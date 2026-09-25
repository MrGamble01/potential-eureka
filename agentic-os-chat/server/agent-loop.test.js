// node --test server/agent-loop.test.js
// Drives runAgent with a fake Anthropic client that replays scripted turns,
// so the tool round-trip, event stream, pause_turn, and abort paths are all
// exercised without a key or network.

import { test } from "node:test";
import assert from "node:assert/strict";
import { runAgent } from "./agent-loop.js";
import { AGENT_BY_ID } from "./agents.js";
import { safeRepoPath, LOCAL_TOOLS } from "./tools.js";

// A MessageStream stand-in: emits the same events the SDK does, then
// resolves finalMessage() with the scripted message.
function fakeStream(message, { onParams } = {}) {
  const handlers = {};
  const stream = {
    on(ev, fn) {
      (handlers[ev] ||= []).push(fn);
      return stream;
    },
    abort() {
      stream.aborted = true;
    },
    async finalMessage() {
      const fire = (ev, ...args) => (handlers[ev] || []).forEach((fn) => fn(...args));
      for (const block of message.content) {
        if (block.type === "text") {
          for (const ch of block.text.match(/.{1,5}/gs) || []) fire("text", ch, "");
        } else if (block.type === "thinking") {
          fire("thinking", block.thinking, "");
        } else if (block.type === "tool_use" || block.type === "server_tool_use") {
          fire("streamEvent", { type: "content_block_start", content_block: block }, {});
        }
        fire("contentBlock", block);
      }
      return message;
    },
  };
  onParams?.();
  return stream;
}

function fakeClient(turns) {
  const requests = [];
  return {
    requests,
    messages: {
      stream(params) {
        requests.push(structuredClone(params)); // snapshot: the loop mutates history in place
        const next = turns.shift();
        if (!next) throw new Error("fake client ran out of scripted turns");
        return fakeStream(next);
      },
    },
  };
}

const usage = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };

test("runs a local tool, feeds the result back, and finishes", async () => {
  const client = fakeClient([
    {
      stop_reason: "tool_use",
      usage,
      content: [
        { type: "thinking", thinking: "I should check the time." },
        { type: "text", text: "Let me check." },
        { type: "tool_use", id: "t1", name: "current_time", input: {} },
      ],
    },
    {
      stop_reason: "end_turn",
      usage,
      content: [{ type: "text", text: "It is now." }],
    },
  ]);
  const events = [];
  const out = await runAgent({
    client,
    agent: AGENT_BY_ID.get("eureka"),
    messages: [{ role: "user", content: "what time is it?" }],
    emit: (e) => events.push(e),
  });

  assert.equal(out.stop_reason, "end_turn");
  assert.equal(out.iterations, 2);
  assert.equal(out.usage.input_tokens, 20);

  const types = events.map((e) => e.type);
  assert.ok(types.includes("thinking"));
  assert.ok(types.includes("tool_start"));
  assert.ok(types.includes("tool_input"));
  const result = events.find((e) => e.type === "tool_result");
  assert.equal(result.id, "t1");
  assert.equal(result.ok, true);
  assert.match(result.summary, /UTC/);
  assert.equal(events.filter((e) => e.type === "usage").length, 2);
  assert.equal(events.filter((e) => e.type === "text").map((e) => e.text).join(""), "Let me check.It is now.");

  // Second request carries the assistant turn and the tool_result.
  const second = client.requests[1];
  assert.equal(second.messages.length, 3);
  assert.equal(second.messages[1].role, "assistant");
  assert.equal(second.messages[2].role, "user");
  assert.equal(second.messages[2].content[0].type, "tool_result");
  assert.equal(second.messages[2].content[0].tool_use_id, "t1");

  // Request shape: adaptive thinking, effort, cached system prompt, tools.
  assert.deepEqual(second.thinking, { type: "adaptive", display: "summarized" });
  assert.deepEqual(second.output_config, { effort: "medium" });
  assert.equal(second.system[0].cache_control.type, "ephemeral");
  assert.ok(second.tools.some((t) => t.type === "web_search_20260209"));
  assert.ok(second.tools.some((t) => t.name === "remember"));
});

test("reports a failing tool as is_error and keeps going", async () => {
  const client = fakeClient([
    {
      stop_reason: "tool_use",
      usage,
      content: [{ type: "tool_use", id: "t1", name: "read_file", input: { path: "../../etc/passwd" } }],
    },
    { stop_reason: "end_turn", usage, content: [{ type: "text", text: "Can't do that." }] },
  ]);
  const events = [];
  const out = await runAgent({
    client,
    agent: AGENT_BY_ID.get("repo"),
    messages: [{ role: "user", content: "read /etc/passwd" }],
    emit: (e) => events.push(e),
  });
  assert.equal(out.stop_reason, "end_turn");
  const result = events.find((e) => e.type === "tool_result");
  assert.equal(result.ok, false);
  assert.match(result.summary, /escapes the repository/);
  assert.equal(client.requests[1].messages[2].content[0].is_error, true);
});

