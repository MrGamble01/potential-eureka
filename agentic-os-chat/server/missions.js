// Missions: agents that run on their own. A mission is an agent + a prompt,
// run every N minutes (or only on demand). Each run happens in the
// background with no browser attached; the final answer, tool activity and
// usage are stored so the Missions panel can show what the agent did.
// Stored in data/missions.json (gitignored).

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAgent } from "./agent-loop.js";
import { AGENT_MODELS } from "./agents.js";
import { EFFORTS } from "./agent-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MISSIONS_FILE = process.env.MISSIONS_FILE || path.join(__dirname, "..", "data", "missions.json");

const LIMITS = { name: 60, prompt: 20_000 };
const MAX_MISSIONS = 30;
const KEEP_RUNS = 20;
const MIN_MINUTES = 5;
const MAX_MINUTES = 60 * 24 * 7;
const RUN_TIMEOUT_MS = 10 * 60 * 1000;
const ANSWER_LIMIT = 40_000;

let missions = null;
const running = new Map(); // mission id -> AbortController

async function load() {
  if (missions) return missions;
  try {
    const list = JSON.parse(await fs.readFile(MISSIONS_FILE, "utf8"));
    missions = Array.isArray(list) ? list.filter((m) => m && typeof m.id === "string") : [];
  } catch {
    missions = [];
  }
  // A process that died mid-run leaves a "running" record behind.
  for (const m of missions) {
    for (const r of m.runs || []) {
      if (r.status === "running") {
        r.status = "error";
        r.error = "interrupted: the server restarted during this run";
        r.finishedAt = r.finishedAt || new Date().toISOString();
      }
    }
  }
  return missions;
}

async function save() {
  await fs.mkdir(path.dirname(MISSIONS_FILE), { recursive: true });
  await fs.writeFile(MISSIONS_FILE, JSON.stringify(missions, null, 2));
}

function uid() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
}

function nextRunFrom(from, everyMinutes) {
  return everyMinutes > 0 ? new Date(from.getTime() + everyMinutes * 60_000).toISOString() : null;
}

// Returns { fields } or { error }.
export async function normalizeMission(input, { existing, getAgent } = {}) {
  if (!input || typeof input !== "object") return { error: "body must be an object" };
  const str = (k, required) => {
    const v = input[k] ?? existing?.[k] ?? "";
    if (typeof v !== "string") return { error: `${k} must be a string` };
    const t = v.trim();
    if (required && !t) return { error: `${k} is required` };
    if (t.length > LIMITS[k]) return { error: `${k} is too long (max ${LIMITS[k]} characters)` };
    return { value: t };
  };
  const out = {};
  for (const [k, required] of [["name", true], ["prompt", true]]) {
    const r = str(k, required);
    if (r.error) return r;
    out[k] = r.value;
  }
  const agentId = input.agentId ?? existing?.agentId;
  if (typeof agentId !== "string" || !agentId) return { error: "agentId is required" };
  const agent = await getAgent?.(agentId);
  if (!agent || agent.hidden) return { error: `unknown agent: ${agentId}` };
  out.agentId = agentId;

  let every = input.everyMinutes ?? existing?.everyMinutes ?? 0;
  every = Number(every);
  if (!Number.isFinite(every) || every < 0) return { error: "everyMinutes must be a number (0 = run only on demand)" };
  every = Math.round(every);
  if (every > 0 && every < MIN_MINUTES) return { error: `everyMinutes must be at least ${MIN_MINUTES}` };
  if (every > MAX_MINUTES) return { error: `everyMinutes must be at most ${MAX_MINUTES} (one week)` };
  out.everyMinutes = every;

  const enabled = input.enabled ?? existing?.enabled ?? true;
  if (typeof enabled !== "boolean") return { error: "enabled must be true or false" };
  out.enabled = enabled;

  const model = input.model ?? existing?.model ?? null;
  if (model != null && !AGENT_MODELS.includes(model)) return { error: `model must be one of: ${AGENT_MODELS.join(", ")}` };
  out.model = model;

  const effort = input.effort ?? existing?.effort ?? null;
  if (effort != null && !EFFORTS.includes(effort)) return { error: `effort must be one of: ${EFFORTS.join(", ")}` };
  out.effort = effort;

  return { fields: out };
}

export function publicMission(m) {
  return { ...m, running: running.has(m.id), runs: (m.runs || []).slice() };
}

export async function listMissions() {
  return (await load()).map(publicMission);
}

export async function getMission(id) {
  const m = (await load()).find((x) => x.id === id);
  return m ? publicMission(m) : null;
}

export async function createMission(input, { getAgent }) {
  const list = await load();
  if (list.length >= MAX_MISSIONS) return { error: `at most ${MAX_MISSIONS} missions` };
  const r = await normalizeMission(input, { getAgent });
  if (r.error) return r;
  const now = new Date();
  const mission = {
    id: `m-${uid()}`,
    ...r.fields,
    createdAt: now.toISOString(),
    lastRunAt: null,
    nextRunAt: r.fields.enabled ? nextRunFrom(now, r.fields.everyMinutes) : null,
    runs: [],
  };
  list.push(mission);
  await save();
  return { mission: publicMission(mission) };
}

