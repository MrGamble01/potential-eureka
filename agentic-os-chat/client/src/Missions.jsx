import { useEffect, useRef, useState } from "react";

// Missions: agents that run on a schedule (or on demand) in the background
// and report back here. All state lives on the server (data/missions.json).

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

function when(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const unit = abs < 60_000 ? [Math.round(abs / 1000), "s"] : abs < 3_600_000 ? [Math.round(abs / 60_000), "m"] : abs < 86_400_000 ? [Math.round(abs / 3_600_000), "h"] : [Math.round(abs / 86_400_000), "d"];
  return diff < 0 ? `${unit[0]}${unit[1]} ago` : `in ${unit[0]}${unit[1]}`;
}

function every(m) {
  if (!m.everyMinutes) return "on demand";
  if (m.everyMinutes % 1440 === 0) return `every ${m.everyMinutes / 1440}d`;
  if (m.everyMinutes % 60 === 0) return `every ${m.everyMinutes / 60}h`;
  return `every ${m.everyMinutes}m`;
}

const EMPTY = { name: "", agentId: "", prompt: "", everyMinutes: 0, enabled: true, model: "", effort: "" };

function MissionForm({ initial, agents, models, efforts, onSaved, onClose }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...initial, model: initial?.model || "", effort: initial?.effort || "" }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const editing = !!initial?.id;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = {
        name: form.name,
        agentId: form.agentId,
        prompt: form.prompt,
        everyMinutes: Number(form.everyMinutes) || 0,
        enabled: !!form.enabled,
        model: form.model || null,
        effort: form.effort || null,
      };
      const j = editing ? await api(`/api/missions/${encodeURIComponent(initial.id)}`, "PUT", body) : await api("/api/missions", "POST", body);
      onSaved(j.mission);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mission-form" onSubmit={submit}>
      <div className="form-row">
        <label className="field grow">
          <span>Name</span>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={60} required autoFocus placeholder="Morning news brief" />
        </label>
        <label className="field grow">
          <span>Agent</span>
          <select value={form.agentId} onChange={(e) => set("agentId", e.target.value)} required>
            <option value="">Pick an agent…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.emoji} {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Prompt (the agent gets exactly this each run)</span>
        <textarea value={form.prompt} onChange={(e) => set("prompt", e.target.value)} rows={5} required placeholder="Search for news about … from the last 24 hours and write a five-bullet brief with sources." />
      </label>
      <div className="form-row">
        <label className="field">
          <span>Run every (minutes, 0 = on demand)</span>
          <input type="number" min={0} step={5} value={form.everyMinutes} onChange={(e) => set("everyMinutes", e.target.value)} />
        </label>
        <label className="field grow">
          <span>Model (blank = agent default)</span>
          <select value={form.model} onChange={(e) => set("model", e.target.value)}>
            <option value="">agent default</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Effort</span>
          <select value={form.effort} onChange={(e) => set("effort", e.target.value)}>
            <option value="">agent default</option>
            {efforts.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={!!form.enabled} onChange={(e) => set("enabled", e.target.checked)} /> Enabled (scheduled runs happen while the server is up)
      </label>
      {error && <div className="msg-error">{error}</div>}
      <div className="modal-foot">
        <button type="button" className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn send" disabled={busy || !form.name.trim() || !form.prompt.trim() || !form.agentId}>
          {busy ? "Saving…" : editing ? "Save changes" : "Create mission"}
        </button>
      </div>
    </form>
  );
}