test("resumes on pause_turn and summarizes server tool results", async () => {
  const client = fakeClient([
    {
      stop_reason: "pause_turn",
      usage,
      content: [
        { type: "server_tool_use", id: "s1", name: "web_search", input: { query: "eureka games" } },
        {
          type: "web_search_tool_result",
          tool_use_id: "s1",
          content: [
            { type: "web_search_result", title: "Eureka Games", url: "https://example.com", page_age: null, encrypted_content: "x" },
          ],
        },
      ],
    },
    { stop_reason: "end_turn", usage, content: [{ type: "text", text: "Found it." }] },
  ]);
  const events = [];
  const out = await runAgent({
    client,
    agent: AGENT_BY_ID.get("research"),
    messages: [{ role: "user", content: "search" }],
    emit: (e) => events.push(e),
  });
  assert.equal(out.stop_reason, "end_turn");
  assert.equal(client.requests.length, 2);
  assert.equal(client.requests[1].messages[1].role, "assistant");
  const start = events.find((e) => e.type === "tool_start");
  assert.equal(start.server, true);
  const result = events.find((e) => e.type === "tool_result");
  assert.equal(result.name, "web_search");
  assert.deepEqual(result.results, [{ title: "Eureka Games", url: "https://example.com", age: null }]);
});

test("stops at maxIterations instead of looping forever", async () => {
  const turn = () => ({
    stop_reason: "tool_use",
    usage,
    content: [{ type: "tool_use", id: "t", name: "current_time", input: {} }],
  });
  const client = fakeClient([turn(), turn(), turn(), turn()]);
  const out = await runAgent({
    client,
    agent: AGENT_BY_ID.get("eureka"),
    messages: [{ role: "user", content: "loop" }],
    emit: () => {},
    maxIterations: 3,
  });
  assert.equal(out.stop_reason, "max_iterations");
  assert.equal(client.requests.length, 3);
});

test("an aborted signal stops before the next model call", async () => {
  const controller = new AbortController();
  const client = fakeClient([
    {
      stop_reason: "tool_use",
      usage,
      content: [{ type: "tool_use", id: "t1", name: "current_time", input: {} }],
    },
  ]);
  const out = await runAgent({
    client,
    agent: AGENT_BY_ID.get("eureka"),
    messages: [{ role: "user", content: "hi" }],
    signal: controller.signal,
    emit: (e) => {
      if (e.type === "tool_result") controller.abort();
    },
  });
  assert.equal(out.stop_reason, "aborted");
  assert.equal(client.requests.length, 1);
});

test("system prompt override is appended after the agent prompt", async () => {
  const client = fakeClient([{ stop_reason: "end_turn", usage, content: [{ type: "text", text: "ok" }] }]);
  await runAgent({
    client,
    agent: AGENT_BY_ID.get("desk"),
    systemPrompt: "You are FORGE.",
    messages: [{ role: "user", content: "hi" }],
    emit: () => {},
  });
  const sys = client.requests[0].system;
  assert.equal(sys.length, 2);
  assert.equal(sys[1].text, "You are FORGE.");
});

test("repo tools stay inside the repo and away from dotfiles", async () => {
  assert.throws(() => safeRepoPath("../outside"), /escapes/);
  assert.throws(() => safeRepoPath("agentic-os-chat/.env"), /dotfiles/);
  assert.throws(() => safeRepoPath("agentic-os-chat/server/node_modules/x"), /not browsable/);
  assert.equal(safeRepoPath("/README.md").rel, "README.md");

  const listing = await LOCAL_TOOLS.list_files.run({ path: "agentic-os-chat", depth: 0 });
  assert.match(listing, /server\//);
  assert.doesNotMatch(listing, /\.env/);

  const file = await LOCAL_TOOLS.read_file.run({ path: "agentic-os-chat/package.json", max_lines: 3 });
  assert.match(file, /^agentic-os-chat\/package.json \(lines 1-3/);
  assert.match(file, /2: {3}"name"/);

  const hits = await LOCAL_TOOLS.search_files.run({ pattern: "AGENT_MODELS", path: "agentic-os-chat/server" });
  assert.match(hits, /agents\.js:\d+:/);
});
