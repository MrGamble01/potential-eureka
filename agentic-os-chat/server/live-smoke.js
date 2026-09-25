// Live smoke test against the real Anthropic API: one short turn per agent.
//   npm run smoke:live            # every visible built-in agent
//   npm run smoke:live -- repo    # just one agent id
// Needs ANTHROPIC_API_KEY in ../.env (or the environment). Spends a few
// cents; prints stop reason, tool calls, tokens and the start of the answer.

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { runAgent } from "./agent-loop.js";
import { listAgents, getAgent } from "./agent-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const PROMPTS = {
  eureka: "In one sentence: what is today's date, and what is one piece of tech news from this week? Cite the source.",
  research: "In three bullet points with sources: what is the current stable version of Node.js and when was it released?",
  code: "Compute the 30th Fibonacci number by running code, and show the code.",
  repo: "Which file defines the agent roster in agentic-os-chat, and how many agents does it define? Quote the file path.",
  chief: "Delegate: find out what Node.js version is current (research) and how many built-in agents this repo defines (repo). Answer in two lines.",
};

const only = process.argv[2];
const client = new Anthropic();
const roster = await listAgents();
const targets = roster.filter((a) => (only ? a.id === only : PROMPTS[a.id]));
if (!targets.length) {
  console.error(only ? `no agent with id ${only}` : "no agents to test");
  process.exit(1);
}

let failed = 0;
for (const agent of targets) {
  const prompt = PROMPTS[agent.id] || "Introduce yourself in one sentence and use one of your tools to prove it works.";
  const started = Date.now();
  const tools = [];
  let answer = "";
  process.stdout.write(`\n== ${agent.emoji} ${agent.name} (${agent.id}) — ${agent.model} / ${agent.effort}\n   > ${prompt}\n`);
  try {
    const out = await runAgent({
      client,
      agent,
      messages: [{ role: "user", content: prompt }],
      emit: (e) => {
        if (e.type === "tool_start") tools.push(e.parent ? `${e.name}*` : e.name);
        if (e.type === "text" && !e.parent) answer += e.text;
      },
      getAgent: (id) => roster.find((a) => a.id === id) || null,
      listAgents: () => roster,
    });
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    const ok = out.stop_reason === "end_turn" && answer.trim();
    if (!ok) failed++;
    console.log(`   ${ok ? "OK " : "FAIL"} stop=${out.stop_reason} turns=${out.iterations} tools=[${tools.join(", ")}] in=${out.usage.input_tokens} out=${out.usage.output_tokens} ${secs}s`);
    console.log("   " + answer.trim().replace(/\s+/g, " ").slice(0, 300));
  } catch (err) {
    failed++;
    console.log(`   FAIL ${err?.constructor?.name || "Error"}: ${err?.message || err}`);
    if (err instanceof Anthropic.APIError && err.status === 400) {
      console.log("   (a 400 usually means a request-shape problem: check the tool types and thinking/effort params for this model)");
    }
  }
}
console.log(`\n${targets.length - failed}/${targets.length} agents passed`);
process.exit(failed ? 1 : 0);
