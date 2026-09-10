// node --test server/agents-and-store.test.js
// Delegation between agents, the turn transcript, citations, and the
// custom-agent store. AGENTS_FILE is pointed at a scratch file before the
// store is imported so nothing touches data/agents.json.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const scratch = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "agents-test-")), "agents.json");
process.env.AGENTS_FILE = scratch;

const { runAgent } = await import("./agent-loop.js");
const { AGENTS, AGENT_BY_ID } = await import("./agents.js");
const { validateToolSet } = await import("./tools.js");
const store = await import("./agent-store.js");

after(async () => {
  await fs.rm(path.dirname(scratch), { recursive: true, force: true });
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
        if (block.type === "text") {
          fire("text", block.text, block.text);
          for (const c of block.citations || []) fire("citation", c, []);
        } else if (block.type === "tool_use" || block.type === "server_tool_use") {
          fire("streamEvent", { type: "content_block_start", content_block: block }, {});
        }
        fire("contentBlock", block);
      }
      return message;
    },
  };
  return stream;
}

// Routes each request to a scripted turn by the model+first-system-text
// agent name so nested runs (different agents) can be told apart.
function routingClient(script) {
  const requests = [];
  return {
    requests,
    messages: {
      stream(params) {
        requests.push(structuredClone(params));
        const key = Object.keys(script).find((k) => params.system[0].text.startsWith(k));
        const turns = script[key];
        if (!turns?.length) throw new Error(`no scripted turn for ${key}`);
        return fakeStream(turns.shift());
      },
    },
  };
}

const usage = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
const roster = AGENTS.filter((a) => !a.hidden);
const lookups = { getAgent: (id) => roster.find((a) => a.id === id) || null, listAgents: () => roster };

test("chief delegates to a specialist and gets its answer back", async () => {
  const client = routingClient({
    "You are Chief": [
      {
        stop_reason: "tool_use",
        usage,
        content: [
          { type: "tool_use", id: "d1", name: "delegate", input: { agent: "research", task: "Find the launch date." } },
        ],
      },
      { stop_reason: "end_turn", usage, content: [{ type: "text", text: "It launched in 2024." }] },
    ],
    "You are Deep Dive": [
      {
        stop_reason: "tool_use",
        usage,
        content: [{ type: "tool_use", id: "t1", name: "current_time", input: {} }],
      },
      { stop_reason: "end_turn", usage, content: [{ type: "text", text: "Launch date: 2024." }] },
    ],
  });
  const events = [];
  const out = await runAgent({
    client,
    agent: AGENT_BY_ID.get("chief"),
    messages: [{ role: "user", content: "when did it launch?" }],
    emit: (e) => events.push(e),
    ...lookups,
  });
  assert.equal(out.stop_reason, "end_turn");
  // Chief: 2 model turns, Deep Dive: 2 model turns.
  assert.equal(client.requests.length, 4);
  // The roster is in Chief's system prompt so it can pick ids.
  assert.match(client.requests[0].system[0].text, /- research: Deep Dive/);
  assert.doesNotMatch(client.requests[0].system[0].text, /- chief:/);
  // The sub-agent's task is its first user message.
  assert.deepEqual(client.requests[1].messages[0], { role: "user", content: "Find the launch date." });
  // Nested events are tagged with the delegate call id; no nested usage.
  const nested = events.filter((e) => e.parent === "d1");
  assert.ok(nested.some((e) => e.type === "tool_start" && e.name === "current_time"));
  assert.ok(nested.some((e) => e.type === "text"));
  assert.ok(!nested.some((e) => e.type === "usage"));
  // The delegate tool result carries the specialist's text.
  const result = events.find((e) => e.type === "tool_result" && e.id === "d1");
  assert.equal(result.ok, true);
  assert.match(result.summary, /\[Deep Dive answered\]\nLaunch date: 2024\./);
  // Usage folds the sub-run in: 4 turns x 10 input tokens.
  assert.equal(out.usage.input_tokens, 40);
  // Only Chief's own text reaches the top level.
  assert.equal(events.filter((e) => e.type === "text" && !e.parent).map((e) => e.text).join(""), "It launched in 2024.");
});