function RunRow({ run, Markdown }) {
  const [open, setOpen] = useState(false);
  const status = run.status === "running" ? "running" : run.status === "ok" ? "ok" : "failed";
  return (
    <div className={`run ${status}`}>
      <button className="run-head" onClick={() => setOpen((v) => !v)}>
        <span className="tool-dot" />
        <span className="run-when">{when(run.startedAt)}</span>
        <span className="run-meta">
          {run.status === "running" ? "running…" : run.status === "ok" ? "done" : "failed"}
          {run.toolCalls ? ` · ${run.toolCalls} tool call${run.toolCalls === 1 ? "" : "s"}` : ""}
          {run.usage ? ` · ${(run.usage.input_tokens + run.usage.output_tokens).toLocaleString()} tokens` : ""}
        </span>
        <span className="run-preview">{run.error || run.answer?.replace(/\s+/g, " ").slice(0, 90)}</span>
        <span className="tool-toggle">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="run-body">
          {run.error && <div className="msg-error">{run.error}</div>}
          {run.answer ? <Markdown text={run.answer} /> : !run.error && <div className="tool-wait">no answer yet</div>}
          {run.tools?.length > 0 && <div className="run-tools">tools: {run.tools.join(", ")}</div>}
          {run.sources?.length > 0 && (
            <div className="sources">
              <div className="sources-head">Sources</div>
              <ol>
                {run.sources.map((s, i) => (
                  <li key={i}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                      {s.title || s.url}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MissionsPanel({ agents, models, efforts, Markdown, onClose }) {
  const [list, setList] = useState(null);
  const [form, setForm] = useState(null); // null | {} | mission
  const [error, setError] = useState("");
  const timer = useRef(null);

  async function refresh() {
    try {
      const j = await api("/api/missions", "GET");
      setList(j.missions || []);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    refresh();
    timer.current = setInterval(() => {
      // Poll faster while something is running.
      refresh();
    }, 4000);
    return () => clearInterval(timer.current);
  }, []);

  async function act(fn) {
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  const agentOf = (id) => agents.find((a) => a.id === id);

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide">
        <div className="modal-head">
          <span className="modal-title">Missions</span>
          <span className="modal-sub">agents that run on their own and report back</span>
          <span className="spacer" />
          {!form && (
            <button className="btn" onClick={() => setForm({})}>
              + New mission
            </button>
          )}
          <button className="icon-btn" onClick={onClose} title="Close">
            ×
          </button>
        </div>
        {error && <div className="msg-error">{error}</div>}
        {form && (
          <MissionForm
            initial={form.id ? form : null}
            agents={agents}
            models={models}
            efforts={efforts}
            onClose={() => setForm(null)}
            onSaved={() => {
              setForm(null);
              refresh();
            }}
          />
        )}
        {list === null ? (
          <div className="tool-wait">loading…</div>
        ) : list.length === 0 && !form ? (
          <div className="empty-hint">
            No missions yet. A mission is an agent plus a prompt that runs every N minutes while the server is up, or whenever you press Run. Try: Deep Dive, "What changed in the Node.js world in the last day? Five bullets with sources.", every 720 minutes.
          </div>
        ) : (
          <div className="mission-list">
            {list.map((m) => {
              const a = agentOf(m.agentId);
              return (
                <div key={m.id} className={`mission ${m.enabled ? "" : "off"}`}>
                  <div className="mission-head">
                    <span className="mission-emoji">{a?.emoji || "🤖"}</span>
                    <div className="mission-main">
                      <div className="mission-name">
                        {m.name} {m.running && <span className="tag running">running</span>}
                        {!m.enabled && <span className="tag">paused</span>}
                      </div>
                      <div className="mission-sub">
                        {a ? a.name : `${m.agentId} (deleted)`} · {every(m)}
                        {m.enabled && m.nextRunAt && m.everyMinutes ? ` · next ${when(m.nextRunAt)}` : ""}
                        {m.lastRunAt ? ` · last ${when(m.lastRunAt)}` : ""}
                      </div>
                      <div className="mission-prompt" title={m.prompt}>
                        {m.prompt}
                      </div>
                    </div>
                    <div className="mission-actions">
                      {m.running ? (
                        <button className="btn ghost danger" onClick={() => act(() => api(`/api/missions/${m.id}/cancel`, "POST", {}))}>
                          Cancel
                        </button>
                      ) : (
                        <button className="btn" onClick={() => act(() => api(`/api/missions/${m.id}/run`, "POST", {}))}>
                          ▶ Run now
                        </button>
                      )}
                      <button className="btn ghost" onClick={() => act(() => api(`/api/missions/${m.id}`, "PUT", { enabled: !m.enabled }))}>
                        {m.enabled ? "Pause" : "Resume"}
                      </button>
                      <button className="btn ghost" onClick={() => setForm(m)}>
                        Edit
                      </button>
                      <button
                        className="btn ghost danger"
                        onClick={() => {
                          if (confirm(`Delete mission "${m.name}" and its run history?`)) act(() => api(`/api/missions/${m.id}`, "DELETE"));
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {m.runs?.length > 0 && (
                    <div className="runs">
                      {m.runs.map((r) => (
                        <RunRow key={r.id} run={r} Markdown={Markdown} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
