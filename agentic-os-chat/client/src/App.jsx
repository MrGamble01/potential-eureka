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
const DEFAULT_EFFORTS = ["low", "medium", "high", "xhigh", "max"];

const STORAGE_KEY = "agentic-os-chat.conversations.v1";
const ACTIVE_KEY = "agentic-os-chat.active.v1";
// A turn's transcript (assistant blocks + tool results) is kept so the agent
// remembers its tool work next turn. Web results carry encrypted payloads,
// so cap what one message may hold and what the whole store may grow to.
const MAX_RAW_CHARS = 300_000;
const MAX_STORE_CHARS = 4_000_000;

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

function stripRaw(list, keepId) {
  return list.map((c) =>
    c.id === keepId ? c : { ...c, messages: c.messages.map((m) => (m.raw ? { ...m, raw: undefined, rawDropped: true } : m)) }
  );
}

// Persist, shedding transcripts (oldest conversations first) if the store
// outgrows localStorage.
function persist(list, activeId) {
  let candidate = list;
  let json = JSON.stringify(candidate);
  if (json.length > MAX_STORE_CHARS) {
    candidate = stripRaw(candidate, activeId);
    json = JSON.stringify(candidate);
  }
  try {
    localStorage.setItem(STORAGE_KEY, json);
  } catch {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stripRaw(candidate, null)));
    } catch {
      /* storage unavailable */
    }
  }
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

async function api(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  try {
    j = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) throw new Error(j?.error || `Request failed (${res.status})`);
  return j;
}

// Assistant messages are a list of parts so tool activity can sit inline
// with the streamed text: {kind:"text"|"thinking"|"tool", ...}. A delegate
// tool part carries the sub-agent's own parts in `sub`.
function appendPart(parts, kind, text) {
  const next = parts.slice();
  const last = next[next.length - 1];
  if (last && last.kind === kind) {
    next[next.length - 1] = { ...last, text: last.text + text };
  } else {
    next.push({ kind, text });
  }
  return next;
}

function applyEvent(parts, ev) {
  if (ev.parent) {
    const inner = { ...ev, parent: undefined };
    return parts.map((p) => (p.kind === "tool" && p.id === ev.parent ? { ...p, sub: applyEvent(p.sub || [], inner) } : p));
  }
  switch (ev.type) {
    case "text":
      return appendPart(parts, "text", ev.text);
    case "thinking":
      return appendPart(parts, "thinking", ev.text);
    case "tool_start":
      return [...parts, { kind: "tool", id: ev.id, name: ev.name, server: ev.server, done: false, sub: [] }];
    case "tool_input":
      return parts.map((p) => (p.kind === "tool" && p.id === ev.id ? { ...p, input: ev.input } : p));
    case "tool_result":
      return parts.map((p) =>
        p.kind === "tool" && p.id === ev.id ? { ...p, done: true, ok: ev.ok, summary: ev.summary, results: ev.results } : p
      );
    default:
      return parts;
  }
}

function closeOpenTools(parts) {
  return parts.map((p) => {
    if (p.kind !== "tool") return p;
    const next = p.sub?.length ? { ...p, sub: closeOpenTools(p.sub) } : p;
    return next.done ? next : { ...next, done: true, ok: false, summary: "no result" };
  });
}

// The history the API sees: user text, and for assistant turns the stored
// transcript when we have it (tool memory), else just the text.
function buildHistory(messages, text) {
  const h = [];
  for (const m of messages) {
    if (m.error || !m.content || !m.content.trim()) continue;
    if (m.role === "user") h.push({ role: "user", content: m.content });
    else if (m.raw?.length) h.push(...m.raw);
    else h.push({ role: "assistant", content: m.content });
  }
  h.push({ role: "user", content: text });
  return h;
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
  delegate: "Delegating",
};

function inputPreview(input) {
  if (!input || typeof input !== "object") return "";
  const v = input.query ?? input.url ?? input.path ?? input.pattern ?? input.note ?? input.kind ?? input.code ?? input.command ?? input.task;
  if (typeof v === "string") return v.length > 120 ? v.slice(0, 120) + "…" : v;
  const keys = Object.keys(input);
  return keys.length ? JSON.stringify(input).slice(0, 120) : "";
}

