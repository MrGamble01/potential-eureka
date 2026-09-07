// Local (client-side) tools the agents can call. Each tool is a plain
// Anthropic tool definition plus a `run(input)` that returns a string.
// Everything here is read-only against the repo and sandboxed to it —
// the agents can look at the arcade's code, never change it, and never
// see dotfiles (so the .env with the API key is unreachable).

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DATA_DIR = path.join(__dirname, "..", "data");
const MEMORY_FILE = path.join(DATA_DIR, "memory.json");

// The office page hard-codes its repo too; keep both overridable.
export const GITHUB_REPO = process.env.GITHUB_REPO || "mrgamble01/potential-eureka";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "vendor", "data"]);
const MAX_FILE_BYTES = 60_000;
const MAX_LIST = 400;
const MAX_MATCHES = 60;
const MAX_MEMORIES = 200;

function err(msg) {
  const e = new Error(msg);
  e.toolError = true;
  return e;
}

// Resolve a user-supplied repo-relative path and refuse anything that
// escapes the repo, is a dotfile (.env!), or lives in a skipped directory.
export function safeRepoPath(rel) {
  if (typeof rel !== "string") throw err("path must be a string");
  const clean = rel.replace(/^[/\\]+/, "").trim() || ".";
  const abs = path.resolve(REPO_ROOT, clean);
  const relative = path.relative(REPO_ROOT, abs);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw err("path escapes the repository");
  }
  const parts = relative ? relative.split(path.sep) : [];
  for (const p of parts) {
    if (p.startsWith(".")) throw err("dotfiles and hidden directories are off limits");
    if (SKIP_DIRS.has(p)) throw err(`${p}/ is not browsable`);
  }
  return { abs, rel: relative || "." };
}

async function walk(dirAbs, dirRel, out, depth) {
  if (out.length >= MAX_LIST) return;
  let entries;
  try {
    entries = await fs.readdir(dirAbs, { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    if (out.length >= MAX_LIST) return;
    if (e.name.startsWith(".") || SKIP_DIRS.has(e.name)) continue;
    const rel = dirRel === "." ? e.name : `${dirRel}/${e.name}`;
    if (e.isDirectory()) {
      out.push(rel + "/");
      if (depth > 0) await walk(path.join(dirAbs, e.name), rel, out, depth - 1);
    } else if (e.isFile()) {
      out.push(rel);
    }
  }
}

const TEXT_EXT = new Set([
  ".html", ".htm", ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".json",
  ".css", ".md", ".txt", ".xml", ".svg", ".yml", ".yaml", ".sh", ".env.example",
]);
function looksText(file) {
  return TEXT_EXT.has(path.extname(file).toLowerCase());
}

// ---- tool implementations --------------------------------------------

async function listFiles({ path: rel = ".", depth = 1 } = {}) {
  const { abs, rel: cleanRel } = safeRepoPath(rel);
  const st = await fs.stat(abs).catch(() => null);
  if (!st?.isDirectory()) throw err(`${cleanRel} is not a directory`);
  const out = [];
  await walk(abs, cleanRel, out, Math.max(0, Math.min(4, Number(depth) || 0)));
  if (!out.length) return `${cleanRel}/ is empty`;
  const note = out.length >= MAX_LIST ? `\n… truncated at ${MAX_LIST} entries` : "";
  return out.join("\n") + note;
}

async function readFile({ path: rel, start_line = 1, max_lines = 300 } = {}) {
  const { abs, rel: cleanRel } = safeRepoPath(rel);
  const st = await fs.stat(abs).catch(() => null);
  if (!st?.isFile()) throw err(`${cleanRel} is not a file`);
  if (!looksText(abs)) throw err(`${cleanRel} is not a text file`);
  const text = await fs.readFile(abs, "utf8");
  const lines = text.split("\n");
  const start = Math.max(1, Number(start_line) || 1);
  const count = Math.max(1, Math.min(1000, Number(max_lines) || 300));
  const slice = lines.slice(start - 1, start - 1 + count);
  let body = slice.map((l, i) => `${start + i}: ${l}`).join("\n");
  if (body.length > MAX_FILE_BYTES) body = body.slice(0, MAX_FILE_BYTES) + "\n… truncated";
  const more = start - 1 + count < lines.length
    ? `\n… ${lines.length - (start - 1 + count)} more lines (file has ${lines.length}); call again with start_line=${start + count}`
    : "";
  return `${cleanRel} (lines ${start}-${Math.min(lines.length, start + count - 1)} of ${lines.length})\n${body}${more}`;
}

async function searchFiles({ pattern, path: rel = ".", case_sensitive = false } = {}) {
  if (typeof pattern !== "string" || !pattern.trim()) throw err("pattern is required");
  let re;
  try {
    re = new RegExp(pattern, case_sensitive ? "" : "i");
  } catch (e) {
    throw err(`invalid regex: ${e.message}`);
  }
  const { abs, rel: cleanRel } = safeRepoPath(rel);
  const files = [];
  const st = await fs.stat(abs).catch(() => null);
  if (st?.isFile()) files.push(cleanRel);
  else await walk(abs, cleanRel, files, 6);
  const hits = [];
  for (const f of files) {
    if (f.endsWith("/") || !looksText(f)) continue;
    let text;
    try {
      text = await fs.readFile(path.join(REPO_ROOT, f), "utf8");
    } catch {
      continue;
    }
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        hits.push(`${f}:${i + 1}: ${lines[i].trim().slice(0, 200)}`);
        if (hits.length >= MAX_MATCHES) break;
      }
    }
    if (hits.length >= MAX_MATCHES) break;
  }
  if (!hits.length) return `no matches for /${pattern}/ under ${cleanRel}`;
  const note = hits.length >= MAX_MATCHES ? `\n… stopped at ${MAX_MATCHES} matches; narrow the pattern or path` : "";
  return hits.join("\n") + note;
}

