import { useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

// $/MTok (standard rates)
const MODELS = [
  { id: "claude-opus-5", label: "Claude Opus 5", in: 5, out: 25 },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8", in: 5, out: 25 },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", in: 2, out: 10 },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", in: 1, out: 5 },
];
const EFFORTS = ["low", "medium", "high", "xhigh", "max"];

const STORAGE_KEY = "agentic-os-chat.conversations.v1";
const ACTIVE_KEY = "agentic-os-chat.active.v1";

marked.setOptions({ gfm: true, breaks: true });
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function newConversation(agentId = null) {
  return {
    id: uid(),
    title: "New chat",
    model: MODELS[0].id,
    agentId,
    effort: null,
    systemPrompt: "",
    messages: [],
    usage: { input: 0, output: 0, cost: 0 },
  };
}

function loadConversations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) {
        return list.map((c) => ({ agentId: null, effort: null, ...c }));
      }
    }
  } catch {
    /* corrupted storage — start fresh */
  }
  return [newConversation()];
}

// Streams SSE `data:` lines from a POST and hands each parsed event to onEvent.
async function streamEvents(url, body, { signal, onEvent }) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j.error) msg = j.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop();
    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (line.startsWith("data: ")) onEvent(JSON.parse(line.slice(6)));
      }
    }
  }
}

// Assistant messages are a list of parts so tool activity can sit inline
// with the streamed text: {kind:"text"|"thinking"|"tool", ...}.
function appendPart(msg, kind, text) {
  const parts = msg.parts ? msg.parts.slice() : [];
  const last = parts[parts.length - 1];
  if (last && last.kind === kind) {
    parts[parts.length - 1] = { ...last, text: last.text + text };
  } else {
    parts.push({ kind, text });
  }
  return parts;
}

function Markdown({ text }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text)), [text]);
  return <div className="msg-body md" dangerouslySetInnerHTML={{ __html: html }} />;
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="copy-btn"
      title="Copy message"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}

const TOOL_LABELS = {
  web_search: "Searching the web",
  web_fetch: "Reading a page",
  code_execution: "Running code",
  bash_code_execution: "Running code",
  text_editor_code_execution: "Editing sandbox file",
  current_time: "Checking the time",
  list_files: "Listing repo files",
  read_file: "Reading a file",
  search_files: "Searching the repo",
  github_activity: "Checking GitHub",
  remember: "Saving a memory",
  recall: "Recalling memory",
  forget: "Forgetting a memory",
};

function inputPreview(input) {
  if (!input || typeof input !== "object") return "";
  const v = input.query ?? input.url ?? input.path ?? input.pattern ?? input.note ?? input.kind ?? input.code ?? input.command;
  if (typeof v === "string") return v.length > 120 ? v.slice(0, 120) + "…" : v;
  const keys = Object.keys(input);
  return keys.length ? JSON.stringify(input).slice(0, 120) : "";
}

function ToolCard({ part }) {
  const [open, setOpen] = useState(false);
  const label = TOOL_LABELS[part.name] || part.name;
  const status = !part.done ? "running" : part.ok ? "ok" : "failed";
  return (
    <div className={`tool ${status}`}>
      <button className="tool-head" onClick={() => setOpen((v) => !v)}>
        <span className="tool-dot" />
        <span className="tool-label">{label}</span>
        <span className="tool-preview">{inputPreview(part.input)}</span>
        <span className="tool-toggle">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="tool-detail">
          {part.input && Object.keys(part.input).length > 0 && (
            <pre className="tool-pre">{JSON.stringify(part.input, null, 2)}</pre>
          )}
          {part.results?.length > 0 && (
            <ul className="tool-results">
              {part.results.map((r, i) => (
                <li key={i}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer">
                    {r.title || r.url}
                  </a>
                  {r.age && <span className="tool-age"> · {r.age}</span>}
                </li>
              ))}
            </ul>
          )}
          {part.summary && !part.results?.length && <pre className="tool-pre">{part.summary}</pre>}
          {!part.done && <div className="tool-wait">waiting for result…</div>}
        </div>
      )}
    </div>
  );
}

function ThinkingBlock({ text, live }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="thought">
      <button className="thought-head" onClick={() => setOpen((v) => !v)}>
        {live ? "Thinking…" : "Thought process"} {open ? "▾" : "▸"}
      </button>
      {open && <div className="thought-body">{text}</div>}
    </div>
  );
}