function ToolCard({ part, agents, live }) {
  const isDelegate = part.name === "delegate";
  const [open, setOpen] = useState(false);
  const status = !part.done ? "running" : part.ok ? "ok" : "failed";
  const target = isDelegate && part.input?.agent ? agents.find((a) => a.id === part.input.agent) : null;
  const label = isDelegate
    ? `Delegating to ${target ? `${target.emoji} ${target.name}` : part.input?.agent || "…"}`
    : TOOL_LABELS[part.name] || part.name;
  return (
    <div className={`tool ${status} ${isDelegate ? "delegate" : ""}`}>
      <button className="tool-head" onClick={() => setOpen((v) => !v)}>
        <span className="tool-dot" />
        <span className="tool-label">{label}</span>
        <span className="tool-preview">{inputPreview(part.input)}</span>
        <span className="tool-toggle">{open ? "▾" : "▸"}</span>
      </button>
      {isDelegate && part.sub?.length > 0 && (
        <div className="tool-sub">
          <Parts parts={part.sub} agents={agents} live={live && !part.done} />
        </div>
      )}
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

function Parts({ parts, agents, live }) {
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "text" ? (
          <Markdown key={i} text={p.text} />
        ) : p.kind === "tool" ? (
          <ToolCard key={i} part={p} agents={agents} live={live} />
        ) : (
          <ThinkingBlock key={i} text={p.text} live={live && i === parts.length - 1} />
        )
      )}
    </>
  );
}

