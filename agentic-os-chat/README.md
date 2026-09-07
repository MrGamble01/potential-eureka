# Agentic OS Chat

A local, single-user chat app for the Anthropic API with a roster of
**agents**: personas that search the web, run code, read this repo, check
GitHub, and keep long-term memory. Node + Express backend (streams
responses over SSE), React + Vite frontend, no database — conversations
live in your browser's localStorage, memory notes live in a local JSON
file, and your API key never leaves the server.

## Agents

| Agent | What it does | Tools |
|---|---|---|
| ⚡ **Eureka** | The everyday bot: sharp, direct, opinionated. Searches the web for anything current and remembers what you tell it across conversations. | `web_search`, `web_fetch`, `current_time`, `remember`, `recall`, `forget` |
| 🔎 **Deep Dive** | Multi-source research: several searches, reads the actual pages, cross-checks, writes a sourced brief. | `web_search`, `web_fetch`, `current_time` |
| 🧪 **Sandbox** | Solves problems by writing and executing code in Anthropic's sandbox (Python + bash, no internet). Tests before it answers. | `code_execution`, `current_time` |
| 🗂️ **Repo Guide** | Knows the Eureka Games codebase: lists, searches and reads the source, and pulls live PRs, issues and commits from GitHub. | `list_files`, `read_file`, `search_files`, `github_activity`, `current_time` |
| 🎯 **Chief** | The orchestrator: splits a big task into sub-tasks, hands each to the right specialist through `delegate`, and synthesizes one answer. | `delegate`, `current_time`, `remember`, `recall` |

Pick an agent from the cards on a new chat or the dropdown in the header.
"Plain chat" is the original no-tools mode. Each agent has a default model
and **effort** (`low` → `max`); both are per-conversation and editable in
the header. The "Extra instructions" box appends to the agent's own prompt.

While an agent works you see its tool calls inline: what it searched,
which pages it read, what code it ran, and whether each call succeeded.
Click a card to expand the arguments and results. A collapsible "Thought
process" shows the model's summarized reasoning. When Chief delegates, the
specialist's own tool calls and answer render nested inside the delegate
card, live. Web citations the model makes are collected into a **Sources**
list under the message.

Agents remember their tool work across turns: the server returns each
turn's transcript (assistant blocks and tool results) and the client
replays it on the next turn, so "what did that page say?" works. Very
large transcripts (web results carry encrypted payloads) fall back to
text-only history, and localStorage sheds old transcripts first if it
fills up.

### Make your own agents

Click **🤖 Agents** in the sidebar (or the **New agent** card on a new
chat). An agent is a name, an emoji, a system prompt, a model, an effort
level, and a set of tools ticked from the catalog. Built-in agents are
read-only but can be **duplicated** as a starting point; your agents can
be edited and deleted. They are stored in `agentic-os-chat/data/agents.json`
(gitignored) and appear under "Yours" in the header dropdown. The editor
enforces the one rule the API has: `code_execution` cannot be combined
with the web tools.

### Agents working together

Give an agent the `delegate` tool and its system prompt is extended with
the roster of the other agents (id, name, tagline, tools). It can then
hand self-contained sub-tasks to them, several in parallel, and use their
answers. Delegation is one level deep: a delegated agent cannot delegate
again, and orchestrators cannot delegate to each other. The specialist's
token usage is folded into the conversation's counter.

### Tools

