import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { AGENT_BY_ID, AGENT_MODELS, publicAgents } from "./agents.js";
import { runAgent } from "./agent-loop.js";

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
app.use(express.json({ limit: "10mb" }));

// CORS: the studio office page (agentic-os.html) may be served from another
// origin (Vercel, file://) and talks to this local API. Local single-user
// app, no credentials — permissive CORS is fine here.
app.use("/api", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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
    messages.every(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    );
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

app.get("/api/agents", (req, res) => {
  res.json({ agents: publicAgents(), models: AGENT_MODELS });
});

const EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"]);

// Same SSE contract as /api/chat (text / usage / done / error) plus the
// agent events documented in agent-loop.js. The client sends the plain
// text history; the tool-use loop for the current turn happens here.
app.post("/api/agent", async (req, res) => {
  const { agentId, messages, model, effort, systemPrompt } = req.body ?? {};

  const agent = AGENT_BY_ID.get(agentId);
  if (!agent) return res.status(400).json({ error: `Unknown agent: ${agentId}` });
  const useModel = model ?? agent.model;
  if (!AGENT_MODELS.includes(useModel)) {
    return res.status(400).json({ error: `Model ${useModel} cannot run agents. Use one of: ${AGENT_MODELS.join(", ")}` });
  }
  const useEffort = effort ?? agent.effort;
  if (useEffort != null && !EFFORTS.has(useEffort)) {
    return res.status(400).json({ error: `Unknown effort: ${useEffort}` });
  }
  const valid =
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.every(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    );
  if (!valid) {
    return res.status(400).json({ error: "messages must be a non-empty array of {role, content}" });
  }
  if (messages[messages.length - 1].role !== "user") {
    return res.status(400).json({ error: "the last message must be from the user" });
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
    });
    if (out.stop_reason !== "aborted") {
      send({ type: "done", stop_reason: out.stop_reason, iterations: out.iterations, stop_details: out.stop_details ?? null });
    }
  } catch (err) {
    if (!(err instanceof Anthropic.APIUserAbortError) && !controller.signal.aborted) {
      send({ type: "error", message: friendlyError(err) });
    }
  }
  res.end();
});

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
  console.log(`Studio office (live agents): http://localhost:${PORT}/agentic-os.html`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      "⚠ ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key."
    );
  }
});