function AssistantBody({ m, agents, live }) {
  return (
    <>
      {m.parts?.length ? <Parts parts={m.parts} agents={agents} live={live} /> : m.content ? <Markdown text={m.content} /> : null}
      {m.sources?.length > 0 && (
        <div className="sources">
          <div className="sources-head">Sources</div>
          <ol>
            {m.sources.map((s, i) => (
              <li key={i}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" title={s.cited_text || ""}>
                  {s.title || s.url}
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}

// ---- agent editor ------------------------------------------------------

const EMPTY_AGENT = { name: "", emoji: "🤖", tagline: "", description: "", system: "", model: "claude-opus-5", effort: "medium", tools: [] };

function AgentEditor({ initial, mode, catalog, models, efforts, onSaved, onClose }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_AGENT, ...initial }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const hasCode = form.tools.includes("code_execution");
  const hasWeb = form.tools.includes("web_search") || form.tools.includes("web_fetch");

  function toggleTool(name) {
    setForm((f) => ({ ...f, tools: f.tools.includes(name) ? f.tools.filter((t) => t !== name) : [...f.tools, name] }));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = { name: form.name, emoji: form.emoji, tagline: form.tagline, description: form.description, system: form.system, model: form.model, effort: form.effort, tools: form.tools };
      const j = mode === "edit" ? await api(`/api/agents/${encodeURIComponent(initial.id)}`, "PUT", body) : await api("/api/agents", "POST", body);
      onSaved(j.agent);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal editor" onSubmit={submit}>
        <div className="modal-head">
          <span className="modal-title">{mode === "edit" ? "Edit agent" : mode === "duplicate" ? "Duplicate agent" : "New agent"}</span>
          <button type="button" className="icon-btn" onClick={onClose} title="Close">
            ×
          </button>
        </div>
        <div className="form-row">
          <label className="field emoji-field">
            <span>Emoji</span>
            <input value={form.emoji} onChange={(e) => set("emoji", e.target.value)} maxLength={8} />
          </label>
          <label className="field grow">
            <span>Name</span>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={40} required autoFocus />
          </label>
        </div>
        <label className="field">
          <span>Tagline</span>
          <input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={120} placeholder="One line shown on the agent card" />
        </label>
        <label className="field">
          <span>Description</span>
          <input value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={400} placeholder="What it is for" />
        </label>
        <label className="field">
          <span>System prompt</span>
          <textarea value={form.system} onChange={(e) => set("system", e.target.value)} rows={8} required placeholder="Who the agent is, how it works, what it must never do…" />
        </label>
        <div className="form-row">
          <label className="field grow">
            <span>Model</span>
            <select value={form.model} onChange={(e) => set("model", e.target.value)}>
              {models.map((m) => (
                <option key={m} value={m}>
                  {MODELS.find((x) => x.id === m)?.label || m}
                </option>
              ))}
            </select>
          </label>
          <label className="field grow">
            <span>Effort</span>
            <select value={form.effort} onChange={(e) => set("effort", e.target.value)}>
              {efforts.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="field">
          <span>Tools</span>
          <div className="tool-grid">
            {catalog.map((t) => {
              const conflict = (t.name === "code_execution" && hasWeb) || ((t.name === "web_search" || t.name === "web_fetch") && hasCode);
              return (
                <label key={t.name} className={`tool-opt ${conflict ? "off" : ""}`} title={t.description}>
                  <input type="checkbox" checked={form.tools.includes(t.name)} disabled={conflict} onChange={() => toggleTool(t.name)} />
                  <span className="tool-opt-name">
                    {t.label}
                    {t.server && <span className="tool-opt-tag">hosted</span>}
                  </span>
                  <span className="tool-opt-desc">{t.description}</span>
                </label>
              );
            })}
          </div>
        </div>
        {error && <div className="msg-error">{error}</div>}
        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn send" disabled={busy || !form.name.trim() || !form.system.trim()}>
            {busy ? "Saving…" : mode === "edit" ? "Save changes" : "Create agent"}
          </button>
        </div>
      </form>
    </div>
  );
}

function AgentsPanel({ agents, onNew, onEdit, onDuplicate, onDelete, onPick, onClose }) {
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <span className="modal-title">Agents</span>
          <span className="spacer" />
          <button className="btn" onClick={onNew}>
            + New agent
          </button>
          <button className="icon-btn" onClick={onClose} title="Close">
            ×
          </button>
        </div>
        <div className="agent-rows">
          {agents.map((a) => (
            <div key={a.id} className="agent-row">
              <span className="agent-row-emoji">{a.emoji}</span>
              <div className="agent-row-main">
                <div className="agent-row-name">
                  {a.name} {a.builtin ? <span className="tag">built-in</span> : <span className="tag custom">custom</span>}
                </div>
                <div className="agent-row-tag">{a.tagline || a.description}</div>
                <div className="agent-row-tools">{a.tools.join(" · ") || "no tools"}</div>
              </div>
              <div className="agent-row-actions">
                <button className="btn ghost" onClick={() => onPick(a.id)}>
                  Chat
                </button>
                <button className="btn ghost" onClick={() => onDuplicate(a)}>
                  Duplicate
                </button>
                {!a.builtin && (
                  <>
                    <button className="btn ghost" onClick={() => onEdit(a)}>
                      Edit
                    </button>
                    <button className="btn ghost danger" onClick={() => onDelete(a)}>
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- app ---------------------------------------------------------------

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
  const [efforts, setEfforts] = useState(DEFAULT_EFFORTS);
  const [catalog, setCatalog] = useState([]);
  const [panel, setPanel] = useState(false);
  const [editor, setEditor] = useState(null); // {mode, initial}
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const abortRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const active =
    conversations.find((c) => c.id === activeId) ?? conversations[0];
  const agent = active?.agentId ? agents.find((a) => a.id === active.agentId) : null;
  const agentMissing = !!active?.agentId && agents.length > 0 && !agent;

  useEffect(() => {
    persist(conversations, active?.id);
  }, [conversations]);

  useEffect(() => {
    if (active) localStorage.setItem(ACTIVE_KEY, active.id);
  }, [active?.id]);

  function loadAgents() {
    return fetch("/api/agents")
      .then((r) => r.json())
      .then((j) => {
        setAgents(j.agents || []);
        setAgentModels(j.models || []);
        if (j.efforts?.length) setEfforts(j.efforts);
        setCatalog(j.tools || []);
      })
      .catch(() => {});
  }

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() =>
        setHealth({ ok: false, error: "Backend not reachable on :3001" })
      );
    loadAgents();
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
    const history = buildHistory(conv.messages, text);
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
        { role: "assistant", content: "", parts: [], sources: [] },
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
          : { messages: history.map((m) => (typeof m.content === "string" ? m : null)).filter(Boolean), model, systemPrompt: conv.systemPrompt },
        {
          signal: controller.signal,
          onEvent: (ev) => {
            switch (ev.type) {
              case "text":
              case "thinking":
              case "tool_start":
              case "tool_input":
              case "tool_result":
                updateLast(conv.id, (last) => ({
                  ...last,
                  content: ev.type === "text" && !ev.parent ? last.content + ev.text : last.content,
                  parts: applyEvent(last.parts || [], ev),
                }));
                break;
              case "citation":
                if (ev.parent) break;
                updateLast(conv.id, (last) => {
                  const sources = last.sources || [];
                  if (sources.some((s) => s.url === ev.url)) return last;
                  return { ...last, sources: [...sources, { url: ev.url, title: ev.title, cited_text: ev.cited_text }] };
                });
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
                if (Array.isArray(ev.transcript) && ev.transcript.length) {
                  const small = JSON.stringify(ev.transcript).length <= MAX_RAW_CHARS;
                  updateLast(conv.id, (last) => (small ? { ...last, raw: ev.transcript } : { ...last, rawDropped: true }));
                }
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
      updateLast(conv.id, (last) => ({ ...last, parts: closeOpenTools(last.parts || []) }));
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

  async function removeAgent(a) {
    if (!confirm(`Delete the agent "${a.name}"? Conversations with it stay, but cannot continue.`)) return;
    try {
      await api(`/api/agents/${encodeURIComponent(a.id)}`, "DELETE");
      await loadAgents();
    } catch (err) {
      alert(err.message);
    }
  }

  function onAgentSaved(saved) {
    setEditor(null);
    loadAgents().then(() => {
      if (editor?.mode !== "edit") {
        setPanel(false);
        addConversation(saved.id);
      }
    });
  }

  if (!active) return null;

  const modelOptions = agent ? MODELS.filter((m) => agentModels.includes(m.id)) : MODELS;
  const agentEmoji = (id) => agents.find((a) => a.id === id)?.emoji || "🤖";
  const builtins = agents.filter((a) => a.builtin);
  const customs = agents.filter((a) => !a.builtin);
  const roleLabel = agent ? `${agent.emoji} ${agent.name}` : active.agentId ? "agent" : "claude";

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
        <button className="sidebar-agents" onClick={() => setPanel(true)} title="Create and manage agents">
          🤖 Agents <span className="count">{agents.length || ""}</span>
        </button>
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
            {builtins.length > 0 && (
              <optgroup label="Built-in">
                {builtins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.emoji} {a.name}
                  </option>
                ))}
              </optgroup>
            )}
            {customs.length > 0 && (
              <optgroup label="Yours">
                {customs.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.emoji} {a.name}
                  </option>
                ))}
              </optgroup>
            )}
            {agentMissing && <option value={active.agentId}>(deleted agent)</option>}
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
              {efforts.map((e) => (
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
                      <div className="empty-title">
                        {agent.name} {!agent.builtin && <span className="tag custom">custom</span>}
                      </div>
                      <div className="empty-sub">{agent.description || agent.tagline}</div>
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
                        <span className="agent-card-name">
                          {a.name} {!a.builtin && <span className="tag custom">custom</span>}
                        </span>
                        <span className="agent-card-tag">{a.tagline}</span>
                      </button>
                    ))}
                    {agents.length > 0 && (
                      <button className="agent-card new" onClick={() => setEditor({ mode: "create", initial: {} })}>
                        <span className="agent-card-emoji">＋</span>
                        <span className="agent-card-name">New agent</span>
                        <span className="agent-card-tag">Your own prompt, model and tools</span>
                      </button>
                    )}
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
                  <span className="role">{m.role === "user" ? "you" : roleLabel}</span>
                  {m.role === "assistant" && m.content && (
                    <CopyButton text={m.content} />
                  )}
                </div>
                {m.role === "user" ? (
                  <div className="msg-body">{m.content}</div>
                ) : (
                  <AssistantBody m={m} agents={agents} live={live} />
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
            <button className="btn send" onClick={send} disabled={!input.trim() || agentMissing}>
              Send
            </button>
          )}
        </div>
      </main>

      {panel && (
        <AgentsPanel
          agents={agents}
          onClose={() => setPanel(false)}
          onNew={() => setEditor({ mode: "create", initial: {} })}
          onEdit={(a) => setEditor({ mode: "edit", initial: a })}
          onDuplicate={(a) => setEditor({ mode: "duplicate", initial: { ...a, id: undefined, name: `${a.name} copy`, builtin: undefined } })}
          onDelete={removeAgent}
          onPick={(id) => {
            setPanel(false);
            if (active.messages.length === 0) setAgent(active.id, id);
            else addConversation(id);
          }}
        />
      )}
      {editor && (
        <AgentEditor
          mode={editor.mode}
          initial={editor.initial}
          catalog={catalog}
          models={agentModels}
          efforts={efforts}
          onSaved={onAgentSaved}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
