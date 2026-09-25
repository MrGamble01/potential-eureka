// Custom agents: the ones you make in the app. Stored as JSON in
// data/agents.json (gitignored) next to the memory notes. Built-in agents
// from agents.js are read-only; the store merges both into one roster.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AGENTS, AGENT_MODELS } from "./agents.js";
import { validateToolSet } from "./tools.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
// Tests point this at a scratch file via AGENTS_FILE.
const AGENTS_FILE = process.env.AGENTS_FILE || path.join(DATA_DIR, "agents.json");

export const EFFORTS = ["low", "medium", "high", "xhigh", "max"];
const LIMITS = { name: 40, emoji: 8, tagline: 120, description: 400, system: 20_000 };
const MAX_CUSTOM = 50;

let custom = null; // lazily loaded cache of the JSON file

async function load() {
  if (custom) return custom;
  try {
    const list = JSON.parse(await fs.readFile(AGENTS_FILE, "utf8"));
    custom = Array.isArray(list) ? list.filter((a) => a && typeof a.id === "string") : [];
  } catch {
    custom = [];
  }
  return custom;
}

async function save() {
  await fs.mkdir(path.dirname(AGENTS_FILE), { recursive: true });
  await fs.writeFile(AGENTS_FILE, JSON.stringify(custom, null, 2));
}

function slug(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "agent"
  );
}

// Returns { agent } or { error }. Unknown fields are dropped.
export function normalizeAgent(input, { existing } = {}) {
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
  for (const [k, required] of [["name", true], ["emoji", false], ["tagline", false], ["description", false], ["system", true]]) {
    const r = str(k, required);
    if (r.error) return r;
    out[k] = r.value;
  }
  out.emoji = out.emoji || "🤖";

  const model = input.model ?? existing?.model ?? AGENT_MODELS[0];
  if (!AGENT_MODELS.includes(model)) return { error: `model must be one of: ${AGENT_MODELS.join(", ")}` };
  out.model = model;

  const effort = input.effort ?? existing?.effort ?? "medium";
  if (!EFFORTS.includes(effort)) return { error: `effort must be one of: ${EFFORTS.join(", ")}` };
  out.effort = effort;

  const tools = input.tools ?? existing?.tools ?? [];
  const toolErr = validateToolSet(tools);
  if (toolErr) return { error: toolErr };
  out.tools = tools.slice();

  return { agent: out };
}

export async function listAgents({ includeHidden = false } = {}) {
  const list = await load();
  const builtins = AGENTS.filter((a) => includeHidden || !a.hidden).map((a) => ({ ...a, builtin: true }));
  return [...builtins, ...list.map((a) => ({ ...a, builtin: false }))];
}

export async function getAgent(id) {
  const b = AGENTS.find((a) => a.id === id);
  if (b) return { ...b, builtin: true };
  const list = await load();
  const c = list.find((a) => a.id === id);
  return c ? { ...c, builtin: false } : null;
}

export async function createAgent(input) {
  const list = await load();
  if (list.length >= MAX_CUSTOM) return { error: `at most ${MAX_CUSTOM} custom agents` };
  const r = normalizeAgent(input);
  if (r.error) return r;
  let id = `custom-${slug(r.agent.name)}`;
  const taken = new Set([...AGENTS.map((a) => a.id), ...list.map((a) => a.id)]);
  for (let n = 2; taken.has(id); n++) id = `custom-${slug(r.agent.name)}-${n}`;
  const agent = { id, ...r.agent, createdAt: new Date().toISOString() };
  list.push(agent);
  await save();
  return { agent: { ...agent, builtin: false } };
}

export async function updateAgent(id, input) {
  if (AGENTS.some((a) => a.id === id)) return { error: "built-in agents are read-only; duplicate it to edit a copy", status: 403 };
  const list = await load();
  const i = list.findIndex((a) => a.id === id);
  if (i < 0) return { error: `no custom agent with id ${id}`, status: 404 };
  const r = normalizeAgent(input, { existing: list[i] });
  if (r.error) return r;
  list[i] = { ...list[i], ...r.agent, updatedAt: new Date().toISOString() };
  await save();
  return { agent: { ...list[i], builtin: false } };
}

export async function deleteAgent(id) {
  if (AGENTS.some((a) => a.id === id)) return { error: "built-in agents cannot be deleted", status: 403 };
  const list = await load();
  const i = list.findIndex((a) => a.id === id);
  if (i < 0) return { error: `no custom agent with id ${id}`, status: 404 };
  list.splice(i, 1);
  await save();
  return { ok: true };
}

// Public shape for the client. Built-in system prompts are included so
// "duplicate" can prefill the editor with them.
export function publicShape(a) {
  const { id, name, emoji, tagline, description, model, effort, tools, system, builtin, createdAt, updatedAt } = a;
  return { id, name, emoji, tagline, description, model, effort, tools, system, builtin, createdAt, updatedAt };
}
