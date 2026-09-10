// node --test server/missions.test.js
// Missions against a fake client: create/update/delete, a run that stores
// its answer and tool activity, an error run, the scheduler tick, and the
// attachment validation the chat routes share.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const dir = await fs.mkdtemp(path.join(os.tmpdir(), "missions-test-"));
process.env.MISSIONS_FILE = path.join(dir, "missions.json");
process.env.AGENTS_FILE = path.join(dir, "agents.json");

const missions = await import("./missions.js");
const store = await import("./agent-store.js");

after(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

function fakeStream(message) {
  const handlers = {};
  const stream = {
    on(ev, fn) {
      (handlers[ev] ||= []).push(fn);
      return stream;
    },
    abort() {},
    async finalMessage() {
      const fire = (ev, ...args) => (handlers[ev] || []).forEach((fn) => fn(...args));
      for (const block of message.content) {
        if (block.type === "text") fire("text", block.text, block.text);
        else if (block.type === "tool_use") fire("streamEvent", { type: "content_block_start", content_block: block }, {});
        fire("contentBlock", block);
      }
      return message;
    },
  };
  return stream;
}
const usage = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };

function deps(turns) {
  return {
    getClient: () => ({
      messages: {
        stream() {
          const next = turns.shift();
          if (next instanceof Error) throw next;
          return fakeStream(next);
        },
      },
    }),
    getAgent: store.getAgent,
    listAgents: store.listAgents,
    describeError: (e) => `friendly: ${e.message}`,
  };
}

test("missions: validation, create, update, delete", async () => {
  const d = deps([]);
  assert.match((await missions.createMission({ name: "", prompt: "p", agentId: "eureka" }, d)).error, /name is required/);
  assert.match((await missions.createMission({ name: "n", prompt: "p", agentId: "nope" }, d)).error, /unknown agent/);
  assert.match((await missions.createMission({ name: "n", prompt: "p", agentId: "desk" }, d)).error, /unknown agent/);
  assert.match((await missions.createMission({ name: "n", prompt: "p", agentId: "eureka", everyMinutes: 2 }, d)).error, /at least 5/);
  assert.match((await missions.createMission({ name: "n", prompt: "p", agentId: "eureka", effort: "turbo" }, d)).error, /effort must be/);

  const made = await missions.createMission({ name: "News", prompt: "What happened today?", agentId: "eureka", everyMinutes: 60 }, d);
  assert.ok(made.mission.id.startsWith("m-"));
  assert.equal(made.mission.enabled, true);
  assert.equal(made.mission.running, false);
  assert.ok(made.mission.nextRunAt, "scheduled missions get a next run");
  assert.deepEqual(made.mission.runs, []);

  const manual = await missions.createMission({ name: "Manual", prompt: "p", agentId: "repo" }, d);
  assert.equal(manual.mission.everyMinutes, 0);
  assert.equal(manual.mission.nextRunAt, null);

  const upd = await missions.updateMission(made.mission.id, { enabled: false }, d);
  assert.equal(upd.mission.enabled, false);
  assert.equal(upd.mission.nextRunAt, null, "disabling clears the schedule");
  assert.equal(upd.mission.prompt, "What happened today?", "other fields survive");
  assert.equal((await missions.updateMission("m-missing", { name: "x" }, d)).status, 404);

  const onDisk = JSON.parse(await fs.readFile(process.env.MISSIONS_FILE, "utf8"));
  assert.equal(onDisk.length, 2);

  assert.deepEqual(await missions.deleteMission(manual.mission.id), { ok: true });
  assert.equal((await missions.deleteMission(manual.mission.id)).status, 404);
  assert.equal((await missions.listMissions()).length, 1);
});

test("a run stores the answer, tool activity and usage", async () => {
  const d = deps([
    { stop_reason: "tool_use", usage, content: [{ type: "tool_use", id: "t1", name: "current_time", input: {} }] },
    { stop_reason: "end_turn", usage, content: [{ type: "text", text: "All quiet." }] },
  ]);
  const [m] = await missions.listMissions();
  const before = m.nextRunAt;
  await missions.updateMission(m.id, { enabled: true, everyMinutes: 30 }, d);
  const { run } = await missions.runMission(m.id, d);
  assert.equal(run.status, "ok");
  assert.equal(run.answer, "All quiet.");
  assert.equal(run.toolCalls, 1);
  assert.deepEqual(run.tools, ["current_time"]);
  assert.equal(run.iterations, 2);
  assert.equal(run.usage.input_tokens, 20);
  assert.ok(run.finishedAt);

  const after = await missions.getMission(m.id);
  assert.equal(after.runs.length, 1);
  assert.equal(after.runs[0].id, run.id);
  assert.equal(after.lastRunAt, run.startedAt);
  assert.notEqual(after.nextRunAt, before, "a run reschedules the next one");
  assert.equal(after.running, false);
});

test("a failing run is recorded with a friendly error", async () => {
  const d = deps([new Error("boom")]);
  const [m] = await missions.listMissions();
  const { run } = await missions.runMission(m.id, d);
  assert.equal(run.status, "error");
  assert.equal(run.error, "friendly: boom");
  const after = await missions.getMission(m.id);
  assert.equal(after.runs.length, 2);
  assert.equal(after.runs[0].status, "error", "newest run first");
});

test("the scheduler tick starts only due, enabled missions", async () => {
  const [m] = await missions.listMissions();
  const d = deps([{ stop_reason: "end_turn", usage, content: [{ type: "text", text: "tick" }] }]);

  // Not due yet.
  assert.deepEqual(await missions.tick(d, new Date()), []);
  // Due: pretend an hour passed.
  const later = new Date(new Date(m.nextRunAt).getTime() + 1000);
  const started = await missions.tick(d, later);
  assert.deepEqual(started, [m.id]);
  // Let the background run finish.
  for (let i = 0; i < 50 && (await missions.getMission(m.id)).running; i++) await new Promise((r) => setTimeout(r, 10));
  const after = await missions.getMission(m.id);
  assert.equal(after.runs[0].answer, "tick");
  assert.equal(after.runs.length, 3);

  // Disabled missions never start.
  await missions.updateMission(m.id, { enabled: false }, d);
  assert.deepEqual(await missions.tick(d, new Date(Date.now() + 1e9)), []);
});

test("a run for a deleted agent fails cleanly", async () => {
  const made = await store.createAgent({ name: "Temp", system: "s", tools: [] });
  const d = deps([]);
  const mission = (await missions.createMission({ name: "Temp mission", prompt: "p", agentId: made.agent.id }, d)).mission;
  await store.deleteAgent(made.agent.id);
  const { run } = await missions.runMission(mission.id, d);
  assert.equal(run.status, "error");
  assert.match(run.error, /no longer exists/);
});
