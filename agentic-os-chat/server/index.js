import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { AGENT_MODELS } from "./agents.js";
import { runAgent } from "./agent-loop.js";
import { TOOL_CATALOG } from "./tools.js";
import { EFFORTS, listAgents, getAgent, createAgent, updateAgent, deleteAgent, publicShape } from "./agent-store.js";
import * as missions from "./missions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// The .env file lives at the app root, next to .env.example
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const PORT = 3001;

const ALLOWED_MODELS = new Set([
  "claude-opus-5",
  "claude-opus-4-8",
  "claude-sonnet-5",
  "claude-haiku-4-5-20251001",
]);

// Haiku 4.5 caps output at 64K; the other two allow more but 64K is plenty for chat.
const MAX_TOKENS = 64000;

const app = express();
// Attachments (images, PDFs) travel as base64 content blocks.
app.use(express.json({ limit: "40mb" }));

// CORS: the studio office page (agentic-os.html) may be served from another
// origin (Vercel, file://) and talks to this local API. Local single-user
// app, no credentials — permissive CORS is fine here.
app.use("/api", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Serve the repo's static site so the office works fully local:
// http://localhost:3001/agentic-os.html (dotfiles like .env are not served).
app.use(express.static(path.join(__dirname, "..", ".."), { extensions: ["html"] }));

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key, then restart."
    );
    err.expose = true;
    throw err;
  }
  if (!client) client = new Anthropic();
  return client;
}