test("delegation refuses bad targets and a delegated agent cannot delegate again", async () => {
  const client = routingClient({
    "You are Chief": [
      {
        stop_reason: "tool_use",
        usage,
        content: [
          { type: "tool_use", id: "d1", name: "delegate", input: { agent: "nope", task: "x" } },
          { type: "tool_use", id: "d2", name: "delegate", input: { agent: "chief", task: "x" } },
          { type: "tool_use", id: "d3", name: "delegate", input: { agent: "research", task: "  " } },
        ],
      },
      { stop_reason: "end_turn", usage, content: [{ type: "text", text: "ok" }] },
    ],
  });
  const events = [];
  await runAgent({
    client,
    agent: AGENT_BY_ID.get("chief"),
    messages: [{ role: "user", content: "go" }],
    emit: (e) => events.push(e),
    ...lookups,
  });
  const results = events.filter((e) => e.type === "tool_result");
  assert.equal(results.length, 3);
  assert.ok(results.every((r) => r.ok === false));
  assert.match(results.find((r) => r.id === "d1").summary, /unknown agent id/);
  assert.match(results.find((r) => r.id === "d2").summary, /cannot delegate to itself/);
  assert.match(results.find((r) => r.id === "d3").summary, /task is required/);
  // All three errors went back in one user turn.
  assert.equal(client.requests[1].messages[2].content.length, 3);

  // Depth limit: a run already at depth 1 cannot delegate.
  const client2 = routingClient({
    "You are Chief": [
      { stop_reason: "tool_use", usage, content: [{ type: "tool_use", id: "d9", name: "delegate", input: { agent: "research", task: "x" } }] },
      { stop_reason: "end_turn", usage, content: [{ type: "text", text: "ok" }] },
    ],
  });
  const events2 = [];
  await runAgent({ client: client2, agent: AGENT_BY_ID.get("chief"), messages: [{ role: "user", content: "go" }], emit: (e) => events2.push(e), depth: 1, ...lookups });
  assert.match(events2.find((e) => e.type === "tool_result").summary, /delegation limit/);
});

test("the transcript replays a previous turn's tool work", async () => {
  const client = routingClient({
    "You are Eureka": [
      { stop_reason: "tool_use", usage, content: [{ type: "tool_use", id: "t1", name: "current_time", input: {} }] },
      { stop_reason: "end_turn", usage, content: [{ type: "text", text: "Done." }] },
    ],
  });
  const out = await runAgent({
    client,
    agent: AGENT_BY_ID.get("eureka"),
    messages: [{ role: "user", content: "time?" }],
    emit: () => {},
  });
  assert.equal(out.transcript.length, 3);
  assert.equal(out.transcript[0].role, "assistant");
  assert.equal(out.transcript[1].role, "user");
  assert.equal(out.transcript[1].content[0].type, "tool_result");
  assert.equal(out.transcript[2].role, "assistant");

  // Next turn: the client sends the text history expanded with the transcript.
  const client2 = routingClient({
    "You are Eureka": [{ stop_reason: "end_turn", usage, content: [{ type: "text", text: "Still done." }] }],
  });
  await runAgent({
    client: client2,
    agent: AGENT_BY_ID.get("eureka"),
    messages: [{ role: "user", content: "time?" }, ...out.transcript, { role: "user", content: "and now?" }],
    emit: () => {},
  });
  const sent = client2.requests[0].messages;
  assert.equal(sent.length, 5);
  assert.equal(sent[2].content[0].tool_use_id, "t1");
  assert.equal(sent[4].content, "and now?");
});

test("web citations are surfaced as events", async () => {
  const client = routingClient({
    "You are Eureka": [
      {
        stop_reason: "end_turn",
        usage,
        content: [
          {
            type: "text",
            text: "The sky is blue.",
            citations: [
              { type: "web_search_result_location", url: "https://example.com/sky", title: "Sky facts", cited_text: "The sky is blue because", encrypted_index: "x" },
              { type: "char_location", cited_text: "no url here" },
            ],
          },
        ],
      },
    ],
  });
  const events = [];
  await runAgent({ client, agent: AGENT_BY_ID.get("eureka"), messages: [{ role: "user", content: "sky?" }], emit: (e) => events.push(e) });
  const cites = events.filter((e) => e.type === "citation");
  assert.equal(cites.length, 1);
  assert.deepEqual(cites[0], { type: "citation", url: "https://example.com/sky", title: "Sky facts", cited_text: "The sky is blue because" });
});