**Anthropic-hosted** (run on Anthropic's servers, no setup):
`web_search`, `web_fetch`, `code_execution`.

**Local** (run in the Express process, all read-only):

- `list_files`, `read_file`, `search_files` — browse the repository this
  app lives in. Sandboxed to the repo root; dotfiles (so `.env`),
  `node_modules`, `vendor` and `data/` are never visible.
- `github_activity` — open/closed PRs, issues, latest commits from the
  public GitHub API. Set `GITHUB_TOKEN` in `.env` to raise the rate limit,
  `GITHUB_REPO=owner/name` to point at a different repo.
- `remember` / `recall` / `forget` — long-term memory, stored in
  `agentic-os-chat/data/memory.json` (gitignored).
- `delegate` — run another agent on a sub-task and return its answer
  (implemented in `server/agent-loop.js` since it needs the loop itself).

Add an agent in `server/agents.js` (a system prompt plus a list of tool
names); add a tool in `server/tools.js` (a JSON-schema definition plus a
`run(input)` that returns a string).

## Other features

- Streaming responses, with a Stop button that aborts the in-flight
  request end-to-end (including mid-tool-loop)
- Markdown rendering (sanitized) with code blocks, tables and links
- Model picker: Claude Opus 5, Opus 4.8, Sonnet 5, Haiku 4.5 (Haiku is
  plain-chat only: it cannot run the agent tool set)
- Conversation sidebar with new / rename / delete, persisted to localStorage
- Running token + estimated cost counter per conversation
- `GET /api/health` verifies your key with a 1-token test call

## Requirements

- Node.js 20+ (uses `node --watch`)
- An Anthropic API key from https://platform.claude.com/

## Setup

```bash
cd agentic-os-chat

# 1. Install everything (root, server, and client deps)
npm install

# 2. Add your API key
cp .env.example .env
# then edit .env and set:  ANTHROPIC_API_KEY=sk-ant-...
```

The key is read only by the Express server via dotenv. It is never sent to,
or stored in, the frontend.

## Run

```bash
npm run dev
```

This starts both servers concurrently:

- API server on http://localhost:3001
- Web app on http://localhost:5173 (Vite proxies `/api` to 3001)

Open **http://localhost:5173** in your browser. Press Enter to send,
Shift+Enter for a newline.

## Test

```bash
npm test
```

Runs the server's `node --test` suites: the agent loop against a fake
streaming client (tool round-trip, `pause_turn` resume, server-tool result
summaries, iteration cap, abort), delegation (nested events, bad targets,
depth limit), the turn transcript, citations, tool-set validation, the
custom-agent store (CRUD, read-only built-ins, persistence), and the repo
tools' path sandboxing.

## Talk to the office agents

The studio office page (`../agentic-os.html` — the EUREKA STUDIO pixel office)
is wired to this backend. While `npm run dev` is running:

- Open **http://localhost:3001/agentic-os.html** (the server also serves the
  repo's static site), or the deployed office page — either connects to the
  local backend automatically.
- The header shows **AGENTS ONLINE** when the backend + key are working.
- Click any robot (or the TALK button on a desk) to chat with that agent.
  Each of the eight agents has a personality, and their system prompt is
  rebuilt per message with their desk's live GitHub state — open PRs,
  shipped counts, status — so they actually know what they're working on.
  They run as the `desk` agent, so they also have the repo and GitHub
  tools: ask FORGE how the catapult damage is computed and it reads the
  source.
- Chats are per-agent, stored in your browser's localStorage.

The deployed office page works without the backend (agents just show as
offline) — the API key is only ever read by the local server.

## How it works

- `POST /api/chat` accepts `{ messages, model, systemPrompt }` and streams the
  model's response back as Server-Sent Events (`text`, `usage`, `done`,
  `error`). Closing the connection (Stop button) aborts the upstream Anthropic
  request.
- `GET /api/agents` lists the roster (built-in + yours), the models that
  can run agents, the effort levels, and the tool catalog.
  `POST /api/agents`, `PUT /api/agents/:id`, `DELETE /api/agents/:id`
  manage your agents (same-origin only; built-ins are read-only).
- `POST /api/agent` accepts `{ agentId, messages, model?, effort?, systemPrompt? }`
  and runs the tool-use loop in `server/agent-loop.js`: stream one model
  turn, execute any local tool calls (concurrently), send the results back,
  repeat until the model stops asking for tools (capped at 12 turns).
  Anthropic-hosted tools run inside the model turn; a `pause_turn` stop is
  resumed automatically. The stream carries `text`, `thinking`,
  `citation`, `tool_start`, `tool_input`, `tool_result`, `usage` (running
  totals for the turn), `done` (with the turn's `transcript`), and
  `error` events; events from a delegated agent carry `parent`. Messages
  may be plain text or arrays of content blocks (the replayed transcript),
  so the loop stays stateless on the server.
- Agent requests use adaptive thinking with a summarized display,
  `output_config.effort`, and a cached system prompt.
- `GET /api/health` makes a 1-token call to verify the key works.
- Cost estimates use standard per-MTok pricing: Opus 5 / 4.8 $5/$25,
  Sonnet 5 $2/$10, Haiku 4.5 $1/$5 (input/output), cache reads at 0.1×
  and cache writes at 1.25× input. Figures are estimates — check your
  Console usage page for exact billing.

## Project layout

```
agentic-os-chat/
├── package.json        # npm run dev (concurrently), npm test, installs both workspaces
├── .env.example        # ANTHROPIC_API_KEY=
├── data/               # memory.json + agents.json (created on first use, gitignored)
├── server/             # Express API on :3001
│   ├── index.js        # routes: /api/chat, /api/agents (+CRUD), /api/agent, /api/health
│   ├── agents.js       # the built-in roster: persona + tools + default model/effort
│   ├── agent-store.js  # your agents: validation + data/agents.json
│   ├── tools.js        # local tools, the tool catalog, tool-set validation
│   ├── agent-loop.js   # the streaming tool-use loop, delegation, transcript
│   ├── agent-loop.test.js
│   └── agents-and-store.test.js
└── client/             # React + Vite app on :5173
    ├── vite.config.js  # proxies /api → :3001
    └── src/
        ├── App.jsx
        └── styles.css
```