async function githubActivity({ kind = "prs", state = "open", limit = 10 } = {}) {
  const n = Math.max(1, Math.min(30, Number(limit) || 10));
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "agentic-os-chat" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const base = `https://api.github.com/repos/${GITHUB_REPO}`;
  let url;
  if (kind === "prs") url = `${base}/pulls?state=${state === "closed" ? "closed" : state === "all" ? "all" : "open"}&per_page=${n}&sort=updated&direction=desc`;
  else if (kind === "issues") url = `${base}/issues?state=${state === "closed" ? "closed" : state === "all" ? "all" : "open"}&per_page=${n}&sort=updated&direction=desc`;
  else if (kind === "commits") url = `${base}/commits?per_page=${n}`;
  else throw err(`unknown kind: ${kind} (use prs, issues, or commits)`);

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw err(`GitHub API responded ${res.status} for ${kind}`);
  const data = await res.json();
  if (!Array.isArray(data) || !data.length) return `no ${kind} found (${state})`;

  if (kind === "commits") {
    return data
      .map((c) => `${c.sha.slice(0, 7)} ${(c.commit?.message || "").split("\n")[0]} — ${c.commit?.author?.name || "?"} ${c.commit?.author?.date || ""}`)
      .join("\n");
  }
  return data
    .filter((x) => kind === "prs" || !x.pull_request) // issues endpoint also returns PRs
    .map((x) => `#${x.number} [${x.state}${x.draft ? ", draft" : ""}] ${x.title} — @${x.user?.login || "?"} updated ${x.updated_at} ${x.html_url}`)
    .join("\n");
}

