# Agentic OS Chat

A local, single-user chat app for the Anthropic API. Node + Express backend
(streams responses over SSE), React + Vite frontend, no database — conversations
live in your browser's localStorage, and your API key never leaves the server.

## Features

- Streaming responses (tokens appear as they arrive), with a Stop button that
  aborts the in-flight request end-to-end
- Model picker: Claude Opus 4.8, Claude Sonnet 5, Claude Haiku 4.5
- Editable per-conversation system prompt in a collapsible panel
- Conversation sidebar with new / rename / delete, persisted to localStorage
- Running token + estimated cost counter per conversation
- Copy button on assistant messages
- `GET /api/health` verifies your key with a 1-token test call (shown as a
  status dot in the sidebar)
- Graceful, readable error messages for invalid keys, rate limits, and
  overloaded-API responses

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

## How it works

- `POST /api/chat` accepts `{ messages, model, systemPrompt }` and streams the
  model's response back as Server-Sent Events (`text`, `usage`, `done`,
  `error`). Closing the connection (Stop button) aborts the upstream Anthropic
  request.
- `GET /api/health` makes a 1-token call to verify the key works.
- Cost estimates use standard per-MTok pricing: Opus 4.8 $5/$25,
  Sonnet 5 $3/$15, Haiku 4.5 $1/$5 (input/output). Figures are estimates —
  check your Console usage page for exact billing.

## Project layout

```
agentic-os-chat/
├── package.json        # npm run dev (concurrently), installs both workspaces
├── .env.example        # ANTHROPIC_API_KEY=
├── server/             # Express API on :3001
│   └── index.js
└── client/             # React + Vite app on :5173
    ├── vite.config.js  # proxies /api → :3001
    └── src/
        ├── App.jsx
        └── styles.css
```
