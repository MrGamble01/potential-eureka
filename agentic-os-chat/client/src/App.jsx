import { useEffect, useRef, useState } from "react";

// $/MTok (standard rates)
const MODELS = [
  { id: "claude-opus-4-8", label: "Claude Opus 4.8", in: 5, out: 25 },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", in: 3, out: 15 },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", in: 1, out: 5 },
];

const STORAGE_KEY = "agentic-os-chat.conversations.v1";
const ACTIVE_KEY = "agentic-os-chat.active.v1";

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function newConversation() {
  return {
    id: uid(),
    title: "New chat",
    model: MODELS[0].id,
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
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch {
    /* corrupted storage — start fresh */
  }
  return [newConversation()];
}

async function streamChat({ messages, model, systemPrompt, signal, onEvent }) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, model, systemPrompt }),
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

export default function App() {
  const [conversations, setConversations] = useState(loadConversations);
  const [activeId, setActiveId] = useState(
    () => localStorage.getItem(ACTIVE_KEY) || ""
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showSystem, setShowSystem] = useState(false);
  const [health, setHealth] = useState(null); // null=checking, {ok} or {ok:false,error}
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const abortRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const active =
    conversations.find((c) => c.id === activeId) ?? conversations[0];

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
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages]);

  function update(id, updater) {
    setConversations((list) =>
      list.map((c) => (c.id === id ? updater(c) : c))
    );
  }

  function markError(id, message) {
    update(id, (c) => {
      const msgs = c.messages.slice();
      const last = msgs[msgs.length - 1];
      if (last?.role === "assistant") {
        msgs[msgs.length - 1] = { ...last, error: message };
      }
      return { ...c, messages: msgs };
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
        { role: "assistant", content: "" },
      ],
    }));
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const model = conv.model;
    try {
      await streamChat({
        messages: history,
        model,
        systemPrompt: conv.systemPrompt,
        signal: controller.signal,
        onEvent: (ev) => {
          if (ev.type === "text") {
            update(conv.id, (c) => {
              const msgs = c.messages.slice();
              const last = msgs[msgs.length - 1];
              msgs[msgs.length - 1] = {
                ...last,
                content: last.content + ev.text,
              };
              return { ...c, messages: msgs };
            });
          } else if (ev.type === "usage") {
            const p = MODELS.find((m) => m.id === model) ?? MODELS[0];
            const cost =
              (ev.input_tokens * p.in + ev.output_tokens * p.out) / 1e6;
            update(conv.id, (c) => ({
              ...c,
              usage: {
                input: c.usage.input + ev.input_tokens,
                output: c.usage.output + ev.output_tokens,
                cost: c.usage.cost + cost,
              },
            }));
          } else if (ev.type === "error") {
            markError(conv.id, ev.message);
          } else if (ev.type === "done" && ev.stop_reason === "refusal") {
            markError(conv.id, "The model declined to answer this request.");
          }
        },
      });
    } catch (err) {
      if (err.name !== "AbortError") {
        markError(conv.id, err.message || "Request failed.");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  function stop() {
    abortRef.current?.abort();
    if (active) {
      update(active.id, (c) => {
        const msgs = c.messages.slice();
        const last = msgs[msgs.length - 1];
        if (last?.role === "assistant") {
          msgs[msgs.length - 1] = { ...last, stopped: true };
        }
        return { ...c, messages: msgs };
      });
    }
  }

  function addConversation() {
    const c = newConversation();
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

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-head">
          <span className="brand">Agentic OS Chat</span>
          <button className="btn" onClick={addConversation} title="New conversation">
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
            className="model-select"
            value={active.model}
            disabled={streaming}
            onChange={(e) =>
              update(active.id, (c) => ({ ...c, model: e.target.value }))
            }
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            className={`btn ghost ${showSystem ? "on" : ""}`}
            onClick={() => setShowSystem((v) => !v)}
          >
            System prompt {active.systemPrompt.trim() ? "●" : ""}
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
              placeholder="System prompt (optional) — applied to every request in this conversation"
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
              Start a conversation. Enter to send, Shift+Enter for a newline.
            </div>
          )}
          {active.messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <div className="msg-meta">
                <span className="role">{m.role === "user" ? "you" : "claude"}</span>
                {m.role === "assistant" && m.content && (
                  <CopyButton text={m.content} />
                )}
              </div>
              {m.content && <div className="msg-body">{m.content}</div>}
              {m.role === "assistant" &&
                !m.content &&
                !m.error &&
                streaming &&
                i === active.messages.length - 1 && (
                  <div className="msg-body thinking">…</div>
                )}
              {m.stopped && <div className="msg-note">⏹ stopped</div>}
              {m.error && <div className="msg-error">{m.error}</div>}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="composer">
          <textarea
            ref={inputRef}
            className="input"
            placeholder="Message… (Enter to send, Shift+Enter for newline)"
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