function AssistantBody({ m, live }) {
  if (m.parts?.length) {
    return (
      <>
        {m.parts.map((p, i) =>
          p.kind === "text" ? (
            <Markdown key={i} text={p.text} />
          ) : p.kind === "tool" ? (
            <ToolCard key={i} part={p} />
          ) : (
            <ThinkingBlock key={i} text={p.text} live={live && i === m.parts.length - 1} />
          )
        )}
      </>
    );
  }
  if (m.content) return <Markdown text={m.content} />;
  return null;
}

export default function App() {
  const [conversations, setConversations] = useState(loadConversations);
  const [activeId, setActiveId] = useState(
    () => localStorage.getItem(ACTIVE_KEY) || ""
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showSystem, setShowSystem] = useState(false);
  const [health, setHealth] = useState(null); // null=checking, {ok} or {ok:false,error}
  const [agents, setAgents] = useState([]);
  const [agentModels, setAgentModels] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const abortRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const active =
    conversations.find((c) => c.id === activeId) ?? conversations[0];
  const agent = active?.agentId ? agents.find((a) => a.id === active.agentId) : null;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    if (active) localStorage.setItem(ACTIVE_KEY, active.id);
  }, [active?.id]);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() =>
        setHealth({ ok: false, error: "Backend not reachable on :3001" })
      );
    fetch("/api/agents")
      .then((r) => r.json())
      .then((j) => {
        setAgents(j.agents || []);
        setAgentModels(j.models || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages]);

  function update(id, updater) {
    setConversations((list) =>
      list.map((c) => (c.id === id ? updater(c) : c))
    );
  }

  function updateLast(id, fn) {
    update(id, (c) => {
      const msgs = c.messages.slice();
      const last = msgs[msgs.length - 1];
      if (last?.role === "assistant") msgs[msgs.length - 1] = fn(last);
      return { ...c, messages: msgs };
    });
  }

  function markError(id, message) {
    updateLast(id, (last) => ({ ...last, error: message }));
  }

  function setAgent(id, agentId) {
    update(id, (c) => {
      const a = agents.find((x) => x.id === agentId);
      const next = { ...c, agentId: agentId || null, effort: a ? a.effort : null };
      if (a && !agentModels.includes(c.model)) next.model = a.model;
      return next;
    });
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming || !active) return;
    const conv = active;
    const history = [
      ...conv.messages
        .filter((m) => m.content && m.content.trim() && !m.error)
        .map(({ role, content }) => ({ role, content })),
      { role: "user", content: text },
    ];
    setInput("");
    update(conv.id, (c) => ({
      ...c,
      title:
        c.messages.length === 0 && c.title === "New chat"
          ? text.slice(0, 48)
          : c.title,
      messages: [
        ...c.messages,
        { role: "user", content: text },
        { role: "assistant", content: "", parts: [] },
      ],
    }));
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const model = conv.model;
    const isAgent = !!conv.agentId;
    try {
      await streamEvents(
        isAgent ? "/api/agent" : "/api/chat",
        isAgent
          ? { agentId: conv.agentId, messages: history, model, effort: conv.effort || undefined, systemPrompt: conv.systemPrompt }
          : { messages: history, model, systemPrompt: conv.systemPrompt },
        {
          signal: controller.signal,
          onEvent: (ev) => {
            switch (ev.type) {
              case "text":
                updateLast(conv.id, (last) => ({
                  ...last,
                  content: last.content + ev.text,
                  parts: appendPart(last, "text", ev.text),
                }));
                break;
              case "thinking":
                updateLast(conv.id, (last) => ({ ...last, parts: appendPart(last, "thinking", ev.text) }));
                break;
              case "tool_start":
                updateLast(conv.id, (last) => ({
                  ...last,
                  parts: [...(last.parts || []), { kind: "tool", id: ev.id, name: ev.name, server: ev.server, done: false }],
                }));
                break;
              case "tool_input":
              case "tool_result":
                updateLast(conv.id, (last) => ({
                  ...last,
                  parts: (last.parts || []).map((p) =>
                    p.kind === "tool" && p.id === ev.id
                      ? ev.type === "tool_input"
                        ? { ...p, input: ev.input }
                        : { ...p, done: true, ok: ev.ok, summary: ev.summary, results: ev.results }
                      : p
                  ),
                }));
                break;
              case "usage": {
                const p = MODELS.find((m) => m.id === model) ?? MODELS[0];
                // Agent usage events carry running totals for the turn;
                // plain chat sends one event. Both: replace this turn's share.
                update(conv.id, (c) => {
                  const prev = c.turnUsage || { input: 0, output: 0, cost: 0 };
                  const inTok = ev.input_tokens + (ev.cache_read_input_tokens || 0) + (ev.cache_creation_input_tokens || 0);
                  // Cache reads bill at ~0.1x input, cache writes at ~1.25x.
                  const cost =
                    (ev.input_tokens * p.in +
                      (ev.cache_read_input_tokens || 0) * p.in * 0.1 +
                      (ev.cache_creation_input_tokens || 0) * p.in * 1.25 +
                      ev.output_tokens * p.out) /
                    1e6;
                  return {
                    ...c,
                    turnUsage: { input: inTok, output: ev.output_tokens, cost },
                    usage: {
                      input: c.usage.input - prev.input + inTok,
                      output: c.usage.output - prev.output + ev.output_tokens,
                      cost: c.usage.cost - prev.cost + cost,
                    },
                  };
                });
                break;
              }
              case "error":
                markError(conv.id, ev.message);
                break;
              case "done":
                if (ev.stop_reason === "refusal") markError(conv.id, "The model declined to answer this request.");
                else if (ev.stop_reason === "max_iterations") markError(conv.id, "Stopped after too many tool calls in one turn.");
                else if (ev.stop_reason === "max_tokens") markError(conv.id, "Response hit the output limit.");
                break;
              default:
                break;
            }
          },
        }
      );
    } catch (err) {
      if (err.name !== "AbortError") {
        markError(conv.id, err.message || "Request failed.");
      }
    } finally {
      update(conv.id, (c) => ({ ...c, turnUsage: undefined }));
      updateLast(conv.id, (last) => ({
        ...last,
        parts: (last.parts || []).map((p) => (p.kind === "tool" && !p.done ? { ...p, done: true, ok: false, summary: "no result" } : p)),
      }));
      setStreaming(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  function stop() {
    abortRef.current?.abort();
    if (active) updateLast(active.id, (last) => ({ ...last, stopped: true }));
  }

  function addConversation(agentId = null) {
    const c = newConversation(agentId);
    const a = agentId ? agents.find((x) => x.id === agentId) : null;
    if (a) {
      c.model = a.model;
      c.effort = a.effort;
    }
    setConversations((list) => [c, ...list]);
    setActiveId(c.id);
    setInput("");
  }

  function deleteConversation(id) {
    if (!confirm("Delete this conversation?")) return;
    setConversations((list) => {
      const next = list.filter((c) => c.id !== id);
      return next.length > 0 ? next : [newConversation()];
    });
  }

  function commitTitle(id) {
    const t = editTitle.trim();
    if (t) update(id, (c) => ({ ...c, title: t }));
    setEditingId(null);
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (!active) return null;

  const modelOptions = agent ? MODELS.filter((m) => agentModels.includes(m.id)) : MODELS;
  const agentEmoji = (id) => agents.find((a) => a.id === id)?.emoji || "";

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-head">
          <span className="brand">Agentic OS Chat</span>
          <button className="btn" onClick={() => addConversation()} title="New conversation">
            + New
          </button>
        </div>
        <div className="conv-list">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`conv-item ${c.id === active.id ? "active" : ""}`}
              onClick={() => setActiveId(c.id)}
            >
              {c.agentId && <span className="conv-emoji">{agentEmoji(c.agentId)}</span>}
              {editingId === c.id ? (
                <input
                  className="rename-input"
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitTitle(c.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onBlur={() => commitTitle(c.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="conv-title" title={c.title}>
                  {c.title}
                </span>
              )}
              <span className="conv-actions">
                <button
                  className="icon-btn"
                  title="Rename"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(c.id);
                    setEditTitle(c.title);
                  }}
                >
                  ✎
                </button>
                <button
                  className="icon-btn"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(c.id);
                  }}
                >
                  ×
                </button>
              </span>
            </div>
          ))}
        </div>
        <div className="sidebar-foot">
          <span
            className={`dot ${
              health === null ? "pending" : health.ok ? "ok" : "bad"
            }`}
          />
          <span className="health-text" title={health?.error || ""}>
            {health === null
              ? "checking API key…"
              : health.ok
              ? "API key OK"
              : health.error}
          </span>
        </div>
      </aside>

      <main className="chat">
        <header className="chat-head">
          <select
            className="model-select agent-select"
            value={active.agentId || ""}
            disabled={streaming}
            onChange={(e) => setAgent(active.id, e.target.value)}
            title="Agent"
          >
            <option value="">Plain chat</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.emoji} {a.name}
              </option>
            ))}
          </select>
          <select
            className="model-select"
            value={active.model}
            disabled={streaming}
            onChange={(e) =>
              update(active.id, (c) => ({ ...c, model: e.target.value }))
            }
            title="Model"
          >
            {modelOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          {agent && (
            <select
              className="model-select"
              value={active.effort || agent.effort || "medium"}
              disabled={streaming}
              onChange={(e) => update(active.id, (c) => ({ ...c, effort: e.target.value }))}
              title="Effort: how hard the model thinks and how many tool calls it makes"
            >
              {EFFORTS.map((e) => (
                <option key={e} value={e}>
                  effort: {e}
                </option>
              ))}
            </select>
          )}
          <button
            className={`btn ghost ${showSystem ? "on" : ""}`}
            onClick={() => setShowSystem((v) => !v)}
          >
            {agent ? "Extra instructions" : "System prompt"} {active.systemPrompt.trim() ? "●" : ""}
          </button>
          <span className="spacer" />
          <span className="usage">
            {active.usage.input.toLocaleString()} in ·{" "}
            {active.usage.output.toLocaleString()} out · $
            {active.usage.cost.toFixed(4)}
          </span>
        </header>

        {showSystem && (
          <div className="system-panel">
            <textarea
              className="system-input"
              placeholder={
                agent
                  ? `Extra instructions for ${agent.name} (optional) — appended to the agent's own prompt`
                  : "System prompt (optional) — applied to every request in this conversation"
              }
              value={active.systemPrompt}
              onChange={(e) =>
                update(active.id, (c) => ({
                  ...c,
                  systemPrompt: e.target.value,
                }))
              }
              rows={4}
            />
          </div>
        )}

        <div className="messages">
          {active.messages.length === 0 && (
            <div className="empty">
              {agent ? (
                <>
                  <div className="empty-agent">
                    <span className="empty-emoji">{agent.emoji}</span>
                    <div>
                      <div className="empty-title">{agent.name}</div>
                      <div className="empty-sub">{agent.description}</div>
                      <div className="empty-tools">
                        {agent.tools.map((t) => (
                          <span key={t} className="chip">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="empty-hint">Enter to send, Shift+Enter for a newline.</div>
                </>
              ) : (
                <>
                  <div className="empty-title">Pick an agent, or just chat.</div>
                  <div className="agent-grid">
                    {agents.map((a) => (
                      <button key={a.id} className="agent-card" onClick={() => setAgent(active.id, a.id)}>
                        <span className="agent-card-emoji">{a.emoji}</span>
                        <span className="agent-card-name">{a.name}</span>
                        <span className="agent-card-tag">{a.tagline}</span>
                      </button>
                    ))}
                  </div>
                  <div className="empty-hint">
                    {agents.length ? "Plain chat has no tools. " : health?.ok === false ? "Agents load once the backend is up. " : ""}
                    Enter to send, Shift+Enter for a newline.
                  </div>
                </>
              )}
            </div>
          )}
          {active.messages.map((m, i) => {
            const isLast = i === active.messages.length - 1;
            const live = streaming && isLast;
            return (
              <div key={i} className={`msg ${m.role}`}>
                <div className="msg-meta">
                  <span className="role">
                    {m.role === "user" ? "you" : agent ? `${agent.emoji} ${agent.name}` : "claude"}
                  </span>
                  {m.role === "assistant" && m.content && (
                    <CopyButton text={m.content} />
                  )}
                </div>
                {m.role === "user" ? (
                  <div className="msg-body">{m.content}</div>
                ) : (
                  <AssistantBody m={m} live={live} />
                )}
                {m.role === "assistant" &&
                  !m.content &&
                  !m.parts?.length &&
                  !m.error &&
                  live && <div className="msg-body thinking">…</div>}
                {m.stopped && <div className="msg-note">⏹ stopped</div>}
                {m.error && <div className="msg-error">{m.error}</div>}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="composer">
          <textarea
            ref={inputRef}
            className="input"
            placeholder={agent ? `Message ${agent.name}… (Enter to send, Shift+Enter for newline)` : "Message… (Enter to send, Shift+Enter for newline)"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={Math.min(8, Math.max(1, input.split("\n").length))}
          />
          {streaming ? (
            <button className="btn stop" onClick={stop}>
              ⏹ Stop
            </button>
          ) : (
            <button className="btn send" onClick={send} disabled={!input.trim()}>
              Send
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