function friendlyError(err) {
  if (err?.expose) return err.message;
  if (err instanceof Anthropic.AuthenticationError)
    return "Invalid API key. Check ANTHROPIC_API_KEY in your .env file.";
  if (err instanceof Anthropic.PermissionDeniedError)
    return "Your API key does not have permission to use this model.";
  if (err instanceof Anthropic.NotFoundError)
    return "Model not found — it may not be available to your account.";
  if (err instanceof Anthropic.RateLimitError)
    return "Rate limited by the Anthropic API. Wait a moment and try again.";
  if (err instanceof Anthropic.BadRequestError)
    return `The API rejected the request: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError)
    return "Could not reach the Anthropic API. Check your network connection.";
  if (err instanceof Anthropic.APIError) {
    if (err.status === 529)
      return "The Anthropic API is overloaded right now. Try again shortly.";
    return `Anthropic API error (${err.status}): ${err.message}`;
  }
  return "Unexpected server error.";
}

// A message is either plain text or an array of content blocks: the
// client replays the transcript from earlier turns (assistant blocks,
// tool results) so the agent remembers what it searched, read and ran,
// and a user turn may carry attachments (images, PDFs, text files).
function validMessage(m) {
  if (!m || (m.role !== "user" && m.role !== "assistant")) return false;
  if (typeof m.content === "string") return m.content.trim().length > 0;
  return (
    Array.isArray(m.content) &&
    m.content.length > 0 &&
    m.content.every((b) => b && typeof b === "object" && typeof b.type === "string")
  );
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const MAX_BLOCK_B64 = 28_000_000; // ~20 MB decoded, the API's own ceiling for a PDF

// The user's own message: text plus optional image / document blocks.
function isAttachmentContent(content) {
  if (!Array.isArray(content) || !content.length) return false;
  let hasText = false;
  for (const b of content) {
    if (!b || typeof b !== "object") return false;
    if (b.type === "text") {
      if (typeof b.text !== "string") return false;
      if (b.text.trim()) hasText = true;
    } else if (b.type === "image" || b.type === "document") {
      const src = b.source;
      if (!src || src.type !== "base64" || typeof src.data !== "string" || src.data.length > MAX_BLOCK_B64) return false;
      if (b.type === "image" && !IMAGE_TYPES.has(src.media_type)) return false;
      if (b.type === "document" && src.media_type !== "application/pdf") return false;
    } else {
      return false;
    }
  }
  return hasText;
}

// Creating and editing agents or missions is for the app itself, not for
// arbitrary pages that can reach this local server through the permissive
// CORS above.
function sameOriginOnly(req, res, next) {
  const origin = req.get("origin");
  if (!origin) return next();
  try {
    const host = new URL(origin).hostname;
    if (["localhost", "127.0.0.1", "[::1]", "::1"].includes(host)) return next();
  } catch {
    /* fall through */
  }
  res.status(403).json({ error: "this can only be changed from the local app" });
}

// Verifies the key works with a 1-token test call.
app.get("/api/health", async (req, res) => {
  try {
    await getClient().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: friendlyError(err) });
  }
});

app.post("/api/chat", async (req, res) => {
  const { messages, model, systemPrompt } = req.body ?? {};

  if (!ALLOWED_MODELS.has(model)) {
    return res.status(400).json({ error: `Unknown model: ${model}` });
  }
  const valid =
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.every((m) => validMessage(m) && (typeof m.content === "string" || isAttachmentContent(m.content)));
  if (!valid) {
    return res.status(400).json({ error: "messages must be a non-empty array of {role, content}" });
  }

  let anthropic;
  try {
    anthropic = getClient();
  } catch (err) {
    return res.status(500).json({ error: friendlyError(err) });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (obj) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  const stream = anthropic.messages.stream({
    model,
    max_tokens: MAX_TOKENS,
    ...(typeof systemPrompt === "string" && systemPrompt.trim()
      ? { system: systemPrompt }
      : {}),
    messages: messages.map(({ role, content }) => ({ role, content })),
  });

  // If the browser aborts (stop button / closed tab), cancel the upstream request.
  req.on("close", () => {
    if (!res.writableEnded) stream.abort();
  });

  stream.on("text", (text) => send({ type: "text", text }));

  try {
    const final = await stream.finalMessage();
    send({
      type: "usage",
      input_tokens: final.usage.input_tokens,
      output_tokens: final.usage.output_tokens,
    });
    send({ type: "done", stop_reason: final.stop_reason });
  } catch (err) {
    if (!(err instanceof Anthropic.APIUserAbortError)) {
      send({ type: "error", message: friendlyError(err) });
    }
  }
  res.end();
});

// ---- agents -------------------------------------------------------------

app.get("/api/agents", async (req, res) => {
  const agents = (await listAgents()).map(publicShape);
  res.json({ agents, models: AGENT_MODELS, efforts: EFFORTS, tools: TOOL_CATALOG });
});

app.post("/api/agents", sameOriginOnly, async (req, res) => {
  const r = await createAgent(req.body ?? {});
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  res.status(201).json({ agent: publicShape(r.agent) });
});

app.put("/api/agents/:id", sameOriginOnly, async (req, res) => {
  const r = await updateAgent(req.params.id, req.body ?? {});
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  res.json({ agent: publicShape(r.agent) });
});

app.delete("/api/agents/:id", sameOriginOnly, async (req, res) => {
  const r = await deleteAgent(req.params.id);
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  res.json({ ok: true });
});

// Same SSE contract as /api/chat (text / usage / done / error) plus the
// agent events documented in agent-loop.js. The tool-use loop for the
// current turn happens here; `done` carries the turn's transcript.
app.post("/api/agent", async (req, res) => {
  const { agentId, messages, model, effort, systemPrompt } = req.body ?? {};

  const agent = await getAgent(typeof agentId === "string" ? agentId : "");
  if (!agent) return res.status(400).json({ error: `Unknown agent: ${agentId}` });
  const useModel = model ?? agent.model;
  if (!AGENT_MODELS.includes(useModel)) {
    return res.status(400).json({ error: `Model ${useModel} cannot run agents. Use one of: ${AGENT_MODELS.join(", ")}` });
  }
  const useEffort = effort ?? agent.effort;
  if (useEffort != null && !EFFORTS.includes(useEffort)) {
    return res.status(400).json({ error: `Unknown effort: ${useEffort}` });
  }
  const valid = Array.isArray(messages) && messages.length > 0 && messages.every(validMessage);
  if (!valid) {
    return res.status(400).json({ error: "messages must be a non-empty array of {role, content}" });
  }
  const last = messages[messages.length - 1];
  if (last.role !== "user" || (typeof last.content !== "string" && !isAttachmentContent(last.content))) {
    return res.status(400).json({ error: "the last message must be the user's text (with optional image, PDF or text attachments)" });
  }

  let anthropic;
  try {
    anthropic = getClient();
  } catch (err) {
    return res.status(500).json({ error: friendlyError(err) });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (obj) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  const controller = new AbortController();
  req.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  const roster = await listAgents();
  try {
    const out = await runAgent({
      client: anthropic,
      agent,
      model: useModel,
      effort: useEffort,
      systemPrompt,
      messages,
      signal: controller.signal,
      emit: send,
      getAgent: (id) => roster.find((a) => a.id === id) || null,
      listAgents: () => roster,
    });
    if (out.stop_reason !== "aborted") {
      send({
        type: "done",
        stop_reason: out.stop_reason,
        iterations: out.iterations,
        stop_details: out.stop_details ?? null,
        transcript: out.transcript,
      });
    }
  } catch (err) {
    if (!(err instanceof Anthropic.APIUserAbortError) && !controller.signal.aborted) {
      send({ type: "error", message: friendlyError(err) });
    }
  }
  res.end();
});

// ---- missions -----------------------------------------------------------

const missionDeps = {
  getClient,
  getAgent,
  listAgents,
  describeError: friendlyError,
};

app.get("/api/missions", async (req, res) => {
  res.json({ missions: await missions.listMissions() });
});

app.post("/api/missions", sameOriginOnly, async (req, res) => {
  const r = await missions.createMission(req.body ?? {}, missionDeps);
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  res.status(201).json({ mission: r.mission });
});

app.put("/api/missions/:id", sameOriginOnly, async (req, res) => {
  const r = await missions.updateMission(req.params.id, req.body ?? {}, missionDeps);
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  res.json({ mission: r.mission });
});

app.delete("/api/missions/:id", sameOriginOnly, async (req, res) => {
  const r = await missions.deleteMission(req.params.id);
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  res.json({ ok: true });
});

// Starts a run in the background and returns at once; poll GET /api/missions.
app.post("/api/missions/:id/run", sameOriginOnly, async (req, res) => {
  const m = await missions.getMission(req.params.id);
  if (!m) return res.status(404).json({ error: `no mission with id ${req.params.id}` });
  if (m.running) return res.status(409).json({ error: "this mission is already running" });
  try {
    getClient();
  } catch (err) {
    return res.status(500).json({ error: friendlyError(err) });
  }
  missions.runMission(m.id, missionDeps).catch((e) => console.error("mission run:", e.message));
  res.status(202).json({ started: true });
});

app.post("/api/missions/:id/cancel", sameOriginOnly, async (req, res) => {
  res.json({ cancelled: missions.cancelMission(req.params.id) });
});

missions.startScheduler(missionDeps);

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
  console.log(`Studio office (live agents): http://localhost:${PORT}/agentic-os.html`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      "⚠ ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key."
    );
  }
});
