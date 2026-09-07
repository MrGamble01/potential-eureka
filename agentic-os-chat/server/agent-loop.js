// The agentic loop: stream one model turn, run any local tool calls, feed
// the results back, repeat until the model stops asking for tools. Every
// step is reported through `emit(event)` so the HTTP layer can forward it
// as Server-Sent Events while it happens.
//
// Events emitted:
//   { type: "text", text }                          streamed answer text
//   { type: "thinking", text }                      streamed thinking summary
//   { type: "tool_start", id, name, server }        model began a tool call
//   { type: "tool_input", id, name, input }         its arguments, once complete
//   { type: "tool_result", id, name, ok, summary, results? }
//   { type: "usage", ...token counts, iteration }   once per model turn
//   { type: "done", stop_reason, iterations }
//   { type: "error", message }                      (emitted by the caller)

import { resolveTools, executeTool } from "./tools.js";

const MAX_TOKENS = 64000;
const RESULT_PREVIEW = 600;

function summarizeServerResult(block) {
  const c = block.content;
  switch (block.type) {
    case "web_search_tool_result": {
      if (Array.isArray(c)) {
        const results = c
          .filter((r) => r.type === "web_search_result")
          .map((r) => ({ title: r.title, url: r.url, age: r.page_age ?? null }));
        return { name: "web_search", ok: true, summary: `${results.length} result${results.length === 1 ? "" : "s"}`, results };
      }
      return { name: "web_search", ok: false, summary: `search failed: ${c?.error_code || "unknown error"}` };
    }
    case "web_fetch_tool_result": {
      if (c?.type === "web_fetch_result") {
        const title = c.content?.title || c.url;
        return { name: "web_fetch", ok: true, summary: `fetched ${title}`, results: [{ title, url: c.url }] };
      }
      return { name: "web_fetch", ok: false, summary: `fetch failed: ${c?.error_code || "unknown error"}` };
    }
    case "bash_code_execution_tool_result": {
      if (c?.type === "bash_code_execution_result") {
        const out = (c.stdout || "").trim();
        const errText = (c.stderr || "").trim();
        const ok = (c.return_code ?? 0) === 0;
        const preview = (out || errText || "(no output)").slice(0, RESULT_PREVIEW);
        return { name: "code_execution", ok, summary: preview };
      }
      return { name: "code_execution", ok: false, summary: `execution failed: ${c?.error_code || "unknown error"}` };
    }
    case "text_editor_code_execution_tool_result": {
      const ok = c?.type !== "text_editor_code_execution_tool_result_error";
      return { name: "code_execution", ok, summary: ok ? "edited a file in the sandbox" : `editor failed: ${c?.error_code || "unknown error"}` };
    }
    default:
      return null;
  }
}

// Build the per-model request shape. All AGENT_MODELS take adaptive
// thinking + output_config.effort; the summarized display is what lets us
// stream the reasoning to the UI at all (default is omitted / empty).
export function buildParams({ model, effort, system, tools, messages }) {
  return {
    model,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive", display: "summarized" },
    ...(effort ? { output_config: { effort } } : {}),
    system,
    tools,
    messages,
  };
}

export async function runAgent({
  client,
  agent,
  model = agent.model,
  effort = agent.effort,
  systemPrompt = "",
  messages,
  signal,
  emit,
  maxIterations = 12,
}) {
  const { defs, runners } = resolveTools(agent.tools);
  const system = [{ type: "text", text: agent.system, cache_control: { type: "ephemeral" } }];
  if (typeof systemPrompt === "string" && systemPrompt.trim()) {
    system.push({ type: "text", text: systemPrompt.trim() });
  }

  const history = messages.map(({ role, content }) => ({ role, content }));
  const totals = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  let current = null;
  const onAbort = () => current?.abort();
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      if (signal?.aborted) return { stop_reason: "aborted", iterations: iteration - 1, usage: totals };

      const stream = client.messages.stream(
        buildParams({ model, effort, system, tools: defs, messages: history }),
        signal ? { signal } : undefined
      );
      current = stream;

      stream.on("text", (text) => emit({ type: "text", text }));
      stream.on("thinking", (text) => {
        if (text) emit({ type: "thinking", text });
      });
      stream.on("streamEvent", (ev) => {
        if (ev.type !== "content_block_start") return;
        const b = ev.content_block;
        if (b.type === "tool_use" || b.type === "server_tool_use") {
          emit({ type: "tool_start", id: b.id, name: b.name, server: b.type === "server_tool_use" });
        }
      });
      stream.on("contentBlock", (b) => {
        if (b.type === "tool_use" || b.type === "server_tool_use") {
          emit({ type: "tool_input", id: b.id, name: b.name, input: b.input });
          return;
        }
        const s = summarizeServerResult(b);
        if (s) emit({ type: "tool_result", id: b.tool_use_id, ...s });
      });

      const message = await stream.finalMessage();
      current = null;

      const u = message.usage || {};
      for (const k of Object.keys(totals)) totals[k] += u[k] || 0;
      emit({ type: "usage", ...totals, iteration });

      history.push({ role: "assistant", content: message.content });

      if (message.stop_reason === "pause_turn") continue;

      if (message.stop_reason === "tool_use") {
        const calls = message.content.filter((b) => b.type === "tool_use");
        if (!calls.length) {
          // Only server tools ran and the turn is not over: resend as-is.
          continue;
        }
        // Run every call concurrently and return all results in one user turn.
        const results = await Promise.all(calls.map((b) => executeTool(runners, b)));
        results.forEach((r, i) => {
          emit({
            type: "tool_result",
            id: r.tool_use_id,
            name: calls[i].name,
            ok: !r.is_error,
            summary: String(r.content).slice(0, RESULT_PREVIEW),
          });
        });
        history.push({ role: "user", content: results });
        continue;
      }

      return { stop_reason: message.stop_reason, iterations: iteration, usage: totals, stop_details: message.stop_details ?? null };
    }
    return { stop_reason: "max_iterations", iterations: maxIterations, usage: totals };
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}