test("validateToolSet rejects unknown, duplicate, and conflicting tools", () => {
  assert.equal(validateToolSet(["web_search", "current_time"]), null);
  assert.match(validateToolSet(["web_search", "code_execution"]), /cannot be combined/);
  assert.match(validateToolSet(["nope"]), /unknown tool/);
  assert.match(validateToolSet(["recall", "recall"]), /repeat/);
  assert.match(validateToolSet("recall"), /array/);
});

test("custom agents: create, list, get, update, delete, and built-ins stay read-only", async () => {
  const before = await store.listAgents();
  assert.ok(before.every((a) => a.builtin));
  assert.ok(!before.some((a) => a.id === "desk"), "hidden desk agent is not listed");
  assert.ok((await store.getAgent("desk"))?.hidden, "but it is still resolvable");

  const bad = await store.createAgent({ name: "X", system: "s", tools: ["code_execution", "web_search"] });
  assert.match(bad.error, /cannot be combined/);
  assert.match((await store.createAgent({ name: "", system: "s" })).error, /name is required/);
  assert.match((await store.createAgent({ name: "X", system: "s", model: "claude-haiku-4-5-20251001" })).error, /model must be/);
  assert.match((await store.createAgent({ name: "X", system: "s", effort: "turbo" })).error, /effort must be/);

  const made = await store.createAgent({ name: "Poet Bot!", system: "You rhyme.", tools: ["current_time"], emoji: "📜", extra: "dropped" });
  assert.ok(made.agent);
  assert.equal(made.agent.id, "custom-poet-bot");
  assert.equal(made.agent.builtin, false);
  assert.equal(made.agent.model, "claude-opus-5");
  assert.equal(made.agent.effort, "medium");
  assert.equal(made.agent.extra, undefined);

  const dup = await store.createAgent({ name: "Poet Bot", system: "s" });
  assert.equal(dup.agent.id, "custom-poet-bot-2");

  const listed = await store.listAgents();
  assert.equal(listed.filter((a) => !a.builtin).length, 2);
  assert.equal((await store.getAgent("custom-poet-bot")).system, "You rhyme.");

  // Persisted to disk.
  const onDisk = JSON.parse(await fs.readFile(scratch, "utf8"));
  assert.equal(onDisk.length, 2);

  const upd = await store.updateAgent("custom-poet-bot", { tools: ["web_search", "web_fetch"], effort: "high" });
  assert.deepEqual(upd.agent.tools, ["web_search", "web_fetch"]);
  assert.equal(upd.agent.effort, "high");
  assert.equal(upd.agent.system, "You rhyme.", "unspecified fields keep their value");

  assert.equal((await store.updateAgent("eureka", { name: "x" })).status, 403);
  assert.equal((await store.deleteAgent("eureka")).status, 403);
  assert.equal((await store.updateAgent("custom-missing", { name: "x" })).status, 404);

  assert.deepEqual(await store.deleteAgent("custom-poet-bot-2"), { ok: true });
  assert.equal((await store.listAgents()).filter((a) => !a.builtin).length, 1);
  assert.equal(await store.getAgent("custom-poet-bot-2"), null);
});

test("a custom agent runs through the loop like a built-in", async () => {
  const made = await store.createAgent({ name: "Timekeeper", system: "You are Timekeeper. Tell the time.", tools: ["current_time"] });
  const client = routingClient({
    "You are Timekeeper": [
      { stop_reason: "tool_use", usage, content: [{ type: "tool_use", id: "t1", name: "current_time", input: {} }] },
      { stop_reason: "end_turn", usage, content: [{ type: "text", text: "Now." }] },
    ],
  });
  const events = [];
  const out = await runAgent({ client, agent: made.agent, messages: [{ role: "user", content: "time" }], emit: (e) => events.push(e) });
  assert.equal(out.stop_reason, "end_turn");
  assert.equal(events.find((e) => e.type === "tool_result").ok, true);
  assert.deepEqual(client.requests[0].output_config, { effort: "medium" });
  assert.equal(client.requests[0].tools.length, 1);
});
