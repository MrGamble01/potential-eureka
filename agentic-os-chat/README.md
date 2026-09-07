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

Pick an agent from the cards on a new chat or the dropdown in the header.
"Plain chat" is the original no-tools mode. Each agent has a default model
and **effort** (`low` → `max`); both are per-conversation and editable in
the header. The "Extra instructions" box appends to the agent's own prompt.

While an agent works you see its tool calls inline: what it searched,
which pages it read, what code it ran, and whether each call succeeded.
Click a card to expand the arguments and results. A collapsible "Thought
process" shows the model's summarized reasoning.

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

Runs the server's `node --test` suite: the agent loop against a fake
streaming client (tool round-trip, `pause_turn` resume, server-tool result
summaries, iteration cap, abort) and the repo tools' path sandboxing.

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
  tools: ask FORGE how the catapult damage is computed and he reads the
  source.
- Chats are per-agent, stored in your browser's localStorage.

The deployed office page works without the backend (agents just show as
offline) — the API key is only ever read by the local server.

## How it works

- `POST /api/chat` accepts `{ messages, model, systemPrompt }` and streams the
  model's response back as Server-Sent Events (`text`, `usage`, `done`,
  `error`). Closing the connection (Stop button) aborts the upstream Anthropic
  request.
- `GET /api/agents` lists the agents and the models that can run them.
- `POST /api/agent` accepts `{ agentId, messages, model?, effort?, systemPrompt? }`
  and runs the tool-use loop in `server/agent-loop.js`: stream one model
  turn, execute any local tool calls (concurrently), send the results back,
  repeat until the model stops asking for tools (capped at 12 turns).
  Anthropic-hosted tools run inside the model turn; a `pause_turn` stop is
  resumed automatically. The stream carries `text`, `thinking`,
  `tool_start`, `tool_input`, `tool_result`, `usage` (running totals for
  the turn), `done`, and `error` events. The client keeps only the text
  history between turns, so the loop is stateless on the server.
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
├── data/               # memory.json (created on first `remember`, gitignored)
├── server/             # Express API on :3001
│   ├── index.js        # routes: /api/chat, /api/agents, /api/agent, /api/health
│   ├── agents.js       # the agent roster: persona + tools + default model/effort
│   ├── tools.js        # local tools (repo browsing, GitHub, memory, time)
│   ├── agent-loop.js   # the streaming tool-use loop
│   └── agent-loop.test.js
└── client/             # React + Vite app on :5173
    ├── vite.config.js  # proxies /api → :3001
    └── src/
        ├── App.jsx
        └── styles.css
```