async function loadMemory() {
  try {
    const raw = await fs.readFile(MEMORY_FILE, "utf8");
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
async function saveMemory(list) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(MEMORY_FILE, JSON.stringify(list, null, 2));
}

async function remember({ note } = {}) {
  if (typeof note !== "string" || !note.trim()) throw err("note is required");
  const list = await loadMemory();
  list.push({ id: Date.now().toString(36), at: new Date().toISOString(), note: note.trim().slice(0, 1000) });
  while (list.length > MAX_MEMORIES) list.shift();
  await saveMemory(list);
  return `remembered (${list.length} notes total)`;
}

async function recall({ query = "" } = {}) {
  const list = await loadMemory();
  if (!list.length) return "no memories saved yet";
  const q = String(query || "").trim().toLowerCase();
  const hits = q ? list.filter((m) => m.note.toLowerCase().includes(q)) : list;
  if (!hits.length) return `nothing remembered about "${query}"`;
  return hits
    .slice(-25)
    .map((m) => `[${m.at.slice(0, 10)}] ${m.note}`)
    .join("\n");
}

async function forget({ query } = {}) {
  if (typeof query !== "string" || !query.trim()) throw err("query is required");
  const list = await loadMemory();
  const q = query.trim().toLowerCase();
  const keep = list.filter((m) => !m.note.toLowerCase().includes(q));
  await saveMemory(keep);
  return `forgot ${list.length - keep.length} note(s)`;
}

async function currentTime() {
  const now = new Date();
  return `${now.toISOString()} (UTC) — local: ${now.toString()}`;
}

// ---- registry -----------------------------------------------------------

export const LOCAL_TOOLS = {
  current_time: {
    definition: {
      name: "current_time",
      description: "Get the current date and time. Call this before reasoning about 'today', 'now', deadlines, or how recent something is.",
      input_schema: { type: "object", properties: {}, additionalProperties: false },
    },
    run: currentTime,
  },
  list_files: {
    definition: {
      name: "list_files",
      description: `List files and folders in the Eureka Games repository (${GITHUB_REPO}), the browser arcade this app lives in. Paths are relative to the repo root. Hidden files, node_modules, and vendor are never listed.`,
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory to list, relative to the repo root. Default '.'" },
          depth: { type: "integer", description: "How many levels of subdirectories to include (0-4). Default 1." },
        },
        additionalProperties: false,
      },
    },
    run: listFiles,
  },
  read_file: {
    definition: {
      name: "read_file",
      description: "Read a text file from the repository with line numbers. Large files are paged: use start_line and max_lines to read further.",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to the repo root" },
          start_line: { type: "integer", description: "First line to return (1-based). Default 1." },
          max_lines: { type: "integer", description: "How many lines to return (max 1000). Default 300." },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
    run: readFile,
  },
  search_files: {
    definition: {
      name: "search_files",
      description: "Search the repository's text files with a regular expression. Returns file:line: matching text, capped at 60 hits.",
      input_schema: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "JavaScript regular expression to search for" },
          path: { type: "string", description: "Directory or file to search under, relative to the repo root. Default '.'" },
          case_sensitive: { type: "boolean", description: "Default false" },
        },
        required: ["pattern"],
        additionalProperties: false,
      },
    },
    run: searchFiles,
  },
  github_activity: {
    definition: {
      name: "github_activity",
      description: `Fetch live activity from the GitHub repository ${GITHUB_REPO}: open or closed pull requests, issues, or the latest commits. Use it whenever asked what is being worked on, what shipped, or what is broken.`,
      input_schema: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["prs", "issues", "commits"], description: "What to fetch" },
          state: { type: "string", enum: ["open", "closed", "all"], description: "For prs and issues. Default open." },
          limit: { type: "integer", description: "Max items (1-30). Default 10." },
        },
        required: ["kind"],
        additionalProperties: false,
      },
    },
    run: githubActivity,
  },
  remember: {
    definition: {
      name: "remember",
      description: "Save a short note to long-term memory so it survives across conversations: user preferences, facts they tell you about themselves, decisions, ongoing projects. Only store things worth knowing next time.",
      input_schema: {
        type: "object",
        properties: { note: { type: "string", description: "The fact to remember, in one or two sentences" } },
        required: ["note"],
        additionalProperties: false,
      },
    },
    run: remember,
  },
  recall: {
    definition: {
      name: "recall",
      description: "Search long-term memory for notes saved earlier. Call with no query to list recent notes, or with a keyword to filter.",
      input_schema: {
        type: "object",
        properties: { query: { type: "string", description: "Keyword to filter by (optional)" } },
        additionalProperties: false,
      },
    },
    run: recall,
  },
  forget: {
    definition: {
      name: "forget",
      description: "Delete memory notes containing a keyword. Use only when the user asks you to forget something.",
      input_schema: {
        type: "object",
        properties: { query: { type: "string", description: "Keyword; every note containing it is deleted" } },
        required: ["query"],
        additionalProperties: false,
      },
    },
    run: forget,
  },
};

// Anthropic-hosted tools: run on Anthropic's servers, no run() here.
export const SERVER_TOOLS = {
  web_search: { type: "web_search_20260209", name: "web_search", max_uses: 8 },
  web_fetch: { type: "web_fetch_20260209", name: "web_fetch", max_uses: 6, max_content_tokens: 30_000 },
  code_execution: { type: "code_execution_20260521", name: "code_execution" },
};

export function resolveTools(names) {
  const defs = [];
  const runners = new Map();
  for (const n of names) {
    if (LOCAL_TOOLS[n]) {
      defs.push(LOCAL_TOOLS[n].definition);
      runners.set(n, LOCAL_TOOLS[n].run);
    } else if (SERVER_TOOLS[n]) {
      defs.push(SERVER_TOOLS[n]);
    } else {
      throw new Error(`unknown tool: ${n}`);
    }
  }
  return { defs, runners };
}

// Run one local tool call, always returning a tool_result block.
export async function executeTool(runners, block) {
  const run = runners.get(block.name);
  if (!run) {
    return { type: "tool_result", tool_use_id: block.id, is_error: true, content: `unknown tool ${block.name}` };
  }
  try {
    const out = await run(block.input ?? {});
    return { type: "tool_result", tool_use_id: block.id, content: String(out ?? "") };
  } catch (e) {
    const msg = e?.toolError ? e.message : `tool failed: ${e?.message || e}`;
    return { type: "tool_result", tool_use_id: block.id, is_error: true, content: msg };
  }
}