export async function updateMission(id, input, { getAgent }) {
  const list = await load();
  const m = list.find((x) => x.id === id);
  if (!m) return { error: `no mission with id ${id}`, status: 404 };
  const r = await normalizeMission(input, { existing: m, getAgent });
  if (r.error) return r;
  const scheduleChanged = r.fields.everyMinutes !== m.everyMinutes || r.fields.enabled !== m.enabled;
  Object.assign(m, r.fields, { updatedAt: new Date().toISOString() });
  if (scheduleChanged) m.nextRunAt = m.enabled ? nextRunFrom(new Date(), m.everyMinutes) : null;
  await save();
  return { mission: publicMission(m) };
}

export async function deleteMission(id) {
  const list = await load();
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return { error: `no mission with id ${id}`, status: 404 };
  running.get(id)?.abort();
  list.splice(i, 1);
  await save();
  return { ok: true };
}

// Runs one mission now. Resolves when the run is stored. `deps` supplies the
// Anthropic client and the agent roster so this stays testable.
export async function runMission(id, deps) {
  const list = await load();
  const m = list.find((x) => x.id === id);
  if (!m) return { error: `no mission with id ${id}`, status: 404 };
  if (running.has(id)) return { error: "this mission is already running", status: 409 };

  const agent = await deps.getAgent(m.agentId);
  if (!agent) {
    const run = finished({ id: `r-${uid()}`, startedAt: new Date().toISOString() }, { status: "error", error: `agent ${m.agentId} no longer exists` });
    pushRun(m, run);
    await save();
    return { run };
  }

  const controller = new AbortController();
  running.set(id, controller);
  const timer = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS);
  const run = { id: `r-${uid()}`, startedAt: new Date().toISOString(), status: "running", answer: "", toolCalls: 0, tools: [], sources: [] };
  pushRun(m, run);
  m.lastRunAt = run.startedAt;
  m.nextRunAt = m.enabled ? nextRunFrom(new Date(), m.everyMinutes) : null;
  await save();

  let answer = "";
  let toolCalls = 0;
  const tools = [];
  const sources = [];
  try {
    const client = deps.getClient();
    const roster = await deps.listAgents();
    const out = await runAgent({
      client,
      agent,
      model: m.model || agent.model,
      effort: m.effort || agent.effort,
      messages: [{ role: "user", content: m.prompt }],
      signal: controller.signal,
      getAgent: (aid) => roster.find((a) => a.id === aid) || null,
      listAgents: () => roster,
      emit: (e) => {
        if (e.type === "text" && !e.parent) answer += e.text;
        if (e.type === "tool_start") {
          toolCalls++;
          if (tools.length < 40) tools.push(e.parent ? `${e.name} (delegated)` : e.name);
        }
        if (e.type === "citation" && !sources.some((s) => s.url === e.url)) sources.push({ url: e.url, title: e.title });
      },
    });
    const status = out.stop_reason === "end_turn" ? "ok" : out.stop_reason === "aborted" ? "error" : "ok";
    finished(run, {
      status,
      answer: answer.slice(0, ANSWER_LIMIT),
      toolCalls,
      tools,
      sources,
      stop_reason: out.stop_reason,
      iterations: out.iterations,
      usage: out.usage,
      error: out.stop_reason === "aborted" ? "cancelled or timed out" : out.stop_reason === "refusal" ? "the model declined the task" : undefined,
    });
  } catch (err) {
    finished(run, {
      status: "error",
      answer: answer.slice(0, ANSWER_LIMIT),
      toolCalls,
      tools,
      sources,
      error: deps.describeError ? deps.describeError(err) : err?.message || String(err),
    });
  } finally {
    clearTimeout(timer);
    running.delete(id);
    await save();
  }
  return { run };
}

function pushRun(m, run) {
  m.runs = [run, ...(m.runs || [])].slice(0, KEEP_RUNS);
}

function finished(run, fields) {
  Object.assign(run, fields, { finishedAt: new Date().toISOString() });
  return run;
}

// One scheduler pass: start every enabled, due, not-running mission.
// Returns the ids it started (runs happen in the background).
export async function tick(deps, now = new Date()) {
  const list = await load();
  const started = [];
  for (const m of list) {
    if (!m.enabled || !m.everyMinutes || running.has(m.id)) continue;
    if (!m.nextRunAt) {
      m.nextRunAt = nextRunFrom(now, m.everyMinutes);
      continue;
    }
    if (new Date(m.nextRunAt) <= now) {
      started.push(m.id);
      runMission(m.id, deps).catch(() => {});
    }
  }
  if (started.length === 0) await save().catch(() => {});
  return started;
}

export function startScheduler(deps, { intervalMs = 30_000 } = {}) {
  const timer = setInterval(() => tick(deps).catch((e) => console.error("mission scheduler:", e.message)), intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

export function cancelMission(id) {
  const c = running.get(id);
  if (!c) return false;
  c.abort();
  return true;
}
