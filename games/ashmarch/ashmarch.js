// games/ashmarch/src/server/config.ts
var LLM_IDS = ["stub", "openai", "anthropic"];
var IMAGE_IDS = ["stub", "http"];
function pick(value, allowed, fallback, name) {
  const trimmed = (value ?? "").trim();
  const chosen = trimmed || fallback;
  if (!allowed.includes(chosen)) {
    throw new Error(`${name} must be one of ${allowed.join(", ")}. Received "${trimmed}".`);
  }
  return chosen;
}
function defaultEnv() {
  const proc = globalThis;
  return proc.process?.env ?? {};
}
function loadConfig(env = defaultEnv()) {
  const portRaw = (env.PORT ?? "").trim();
  const port = portRaw ? Number(portRaw) : 8787;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  return {
    llmProvider: pick(env.LLM_PROVIDER, LLM_IDS, "stub", "LLM_PROVIDER"),
    imageProvider: pick(env.IMAGE_PROVIDER, IMAGE_IDS, "stub", "IMAGE_PROVIDER"),
    openaiApiKey: (env.OPENAI_API_KEY ?? "").trim(),
    openaiModel: (env.OPENAI_MODEL ?? "").trim() || "gpt-4o-mini",
    anthropicApiKey: (env.ANTHROPIC_API_KEY ?? "").trim(),
    anthropicModel: (env.ANTHROPIC_MODEL ?? "").trim() || "claude-3-5-sonnet-latest",
    imageApiKey: (env.IMAGE_API_KEY ?? "").trim(),
    imageApiUrl: (env.IMAGE_API_URL ?? "").trim(),
    databaseUrl: (env.DATABASE_URL ?? "").trim() || "file:./data/ashmarch.sqlite",
    port
  };
}

// games/ashmarch/src/shared/companions.ts
var ASHMARCH_PARTY = [
  {
    id: "mara",
    name: "Mara Voss",
    title: "Road warden, retired badly",
    blurb: "Terse, protective, and finished with cleverness that gets people erased. She lost a gate once. She will not lose a person the same way.",
    quote: "Bridges that charge names don't give receipts."
  },
  {
    id: "ivo",
    name: "Ivo Quill",
    title: "Expelled archivist",
    blurb: "Eloquent, hungry, and convinced a copied page is a rescued life. He will argue with weather if it has a footnote.",
    quote: "The bridge is one sentence. Sentences are my trade."
  },
  {
    id: "sable",
    name: "Sable",
    title: "Lantern-spirit",
    blurb: "Bound to a cracked brass lamp. Speaks warmly, a little sideways, and remembers roads the map refuses to admit.",
    quote: "If the lamp goes dark I become weather. I would rather not."
  }
];
var LUMENFERRY_PARTY = [
  {
    id: "bram",
    name: "Bram Holt",
    title: "Ferry captain",
    blurb: "Keeps the night crossing and trusts a dark shore more than a counted one. He has ferried people away from lights that made them easy to take.",
    quote: "A lit lens is a finger pointing at every boat I love."
  },
  {
    id: "ness",
    name: "Ness Kite",
    title: "Glassblower's apprentice",
    blurb: "Still has glass in the creases of her hands. She stole the mold that could recast the lens, and she is done pretending the dark is a kindness.",
    quote: "They put the sun out and called it safety. I call it a kiln gone cold."
  },
  {
    id: "pell",
    name: "Pell",
    title: "Tide-bell in a cracked buoy",
    blurb: "A spirit housed in a buoy that should have sunk. Speaks in small bells, remembers drownings, and will not spend a note twice.",
    quote: "I can hold a town the way a bell holds a note. Only while the note remains."
  }
];
var BOOKS = [
  {
    id: "ashmarch",
    title: "Ashmarch",
    kicker: "Field survey, thirty years late",
    deck: "A town voted to be forgotten. You were hired to draw it back onto a map. Three companions come with you, and they do not share a conscience.",
    motiveLabel: "Why did you take the commission?",
    motivePlaceholder: "To pay a debt",
    beginLabel: "Take the road",
    companions: ASHMARCH_PARTY
  },
  {
    id: "lumenferry",
    title: "Lumenferry",
    kicker: "A lighthouse that chose the dark",
    deck: "The glassworks town put its own light out. You were hired to learn why the lens stays cold. The captain, the apprentice, and the buoy do not agree that it should ever burn again.",
    motiveLabel: "Why did you take the night crossing?",
    motivePlaceholder: "To keep the boats uncounted",
    beginLabel: "Take the ferry",
    companions: LUMENFERRY_PARTY
  }
];
var ALL_COMPANIONS = [...ASHMARCH_PARTY, ...LUMENFERRY_PARTY];
function bookById(id) {
  const found = BOOKS.find((book) => book.id === id);
  if (!found) throw new Error(`Unknown book ${id}`);
  return found;
}
function companionById(id) {
  const found = ALL_COMPANIONS.find((companion) => companion.id === id);
  if (!found) throw new Error(`Unknown companion ${id}`);
  return found;
}
function regard(trust) {
  if (trust >= 70) return "steadfast";
  if (trust >= 55) return "with you";
  if (trust >= 40) return "unsettled";
  if (trust >= 25) return "estranged";
  return "near a break";
}
var PLACES = {
  waystation: "The Salt Waystation",
  bridge: "The Bridge of Names",
  shrine: "The Mile-Shrine",
  flats: "The Salt Flats",
  orchard: "The Bone Orchard",
  market: "Veil Market",
  scriptorium: "The Drowned Scriptorium",
  bellcrypt: "The Bellcrypt",
  choir: "The Choir Stair",
  wight: "The Salt Wight",
  ending: "After the Choice",
  quay: "The Night Quay",
  causeway: "The Glass Causeway",
  eelbeds: "The Eelbeds",
  lenshouse: "The Lenshouse",
  kiln: "The Cold Kiln",
  bellpool: "The Bellpool",
  boarding: "The Press-Gang Skiff"
};

// games/ashmarch/src/server/db.ts
var STORAGE_KEY = "ashmarch-chronicle-v1";
function emptyFile() {
  return { campaigns: [], messages: [], memories: [], saveSlot: null, nextMessageId: 1, nextMemoryId: 1 };
}
function browserStorage() {
  return {
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.campaigns)) return null;
        return parsed;
      } catch {
        return null;
      }
    },
    save(file) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
    }
  };
}
var GameDb = class {
  file;
  storage;
  constructor(storage = browserStorage()) {
    this.storage = storage;
    const loaded = storage.load();
    this.file = loaded ?? emptyFile();
    this.file.campaigns ??= [];
    this.file.messages ??= [];
    this.file.memories ??= [];
    this.file.saveSlot ??= null;
    this.file.nextMessageId ??= 1;
    this.file.nextMemoryId ??= 1;
  }
  close() {
  }
  transaction(fn) {
    const snapshot = structuredClone(this.file);
    try {
      fn();
      this.storage.save(this.file);
    } catch (error) {
      this.file = snapshot;
      this.storage.save(this.file);
      throw error;
    }
  }
  insertCampaign(row) {
    this.file.campaigns.push(structuredClone(row));
  }
  updateCampaign(id, state, scene, updatedAt) {
    const row = this.file.campaigns.find((campaign) => campaign.id === id);
    if (!row) throw new Error(`Campaign ${id} disappeared during save.`);
    row.state = structuredClone(state);
    row.scene = structuredClone(scene);
    row.updatedAt = updatedAt;
  }
  insertMessages(campaignId, messages) {
    for (const message of messages) {
      this.file.messages.push({
        ...message,
        id: this.file.nextMessageId++,
        campaignId
      });
    }
  }
  insertMemories(campaignId, turn, memories) {
    for (const memory of memories) {
      this.file.memories.push({
        id: this.file.nextMemoryId++,
        campaignId,
        turn,
        kind: memory.kind,
        text: memory.text
      });
    }
  }
  getCampaign(id) {
    const row = this.file.campaigns.find((campaign) => campaign.id === id);
    if (!row) return null;
    return {
      ...structuredClone(row),
      bookId: row.bookId === "lumenferry" ? "lumenferry" : "ashmarch",
      state: normalizeState(row.state)
    };
  }
  listMessages(campaignId) {
    return this.file.messages.filter((message) => message.campaignId === campaignId).map((row) => ({
      id: row.id,
      campaignId: row.campaignId,
      turn: row.turn,
      role: row.role,
      speaker: row.speaker,
      companionId: row.companionId ?? null,
      stance: row.stance ?? null,
      mood: row.mood,
      text: row.text
    }));
  }
  listMemories(campaignId) {
    return this.file.memories.filter((memory) => memory.campaignId === campaignId).map((row) => ({
      id: row.id,
      campaignId: row.campaignId,
      turn: row.turn,
      kind: row.kind,
      text: row.text
    }));
  }
  listCampaigns() {
    return [...this.file.campaigns].sort((a, b) => a.updatedAt < b.updatedAt ? 1 : -1).map((row) => {
      const state = normalizeState(row.state);
      const bookId = row.bookId === "lumenferry" ? "lumenferry" : "ashmarch";
      const last = [...this.file.messages].reverse().find((message) => message.campaignId === row.id);
      return {
        id: row.id,
        bookId,
        bookTitle: bookById(bookId).title,
        playerName: row.playerName,
        motive: row.motive,
        updatedAt: row.updatedAt,
        placeTitle: PLACES[state.location],
        ended: state.ended,
        ending: state.flags.ending,
        memoryCount: this.file.memories.filter((memory) => memory.campaignId === row.id).length,
        lastLine: last?.text ?? ""
      };
    });
  }
  listMemoriesByPlayer(playerName, exceptCampaignId) {
    const name = playerName.toLowerCase();
    const ids = new Set(
      this.file.campaigns.filter((campaign) => campaign.playerName.toLowerCase() === name && campaign.id !== exceptCampaignId).map((campaign) => campaign.id)
    );
    return this.file.memories.filter((memory) => ids.has(memory.campaignId)).map((row) => ({
      id: row.id,
      campaignId: row.campaignId,
      turn: row.turn,
      kind: row.kind,
      text: row.text
    }));
  }
  deleteCampaign(id) {
    const before = this.file.campaigns.length;
    this.file.campaigns = this.file.campaigns.filter((campaign) => campaign.id !== id);
    if (this.file.campaigns.length === before) return false;
    this.file.messages = this.file.messages.filter((message) => message.campaignId !== id);
    this.file.memories = this.file.memories.filter((memory) => memory.campaignId !== id);
    if (this.file.saveSlot?.campaignId === id) this.file.saveSlot = null;
    this.storage.save(this.file);
    return true;
  }
  writeSaveSlot(campaignId, label, savedAt) {
    this.file.saveSlot = { campaignId, label, savedAt };
    this.storage.save(this.file);
  }
  getSaveSlot() {
    return this.file.saveSlot ? { ...this.file.saveSlot } : null;
  }
  clearSaveSlot() {
    this.file.saveSlot = null;
    this.storage.save(this.file);
  }
};
function normalizeState(state) {
  return { ...state, lastRoll: state.lastRoll ?? null };
}

// games/ashmarch/src/server/validate.ts
var HttpError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
};
function cleanName(raw) {
  if (typeof raw !== "string") throw new HttpError(400, "Give a name the road can hold.");
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < 1 || name.length > 40) {
    throw new HttpError(400, "Give a name the road can hold (1\u201340 characters).");
  }
  if (!/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} '’.-]{0,39}$/u.test(name)) {
    throw new HttpError(400, "Use a name made of letters, numbers, spaces, and simple punctuation.");
  }
  return name;
}
function cleanMotive(raw) {
  if (typeof raw !== "string") throw new HttpError(400, "Say why you took the commission.");
  const motive = raw.replace(/[\u0000-\u001F]+/g, " ").replace(/\s+/g, " ").trim();
  if (motive.length < 1 || motive.length > 200) {
    throw new HttpError(400, "Keep the reason between 1 and 200 characters.");
  }
  return motive;
}
function cleanBook(raw) {
  if (raw === void 0 || raw === null || raw === "") return "ashmarch";
  if (raw === "ashmarch" || raw === "lumenferry") return raw;
  throw new HttpError(400, "Choose Ashmarch or Lumenferry.");
}
function cleanAction(raw) {
  if (typeof raw !== "string") throw new HttpError(400, "Say what you do.");
  const text = raw.replace(/[\u0000-\u001F]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text) throw new HttpError(400, "Say what you do.");
  if (text.length > 500) {
    throw new HttpError(400, "Keep it to 500 characters. The road is listening, not filing.");
  }
  return text;
}

// games/ashmarch/src/server/game/scenes.ts
function plate(sky0, sky1, ground, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 640" role="img">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sky0}"/>
      <stop offset="100%" stop-color="${sky1}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="640" fill="url(#sky)"/>
  <rect y="460" width="1200" height="180" fill="${ground}"/>
  ${body}
</svg>`;
}
function party(x, y) {
  return `
    <g fill="#1a140f">
      <circle cx="${x}" cy="${y - 28}" r="9"/>
      <path d="M${x - 14} ${y + 18} l8 -24 h12 l8 24z"/>
      <circle cx="${x + 36}" cy="${y - 30}" r="9"/>
      <path d="M${x + 22} ${y + 18} l8 -26 h12 l8 26z"/>
      <circle cx="${x + 70}" cy="${y - 18}" r="6" fill="#e4b15c"/>
      <rect x="${x + 67}" y="${y - 10}" width="6" height="22" fill="#8a6a32"/>
    </g>`;
}
function waystation() {
  return plate(
    "#2a1b16",
    "#c47a45",
    "#231910",
    `
    <circle cx="180" cy="120" r="36" fill="#f0d2a4" opacity="0.85"/>
    <g fill="#1a120e">
      <polygon points="150,300 430,210 760,300"/>
      <rect x="210" y="300" width="470" height="190"/>
      <rect x="250" y="340" width="70" height="54" fill="#e4b15c"/>
      <rect x="360" y="340" width="70" height="54" fill="#1a120e" stroke="#e4b15c" stroke-width="6"/>
      <rect x="530" y="360" width="54" height="130" fill="#3a2418"/>
    </g>
    <rect x="860" y="250" width="14" height="210" fill="#1a120e"/>
    <circle cx="867" cy="236" r="28" fill="#e4b15c"/>
    <circle cx="867" cy="236" r="12" fill="#fff4d2"/>
    ${party(760, 500)}
    <g fill="#f0e6d4" opacity="0.45">
      <circle cx="120" cy="180" r="2"/><circle cx="240" cy="90" r="1.5"/><circle cx="980" cy="140" r="2"/>
      <circle cx="1040" cy="220" r="1.5"/><circle cx="80" cy="300" r="1.4"/><circle cx="700" cy="80" r="1.6"/>
    </g>`
  );
}
function bridge() {
  return plate(
    "#1c2430",
    "#d9c7a4",
    "#14181f",
    `
    <circle cx="980" cy="110" r="42" fill="#f4efe2"/>
    <rect x="0" y="430" width="1200" height="90" fill="#07080c"/>
    <path d="M80 470 Q600 250 1120 470" fill="none" stroke="#efe6d4" stroke-width="28"/>
    <path d="M80 470 Q600 330 1120 470" fill="none" stroke="#1c2430" stroke-width="8"/>
    <g fill="#efe6d4">
      <rect x="560" y="250" width="46" height="18"/>
      <rect x="572" y="232" width="34" height="18"/>
      <rect x="584" y="214" width="22" height="18"/>
      <rect x="590" y="196" width="14" height="18"/>
    </g>
    <rect x="586" y="188" width="22" height="14" fill="#c45c26"/>
    ${party(300, 430)}
    `
  );
}
function flats() {
  return plate(
    "#8a6a48",
    "#ead7b8",
    "#cbb892",
    `
    <ellipse cx="300" cy="470" rx="280" ry="48" fill="#e6d3b0"/>
    <ellipse cx="820" cy="490" rx="340" ry="60" fill="#d7c09a"/>
    <g fill="none" stroke="#f7f1e4" stroke-width="10">
      <path d="M470 470 C500 300 560 300 590 470"/>
      <path d="M540 470 C570 250 650 250 690 470"/>
      <path d="M640 470 C670 280 740 280 780 470"/>
      <path d="M730 470 C760 320 820 320 850 470"/>
    </g>
    <circle cx="1040" cy="150" r="30" fill="#f2e2c4" opacity="0.7"/>
    ${party(180, 500)}
    `
  );
}
function market() {
  return plate(
    "#4a2e2a",
    "#e6d3bf",
    "#2a1d18",
    `
    <g>
      <rect x="120" y="330" width="150" height="140" fill="#1a120e"/>
      <polygon points="90,330 195,250 300,330" fill="#a33b32"/>
      <rect x="360" y="350" width="170" height="120" fill="#1a120e"/>
      <polygon points="330,350 445,270 560,350" fill="#8d3d34"/>
      <rect x="640" y="320" width="150" height="150" fill="#1a120e"/>
      <polygon points="610,320 715,230 820,320" fill="#c45c26"/>
    </g>
    <path d="M900 470 v-150 h70 l-10 40 h-30 v110z" fill="#d9cbb8"/>
    <path d="M930 340 h30 v26 h-30z" fill="#1a120e"/>
    <path d="M910 390 h18 v18 h-18z M940 390 h18 v18 h-18z" fill="#1a120e"/>
    ${party(240, 510)}
    `
  );
}
function scriptorium() {
  return plate(
    "#0e2a28",
    "#7fbfb2",
    "#123430",
    `
    <g fill="#163e3a" stroke="#d7efe8" stroke-width="6">
      <path d="M160 470 V250 h40 a80 80 0 0 1 160 0 h40 V470"/>
      <path d="M500 470 V230 h40 a90 90 0 0 1 180 0 h40 V470"/>
      <path d="M860 470 V270 h30 a60 60 0 0 1 120 0 h30 V470"/>
    </g>
    <rect y="390" width="1200" height="250" fill="#1c6b62" opacity="0.55"/>
    <rect x="560" y="340" width="90" height="14" fill="#e7dcc7"/>
    <rect x="596" y="354" width="18" height="50" fill="#e7dcc7"/>
    <path d="M575 330 h60 v16 h-60z" fill="#f4efe2"/>
    `
  );
}
function bellcrypt() {
  return plate(
    "#120e16",
    "#2a2030",
    "#100c12",
    `
    <g fill="#c9a15a">
      <path d="M180 120 h16 v40 a70 70 0 0 0 140 0 v-40 h16 v46 a90 90 0 0 1 -172 0z"/>
      <path d="M470 90 h16 v50 a80 80 0 0 0 160 0 v-50 h16 v56 a100 100 0 0 1 -192 0z"/>
      <path d="M820 140 h14 v36 a60 60 0 0 0 120 0 v-36 h14 v42 a78 78 0 0 1 -148 0z"/>
    </g>
    <g fill="#f0d78a">
      <rect x="230" y="210" width="16" height="10"/>
      <rect x="530" y="200" width="22" height="12"/>
      <rect x="560" y="220" width="10" height="16"/>
      <rect x="860" y="230" width="14" height="9"/>
    </g>
    <path d="M600 470 l-20 -40 h40z" fill="#e7dcc7"/>
    `
  );
}
function ending(kind) {
  if (kind === "mercy") {
    return plate(
      "#16141c",
      "#3a342c",
      "#12100e",
      `
      <path d="M360 480 V220 h80 a160 160 0 0 1 320 0 h80 V480z" fill="#1a1714" stroke="#e7dcc7" stroke-width="8"/>
      <rect x="560" y="300" width="80" height="180" fill="#0e0c0a"/>
      <circle cx="620" cy="250" r="18" fill="#8a6a32"/>
      <rect x="500" y="250" width="240" height="16" fill="#c45c26"/>
      ${party(180, 500)}
      `
    );
  }
  if (kind === "kept") {
    return plate(
      "#1a140e",
      "#6a4a2a",
      "#1a140f",
      `
      <circle cx="600" cy="300" r="150" fill="#e4b15c"/>
      <circle cx="600" cy="300" r="108" fill="#fff1c9"/>
      <g fill="#1a140f">
        <rect x="540" y="250" width="28" height="40"/>
        <rect x="580" y="230" width="18" height="60"/>
        <rect x="610" y="260" width="34" height="28"/>
        <polygon points="560,310 600,270 650,320 610,340"/>
      </g>
      <rect x="588" y="450" width="24" height="70" fill="#8a6a32"/>
      ${party(250, 510)}
      `
    );
  }
  return plate(
    "#3a2418",
    "#f0c48a",
    "#2a1c14",
    `
    <g fill="#1a120e">
      <rect x="140" y="300" width="120" height="180"/>
      <rect x="290" y="250" width="90" height="230"/>
      <rect x="410" y="280" width="160" height="200"/>
      <rect x="600" y="230" width="80" height="250"/>
      <rect x="710" y="310" width="140" height="170"/>
      <rect x="880" y="260" width="110" height="220"/>
    </g>
    <g fill="#e4b15c">
      <rect x="170" y="330" width="22" height="16"/><rect x="210" y="360" width="22" height="16"/>
      <rect x="450" y="320" width="26" height="18"/><rect x="500" y="360" width="26" height="18"/>
      <rect x="630" y="280" width="18" height="14"/><rect x="750" y="350" width="22" height="16"/>
      <rect x="910" y="300" width="20" height="14"/><rect x="950" y="340" width="20" height="14"/>
    </g>
    ${party(80, 500)}
    `
  );
}
function hash(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function weather(scene) {
  let s = hash(`${scene.bookId ?? "ashmarch"}|${scene.location}|${scene.mood}|${scene.ending ?? ""}`) || 1;
  const rand = () => {
    s = Math.imul(1664525, s) + 1013904223 >>> 0;
    return s / 4294967296;
  };
  const tint = scene.bookId === "lumenferry" ? "#d7fff6" : "#f6e7c8";
  const stars = Array.from({ length: 18 }, () => {
    const x = Math.round(rand() * 1160 + 16);
    const y = Math.round(rand() * 200 + 12);
    const r = (rand() * 1.7 + 0.45).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${tint}"/>`;
  }).join("");
  const moonX = Math.round(90 + rand() * 960);
  const moonY = Math.round(46 + rand() * 80);
  const drift = Array.from({ length: 8 }, () => {
    const x = Math.round(rand() * 1100 + 40);
    const y = Math.round(340 + rand() * 180);
    return `<circle cx="${x}" cy="${y}" r="${(rand() * 2.2 + 0.6).toFixed(2)}" fill="${tint}" opacity="0.35"/>`;
  }).join("");
  return `<g opacity="0.9">${stars}<circle cx="${moonX}" cy="${moonY}" r="28" fill="${tint}"/><circle cx="${moonX + 14}" cy="${moonY - 6}" r="22" fill="#100e0c" opacity="0.38"/>${drift}</g>`;
}
function shrine() {
  return plate(
    "#24160f",
    "#c9a27a",
    "#1a120e",
    `
    <path d="M80 500 L520 210 L560 210 L1040 500" fill="#3a2a22"/>
    <rect x="470" y="250" width="220" height="150" fill="#6d5846"/>
    <rect x="500" y="280" width="160" height="90" fill="#1a120e"/>
    <g fill="#e7d7bc" font-size="0">
      <rect x="518" y="298" width="28" height="6"/>
      <rect x="556" y="312" width="40" height="6"/>
      <rect x="520" y="328" width="22" height="6"/>
      <rect x="560" y="342" width="36" height="6" fill="#e4b15c"/>
    </g>
    <path d="M80 470 Q600 390 1120 470" fill="none" stroke="#efe6d4" stroke-width="10" opacity="0.4"/>
    ${party(180, 500)}
    `
  );
}
function orchard() {
  return plate(
    "#6e5a48",
    "#efe2cf",
    "#cbb892",
    `
    <g fill="none" stroke="#f7f1e4" stroke-width="8">
      <path d="M180 490 C200 300 280 280 300 490"/>
      <path d="M420 490 C450 240 560 240 590 490"/>
      <path d="M760 490 C790 260 900 270 930 490"/>
    </g>
    <g fill="#f4efe8">
      <circle cx="250" cy="360" r="7"/><circle cx="500" cy="330" r="8"/><circle cx="540" cy="360" r="6"/>
      <circle cx="850" cy="340" r="8" fill="#e7d2a8"/>
    </g>
    <path d="M120 180 q20 30 0 50 q20 -10 0 -50" fill="none" stroke="#f7f1e4" opacity="0.6"/>
    ${party(140, 510)}
    `
  );
}
function choir() {
  return plate(
    "#140e16",
    "#3a2a38",
    "#120c12",
    `
    <path d="M160 500 L430 180 h40 L700 500" fill="#2a2030"/>
    <g fill="#c9a15a">
      <path d="M300 220 h8 v20 a28 28 0 0 0 56 0 v-20 h8 v24 a40 40 0 0 1 -72 0z"/>
      <path d="M430 250 h8 v16 a22 22 0 0 0 44 0 v-16 h8 v20 a32 32 0 0 1 -60 0z"/>
    </g>
    <rect x="470" y="360" width="18" height="140" fill="#e7dcc7"/>
    ${party(760, 500)}
    `
  );
}
function quay() {
  return plate(
    "#071820",
    "#1f6f78",
    "#041016",
    `
    <rect x="860" y="80" width="36" height="360" fill="#d7fff6"/>
    <polygon points="848,80 908,80 890,20 866,20" fill="#0b3a44"/>
    <circle cx="878" cy="150" r="18" fill="#062833" stroke="#d7fff6" stroke-width="4"/>
    <path d="M40 430 h1120" stroke="#14343c" stroke-width="8"/>
    <path d="M180 470 q80 -30 160 0 q80 30 160 0 q80 -30 160 0" fill="none" stroke="#7ec8c3" stroke-width="6" opacity="0.7"/>
    <path d="M120 500 h280 l40 -40 h-240 z" fill="#123840"/>
    <rect x="150" y="450" width="16" height="50" fill="#d7fff6"/>
    ${party(420, 490)}
    `
  );
}
function causeway() {
  return plate(
    "#062028",
    "#9fd7ff",
    "#07141c",
    `
    <rect y="430" width="1200" height="80" fill="#02080c"/>
    <g fill="#d7fff8" opacity="0.85">
      <polygon points="80,470 280,390 340,470"/>
      <polygon points="360,470 560,360 640,470"/>
      <polygon points="660,470 860,380 940,470"/>
      <polygon points="960,470 1120,410 1160,470"/>
    </g>
    <g fill="none" stroke="#7ec8c3" stroke-width="3" opacity="0.8">
      <path d="M100 440 q40 -20 80 0"/><path d="M400 420 q50 -24 90 0"/><path d="M700 430 q40 -16 70 0"/>
    </g>
    <rect x="1040" y="120" width="28" height="280" fill="#d7fff6" opacity="0.5"/>
    ${party(200, 450)}
    `
  );
}
function eelbeds() {
  return plate(
    "#042028",
    "#1a4a44",
    "#06302a",
    `
    <g fill="#0e4a40">
      <path d="M40 470 q30 -80 10 -140 q20 40 0 140"/>
      <path d="M120 480 q40 -120 16 -200 q24 60 0 200"/>
      <path d="M220 470 q24 -70 8 -120 q16 30 0 120"/>
      <path d="M900 480 q36 -110 12 -180 q20 50 0 180"/>
      <path d="M1000 470 q30 -90 10 -150 q18 40 0 150"/>
    </g>
    <path d="M300 420 C420 360 520 460 680 400" fill="none" stroke="#9fd7c8" stroke-width="8"/>
    <path d="M360 450 C480 500 600 390 760 460" fill="none" stroke="#d7fff6" stroke-width="5" opacity="0.7"/>
    <circle cx="640" cy="430" r="22" fill="#c9a15a"/>
    <path d="M628 430 h24" stroke="#1a140f" stroke-width="3"/>
    ${party(160, 500)}
    `
  );
}
function lenshouse() {
  return plate(
    "#07141c",
    "#245868",
    "#0c1c22",
    `
    <circle cx="620" cy="300" r="170" fill="#d7fff6" opacity="0.18" stroke="#d7fff6" stroke-width="10"/>
    <circle cx="620" cy="300" r="90" fill="none" stroke="#9fd7ff" stroke-width="6"/>
    <circle cx="620" cy="300" r="8" fill="#f2c14e"/>
    <rect x="180" y="360" width="220" height="140" fill="#0e2c34"/>
    <polygon points="160,360 290,250 420,360" fill="#123840"/>
    <rect x="860" y="160" width="40" height="340" fill="#d7fff6" opacity="0.35"/>
    ${party(240, 500)}
    `
  );
}
function kiln() {
  return plate(
    "#1a120e",
    "#3a2418",
    "#140e0c",
    `
    <path d="M360 500 V240 h80 a140 160 0 0 1 280 0 h80 V500" fill="#2a1c16" stroke="#e07a45" stroke-width="8"/>
    <ellipse cx="600" cy="430" rx="90" ry="28" fill="#e07a45" opacity="0.85"/>
    <ellipse cx="600" cy="430" rx="40" ry="12" fill="#f2c14e"/>
    <g fill="#9fd7ff" opacity="0.55">
      <ellipse cx="180" cy="390" rx="30" ry="46"/>
      <ellipse cx="980" cy="370" rx="24" ry="40"/>
      <ellipse cx="1040" cy="420" rx="18" ry="28"/>
    </g>
    <rect x="560" y="200" width="80" height="12" fill="#e7dcc7"/>
    `
  );
}
function bellpool() {
  return plate(
    "#06141c",
    "#1f6f78",
    "#041018",
    `
    <ellipse cx="600" cy="420" rx="340" ry="90" fill="#0e3a44"/>
    <ellipse cx="600" cy="420" rx="220" ry="48" fill="#14343c"/>
    <circle cx="600" cy="400" r="36" fill="#c9a15a"/>
    <path d="M588 400 h24 M600 386 v28" stroke="#1a140f" stroke-width="3"/>
    <path d="M520 250 h12 v30 a40 40 0 0 0 80 0 v-30 h12 v34 a54 54 0 0 1 -104 0z" fill="#d7fff6" opacity="0.8"/>
    <rect x="980" y="80" width="26" height="300" fill="#d7fff6" opacity="0.4"/>
    ${party(180, 470)}
    `
  );
}
function ferryEnding(kind) {
  if (kind === "relit") {
    return plate(
      "#071820",
      "#d7fff6",
      "#062028",
      `
      <rect x="860" y="40" width="34" height="420" fill="#f4efe2"/>
      <polygon points="150,470 878,120 980,470" fill="#f2c14e" opacity="0.35"/>
      <circle cx="878" cy="150" r="22" fill="#fff6d8"/>
      <path d="M80 500 h260 l30 -36 h-220 z" fill="#123840"/>
      <path d="M420 510 h180 l20 -24 h-150 z" fill="#0e2c34"/>
      ${party(180, 490)}
      `
    );
  }
  if (kind === "held") {
    return plate(
      "#07141c",
      "#245868",
      "#041016",
      `
      <circle cx="620" cy="330" r="150" fill="#1f6f78"/>
      <circle cx="620" cy="330" r="108" fill="#d7fff6"/>
      <g fill="#062833">
        <rect x="560" y="280" width="22" height="40"/>
        <rect x="600" y="250" width="16" height="70"/>
        <rect x="640" y="290" width="30" height="28"/>
      </g>
      <circle cx="620" cy="470" r="28" fill="#c9a15a"/>
      ${party(220, 510)}
      `
    );
  }
  return plate(
    "#041016",
    "#0e2c34",
    "#02080c",
    `
    <rect x="900" y="70" width="30" height="400" fill="#0e2c34" stroke="#1f6f78" stroke-width="4"/>
    <circle cx="915" cy="150" r="16" fill="#062028" stroke="#1f6f78" stroke-width="3"/>
    <path d="M80 490 h240 l28 -30 h-200 z" fill="#0b1c24"/>
    <path d="M400 500 h160 l16 -20 h-130 z" fill="#102830"/>
    <path d="M640 505 h120 l12 -16 h-100 z" fill="#0b1c24"/>
    ${party(160, 480)}
    `
  );
}
function wight() {
  return plate(
    "#3a2a22",
    "#c47a45",
    "#d9d2c3",
    `
    <ellipse cx="620" cy="430" rx="220" ry="70" fill="#efe6d4"/>
    <path d="M430 390 l70 -150 40 90 80 -170 50 140 90 -80 30 170z" fill="#f4f0e6" stroke="#2a2118" stroke-width="6"/>
    <circle cx="760" cy="250" r="34" fill="#1a140f"/>
    <path d="M740 246 h12 M770 246 h12" stroke="#e4b15c" stroke-width="4"/>
    <path d="M500 470 q120 40 240 0" fill="none" stroke="#8a6a32" stroke-width="8"/>
    ${party(180, 500)}
    `
  );
}
function boarding() {
  return plate(
    "#062833",
    "#1f6f78",
    "#04161c",
    `
    <path d="M80 470 h1040" stroke="#9fd7ff" stroke-width="6" opacity="0.45"/>
    <path d="M640 360 l220 40 -30 70 -180 10z" fill="#102830" stroke="#d7fff6" stroke-width="4"/>
    <path d="M700 300 v70 M760 280 v90 M820 310 v60" stroke="#c9a15a" stroke-width="6"/>
    <circle cx="900" cy="120" r="26" fill="#062028" stroke="#9fd7ff" stroke-width="4"/>
    ${party(220, 470)}
    `
  );
}
function drawScene(scene) {
  if (scene.bookId === "lumenferry" && scene.location === "ending") return ferryEnding(scene.ending);
  switch (scene.location) {
    case "waystation":
      return waystation();
    case "bridge":
      return bridge();
    case "flats":
      return flats();
    case "market":
      return market();
    case "scriptorium":
      return scriptorium();
    case "bellcrypt":
      return bellcrypt();
    case "shrine":
      return shrine();
    case "orchard":
      return orchard();
    case "choir":
      return choir();
    case "wight":
      return wight();
    case "quay":
      return quay();
    case "causeway":
      return causeway();
    case "eelbeds":
      return eelbeds();
    case "lenshouse":
      return lenshouse();
    case "kiln":
      return kiln();
    case "bellpool":
      return bellpool();
    case "boarding":
      return boarding();
    case "ending":
      return ending(scene.ending);
    default:
      return waystation();
  }
}
function renderScene(scene) {
  const book = scene.bookId ?? "ashmarch";
  const drawn = drawScene(scene).replace("<svg ", `<svg data-book="${book}" `);
  return drawn.replace("</svg>", `${weather(scene)}</svg>`);
}

// games/ashmarch/src/server/providers/stubImage.ts
var StubImageProvider = class {
  id = "stub";
  async generate(request) {
    const svg = renderScene(request);
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    return {
      mime: "image/svg+xml",
      dataUrl,
      alt: request.alt,
      prompt: request.prompt
    };
  }
};

// games/ashmarch/src/shared/dice.ts
function rollD20(seed) {
  let hash2 = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash2 ^= seed.charCodeAt(i);
    hash2 = Math.imul(hash2, 16777619);
  }
  return (hash2 >>> 0) % 20 + 1;
}
function modifierFromTrust(trust) {
  const value = trust ?? 50;
  return Math.max(-1, Math.min(4, Math.round((value - 50) / 10)));
}
function makeCheck(input) {
  const seed = `${input.playerName}|${input.turn}|${input.choiceId}`;
  const natural = rollD20(seed);
  const total = natural + input.modifier;
  const success = natural === 1 ? false : natural === 20 ? true : total >= input.dc;
  const faces = Array.from({ length: 8 }, (_, index) => rollD20(`${seed}|${index}`));
  faces.push(natural);
  return {
    id: `${input.choiceId}:${input.turn}:${natural}`,
    kind: input.kind,
    label: input.label,
    actor: input.actor,
    die: "d20",
    natural,
    modifier: input.modifier,
    total,
    dc: input.dc,
    success,
    faces,
    turn: input.turn
  };
}
function rollSentence(roll) {
  const sign = roll.modifier >= 0 ? "+" : "";
  const verdict = roll.success ? "The roll holds." : "The roll fails.";
  return `${roll.actor} throws a d20 for ${roll.label}: ${roll.natural} ${sign}${roll.modifier} = ${roll.total} against DC ${roll.dc}. ${verdict}`;
}

// games/ashmarch/src/server/game/prompt.ts
function chronicleSystem(bookId = "ashmarch") {
  const book = bookById(bookId);
  const people = book.companions.map((companion) => `${companion.name} (companionId ${companion.id}) \u2014 ${companion.title}. ${companion.blurb}`).join("\n");
  const ids = book.companions.map((companion) => companion.id).join("|");
  return [
    `You are the Chronicle, the game master of ${book.title}, a single-player text adventure.`,
    "One human plays. Three companions travel with them and argue with the player and with each other.",
    "The same player may carry memories from another campaign. Honor those memories. Do not erase them.",
    "Write in second person, present tense. Be concrete. Do not mention being a model.",
    `Return JSON only: {"narration": string, "lines": [{"speaker": string, "companionId": "${ids}", "text": string, "mood": string, "stance": "for"|"against"|"aside"}]}`,
    "narration is 2 short paragraphs. lines includes at least two different companions.",
    "If the facts say the party disagrees, the lines must take both sides and address each other by name.",
    "Do not invent locations, items, deaths, or endings that are not in the facts.",
    "",
    people
  ].join("\n");
}
function chronicleUser(input) {
  const book = bookById(input.bookId ?? input.state.bookId ?? "ashmarch");
  const memories = input.memories.length ? input.memories.map((memory) => `- ${memory}`).join("\n") : "- none yet";
  const guidance = input.canonLines.map((line3) => `- ${line3.speaker} [${line3.stance}/${line3.mood}]: ${line3.text}`).join("\n");
  const kits = book.companions.map((companion) => `${companion.name} carries: ${(input.state.partyKits[companion.id] ?? []).join(", ") || "nothing"}`).join("\n");
  return [
    `Book: ${book.title}`,
    `Player name: ${input.playerName}`,
    `Why they took the commission: ${input.motive}`,
    `Place: ${PLACES[input.state.location]}`,
    `Beat: ${input.state.beat}`,
    `Ended: ${input.state.ended ? "yes" : "no"}`,
    input.state.lastRoll ? `Dice this turn: ${rollSentence(input.state.lastRoll)}` : "Dice this turn: none",
    `Flags: ${JSON.stringify(input.state.flags)}`,
    `Trust: ${JSON.stringify(input.state.trust)}`,
    `Mood: ${JSON.stringify(input.state.mood)}`,
    `Inventory: ${input.state.inventory.join(", ") || "empty"}`,
    kits,
    "Memories the Chronicle must honor, including other campaigns under this name:",
    memories,
    input.playerText ? `What the player just did: ${input.playerText}` : "This is the opening, before the player acts.",
    "Facts that happened, which you may sharpen but must not contradict:",
    input.canonNarration,
    "How the companions answered, which you may sharpen but must not reverse:",
    guidance
  ].join("\n");
}

// games/ashmarch/src/server/game/parse.ts
var BEAT_CHOICES = {
  waystation: [
    { id: "fears", patterns: [/afraid/, /\bfear\b/, /afraid of losing/] },
    { id: "bridge", patterns: [/\bbridge\b/] },
    { id: "flats", patterns: [/\bflats\b/, /long way/, /salt flats/] },
    { id: "study_map", patterns: [/look at the map/, /study the map/, /the map again/] },
    { id: "rest", patterns: [/rest until/, /lamp is low/] }
  ],
  bridge: [
    { id: "own_name", patterns: [/my own name/, /give (the bridge )?my name/, /\bmy name\b/, /true name/] },
    { id: "false_name", patterns: [/false name/, /fake name/, /invent a name/, /\ba lie\b/] },
    { id: "mara_name", patterns: [/mara.{0,48}(name|offer)/, /warden-?name/] },
    { id: "ivo_name", patterns: [/ivo.{0,48}(name|offer|index)/, /stolen name/, /name from the index/] },
    { id: "sable_name", patterns: [/sable.{0,48}(name|offer|remember)/, /remembered name/, /name you remember/] },
    { id: "shrine", patterns: [/mile-shrine/, /climb down/] }
  ],
  shrine: [
    { id: "shrine_take", patterns: [/carved name/, /take the name/] },
    { id: "shrine_leave", patterns: [/leave the shrine/, /as it is/] }
  ],
  flats: [
    { id: "shelter", patterns: [/shelter/, /\bribs\b/, /rib cage/, /inside the rib/] },
    { id: "push", patterns: [/push through/, /\bstorm\b/, /keep walking/, /press on/] },
    { id: "orchard", patterns: [/bone chime/, /orchard/] },
    { id: "fight_wight", patterns: [/salt-wight/, /fight the wight/, /stand and fight/] }
  ],
  wight: [
    { id: "wight_strike", patterns: [/strike the wight/, /with mara/, /road-knife/] },
    { id: "wight_brace", patterns: [/brace/, /call sable/, /sable's lamp/] }
  ],
  orchard: [
    { id: "orchard_pick", patterns: [/salt fruit/, /pick the/] },
    { id: "orchard_leave", patterns: [/leave the fruit/, /on the branch/] }
  ],
  market: [
    { id: "trade_seal", patterns: [/warden seal/, /mara's seal/, /trade mara/, /seal for/] },
    { id: "trade_index", patterns: [/index page/, /ivo's index/, /trade ivo/, /trade the index/] },
    { id: "trade_memory", patterns: [/sable.{0,40}memor/, /give up a memory/, /let sable/] },
    { id: "refuse", patterns: [/refuse/, /another way/, /floodgate/, /don't trade/, /do not trade/, /\bsneak\b/] }
  ],
  scriptorium: [
    { id: "read", patterns: [/read (it |the vote )?aloud/, /read the vote/, /^read\b/] },
    { id: "copy", patterns: [/\bcopy\b/, /into the map/] },
    { id: "burn", patterns: [/\bburn\b/] },
    { id: "leave", patterns: [/untouched/, /leave the record/, /leave it/] }
  ],
  bellcrypt: [
    { id: "complete_map", patterns: [/complete the map/, /wake vellum/, /wake the town/, /finish the map/] },
    { id: "seal_crypt", patterns: [/seal the crypt/, /still gone/, /tell my employer/, /\blie\b/] },
    { id: "lamp_keep", patterns: [/in the lamp/, /keep the town/, /ask sable/] },
    { id: "choir", patterns: [/choir stair/, /listen at the choir/] }
  ],
  choir: [{ id: "choir_back", patterns: [/back to the bells/, /choir stair behind/] }],
  quay: [
    { id: "fears_light", patterns: [/afraid the light/, /light will show/] },
    { id: "ferry_bell", patterns: [/ferry bell/] },
    { id: "causeway", patterns: [/causeway/, /toward the lens/] },
    { id: "eelbeds", patterns: [/eelbeds/, /\bwade\b/] }
  ],
  causeway: [
    { id: "steady", patterns: [/steady the skiff/, /glass sings/] },
    { id: "cut", patterns: [/cut across/, /tide turns/] },
    { id: "fight_skiff", patterns: [/press-gang/, /fight the skiff/] }
  ],
  boarding: [
    { id: "skiff_repel", patterns: [/repel the boarding/, /boarding party/, /fight them off/] },
    { id: "skiff_slip", patterns: [/slip under the hull/, /under the hull/, /slip past/] }
  ],
  eelbeds: [
    { id: "follow_bell", patterns: [/pell's bell/, /under the water/, /follow pell/] },
    { id: "weed", patterns: [/keep to the weed/, /look down/] }
  ],
  lenshouse: [
    { id: "trade_charm", patterns: [/tide-charm/, /bram's tide/] },
    { id: "trade_mold", patterns: [/stolen mold/, /ness's stolen/] },
    { id: "trade_note", patterns: [/bell-note/, /spend a bell/] },
    { id: "weed_ladder", patterns: [/weed ladder/, /refuse and climb/] }
  ],
  kiln: [
    { id: "read_log", patterns: [/firing log aloud/, /read the firing/] },
    { id: "copy_log", patterns: [/tide-book/, /copy the log/] },
    { id: "smash_log", patterns: [/smash the firing/, /smash the log/] },
    { id: "leave_log", patterns: [/leave the log/] }
  ],
  bellpool: [
    { id: "pool_argue", patterns: [/argue the light/, /one more time/] },
    { id: "relight", patterns: [/relight/] },
    { id: "keep_dark", patterns: [/keep the light dark/, /warn the boats/] },
    { id: "hold_town", patterns: [/hold the town/, /in the buoy/] }
  ],
  ending: [{ id: "tomorrow", patterns: [/tomorrow/] }]
};
function negated(text, index) {
  const window2 = text.slice(Math.max(0, index - 32), index);
  return /\b(don't|do not|never|won't|will not|refuse to|not)\b/.test(window2);
}
function matchPattern(text, pattern) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const re = new RegExp(pattern.source, flags);
  let found;
  while (found = re.exec(text)) {
    if (!negated(text, found.index)) return true;
    if (found[0].length === 0) break;
  }
  return false;
}
var NAME_PATTERNS = {
  mara: /\bmara\b/,
  ivo: /\bivo\b/,
  sable: /\bsable\b/,
  bram: /\bbram\b/,
  ness: /\bness\b/,
  pell: /\bpell\b/
};
function addressOf(text, party2) {
  const hits = [];
  for (const id of party2) {
    const found = NAME_PATTERNS[id].exec(text);
    if (found) hits.push({ id, index: found.index });
  }
  hits.sort((a, b) => a.index - b.index);
  return hits[0]?.id ?? null;
}
function parseIntent(text, beat, suggestions, party2 = ["mara", "ivo", "sable"]) {
  const lower = text.trim().toLowerCase();
  const exact = suggestions.find((suggestion) => suggestion.label.toLowerCase() === lower || suggestion.id === lower);
  if (exact) {
    if (exact.id === "look" || exact.id === "inventory" || exact.id === "recall") return { type: exact.id };
    return { type: "choice", id: exact.id };
  }
  if (matchPattern(lower, /\b(inventory|pockets|what am i carrying|what do we carry)\b/)) return { type: "inventory" };
  if (matchPattern(lower, /\b(remember|memories|what do you remember|read the road)\b/)) return { type: "recall" };
  for (const choice of BEAT_CHOICES[beat]) {
    if (choice.patterns.some((pattern) => matchPattern(lower, pattern))) return { type: "choice", id: choice.id };
  }
  if (matchPattern(lower, /^(look|examine|study)\b/) || matchPattern(lower, /\blook around\b/)) {
    return { type: "look" };
  }
  const companionId = addressOf(lower, party2);
  if (companionId) return { type: "address", companionId };
  return { type: "unknown" };
}

// games/ashmarch/src/server/game/lumenferry.ts
var PARTY = ["bram", "ness", "pell"];
function lumenferryState() {
  return {
    bookId: "lumenferry",
    beat: "quay",
    location: "quay",
    flags: {},
    inventory: ["tide chart", "charcoal", "ferry commission"],
    partyKits: {
      bram: ["tide-charm"],
      ness: ["stolen mold"],
      pell: ["cracked buoy"]
    },
    trust: { bram: 50, ness: 54, pell: 58 },
    mood: { bram: "watchful", ness: "bright", pell: "ringing" },
    turn: 0,
    ended: false,
    lastRoll: null
  };
}
function line(id, text, mood, stance) {
  return { companionId: id, speaker: companionById(id).name, text, mood, stance };
}
function bump(state, id, delta, mood) {
  const current = state.trust[id] ?? 50;
  state.trust[id] = Math.max(0, Math.min(100, current + delta));
  state.mood[id] = mood;
}
function dropKit(state, id, item) {
  state.partyKits[id] = (state.partyKits[id] ?? []).filter((entry) => entry !== item);
}
function addItem(state, item) {
  if (!state.inventory.includes(item)) state.inventory.push(item);
}
function dropItem(state, item) {
  state.inventory = state.inventory.filter((entry) => entry !== item);
}
function clip(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 80 ? `${clean.slice(0, 77)}\u2026` : clean;
}
function echoes(state, playerName) {
  const flags = state.flags;
  const out = [];
  if (flags.skiffFought === "repelled") out.push("The press-gang skiff is still short the hands Bram struck off the rail.");
  if (flags.skiffFought === "slipped") out.push("You slipped the press-gang and the skiff is still looking at the wrong patch of water.");
  if (flags.skiffFought === "bloodied") out.push("Blood from the boarding is still drying on the rope.");
  if (flags.glassChoice === "steady") out.push("The glass causeway still hums with the note you refused to rush.");
  if (flags.glassChoice === "cut") out.push("A shortcut across the glass left a white nick in the causeway.");
  if (flags.eelChoice === "follow") out.push("Pell's bell still has eel-water in it.");
  if (flags.eelChoice === "weed") out.push("Weed from the beds is knotted around your wrist.");
  if (flags.lensToll === "charm") out.push("Bram's tide-charm is hanging on the lenshouse latch.");
  if (flags.lensToll === "mold") out.push("Ness's stolen mold was the price of the kiln door.");
  if (flags.lensToll === "note") out.push("Pell is missing the bell-note that could have held a shoreline.");
  if (flags.lensToll === "none") out.push("Salt from the weed ladder is still drying on your cuffs.");
  if (flags.kilnRecord === "read") out.push("The firing log has been spoken, and the press-gang is no longer a rumor.");
  if (flags.kilnRecord === "copied") out.push("A copy of the blackout rides in the tide-book.");
  if (flags.kilnRecord === "smashed") out.push("The firing log is glass-dust on the kiln floor.");
  if (flags.kilnRecord === "left") out.push("The firing log is still in the cold kiln, unread by the town.");
  if (flags.bellListened) out.push(`${playerName} listened to the ferry bell before choosing a shore.`);
  return out;
}
function lead(state, playerName) {
  const all = echoes(state, playerName);
  const latest = all[all.length - 1];
  return latest ? `${latest} ` : "";
}
function sceneFor(state) {
  const title = PLACES[state.location];
  const mood = state.location === "ending" ? state.flags.ending ?? "dark" : state.location;
  const altBits = {
    quay: "A night quay, a dark lighthouse, and a ferry tied under an unlit lens.",
    causeway: "Slabs of sea-glass crossing black water toward a lightless tower.",
    boarding: "A press-gang skiff against the glass, hooks out, the party braced to meet it.",
    eelbeds: "Weed, eel-shine, and a cracked buoy ringing under the surface.",
    lenshouse: "A huge cold lens in a round room, and a latch that wants a toll.",
    kiln: "A glass kiln gone dark, with one firing log on the anneal shelf.",
    bellpool: "A tide pool under the tower where a buoy can hold a whole town.",
    ending: state.flags.ending === "relit" ? "The lighthouse beam rakes the boats and makes every hull easy to count." : state.flags.ending === "held" ? "A cracked buoy glowing with a town folded inside the note." : "A dark shore, and boats slipping past an unlit lens."
  };
  return {
    bookId: "lumenferry",
    location: state.location,
    title,
    alt: `${title}. ${altBits[state.location] ?? "The night ferry and a light that was put out on purpose."}`,
    mood,
    ending: state.flags.ending,
    prompt: `Illustrated field plate of ${title}, mood ${mood}, night glassworks and a darkened lighthouse, sea-glass colors, no lettering`
  };
}
function finish(state, spoken) {
  state.lastRoll = spoken.roll ?? null;
  return {
    state,
    narration: spoken.narration,
    lines: spoken.lines,
    newMemories: spoken.memories,
    scene: sceneFor(state)
  };
}
function throwCheck(prior, playerName, choiceId, kind, label, actor, dc) {
  return makeCheck({
    playerName,
    turn: prior.turn,
    choiceId,
    kind,
    label,
    actor: companionById(actor).name,
    modifier: modifierFromTrust(prior.trust[actor]),
    dc
  });
}
function motiveLine(motive, playerName) {
  const text = motive.toLowerCase();
  if (/\b(debt|owe|owing|coin|unpaid)\b/.test(text)) {
    return line(
      "bram",
      `You said debt, ${playerName}. A lit lens is how collectors find a harbor. I will not pay your ledger with my boats.`,
      "warning",
      "against"
    );
  }
  if (/\b(light|lens|glass|dark)\b/.test(text)) {
    return line(
      "ness",
      "You came talking about the light. Good. Bram will call that a threat. I call it the job.",
      "hopeful",
      "for"
    );
  }
  return null;
}
function resolveLumenferryOpening(playerName, motive) {
  const state = lumenferryState();
  const extra = motiveLine(motive, playerName);
  const lines = [
    line(
      "bram",
      "Leave it dark. I have ferried children under that unlit lens while a press-gang counted hulls by the shine. Ness wants a beacon. Beacons make a list.",
      "watchful",
      "against"
    ),
    line(
      "ness",
      "The kiln has been cold for nine years, Bram. You call the dark a mercy and it is only a room where no one can see what broke. The mold is in my coat. The lens can be born again.",
      "bright",
      "for"
    ),
    line(
      "pell",
      `${playerName}, they will ring this argument until the tide turns. Bram fears a counted boat. Ness fears a craft that dies of caution. I am the bell that used to warn both. I am down one note already, and I feel the missing.`,
      "ringing",
      "aside"
    )
  ];
  if (extra) lines.push(extra);
  return finish(state, {
    narration: `The Night Quay smells of tar, cold glass, and a lighthouse that has agreed to be a shadow. Lumenferry's lenshouse is a black coin against the stars. The ferry bumps the piles as if it would rather leave. You are ${playerName}. You were hired to learn why the light stays out.

You told them you came because ${motive}. Bram Holt keeps a hand on the rope and will not look at the tower. Ness Kite has glass-dust on her cuff and the stolen mold knocking her ribs when she breathes. Between them a cracked buoy ticks: Pell, a tide-bell that should have sunk, still ringing.`,
    lines,
    memories: [{ kind: "fact", text: `${playerName} took the Lumenferry commission because: ${motive}` }]
  });
}
function arriveLenshouse(state, playerName) {
  return `${lead(state, playerName)}The lenshouse is a round dark room and one lens the size of a wagon wheel, filmed with salt. It could throw a road of light across every boat in the reach. The latch on the kiln stair will not move for free.

"Proof," says a voice in the glass, ${playerName}. "A tide-charm. A mold. Or a bell-note warm enough to steer by."`;
}
function arriveKiln(state, playerName) {
  return `${lead(state, playerName)}The kiln is cold in a way that feels chosen. Crucibles hold the ghosts of bowls. On the anneal shelf, a firing log in a glassblower's hand: the town darkened the lens on purpose, ${playerName}. A press-gang was coming up the reach, counting boats by the beam. They put the sun out so the count would fail.

The log can be read, copied, smashed, or left in the cold.`;
}
function arriveBellpool(state, playerName) {
  return `${lead(state, playerName)}Under the tower, the bellpool holds a buoy-ring of still water. Relighting the lens would save the craft and expose every hull. Keeping the dark would save the boats and finish the kiln. Pell could hold the town in the buoy the way a bell holds a note \u2014 kept, not displayed \u2014 if the note is still there, ${playerName}.`;
}
function enterKiln(next) {
  next.location = "kiln";
  next.beat = "kiln";
  next.flags.knowsBlackout = true;
}
function enterBellpool(next) {
  next.location = "bellpool";
  next.beat = "bellpool";
  next.flags.knowsBlackout = true;
}
function enterEnding(next) {
  next.location = "ending";
  next.beat = "ending";
  next.ended = true;
}
function endingNarration(prior, playerName, body) {
  const carried = echoes(prior, playerName).join(" ");
  return `${body}${carried ? `

${carried}` : ""}`;
}
function applyChoice(next, prior, id, playerName) {
  switch (id) {
    case "fears_light": {
      const repeat = prior.flags.fearsOfLight === true;
      next.flags.fearsOfLight = true;
      bump(next, "bram", repeat ? 0 : 3, "unguarded");
      bump(next, "ness", repeat ? 0 : 3, "serious");
      bump(next, "pell", repeat ? 0 : 3, "open");
      return {
        narration: `You ask what each of them is afraid the light will show. The unlit lens suddenly looks like a lid. Nobody reaches for the causeway or the beds. They reach, carefully, for the thing the dark has been hiding.`,
        lines: [
          line(
            "bram",
            "Boats. Names chalked on a gang's slate. I have seen a beam do the work of a finger. Ness would trade that safety for a beautiful pane.",
            "unguarded",
            "against"
          ),
          line(
            "ness",
            "The kiln. If we never relight, the last honest craft in Lumenferry dies and Bram will call the corpse a strategy. I am afraid of becoming a person who agrees.",
            "serious",
            "for"
          ),
          line(
            "pell",
            "I am afraid the light will show the drownings I already carry, and I am afraid the dark will make me forget the note I have left. Spend me carefully.",
            "open",
            "aside"
          )
        ],
        memories: repeat ? [] : [
          {
            kind: "relationship",
            text: "On the Night Quay the party named their fears: Bram's counted boats, Ness's dying kiln, and Pell's last bell-note."
          }
        ]
      };
    }
    case "ferry_bell": {
      const repeat = prior.flags.bellListened === true;
      next.flags.bellListened = true;
      bump(next, "bram", repeat ? 0 : 2, "steady");
      bump(next, "pell", repeat ? 0 : 3, "pleased");
      bump(next, "ness", repeat ? 0 : -1, "impatient");
      return {
        narration: `You make them listen to the ferry bell. It is a small iron sound, not a lighthouse, and it knows the difference. For a moment the argument has to share the rope with a thing that only warns, and does not point.`,
        lines: [
          line("bram", "That bell has never made a list. Remember the difference when Ness calls every flame a kindness.", "steady", "against"),
          line("ness", "A bell is a beautiful excuse, Bram. It does not anneal glass, and it does not feed a town that forgot how to see.", "impatient", "for"),
          line("pell", "I like this smaller ringing. It does not ask me to be a sun.", "pleased", "aside")
        ],
        memories: repeat ? [] : [{ kind: "fact", text: `${playerName} made the party listen to the ferry bell before choosing a road.` }]
      };
    }
    case "causeway": {
      next.flags.ferryRoute = "causeway";
      next.location = "causeway";
      next.beat = "causeway";
      bump(next, "ness", 5, "vindicated");
      bump(next, "bram", -4, "set");
      bump(next, "pell", 0, "alert");
      return {
        narration: `You take the glass causeway. Ness is already on the first slab, which answers her boot with a note like a wet finger on a rim. Bram comes last, as if the glass might file him.

The tower is closer than the argument. The slabs are clear enough to show the drop, and the glass is singing whether you asked it to or not.`,
        lines: [
          line("ness", "Hear that. The road remembers being a lens. Bram, you cannot scold a resonance.", "vindicated", "for"),
          line("bram", `I can scold the person who chose it, ${playerName}. Singing glass is how a reach tells a gang where to look.`, "set", "against"),
          line("pell", "The note is honest and too loud. We can keep time with it, or we can cut it short.", "alert", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} took the glass causeway toward the lens over Bram's objection.` }]
      };
    }
    case "eelbeds": {
      next.flags.ferryRoute = "eelbeds";
      next.location = "eelbeds";
      next.beat = "eelbeds";
      bump(next, "bram", 5, "relieved");
      bump(next, "ness", -4, "thwarted");
      bump(next, "pell", 2, "wide");
      return {
        narration: `You wade the eelbeds and stay off the road. Ness makes a hurt sound and pins the mold higher under her coat so the water will have to work for it. Bram nods, which is a speech.

The beds are black silver. Eels write under the surface. Pell's buoy dips until the crack drinks, and the tower has to be reached without a path that shines.`,
        lines: [
          line("bram", "Good. No slab, no glint. We arrive as mud, which is harder to count.", "relieved", "for"),
          line("ness", "Mud is not a craft, Bram. It is a delay with eels in it.", "thwarted", "against"),
          line("pell", "The eels know the old bell-line. Follow me under, or keep to the weed and don't look where I look.", "wide", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} waded the eelbeds so the party would not shine on the causeway.` }]
      };
    }
    case "fight_skiff": {
      next.location = "boarding";
      next.beat = "boarding";
      bump(next, "bram", 2, "ready");
      bump(next, "ness", -1, "furious");
      bump(next, "pell", 1, "low");
      return {
        narration: `A skiff comes off the dark with its lantern hooded and its hooks already out. Press-gang. They have been counting hulls by ear, and the glass told them where you were, ${playerName}.

Bram wants the rail. Pell can take you under the hull if the water agrees. Ness is already angry that the argument became a fight.`,
        lines: [
          line("bram", "Repel them. Hooks first, then the hands holding the hooks. We do not get counted tonight.", "ready", "for"),
          line("ness", "A fight on the glass is a beacon with blood on it, Bram. Slip under and leave them a note they cannot read.", "furious", "against"),
          line("pell", `${playerName}, the hull has a shadow big enough for three and a buoy. Say which fear you trust.`, "low", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} met the press-gang skiff on the glass causeway.` }]
      };
    }
    case "skiff_repel": {
      const roll = throwCheck(prior, playerName, "skiff_repel", "combat", "repel the press-gang", "bram", 13);
      next.location = "lenshouse";
      next.beat = "lenshouse";
      if (roll.success) {
        next.flags.skiffFought = "repelled";
        bump(next, "bram", 6, "grim");
        bump(next, "ness", 1, "shaken");
        bump(next, "pell", 2, "ringing");
      } else {
        next.flags.skiffFought = "bloodied";
        bump(next, "bram", -4, "cut");
        bump(next, "ness", -2, "angry");
        bump(next, "pell", -1, "thin");
      }
      const clash = roll.success ? "Bram takes the first hook on a boat-hook of his own and the skiff sheers off, short two grips and a count. You reach the lenshouse with the fight still loud in your wrists." : "The hook finds Bram's sleeve and the count almost finds you. You break free bloodied, and the lenshouse door is the only thing that does not try to inventory you.";
      return {
        narration: `${rollSentence(roll)}

${clash}

${arriveLenshouse(next, playerName)}`,
        lines: roll.success ? [
          line("bram", "Off my rail. If they come back they come back missing a story. I can live with that.", "grim", "for"),
          line("ness", "You made a noise the whole reach will repeat. I am glad we are alive and I am not glad about the method.", "shaken", "against"),
          line("pell", "The bell kept time. That is all a buoy can promise in a fight. The lens is next, and it is still cold.", "ringing", "aside")
        ] : [
          line("bram", "They marked me. Don't make a speech about it. Get inside before they finish the number.", "cut", "against"),
          line("ness", "This is what a lit fear looks like even in the dark, Bram. I still have the mold. Try not to bleed on it.", "angry", "for"),
          line("pell", "I can smell the iron. The drownings can too. Walk. The latch will argue, but it will not bite.", "thin", "aside")
        ],
        memories: [
          {
            kind: "choice",
            text: `${playerName} fought the press-gang beside Bram. ${rollSentence(roll)} Outcome: ${roll.success ? "repelled" : "bloodied"}.`
          }
        ],
        roll
      };
    }
    case "skiff_slip": {
      const roll = throwCheck(prior, playerName, "skiff_slip", "skill", "slip under the press-gang hull", "pell", 13);
      next.location = "lenshouse";
      next.beat = "lenshouse";
      if (roll.success) {
        next.flags.skiffFought = "slipped";
        bump(next, "pell", 6, "pleased");
        bump(next, "bram", 3, "grudging");
        bump(next, "ness", 2, "wet");
      } else {
        next.flags.skiffFought = "bloodied";
        bump(next, "pell", -4, "sorry");
        bump(next, "bram", -2, "cut");
        bump(next, "ness", -2, "coughing");
      }
      const slip = roll.success ? "Pell takes you under the hull. The gang's oars comb the wrong dark. You surface at the lenshouse stair uncounted, which Bram treats as a professional miracle." : "The slip is a half-second late. An oar finds a shoulder, the water finds a lung, and you arrive at the lenshouse coughing and counted at the edge of a number.";
      return {
        narration: `${rollSentence(roll)}

${slip}

${arriveLenshouse(next, playerName)}`,
        lines: roll.success ? [
          line("pell", "Uncounted. Hold that word the way I hold a note. It does not last unless you keep your mouth off the light.", "pleased", "aside"),
          line("bram", "I hate owing a buoy. I hate being counted more. Thank you, and do not expect a speech.", "grudging", "for"),
          line("ness", "We are wet and we are here and the lens is still a corpse. I can work with the last fact if you two are done being proud.", "wet", "against")
        ] : [
          line("pell", "I missed the shadow. That is on me. Don't spend the next note pretending I am bottomless.", "sorry", "against"),
          line("ness", "So the elegant drowning failed too. Bram, your hook is looking less ridiculous and I am furious about it.", "coughing", "for"),
          line("bram", "Inside. Bleed later. The latch is a problem I understand.", "cut", "aside")
        ],
        memories: [
          {
            kind: "choice",
            text: `${playerName} tried to slip the press-gang under the hull. ${rollSentence(roll)} Outcome: ${roll.success ? "slipped" : "bloodied"}.`
          }
        ],
        roll
      };
    }
    case "steady": {
      next.flags.glassChoice = "steady";
      next.location = "lenshouse";
      next.beat = "lenshouse";
      bump(next, "bram", 4, "grudging");
      bump(next, "ness", 2, "pleased");
      bump(next, "pell", 4, "calm");
      return {
        narration: `You steady the skiff \u2014 there is always a skiff, even on a road \u2014 and let the glass finish its phrase. The causeway answers more quietly once it has been heard. You reach the lenshouse with the song behind you instead of under an accusation.

${arriveLenshouse(next, playerName)}`,
        lines: [
          line("pell", "Thank you for not cutting a note in half. Most people do, and then blame the bell.", "calm", "aside"),
          line("bram", "Quieter is not safe. It is only less rude. I will take less rude and still hate the door.", "grudging", "against"),
          line("ness", "The glass let us pass because we listened. Bram, write that next to your fear so they have to share a page.", "pleased", "for")
        ],
        memories: [{ kind: "choice", text: `${playerName} steadied the crossing and let the glass causeway finish its note.` }]
      };
    }
    case "cut": {
      next.flags.glassChoice = "cut";
      next.location = "lenshouse";
      next.beat = "lenshouse";
      bump(next, "ness", 4, "rushed");
      bump(next, "bram", -3, "angry");
      bump(next, "pell", -4, "clipped");
      return {
        narration: `You cut across before the tide turns. The slab rings once, offended, and a white nick stays in the glass like a comma you cannot unsay. You are at the lenshouse faster. The causeway will mention you later.

${arriveLenshouse(next, playerName)}`,
        lines: [
          line("ness", "Fast was the point. The kiln does not care about our manners.", "rushed", "for"),
          line("bram", "You chipped a road that can be seen from the reach. I felt the gang's attention turn its head.", "angry", "against"),
          line("pell", "That note will scar. I keep scars. I do not enjoy collecting them for sport.", "clipped", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} cut across the glass causeway and left a nick in the road.` }]
      };
    }
    case "follow_bell": {
      next.flags.eelChoice = "follow";
      next.location = "lenshouse";
      next.beat = "lenshouse";
      bump(next, "pell", 6, "deep");
      bump(next, "bram", 2, "wet");
      bump(next, "ness", -2, "shaken");
      return {
        narration: `You follow Pell's bell under the water. The beds close over your shoulders for three strokes and the eels make a tunnel of dull silver. You come up at the lenshouse stair with the buoy leaking and the tower unimpressed.

${arriveLenshouse(next, playerName)}`,
        lines: [
          line("pell", "You came where the drownings are. I will remember that you did not make me go alone.", "deep", "aside"),
          line("bram", "Ugly, dark, and uncounted. I approve of the route and not of the temperature.", "wet", "for"),
          line("ness", "I still have the mold. I also have a lungful of other people's lost bells. Bram, don't you dare call that a victory speech.", "shaken", "against")
        ],
        memories: [{ kind: "choice", text: `${playerName} followed Pell's bell under the eelbeds to the lenshouse.` }]
      };
    }
    case "weed": {
      next.flags.eelChoice = "weed";
      addItem(next, "weed-knot");
      next.location = "lenshouse";
      next.beat = "lenshouse";
      bump(next, "bram", 3, "practical");
      bump(next, "ness", 1, "impatient");
      bump(next, "pell", -1, "wistful");
      return {
        narration: `You keep to the weed and do not look down. It braids your wrist without asking. The eels write their sentences for someone else. The lenshouse stair is slick and ordinary, which Bram treats as a professional courtesy.

${arriveLenshouse(next, playerName)}`,
        lines: [
          line("bram", "Eyes up. The beds charge interest if you audit them.", "practical", "for"),
          line("ness", "We are here, we are uninspired, and the lens is still dead. I can work with two of those.", "impatient", "against"),
          line("pell", "You didn't look. The drownings noticed the politeness. They are not offended. They are lonely.", "wistful", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} kept to the weed in the eelbeds and did not look down.` }]
      };
    }
    case "trade_charm": {
      dropKit(next, "bram", "tide-charm");
      next.flags.lensToll = "charm";
      enterKiln(next);
      bump(next, "bram", -14, "hollowed");
      bump(next, "ness", 5, "relieved");
      bump(next, "pell", -2, "sorry");
      return {
        narration: `Bram hangs his tide-charm on the latch. It is a cheap bit of lead and a life of knowing when to leave. The latch drinks the knowing. He does not grab it back. The kiln stair opens on cold air.

${arriveKiln(next, playerName)}`,
        lines: [
          line("bram", "That charm has turned me out of three bad harbors. You spent the turn. Don't thank me. Thanks make it a favor.", "hollowed", "against"),
          line("ness", "The door is open. I hate the price and I will not pretend the kiln can wait for a kinder coin.", "relieved", "for"),
          line("pell", "A tide-charm is a small bell. The latch is wearing it better than is fair.", "sorry", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} traded Bram Holt's tide-charm to open the lenshouse.` }]
      };
    }
    case "trade_mold": {
      dropKit(next, "ness", "stolen mold");
      next.flags.lensToll = "mold";
      enterKiln(next);
      bump(next, "ness", -14, "stricken");
      bump(next, "bram", 4, "grim");
      bump(next, "pell", 0, "watchful");
      return {
        narration: `Ness puts the stolen mold in the latch's shadow. It is the shape of a lens that does not exist yet. The glass takes the shape and forgets the hands that stole it. She watches her empty pocket the way people watch a boat leave without them.

${arriveKiln(next, playerName)}`,
        lines: [
          line("ness", "That was the last mold. Congratulate the door. I am busy becoming an apprentice of nothing.", "stricken", "against"),
          line("bram", "A tool for a stair. I won't gloat. I will also not pretend I'm sorry the relighting just got harder.", "grim", "for"),
          line("pell", "The mold screamed in a voice like cooling glass. The latch has indigestion. Good, and not good.", "watchful", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} traded Ness Kite's stolen mold for the kiln stair.` }]
      };
    }
    case "trade_note": {
      next.flags.lensToll = "note";
      next.flags.pellNoteSpent = true;
      enterKiln(next);
      bump(next, "pell", -14, "faded");
      bump(next, "bram", -4, "angry");
      bump(next, "ness", 4, "shamed");
      return {
        narration: `Pell gives the latch a bell-note: the one that could hold a shoreline in a buoy. The crack in the buoy goes quiet, a held breath with nowhere to land. The stair opens. Pell is still here, and poorer.

${arriveKiln(next, playerName)}`,
        lines: [
          line("pell", "I know the water is under me. I no longer have the note that could fold a town into it. Leave me a minute before you ask me to hold anything.", "faded", "against"),
          line("ness", "I wanted a door. I did not want it out of Pell's chest. Bram, if you say you told us so, I will put glass in your boot.", "shamed", "for"),
          line("bram", "You spent the bell to skip a wet climb. I am angry enough without company. Don't you dare agree with me out loud.", "angry", "against")
        ],
        memories: [{ kind: "choice", text: "Pell spent a bell-note to pay the lenshouse latch." }]
      };
    }
    case "weed_ladder": {
      next.flags.lensToll = "none";
      enterKiln(next);
      bump(next, "bram", 7, "proud");
      bump(next, "ness", -4, "sulking");
      bump(next, "pell", 3, "bright");
      return {
        narration: `You refuse the latch. It does not argue. It simply stops being a way through. Bram finds the weed ladder by the smell of old rope and older stubbornness. You climb. Ness keeps the mold in her teeth for three rungs and still has it at the top. The kiln lets you in unbought.

${arriveKiln(next, playerName)}`,
        lines: [
          line("bram", "Good. Let the glass keep its empty price. I like us better scraped than sold.", "proud", "for"),
          line("ness", "My knees are a casualty and my schedule is filing a complaint. There was a latch, Bram. Latches exist so craftspeople don't have to bleed on rungs.", "sulking", "against"),
          line("pell", "The weed knows you refused. It is a petty plant. It will remember in your cuffs.", "bright", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} refused the lenshouse toll and climbed the weed ladder.` }]
      };
    }
    case "read_log": {
      next.flags.kilnRecord = "read";
      enterBellpool(next);
      bump(next, "bram", 3, "grim");
      bump(next, "ness", 4, "intent");
      bump(next, "pell", 2, "listening");
      return {
        narration: `You read the firing log aloud. The cold kiln seems to hear a decision it already survived. Lumenferry put the lens out so a press-gang, counting boats by the beam, would find only dark water. Your voice makes the blackout present tense again. Under the tower, the bellpool starts to notice the party.

${arriveBellpool(next, playerName)}`,
        lines: [
          line("bram", "There. You heard it. The dark was a strategy, not a mood. Ness, don't you turn a survival into a scandal.", "grim", "against"),
          line("ness", "I heard a town that saved its boats and buried its craft in the same hour. Both of those are true, Bram. I will not let you keep only the one that flatters you.", "intent", "for"),
          line("pell", "The press-gang's count failed. The drownings did not. A dark lens does not unmake a storm.", "listening", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} read the firing log: Lumenferry darkened the lens so a press-gang could not count the boats.` }]
      };
    }
    case "copy_log": {
      next.flags.kilnRecord = "copied";
      addItem(next, "copied blackout");
      enterBellpool(next);
      bump(next, "ness", 6, "elated");
      bump(next, "bram", -8, "alarmed");
      bump(next, "pell", 0, "wary");
      return {
        narration: `You copy the log into the tide-book, charcoal faithful to every panicked comma. The original stays on the shelf. You now own the town's blackout in duplicate, and duplicates have a habit of being read by the wrong harbor.

${arriveBellpool(next, playerName)}`,
        lines: [
          line("ness", "Yes. A reason that exists once can be smashed by accident. A reason that exists twice has to be answered.", "elated", "for"),
          line("bram", "You just made the press-gang a traveling reader. If that book leaves this reach I will assume you meant it to.", "alarmed", "against"),
          line("pell", "The copy is heavier than the log. Words gain weight when they know they might be used.", "wary", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} copied Lumenferry's blackout into the tide-book.` }]
      };
    }
    case "smash_log": {
      next.flags.kilnRecord = "smashed";
      enterBellpool(next);
      bump(next, "bram", 8, "relieved");
      bump(next, "ness", -12, "devastated");
      bump(next, "pell", -2, "solemn");
      return {
        narration: `You smash the firing log. It breaks the way thin glass does, all at once and personally, before Ness finishes the word "wait." The reason for the dark survives only in the four of you, which is a fragile archive. The bellpool sounds almost grateful.

${arriveBellpool(next, playerName)}`,
        lines: [
          line("bram", "Good. Some instructions should not survive their war. The boats are safer unread.", "relieved", "for"),
          line("ness", "That was the last honest page in a cold kiln. You didn't smash a threat, ${playerName}. You smashed the only witness the craft had.", "devastated", "against"),
          line("pell", "Ash and glass-dust sound the same if you are a bell. I will not pick a side while my metal is still deciding.", "solemn", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} smashed the firing log in the cold kiln.` }]
      };
    }
    case "leave_log": {
      next.flags.kilnRecord = "left";
      enterBellpool(next);
      bump(next, "bram", 2, "wary");
      bump(next, "ness", -3, "frustrated");
      bump(next, "pell", 3, "quiet");
      return {
        narration: `You leave the log in the kiln. The blackout stays a local fact, unwitnessed by any harbor that isn't already standing in the cold. Ness hates the restraint. Bram does not trust it. The bellpool takes you anyway.

${arriveBellpool(next, playerName)}`,
        lines: [
          line("bram", "Leaving it is not the same as ending it. Pages get found. Still. You didn't carry it out. I'll take that.", "wary", "for"),
          line("ness", "We walked all this way to become polite. The log will outlive the politeness, and so will the dark.", "frustrated", "against"),
          line("pell", "Untouched is a kind of respect. It is also a kind of delay. I can ring either.", "quiet", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} left the firing log untouched in the cold kiln.` }]
      };
    }
    case "pool_argue": {
      const repeat = prior.flags.poolArgued === true;
      next.flags.poolArgued = true;
      return {
        narration: `You let them argue the light one more time before anybody touches it. The pool holds their voices the way it holds rain. Bram talks about slates and children. Ness talks about a town that will forget how glass cools. Pell does not vote. Pell keeps time.`,
        lines: [
          line("bram", "Relight it and you hire the gang for them. I will not clap for a massacre with good optics.", "fierce", "against"),
          line("ness", "Leave it dark and you hire the forgetting. The boats live. The people become a rumor who used to make light. I won't clap for that either.", "fierce", "for"),
          line("pell", `${playerName}, they are both describing a real drowning. Choose the one you can bear to hear about later.`, "steady", "aside")
        ],
        memories: repeat ? [] : [{ kind: "relationship", text: "At the bellpool Bram and Ness argued the light one last time, and neither called the other's fear fake." }]
      };
    }
    case "relight": {
      next.flags.ending = "relit";
      dropItem(next, "ferry commission");
      enterEnding(next);
      bump(next, "ness", 10, "blazing");
      bump(next, "bram", -10, "afraid");
      bump(next, "pell", 2, "exposed");
      return {
        narration: endingNarration(
          prior,
          playerName,
          `You relight the lens. Ness strikes the mold's memory against cold glass \u2014 or the idea of the mold, if the latch already ate it \u2014 and the tower remembers its job in one hard breath. A white road lies down on the reach. Every boat is suddenly a fact. Somewhere downcurrent, a slate can be written again.

Bram does not look at the beam. He looks at the hulls, counting them himself so the gang will not be the first.`
        ),
        lines: [
          line("ness", "There. A town with a craft again. Bram, hate me in the light. At least you can see the person you're hating.", "blazing", "for"),
          line("bram", "I can see them. So can anyone with a pencil. If a child is taken off my ferry, this beam is the hand that pointed.", "afraid", "against"),
          line("pell", "The note is enormous. I will ring inside it as long as I can. Do not ask me to call it only beautiful.", "exposed", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} relit the Lumenferry lens, and the boats became easy to count.` }]
      };
    }
    case "keep_dark": {
      next.flags.ending = "dark";
      dropItem(next, "ferry commission");
      enterEnding(next);
      bump(next, "bram", 10, "steadfast");
      bump(next, "ness", -10, "grieving");
      bump(next, "pell", 3, "low");
      return {
        narration: endingNarration(
          prior,
          playerName,
          `You keep the light dark and send Bram's warning down the reach by bell, by word of mouth, by any boat that will still listen. The lens stays a black coin. The press-gang, if it comes, will count waves. Ness puts her forehead against the cold glass and does not pretend it is a victory.

The kiln will not be warm tonight. The ferry will leave on time.`
        ),
        lines: [
          line("bram", "The boats go. Unlisted. I can live in a town that is harder to find. I have been practicing.", "steadfast", "for"),
          line("ness", "You chose a harbor that will forget how to make the thing that saved it. I will stay. I will not call the cold a friend.", "grieving", "against"),
          line("pell", "A small bell can still be a shore. I will be that, since I am not allowed to be a sun.", "low", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} kept the Lumenferry lens dark and warned the boats instead.` }]
      };
    }
    case "hold_town": {
      if (prior.flags.pellNoteSpent) {
        next.flags.buoyRefused = true;
        return {
          narration: `Pell reaches for Lumenferry and finds the buoy hollow. The bell-note that could have held a shoreline was spent on the lenshouse latch. What remains can ring a warning. It cannot fold a town. The pool stays open, ${playerName}, and the choice is still in front of you.`,
          lines: [
            line("pell", "I told you I was down a note. Believe the absence. It is the most honest thing I have left.", "thin", "against"),
            line("ness", "Then we do not get the gentle ending. Bram, don't look relieved. A door shutting is not the same as a plan.", "sharp", "for"),
            line("bram", "I am relieved and I am ashamed of the shape of it. Pick a real dark or a real light. The buoy is spent.", "sorry", "against")
          ],
          memories: [{ kind: "fact", text: `${playerName} could not hold Lumenferry in the buoy after Pell's bell-note was spent.` }]
        };
      }
      next.flags.ending = "held";
      dropItem(next, "ferry commission");
      enterEnding(next);
      bump(next, "pell", 8, "vast");
      bump(next, "bram", 2, "uneasy");
      bump(next, "ness", 2, "awed");
      return {
        narration: endingNarration(
          prior,
          playerName,
          `You ask Pell to hold the town. The buoy takes the lens, the kiln, the quay, and the uncounted boats into one kept note. From the reach, Lumenferry becomes a rumor with a light inside it that does not point. From inside the note, the streets are still there, private as a breath.

Pell is larger, and harder to talk to, and still answering.`
        ),
        lines: [
          line("pell", "I have them. Not displayed. Not erased. If you knock, knock gently. I am a town now, and towns startle.", "vast", "aside"),
          line("bram", "A harbor in a bell. I don't know how to pilot that. I know the gang can't chalk it. That will have to do.", "uneasy", "for"),
          line("ness", "The craft is alive in there. I hate that I can't watch it cool. I love that it isn't dead. Don't make me pick which sentence is the true one.", "awed", "against")
        ],
        memories: [{ kind: "choice", text: `${playerName} asked Pell to hold Lumenferry in the buoy, and the town went private instead of dark or displayed.` }]
      };
    }
    case "tomorrow": {
      const ending2 = prior.flags.ending ?? "dark";
      const ness = ending2 === "relit" ? "Tomorrow I sweep the kiln and pretend I am not listening for pencils." : ending2 === "held" ? "Tomorrow I knock once on the buoy and see if the town knocks back." : "Tomorrow I sit in the cold kiln and refuse to call it a chapel.";
      const bram = ending2 === "relit" ? "Tomorrow I move the ferry to a cove the beam only grazes." : ending2 === "held" ? "Tomorrow I learn a route that pilots by a bell instead of a shore." : "Tomorrow I run the night crossing as if the dark were a contract I signed.";
      return {
        narration: `Morning is a rumor on the reach. You ask them what they will do tomorrow, and for once the answer is smaller than the tower.`,
        lines: [
          line("bram", bram, "plain", ending2 === "relit" ? "against" : "for"),
          line("ness", ness, "plain", ending2 === "dark" ? "against" : "for"),
          line("pell", "Tomorrow I ring once for the boats and once for the drownings, and I will not explain the interval.", "plain", "aside")
        ],
        memories: [{ kind: "relationship", text: `After the lens, the Lumenferry party said what they would do tomorrow.` }]
      };
    }
    default:
      return null;
  }
}
function look(state, playerName) {
  const text = {
    quay: "The quay is tar, rope, and a lighthouse practicing being absent. The ferry would like a decision more than a speech.",
    causeway: "The glass slabs show the drop and sing when ashamed. The tower is a black coin.",
    boarding: "The press-gang skiff grinds the glass. Hooks, hooded lantern, and a count that has not finished.",
    eelbeds: "Weed writes on your wrists. Eels write under it. The buoy dips when Pell is thinking.",
    lenshouse: "The lens is huge, cold, and filmed with salt. The latch has the patience of a toll.",
    kiln: "Crucibles, ash, and a firing log that has already chosen a side and written it down.",
    bellpool: "Still water under the tower. A town could fit in it, or a refusal could.",
    ending: "The reach has finished its demand. What remains is a beam, a dark, or a buoy, depending on the choice you already made."
  };
  return {
    narration: `${text[state.location] ?? "The night ferry waits."} ${lead(state, playerName)}You, ${playerName}, are still in the picture.`,
    lines: [
      line("pell", "Looking is a kind of ringing. The place felt that.", "quiet", "aside"),
      line("bram", "Eyes up. Pretty lights still make lists.", "watchful", "aside")
    ],
    memories: []
  };
}
function inventory(state, playerName) {
  const mine = state.inventory.join(", ") || "nothing";
  const bram = state.partyKits.bram?.join(", ") || "nothing he will show";
  const ness = state.partyKits.ness?.join(", ") || "empty pockets and an opinion";
  const pell = state.partyKits.pell?.join(", ") || "a thinner note";
  return {
    narration: `${playerName}, you are carrying ${mine}. Bram has ${bram}. Ness has ${ness}. Pell has ${pell}.`,
    lines: [
      line(
        "ness",
        state.partyKits.ness?.includes("stolen mold") ? "The mold is still mine. Try to look less relieved, Bram." : "Do not inventory me. I am aware of the absence. It has a shape.",
        "precise",
        "aside"
      ),
      line(
        "bram",
        state.partyKits.bram?.includes("tide-charm") ? "Charm's still here. Let's keep it that way until a harbor deserves it." : "You know what's missing. Don't make me name it for the water.",
        "flat",
        "aside"
      )
    ],
    memories: []
  };
}
function recall(playerName, memories) {
  if (memories.length === 0) {
    return {
      narration: `The Chronicle has nothing filed on you yet, ${playerName}. The reach is still blank.`,
      lines: [
        line("pell", "Blank is a kind of dark. It rarely stays kind.", "soft", "aside"),
        line("bram", "Good. Fewer sentences to steer by.", "dry", "aside")
      ],
      memories: []
    };
  }
  const latest = memories[memories.length - 1];
  return {
    narration: `The Chronicle reads what it kept, including any other road walked under your name. ${memories.join(" ")}`,
    lines: [
      line("pell", `That last one is still warm: ${latest}`, "remembering", "aside"),
      line("ness", "If it is written down, it will try to matter. Bram, that is not a threat. It is a job description.", "intent", "for"),
      line("bram", "Some of those should have stayed in the mouth that made them. Too late now. A road is a road, even the other one.", "wary", "against")
    ],
    memories: []
  };
}
function aside(id, state, playerName) {
  if (id === "bram") {
    if ((state.trust.bram ?? 50) < 40) {
      return line("bram", `You want my heading after spending what I warned you about. Fine. ${playerName}, stop asking the reach to be kind. It won't.`, "cold", "against");
    }
    if (state.beat === "quay") {
      return line("bram", `Ask me plain. I want the beds and the dark. Ness wants a sun she can sign. Those are not the same crossing, ${playerName}.`, "blunt", "against");
    }
    return line("bram", "Keep the boats uncounted if you can do it without lying to Ness about the cost.", "grave", "against");
  }
  if (id === "ness") {
    if ((state.trust.ness ?? 50) < 40) {
      return line("ness", "You may speak. I am not required to be generous. My profession is glass, and you have been expensive.", "clipped", "against");
    }
    if (state.beat === "quay") {
      return line("ness", `Bram will make fear sound like a tide table, ${playerName}. Ask him how many crafts his dark has buried, and then ask him to answer in daylight.`, "arguing", "for");
    }
    return line("ness", "Relight it, or admit we came to bless a corpse. I can respect a refusal. I cannot respect a shrug.", "fierce", "for");
  }
  if ((state.trust.pell ?? 50) < 40) {
    return line("pell", "I am listening. I am also thin. Ask a smaller question, or ask one of the loud ones.", "thin", "aside");
  }
  return line("pell", `They love a hinge, ${playerName}. That is you. Hinges get pinched. I will say so when it happens.`, "fond", "aside");
}
function rebuttal(other, target) {
  const name = companionById(target).name.split(" ")[0];
  if (other === "bram") return line("bram", `${name} will talk until the tide chooses for us. I won't help it.`, "clipped", "against");
  if (other === "ness") return line("ness", `${name} makes it sound settled. It is not settled. I still have a furnace and the lung capacity for this.`, "sharp", "for");
  return line("pell", "You are both loud in a small buoy. The reach can hear you. So can the player. Try to be worth that.", "warm", "aside");
}
function address(state, id, playerName) {
  const other = id === "pell" ? (state.trust.bram ?? 0) <= (state.trust.ness ?? 0) ? "bram" : "ness" : id === "bram" ? "ness" : "bram";
  return {
    narration: `You turn to ${companionById(id).name}. The others do not do you the courtesy of pretending the water isn't listening.`,
    lines: [aside(id, state, playerName), rebuttal(other, id)],
    memories: []
  };
}
function unknown(state, playerName, text) {
  return {
    narration: `You try it: "${clip(text)}". ${PLACES[state.location]} does not take that step. It stays where it is, ${playerName}, waiting for a decision it already understands.`,
    lines: [
      line("ness", "Poetic. Unparsed. Give the scene a verb it already fears.", "dry", "aside"),
      line("bram", "Pick a heading. Mystery is how people get counted twice.", "impatient", "aside"),
      line("pell", "I heard you. The water did too. It is simply not hungry for that sentence.", "kind", "aside")
    ],
    memories: []
  };
}
function resolveLumenferryTurn(state, playerName, text, memories) {
  const intent = parseIntent(text, state.beat, lumenferrySuggestions(state), PARTY);
  if (intent.type === "look") return finish(structuredClone(state), look(state, playerName));
  if (intent.type === "inventory") return finish(structuredClone(state), inventory(state, playerName));
  if (intent.type === "recall") return finish(structuredClone(state), recall(playerName, memories));
  if (intent.type === "address") return finish(structuredClone(state), address(state, intent.companionId, playerName));
  if (intent.type === "choice") {
    const next = structuredClone(state);
    const spoken = applyChoice(next, state, intent.id, playerName);
    if (spoken) return finish(next, spoken);
  }
  return finish(structuredClone(state), unknown(state, playerName, text));
}
function lumenferrySuggestions(state) {
  return LUMEN_SUGGESTIONS[state.beat].map((suggestion) => ({ ...suggestion }));
}
var LUMEN_SUGGESTIONS = {
  quay: [
    { id: "causeway", label: "We take the glass causeway toward the lens." },
    { id: "eelbeds", label: "We wade the eelbeds and stay off the road." },
    { id: "fears_light", label: "What are you each afraid the light will show?" },
    { id: "ferry_bell", label: "Listen to the ferry bell." }
  ],
  causeway: [
    { id: "steady", label: "Steady the skiff while the glass sings." },
    { id: "cut", label: "Cut across before the tide turns." },
    { id: "fight_skiff", label: "Fight the press-gang skiff." }
  ],
  boarding: [
    { id: "skiff_repel", label: "Repel the boarding party." },
    { id: "skiff_slip", label: "Slip under the hull." }
  ],
  eelbeds: [
    { id: "follow_bell", label: "Follow Pell's bell under the water." },
    { id: "weed", label: "Keep to the weed and don't look down." }
  ],
  lenshouse: [
    { id: "trade_charm", label: "Trade Bram's tide-charm." },
    { id: "trade_mold", label: "Trade Ness's stolen mold." },
    { id: "trade_note", label: "Let Pell spend a bell-note." },
    { id: "weed_ladder", label: "Refuse and climb the weed ladder." }
  ],
  kiln: [
    { id: "read_log", label: "Read the firing log aloud." },
    { id: "copy_log", label: "Copy the log into the tide-book." },
    { id: "smash_log", label: "Smash the firing log." },
    { id: "leave_log", label: "Leave the log in the kiln." }
  ],
  bellpool: [
    { id: "relight", label: "Relight the lens." },
    { id: "keep_dark", label: "Keep the light dark and warn the boats." },
    { id: "hold_town", label: "Ask Pell to hold the town in the buoy." },
    { id: "pool_argue", label: "Let them argue the light one more time." }
  ],
  ending: [
    { id: "tomorrow", label: "What will you each do tomorrow?" },
    { id: "recall", label: "Read the road back to me." }
  ],
  waystation: [],
  bridge: [],
  shrine: [],
  flats: [],
  orchard: [],
  market: [],
  scriptorium: [],
  bellcrypt: [],
  choir: [],
  wight: []
};

// games/ashmarch/src/server/game/story.ts
var SUGGESTIONS = {
  waystation: [
    { id: "bridge", label: "We cross the Bridge of Names." },
    { id: "flats", label: "We take the long way across the salt flats." },
    { id: "fears", label: "What are you each afraid of losing?" },
    { id: "study_map", label: "Look at the map again." },
    { id: "rest", label: "Rest until the lamp is low." }
  ],
  bridge: [
    { id: "own_name", label: "I give the bridge my own name." },
    { id: "false_name", label: "I give a false name." },
    { id: "mara_name", label: "Mara, offer your warden-name." },
    { id: "ivo_name", label: "Ivo, offer a name from the index." },
    { id: "sable_name", label: "Sable, offer a name you remember." },
    { id: "shrine", label: "Climb down to the mile-shrine." }
  ],
  flats: [
    { id: "shelter", label: "Shelter inside the ribs." },
    { id: "push", label: "Push through the storm." },
    { id: "orchard", label: "Follow the bone chimes into the orchard." },
    { id: "fight_wight", label: "Fight the salt-wight." }
  ],
  wight: [
    { id: "wight_strike", label: "Strike the wight with Mara." },
    { id: "wight_brace", label: "Brace and call Sable's lamp." }
  ],
  market: [
    { id: "trade_seal", label: "Trade Mara's warden seal." },
    { id: "trade_index", label: "Trade Ivo's index page." },
    { id: "trade_memory", label: "Let Sable give up a memory." },
    { id: "refuse", label: "Refuse the coat and find another way." }
  ],
  scriptorium: [
    { id: "read", label: "Read the vote aloud." },
    { id: "copy", label: "Copy the vote into the map case." },
    { id: "burn", label: "Burn the record." },
    { id: "leave", label: "Leave the record untouched." }
  ],
  bellcrypt: [
    { id: "complete_map", label: "Complete the map and wake Vellum." },
    { id: "seal_crypt", label: "Seal the crypt and report the town still gone." },
    { id: "lamp_keep", label: "Ask Sable to keep the town in the lamp." },
    { id: "choir", label: "Listen at the choir stair before you decide." }
  ],
  shrine: [
    { id: "shrine_take", label: "Take the carved name." },
    { id: "shrine_leave", label: "Leave the shrine as it is." }
  ],
  orchard: [
    { id: "orchard_pick", label: "Pick the salt fruit." },
    { id: "orchard_leave", label: "Leave the fruit on the branch." }
  ],
  choir: [{ id: "choir_back", label: "Leave the choir stair behind and go back to the bells." }],
  ending: [
    { id: "tomorrow", label: "What will you each do tomorrow?" },
    { id: "recall", label: "Read the road back to me." }
  ]
};
function initialState() {
  return {
    bookId: "ashmarch",
    beat: "waystation",
    location: "waystation",
    flags: {},
    inventory: ["field map", "charcoal sticks", "commission letter"],
    partyKits: {
      mara: ["warden seal"],
      ivo: ["index page"],
      sable: ["brass lamp"]
    },
    trust: { mara: 52, ivo: 48, sable: 55 },
    mood: { mara: "braced", ivo: "eager", sable: "watching" },
    turn: 0,
    ended: false,
    lastRoll: null
  };
}
function suggestionsFor(state) {
  if ((state.bookId ?? "ashmarch") === "lumenferry") return lumenferrySuggestions(state);
  return (SUGGESTIONS[state.beat] ?? []).map((suggestion) => ({ ...suggestion }));
}
function echoes2(state, playerName) {
  const out = [];
  const flags = state.flags;
  if (flags.nameGiven === "player") out.push(`The bridge still keeps ${playerName}'s name in its plaque.`);
  if (flags.nameGiven === "false") out.push("A crack in the Bridge of Names is still following the lie.");
  if (flags.nameGiven === "mara") out.push("Mara's warden-name is out on the span, working a shift she did not choose.");
  if (flags.nameGiven === "ivo") out.push("Somewhere a stolen name is stuck in the bridge like a key left in a lock.");
  if (flags.nameGiven === "sable") out.push("The lamp is poorer by one remembered name.");
  if (flags.flatsChoice === "shelter") out.push("Salt still clings to the rib-charm in your pocket.");
  if (flags.flatsChoice === "push") out.push("The flats left all of you hoarse and a little less patient.");
  if (flags.wightFought === "felled") out.push("The salt-wight still lies where the strike put it down.");
  if (flags.wightFought === "held") out.push("Sable's lamp still has the salt-wight's shape burned into the beam.");
  if (flags.wightFought === "bitten") out.push("A salt-wight bite is still open on the road behind you.");
  if (flags.toll === "seal") out.push("Mara's warden seal is gone, sold to an empty coat.");
  if (flags.toll === "index") out.push("Ivo's index page now belongs to Veil Market.");
  if (flags.toll === "memory") out.push("Sable is missing the memory of the road before Vellum vanished.");
  if (flags.toll === "none") out.push("You are still damp from refusing the market and taking the floodgate.");
  if (flags.record === "read") out.push("The vote has been spoken aloud, which is a kind of publishing.");
  if (flags.record === "copied") out.push("A copy of Vellum's vote rides in your case and will not stay quiet.");
  if (flags.record === "burned") out.push("The vote of Vellum is ash on a drowned lectern.");
  if (flags.record === "left") out.push("The vote still sits on the lectern, unread by anyone who was not in the room.");
  if (flags.shrineTaken) out.push("A carved name from the mile-shrine rides in your pocket, warmer than stone.");
  if (flags.orchardFruit) out.push("Salt fruit stains the corner of the map case.");
  if (flags.choirVoice) out.push("The choir stair still has the party's voices in it.");
  if (flags.rested) out.push("You waited until the lamp burned low before choosing a road.");
  return out;
}
function lead2(state, playerName) {
  const all = echoes2(state, playerName);
  const latest = all[all.length - 1];
  return latest ? `${latest} ` : "";
}
function line2(id, text, mood, stance) {
  return { companionId: id, speaker: companionById(id).name, text, mood, stance };
}
function bump2(state, id, delta, mood) {
  state.trust[id] = Math.max(0, Math.min(100, state.trust[id] + delta));
  state.mood[id] = mood;
}
function dropKit2(state, id, item) {
  state.partyKits[id] = state.partyKits[id].filter((entry) => entry !== item);
}
function addItem2(state, item) {
  if (!state.inventory.includes(item)) state.inventory.push(item);
}
function dropItem2(state, item) {
  state.inventory = state.inventory.filter((entry) => entry !== item);
}
function clip2(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 80 ? `${clean.slice(0, 77)}\u2026` : clean;
}
function sceneFor2(state) {
  const title = PLACES[state.location];
  const mood = state.location === "ending" ? state.flags.ending ?? "unveiled" : state.flags.lampDim ? "dim" : state.location;
  const altBits = {
    waystation: "A low timber inn under an ash-colored dusk, one window lit, a brass lamp among three travelers.",
    bridge: "A pale stone span over a black drop, and a toll-keeper built from stacked mile-markers.",
    flats: "Salt dunes and the white ribs of something large enough to shelter in.",
    market: "Empty stalls and a standing coat with gloves in its pockets.",
    scriptorium: "Drowned arches, green water at the waist of the shelves, one dry lectern.",
    bellcrypt: "Great bells hanging in the dark, each one holding a folded street.",
    shrine: "A mile-shrine cut into the bank under the bridge, its stone crowded with carved names.",
    orchard: "Bone-white trees chiming, and salt fruit the color of a warning.",
    choir: "A narrow stair beside the bells where voices go to practice being streets.",
    wight: "A salt-wight risen from the flats, ribs and grit, facing three travelers and a lamp.",
    quay: "A night quay under a lighthouse that has agreed to stay dark.",
    causeway: "Glass slabs over black water, singing when stepped on.",
    eelbeds: "Weed and eel-shine, and a buoy that should have sunk.",
    lenshouse: "A cold lens the size of a wagon wheel.",
    kiln: "A glass kiln gone dark, with a firing log on the shelf.",
    bellpool: "Still water under the tower, deep enough to hold a town.",
    boarding: "A press-gang skiff grinding against the glass, hooks out.",
    ending: state.flags.ending === "mercy" ? "A sealed arch and a road that has agreed to stay quiet." : state.flags.ending === "kept" ? "A brass lamp burning large enough to hold a town." : "A town returned at dawn, windows lighting one by one."
  };
  return {
    bookId: state.bookId ?? "ashmarch",
    location: state.location,
    title,
    alt: `${title}. ${altBits[state.location] ?? title}`,
    mood,
    ending: state.flags.ending,
    prompt: `Illustrated field plate of ${title}, mood ${mood}, salt-ash pilgrimage, woodcut colors, no lettering`
  };
}
function finish2(state, spoken) {
  state.lastRoll = spoken.roll ?? null;
  return {
    state,
    narration: spoken.narration,
    lines: spoken.lines,
    newMemories: spoken.memories,
    scene: sceneFor2(state)
  };
}
function throwCheck2(prior, playerName, choiceId, kind, label, actor, dc) {
  return makeCheck({
    playerName,
    turn: prior.turn,
    choiceId,
    kind,
    label,
    actor: companionById(actor).name,
    modifier: modifierFromTrust(prior.trust[actor]),
    dc
  });
}
function motiveLine2(motive, playerName) {
  const text = motive.toLowerCase();
  if (/\b(debt|owe|owing|coin|unpaid)\b/.test(text)) {
    return line2(
      "mara",
      `You said debt, ${playerName}. Then you will be tempted to spend us like money. I have watched people clear a ledger with the wrong coin.`,
      "knowing",
      "aside"
    );
  }
  if (/\b(lost|forget|forgotten|missing)\b/.test(text)) {
    return line2(
      "sable",
      "You came looking for something already misplaced. I am familiar with that errand. It rarely ends in the pocket you planned.",
      "gentle",
      "aside"
    );
  }
  if (/\b(map|chart|draw|survey|commission)\b/.test(text)) {
    return line2(
      "ivo",
      "A commission is a reader with a purse. If the purse wants Vellum drawn, I want to know who profits from a town becoming legible again.",
      "bright",
      "aside"
    );
  }
  return null;
}
function rememberOtherRoads(resolution, prior) {
  if (!prior?.length) return resolution;
  const latest = prior[prior.length - 1];
  return {
    ...resolution,
    narration: `${resolution.narration}

The Chronicle has not forgotten your other road. ${latest}`,
    newMemories: [...resolution.newMemories, { kind: "fact", text: `Carried from another road: ${latest}` }]
  };
}
function resolveOpening(playerName, motive, options) {
  const bookId = options?.bookId ?? "ashmarch";
  if (bookId === "lumenferry") {
    return rememberOtherRoads(resolveLumenferryOpening(playerName, motive), options?.priorMemories);
  }
  const state = initialState();
  const extra = motiveLine2(motive, playerName);
  const lines = [
    line2(
      "mara",
      "Flats. We lose a day. We keep our names. I have already lost a gate. I will not lose a person to a toll that doesn't write receipts.",
      "braced",
      "against"
    ),
    line2(
      "ivo",
      "A day on the flats will scour the only clean page I have left. The bridge asks for a sentence, Mara. Sentences are my trade. You spend fear like coin and call it discipline.",
      "eager",
      "for"
    ),
    line2(
      "sable",
      `I have crossed both. The flats forget your footprints. The bridge remembers your mouth. ${playerName}, they will argue until the lamp burns low. They are already fond of you, in the way people are fond of a hinge.`,
      "watching",
      "aside"
    )
  ];
  if (extra) lines.push(extra);
  const opened = finish2(state, {
    narration: `Dusk salts the windows of the Salt Waystation until the road outside looks erased. On the table the field map drinks the lamplight and gives nothing back. You are ${playerName}. You were hired to draw Vellum \u2014 a town that stepped out of the world thirty years ago \u2014 onto a map again.

You told the commission you came because ${motive}. The waystation does not care. Your companions do. Mara Voss has turned the map so the Bridge of Names sits under her palm, as if she could hide it. Ivo Quill has turned it back. Between them a cracked brass lamp ticks, and the light inside it watches you decide.`,
    lines,
    memories: [{ kind: "fact", text: `${playerName} took the Vellum commission because: ${motive}` }]
  });
  return rememberOtherRoads(opened, options?.priorMemories);
}
function arriveMarket(state, playerName) {
  let recognition = "A coat with gloves in the pockets stands behind the last counter, neatly, as if a person had just stepped out of it.";
  if (state.flags.nameGiven === "player") {
    recognition = `A coat with gloves in the pockets tips its empty collar toward you. "You are thinner than you were at the bridge, ${playerName}," it says, in a voice like cloth folded twice.`;
  } else if (state.flags.nameGiven === "mara") {
    recognition = "A coat with gloves in the pockets bows toward Mara, the way a clerk bows to paperwork it has already stamped.";
  } else if (state.flags.nameGiven === "false") {
    recognition = `A coat with gloves in the pockets turns its hem toward a crack you cannot see. "Bring the lie in, or leave it on the mat," it says.`;
  } else if (state.flags.nameGiven === "ivo") {
    recognition = `A coat with gloves in the pockets makes a sound like sniffing. "That name you spent was still wearing someone else's warmth."`;
  } else if (state.flags.nameGiven === "sable") {
    recognition = "A coat with gloves in the pockets leans toward the lamp, then away, as if the light owed it money.";
  } else if (state.flags.flatsChoice === "shelter") {
    recognition = "A coat with gloves in the pockets notices the rib-charm and makes a pleased fold at the hem.";
  } else if (state.flags.exhausted) {
    recognition = "A coat with gloves in the pockets waits while you catch your breath, which is somehow worse than being hurried.";
  }
  return `${lead2(state, playerName)}Veil Market kept its stalls and lost its sellers. Canvas roofs clap in no wind. ${recognition}

"Passage to the scriptorium," the coat says. "I take proof. A warden's seal. An index page. Or a memory warm enough to wear."`;
}
function arriveScriptorium(state, playerName) {
  return `${lead2(state, playerName)}The scriptorium is a nave of shelves sunk to the waist in green water. The books have swelled shut. One lectern stays dry. On it, in a clerk's careful hand: Vellum voted to be forgotten. A census was coming that did not count people so much as take the names it counted. The map in your case, ${playerName}, would call them back.

The vote waits. It can be spoken, copied, burned, or left where the water has not yet climbed.`;
}
function arriveBellcrypt(state, playerName) {
  return `${lead2(state, playerName)}Under the square, the bells hang in a ring, and inside each bell a street is folded small. They hum when you breathe. Completing the map would strike them, ${playerName}. Sealing the crypt would leave your employer with a beautiful lie. The lamp could hold the town the way it holds Sable: kept, not displayed.`;
}
function enterScriptorium(next) {
  next.location = "scriptorium";
  next.beat = "scriptorium";
  next.flags.knowsTruth = true;
}
function enterBellcrypt(next) {
  next.location = "bellcrypt";
  next.beat = "bellcrypt";
  next.flags.knowsTruth = true;
}
function enterEnding2(next) {
  next.location = "ending";
  next.beat = "ending";
  next.ended = true;
}
function endingNarration2(prior, playerName, body) {
  const carried = echoes2(prior, playerName).join(" ");
  return `${body}${carried ? `

${carried}` : ""}`;
}
function applyChoice2(next, prior, id, playerName) {
  switch (id) {
    case "fears": {
      const repeat = prior.flags.fearsNamed === true;
      next.flags.fearsNamed = true;
      bump2(next, "mara", repeat ? 0 : 3, "unguarded");
      bump2(next, "ivo", repeat ? 0 : 3, "serious");
      bump2(next, "sable", repeat ? 0 : 3, "open");
      return {
        narration: `You ask what each of them is afraid of losing. The map between you suddenly looks like a thing that can be spent. Nobody reaches for the bridge or the flats. They reach, carefully, for the truth.`,
        lines: [
          line2(
            "mara",
            "My seal. It is the last proof I closed a gate when closing it mattered. Ivo would trade it for a footnote and call the footnote a rescue.",
            "unguarded",
            "against"
          ),
          line2(
            "ivo",
            "The index page. It is the only copy of a list the College burned. Mara thinks paper is a kind of treason. Paper is how I refuse to be the only one who remembers.",
            "serious",
            "for"
          ),
          line2(
            "sable",
            "The lamp keeps me shaped. If it goes dark I become weather. I would rather not become weather. Please do not spend me to win an argument with either of them.",
            "open",
            "aside"
          )
        ],
        memories: repeat ? [] : [{ kind: "relationship", text: "The party named what they are afraid to lose: Mara's seal, Ivo's index page, and Sable's lamp." }]
      };
    }
    case "study_map": {
      const repeat = prior.flags.studiedMap === true;
      next.flags.studiedMap = true;
      return {
        narration: `You smooth the field map. Vellum is a blank the size of a palm, and around the blank the road has been redrawn so many times the charcoal has a shine. Distances disagree with themselves. Someone has written, in a warden's block letters, DO NOT PAY THE BRIDGE, and someone else has answered underneath, in a scholar's hand, everything costs.`,
        lines: [
          line2("mara", "That first line is mine. I wrote it before I met you. It remains accurate.", "firm", "against"),
          line2("ivo", "And the answer is mine. Accuracy is not the same as a plan, Mara.", "pleased", "for"),
          line2("sable", "The blank is warm. Towns that want to stay gone give off heat, like a hand over a mouth.", "hushed", "aside")
        ],
        memories: repeat ? [] : [{ kind: "fact", text: "The field map shows Vellum as a blank, with Mara's warning and Ivo's reply written in the margin." }]
      };
    }
    case "bridge": {
      next.flags.route = "bridge";
      next.location = "bridge";
      next.beat = "bridge";
      bump2(next, "mara", -4, "set");
      bump2(next, "ivo", 5, "vindicated");
      bump2(next, "sable", 0, "attentive");
      return {
        narration: `You choose the bridge. Mara's jaw sets so hard the lamplight skids off it. Ivo is already rolling the map, tender as a nurse.

The walk is shorter than the argument. The Bridge of Names arrives as a pale span over a drop with no floor, only moving air. At the crown a toll-keeper stands, built from stacked mile-markers. Its face is a plaque rubbed almost blank.

"A true name," it says. Grit ticks off the letters. "One that has been used."`,
        lines: [
          line2("mara", `Give it nothing of yours, ${playerName}. Look at me. Nothing.`, "set", "against"),
          line2("ivo", "It said true. A fiction will be charged interest. I have names in the index that were used very loudly.", "vindicated", "for"),
          line2("sable", "I keep a few that no one is wearing. They are cold. They still open doors.", "attentive", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} chose the Bridge of Names over Mara's objection.` }]
      };
    }
    case "flats": {
      next.flags.route = "flats";
      next.location = "flats";
      next.beat = "flats";
      bump2(next, "mara", 5, "relieved");
      bump2(next, "ivo", -4, "thwarted");
      bump2(next, "sable", 1, "wide");
      return {
        narration: `You choose the long way. Ivo makes a small, injured sound and tucks the index page deeper into his coat. Mara nods once, which for her is a speech.

By midmorning the salt flats have erased the horizon. The wind grows a spine. Something large died here and was kind enough to leave its ribs as a house. The storm walks toward you without hurrying.`,
        lines: [
          line2("mara", "Ribs. We get inside them or we get stupid. I prefer the ribs.", "relieved", "for"),
          line2("ivo", "A day, a storm, and a carcass. Mara, your victories have a texture I do not enjoy.", "thwarted", "against"),
          line2("sable", "The bones remember being carried. If we shelter, ask before you lean.", "wide", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} chose the salt flats, and Ivo objected to the lost day.` }]
      };
    }
    case "own_name": {
      next.flags.nameGiven = "player";
      next.location = "market";
      next.beat = "market";
      bump2(next, "mara", -8, "frightened");
      bump2(next, "ivo", 8, "impressed");
      bump2(next, "sable", 4, "careful");
      return {
        narration: `You give the bridge your own name. It tastes ${playerName} the way a clerk tastes ink, and the plaque warms. Something leaves your mouth that is not breath. The far side accepts your boots. You are still yourself. You are also, now, a little archived.

${arriveMarket(next, playerName)}`,
        lines: [
          line2("mara", "That was ours to spend, not the road's. I will say your name twice tonight so it remembers the way back.", "frightened", "against"),
          line2("ivo", "Efficient. A little devastating. I admire it, and I wish I didn't. Mara, don't glare the plaque back open.", "impressed", "for"),
          line2("sable", "I will hold the shape of it. If the town asks, I can answer without spending you twice.", "careful", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} gave their own name to the Bridge of Names.` }]
      };
    }
    case "false_name": {
      next.flags.nameGiven = "false";
      next.flags.mapTorn = true;
      next.location = "market";
      next.beat = "market";
      bump2(next, "mara", -4, "wary");
      bump2(next, "ivo", 5, "amused");
      bump2(next, "sable", -2, "uneasy");
      return {
        narration: `You offer a name you have never worn. The plaque considers the lie, and a crack runs from the toll-keeper's foot to the near bank, thin as a hair and eager. The map's edge tears itself in sympathy. You are allowed across anyway. The bridge dislikes being unpaid, but it dislikes being bored more.

${arriveMarket(next, playerName)}`,
        lines: [
          line2("mara", "It knows. Cracks are how roads collect later. Don't look so spared.", "wary", "against"),
          line2("ivo", "A workable forgery. The College would have marked it passable and then burned the examiner. I respect the craft.", "amused", "for"),
          line2("sable", "The lie is still walking behind us. It has your stride.", "uneasy", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} gave the Bridge of Names a false name, and the span cracked.` }]
      };
    }
    case "mara_name": {
      next.flags.nameGiven = "mara";
      next.location = "market";
      next.beat = "market";
      bump2(next, "mara", -6, "hollowed");
      bump2(next, "ivo", 3, "clinical");
      bump2(next, "sable", 2, "quiet");
      return {
        narration: `Mara steps up before you can soften it. "Mara Voss," she tells the plaque, "warden of the south post." The bridge accepts the name with the sound of a lock giving way. She crosses without looking at her hands. On the far side she is still Mara. The title she paid with stays behind, glowing faintly in the grit.

${arriveMarket(next, playerName)}`,
        lines: [
          line2("mara", "Don't thank me. Thanks make it a favor, and this was a bill. Ivo, if you call it noble I will put you in the crack.", "hollowed", "against"),
          line2("ivo", "I was going to call it efficient. Noble is your dialect. You did spend a real thing, Mara. I am not too much of a thief to notice.", "clinical", "for"),
          line2("sable", "Warden-names are heavy. The bridge will wear hers more comfortably than she will, for a while.", "quiet", "aside")
        ],
        memories: [{ kind: "choice", text: `Mara Voss gave her warden-name to the bridge so ${playerName} would not have to.` }]
      };
    }
    case "ivo_name": {
      next.flags.nameGiven = "ivo";
      next.location = "market";
      next.beat = "market";
      bump2(next, "mara", -10, "furious");
      bump2(next, "ivo", 6, "defensive");
      bump2(next, "sable", -6, "troubled");
      return {
        narration: `Ivo opens the index with two fingers, as if the page might bite, and reads a name that is not his. The plaque drinks it. Somewhere a stranger becomes slightly harder to find. The bridge, satisfied, lets you pass. Ivo does not look as triumphant as he expected to.

${arriveMarket(next, playerName)}`,
        lines: [
          line2("mara", "That was a person, Ivo. Not a key. You heard a life snag and you kept reading.", "furious", "against"),
          line2("ivo", "It was a duplicate of a person. The original is ash in a College grate. I refuse to be scolded for using a ghost as a key, Mara. The ghost was already unpaid.", "defensive", "for"),
          line2("sable", "The ghost stumbled. I felt the stumble. Don't do that again unless you mean to.", "troubled", "aside")
        ],
        memories: [{ kind: "choice", text: `Ivo Quill spent a stolen name from the index to pay the bridge. Mara called it a person.` }]
      };
    }
    case "sable_name": {
      next.flags.nameGiven = "sable";
      next.flags.lampDim = true;
      next.location = "market";
      next.beat = "market";
      bump2(next, "mara", 6, "respectful");
      bump2(next, "ivo", -4, "annoyed");
      bump2(next, "sable", 5, "dim");
      return {
        narration: `Sable speaks a name you have never heard, old enough that the consonants feel dusty. The lamp gutters. For three steps the bridge is only a rumor under your boots, and then the light returns, smaller. The name does not.

${arriveMarket(next, playerName)}`,
        lines: [
          line2("mara", "Even the spirit pays cleaner than the archivist. Sable, if you dim again, say so before you do it.", "respectful", "for"),
          line2("ivo", "We have spent a rarity on a toll. I hope the scriptorium is worth walking in a poorer light. Rarities do not regrow out of politeness.", "annoyed", "against"),
          line2("sable", "I am still here. The name is not. Please do not thank me. Thanks make a debt, and I have just spent one.", "dim", "aside")
        ],
        memories: [{ kind: "choice", text: "Sable gave the bridge a remembered name. The lamp burned lower." }]
      };
    }
    case "shelter": {
      next.flags.flatsChoice = "shelter";
      next.flags.hasRibCharm = true;
      addItem2(next, "rib-charm");
      next.location = "market";
      next.beat = "market";
      bump2(next, "mara", 6, "steady");
      bump2(next, "ivo", -3, "impatient");
      bump2(next, "sable", 4, "pleased");
      return {
        narration: `You duck into the ribs as the storm arrives. The bone ticks with blown salt, and the wind goes around you instead of through. Wired to one rib with a twist of copper is a charm the size of a thumb, warm from no visible fire. You take it. When the white air thins, the market is already a stain on the next rise.

${arriveMarket(next, playerName)}`,
        lines: [
          line2("mara", "That was the correct kind of cowardice. Write it down, Ivo, since writing is your pulse.", "steady", "for"),
          line2("ivo", "I am writing that we lost half a day and gained a souvenir. Forgive me for not composing an ode to the souvenir.", "impatient", "against"),
          line2("sable", "The bones were willing. The charm was lonelier than the bones. It will like your pocket.", "pleased", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} sheltered in the ribs on the salt flats and kept a rib-charm.` }]
      };
    }
    case "rest": {
      const repeat = prior.flags.rested === true;
      next.flags.rested = true;
      bump2(next, "mara", repeat ? 0 : 2, "quiet");
      bump2(next, "ivo", repeat ? 0 : 1, "impatient");
      bump2(next, "sable", repeat ? 0 : 3, "dim");
      return {
        narration: `You rest until the lamp is low. Nobody takes the bridge and nobody takes the flats. The argument has to sit in a room with less light, which makes it smaller and more precise. Mara counts the door. Ivo counts the sentences he is not saying. Sable counts nothing, and is the reason the room still has a shape.`,
        lines: [
          line2("mara", "This is the only toll I like. Time, paid by sitting still. Ivo, you may survive it.", "quiet", "against"),
          line2("ivo", "I am surviving it loudly, on the inside. When the lamp is low enough for Mara, it is already too low for a footnote.", "impatient", "for"),
          line2("sable", "Thank you. A low lamp is still a lamp. I would rather be dim with you than bright on a road that hasn't been chosen.", "dim", "aside")
        ],
        memories: repeat ? [] : [{ kind: "relationship", text: `${playerName} rested at the Salt Waystation until Sable's lamp burned low, and the party argued more quietly.` }]
      };
    }
    case "shrine": {
      next.location = "shrine";
      next.beat = "shrine";
      bump2(next, "mara", 2, "wary");
      bump2(next, "ivo", 3, "hungry");
      bump2(next, "sable", 1, "hushed");
      return {
        narration: `You climb down from the span to the mile-shrine cut into the bank. The drop is still there, pretending to be weather. The stone is crowded with carved names, some warm, some only a habit of the chisel. A niche holds one name that has not been spent. It would fit a pocket.

Mara looks at your hands. Ivo looks at the niche. Sable looks at neither, which is how you know the name is listening.`,
        lines: [
          line2("mara", "Leave it. A name in a pocket is a name that can be traded by someone more frightened than you.", "wary", "against"),
          line2("ivo", "Or it is a name rescued from a shrine that will weather it into nothing. Mara, preservation is not always a theft. Sometimes it is just a pocket.", "hungry", "for"),
          line2("sable", "It is sleeping. If you wake it, wake it gently, and do not tell the bridge you have it.", "hushed", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} climbed down to the mile-shrine under the Bridge of Names.` }]
      };
    }
    case "shrine_take": {
      next.flags.shrineTaken = true;
      addItem2(next, "carved name");
      next.location = "market";
      next.beat = "market";
      bump2(next, "ivo", 4, "pleased");
      bump2(next, "mara", -4, "tight");
      bump2(next, "sable", -2, "watchful");
      return {
        narration: `You take the carved name. It is warmer than stone and lighter than a secret. The shrine does not stop you. The bridge, above, ticks once, as if a clerk made a note it will not read aloud yet. The far path lets you out into the market's dust.

${arriveMarket(next, playerName)}`,
        lines: [
          line2("ivo", "Good. A name that survives is a small archive. I will not spend it unless the road becomes unbearable, and I will tell you when I start defining unbearable.", "pleased", "for"),
          line2("mara", "You picked up a person-shaped stone. Don't look so scholarly. Ivo's compliments are how relics learn to leave.", "tight", "against"),
          line2("sable", "It is awake. I can hear it getting used to the pocket. Speak softly around it.", "watchful", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} took a carved name from the mile-shrine.` }]
      };
    }
    case "shrine_leave": {
      next.location = "market";
      next.beat = "market";
      bump2(next, "mara", 4, "relieved");
      bump2(next, "ivo", -2, "disappointed");
      bump2(next, "sable", 3, "grateful");
      return {
        narration: `You leave the shrine as it is. The carved name stays in the niche, warm from other people's almost. Climbing back to the span, you feel oddly unpaid and oddly clean. The market takes you in with the dust of a road that did not get a souvenir.

${arriveMarket(next, playerName)}`,
        lines: [
          line2("mara", "Good. Let the stone keep its own dead. We have enough names already walking.", "relieved", "for"),
          line2("ivo", "A preservation opportunity, declined. I will mention it only five or six times.", "disappointed", "against"),
          line2("sable", "It went back to sleep. That was kind. Kindness is a loud thing, even when it is only not taking.", "grateful", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} left the mile-shrine's carved name where it slept.` }]
      };
    }
    case "orchard": {
      next.location = "orchard";
      next.beat = "orchard";
      bump2(next, "sable", 3, "wide");
      bump2(next, "mara", 1, "suspicious");
      bump2(next, "ivo", 2, "curious");
      return {
        narration: `You follow the bone chimes. They are ribs strung in the trees, or trees that learned ribs from the wind. The orchard is white and musical and slightly unkind. Salt fruit hangs in the crooks, the color of a warning you could still pick.

Mara does not eat road fruit. Ivo would like a sample. Sable says the fruit remembers the branch, and will say so in your pack.`,
        lines: [
          line2("mara", "Leave it. Fruit on a salt road is bait or a bill. I have paid both.", "suspicious", "against"),
          line2("ivo", "A sample is not a meal, Mara. It is evidence. You distrust evidence because it keeps talking after the danger has left.", "curious", "for"),
          line2("sable", "The fruit is lonely, which is not the same as safe. If you pick it, expect it to miss the tree out loud.", "wide", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} followed the bone chimes off the salt flats into the orchard.` }]
      };
    }
    case "orchard_pick": {
      next.flags.orchardFruit = true;
      addItem2(next, "salt fruit");
      next.location = "market";
      next.beat = "market";
      bump2(next, "ivo", 3, "pleased");
      bump2(next, "mara", -3, "wary");
      bump2(next, "sable", 2, "fond");
      return {
        narration: `You pick the salt fruit. It comes away with a chime, as if the tree had been holding a note and was glad to stop. The fruit is heavy for its size and already staining the map case at the corner. Beyond the last white tree, the market is a stain of canvas.

${arriveMarket(next, playerName)}`,
        lines: [
          line2("ivo", "Evidence, as promised. It is also, regrettably, leaking. Mara, your face is a whole essay.", "pleased", "for"),
          line2("mara", "We are carrying bait into a market that already wants proof. Try to look less delighted.", "wary", "against"),
          line2("sable", "It misses the branch. I can hear the missing. It will quiet if you don't brag.", "fond", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} picked a salt fruit in the bone orchard.` }]
      };
    }
    case "orchard_leave": {
      next.location = "market";
      next.beat = "market";
      bump2(next, "mara", 3, "steady");
      bump2(next, "ivo", -1, "dry");
      bump2(next, "sable", 2, "pleased");
      return {
        narration: `You leave the fruit on the branch. The chimes go on counting weather without your help. The orchard lets you out the far side, where the salt thins and Veil Market has been waiting with its empty sleeves.

${arriveMarket(next, playerName)}`,
        lines: [
          line2("mara", "Correct. Not every bright thing is a ration.", "steady", "for"),
          line2("ivo", "I will record the refusal as 'prudence' and pronounce it skeptically.", "dry", "against"),
          line2("sable", "The branch kept its note. That was a gift you didn't have to wrap.", "pleased", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} left the salt fruit on the branch in the bone orchard.` }]
      };
    }
    case "choir": {
      next.location = "choir";
      next.beat = "choir";
      bump2(next, "mara", 1, "low");
      bump2(next, "ivo", 1, "listening");
      bump2(next, "sable", 2, "open");
      return {
        narration: `You take the choir stair before anyone finishes the map. It is a narrow throat beside the bells, and the air in it is full of streets practicing their names. If you stand still, the party starts to answer in the voices they use when they think the town can hear them.`,
        lines: [
          line2("mara", "If I had a street, I would keep it shut. A woken town is a town that can be knocked on. I have been the knock.", "low", "against"),
          line2("ivo", "If I had a street, I would copy its name twice and give one copy to someone who was not afraid. Fear has had the archive long enough.", "listening", "for"),
          line2("sable", "If I had a street, I would keep it in the lamp until it asked to leave. Asking matters. Most maps forget to let a place ask.", "open", "aside")
        ],
        memories: [{ kind: "relationship", text: "On the choir stair Mara, Ivo, and Sable each said what they would do with a street of Vellum." }]
      };
    }
    case "choir_back": {
      next.flags.choirVoice = true;
      next.location = "bellcrypt";
      next.beat = "bellcrypt";
      return {
        narration: `You leave the choir stair behind. The bells are where you left them, but they have the party's voices in them now: a shut street, a copied street, a street that wants to be asked. The choice under the square has not moved, ${playerName}. It is only louder.

${arriveBellcrypt(next, playerName)}`,
        lines: [
          line2("mara", "We said it. Saying it is not doing it. Don't confuse the stair with a verdict.", "firm", "against"),
          line2("ivo", "A verdict is just a sentence that survived its speakers. I am still here, Mara. So is the map.", "intent", "for"),
          line2("sable", "I heard all three of us. I will not pretend we agreed. The bells can hold a disagreement without dropping it.", "steady", "aside")
        ],
        memories: [{ kind: "fact", text: `${playerName} listened at the choir stair, then returned to the bellcrypt with the argument still intact.` }]
      };
    }
    case "fight_wight": {
      next.location = "wight";
      next.beat = "wight";
      bump2(next, "mara", 2, "ready");
      bump2(next, "ivo", -2, "appalled");
      bump2(next, "sable", 1, "bright");
      return {
        narration: `The salt rises into a wight: ribs, grit, and a mouth where the storm kept its teeth. It wants the map case. The flats offer no second road until somebody answers it, ${playerName}.

Mara already has a knife out. Sable's lamp can blind it if you ask. Ivo is pricing both, which the wight does not respect.`,
        lines: [
          line2("mara", "Strike with me. A thing made of salt dies the way a debt dies: all at once, or not at all.", "ready", "for"),
          line2("ivo", "Or we do not donate our blood to a weather system. The lamp is a tool, Mara, not a dare.", "appalled", "against"),
          line2("sable", `${playerName}, say the word and I will spend light. Say the other word and I will watch Mara spend a knife. I will not choose for a hinge.`, "bright", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} stood to fight the salt-wight on the flats.` }]
      };
    }
    case "wight_strike": {
      const roll = throwCheck2(prior, playerName, "wight_strike", "combat", "strike the salt-wight", "mara", 12);
      next.location = "market";
      next.beat = "market";
      if (roll.success) {
        next.flags.wightFought = "felled";
        addItem2(next, "wight-salt");
        bump2(next, "mara", 6, "spent");
        bump2(next, "ivo", 1, "shaken");
        bump2(next, "sable", 2, "proud");
      } else {
        next.flags.wightFought = "bitten";
        next.flags.exhausted = true;
        bump2(next, "mara", -4, "hurt");
        bump2(next, "ivo", -2, "angry");
        bump2(next, "sable", 1, "worried");
      }
      const blow = roll.success ? "Mara's knife goes in where a heart would be if salt had one. The wight folds into a glittering crust. You pocket a palm of it and the market is suddenly there, as if the flats had been waiting to bill you." : "The wight takes the knife on a rib and gives the bite back. Salt burns the seam of a sleeve. You are through it anyway \u2014 bleeding, upright \u2014 and Veil Market receives you like a clerk who expected the wound.";
      return {
        narration: `${rollSentence(roll)}

${blow}

${arriveMarket(next, playerName)}`,
        lines: roll.success ? [
          line2("mara", "Down. Don't admire it. The market will charge us for standing still.", "spent", "for"),
          line2("ivo", "You solved a monster and opened a shop. Mara, that is not the triumph you think it is.", "shaken", "against"),
          line2("sable", "The lamp stayed lit. I am glad. I did not want to be the weapon and the witness.", "proud", "aside")
        ] : [
          line2("mara", "I missed. Say it once and then walk. The bite is a receipt, not a verdict.", "hurt", "against"),
          line2("ivo", "A receipt written in Mara's arm. I would have preferred a footnote. I am not glad to be right.", "angry", "for"),
          line2("sable", "I can keep the burn from spreading. I cannot make the wight unhappen. Come to the stalls before it stands up again.", "worried", "aside")
        ],
        memories: [
          {
            kind: "choice",
            text: `${playerName} fought the salt-wight with Mara. ${rollSentence(roll)} Outcome: ${roll.success ? "felled" : "bitten"}.`
          }
        ],
        roll
      };
    }
    case "wight_brace": {
      const roll = throwCheck2(prior, playerName, "wight_brace", "skill", "hold the salt-wight in the lamp", "sable", 12);
      next.location = "market";
      next.beat = "market";
      if (roll.success) {
        next.flags.wightFought = "held";
        bump2(next, "sable", 6, "bright");
        bump2(next, "mara", 2, "relieved");
        bump2(next, "ivo", 2, "awed");
      } else {
        next.flags.wightFought = "bitten";
        next.flags.exhausted = true;
        next.flags.lampDim = true;
        bump2(next, "sable", -5, "dim");
        bump2(next, "mara", -2, "grim");
        bump2(next, "ivo", -1, "hoarse");
      }
      const beam = roll.success ? "Sable opens the lamp and the beam pins the wight like a moth made of grit. It cannot step. You walk around the light and the market takes you in with the creature still burning behind you." : "The lamp flares and gutters. The wight steps through the failed beam and bites anyway. Sable is dimmer. You reach the market leaning on each other, and the coat at the counter has already smelled the salt.";
      return {
        narration: `${rollSentence(roll)}

${beam}

${arriveMarket(next, playerName)}`,
        lines: roll.success ? [
          line2("sable", "Held, not killed. A lamp can do that once. Don't ask me to do it as a lifestyle, Mara.", "bright", "aside"),
          line2("mara", "You spent light instead of blood. I will allow it. I will not applaud it where the market can hear.", "relieved", "against"),
          line2("ivo", "A creature filed under illumination. I want that sentence in the index. Sable, you just wrote a chapter Mara was going to stab.", "awed", "for")
        ] : [
          line2("sable", "The light missed. I am smaller for it. Don't spend me again until I say the wick is back.", "dim", "against"),
          line2("ivo", "So much for the elegant solution. Mara, your knife is looking prophetic and I hate that.", "hoarse", "for"),
          line2("mara", "We're upright. That's the whole review. Get to the counter before the bite decides it owns the map.", "grim", "aside")
        ],
        memories: [
          {
            kind: "choice",
            text: `${playerName} tried to hold the salt-wight in Sable's lamp. ${rollSentence(roll)} Outcome: ${roll.success ? "held" : "bitten"}.`
          }
        ],
        roll
      };
    }
    case "push": {
      next.flags.flatsChoice = "push";
      next.flags.exhausted = true;
      next.location = "market";
      next.beat = "market";
      bump2(next, "mara", 4, "proud");
      bump2(next, "ivo", -6, "scraped");
      bump2(next, "sable", 0, "enduring");
      return {
        narration: `You walk into the storm because stopping feels like a decision the wind would mock. Salt finds every seam. Ivo loses the only dry corner of a blank page and does not forgive the page, or you, or the sky. When the market appears it looks like a mercy and is probably a bill.

${arriveMarket(next, playerName)}`,
        lines: [
          line2("mara", "You didn't flinch. I notice. Don't make a habit of proving it when a ribcage is available.", "proud", "for"),
          line2("ivo", "My page is ruined and my temper is educational. Mara, if you say this built character I will inventory your faults alphabetically.", "scraped", "against"),
          line2("sable", "The storm liked the attention. Next time, give it less.", "enduring", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} pushed through the salt storm. The party arrived hoarse, and Ivo lost a dry page.` }]
      };
    }
    case "trade_seal": {
      dropKit2(next, "mara", "warden seal");
      next.flags.toll = "seal";
      enterScriptorium(next);
      bump2(next, "mara", -16, "betrayed");
      bump2(next, "ivo", 4, "relieved");
      bump2(next, "sable", -4, "sorry");
      return {
        narration: `You put Mara's warden seal on the counter. The coat's gloves close over it with tailor's care. Mara does not grab your wrist. That restraint costs her more than the seal. A seam opens behind the last stall, dry and dark, and the market forgets you on purpose.

${arriveScriptorium(next, playerName)}`,
        lines: [
          line2("mara", "That was the last door I closed properly. You sold the door. Don't tell me it was only brass.", "betrayed", "against"),
          line2("ivo", "It was a tool, Mara. The scriptorium is the point of the walking. You can hate me from the dry side of the gate. I accept the posting.", "relieved", "for"),
          line2("sable", "A seal is a promise with a hinge. You sold a hinge. The coat will wear it better than is fair.", "sorry", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} traded Mara Voss's warden seal for passage through Veil Market.` }]
      };
    }
    case "trade_index": {
      dropKit2(next, "ivo", "index page");
      next.flags.toll = "index";
      enterScriptorium(next);
      bump2(next, "ivo", -16, "stricken");
      bump2(next, "mara", 6, "grim");
      bump2(next, "sable", -2, "watchful");
      return {
        narration: `Ivo puts the index page down as if it might still be rescued by a better sentence. The gloves take it. He watches the pocket that swallows it and memorizes the pocket, which is not the same as having the page. The seam behind the stall opens.

${arriveScriptorium(next, playerName)}`,
        lines: [
          line2("ivo", "That was the last copy. Congratulate yourselves quietly. I am busy becoming a worse archivist in real time.", "stricken", "against"),
          line2("mara", "Paper for a door. I won't gloat. I will also not pretend I'm sorry the ghost-list is out of his coat.", "grim", "for"),
          line2("sable", "The page screamed in a voice like footnotes. The coat has indigestion. Good.", "watchful", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} traded Ivo Quill's index page to the coat at Veil Market.` }]
      };
    }
    case "trade_memory": {
      next.flags.toll = "memory";
      next.flags.sableMemorySpent = true;
      enterScriptorium(next);
      bump2(next, "sable", -14, "faded");
      bump2(next, "mara", -6, "angry");
      bump2(next, "ivo", 5, "archival");
      return {
        narration: `Sable gives the coat a memory of the road before Vellum vanished: carts, a bell-rehearsal, ordinary dust. The lamp goes briefly clear, like glass with nothing behind it, then clouded again. The coat wears the memory as a better posture. You are let through.

${arriveScriptorium(next, playerName)}`,
        lines: [
          line2("sable", "I know the road is under me. I no longer remember what it was like when it was only a road. Leave me a minute before you ask me to hold anything else.", "faded", "against"),
          line2("ivo", "An archive is an archive. It hurts the shelf. I will not insult Sable by calling the hurt beautiful.", "archival", "for"),
          line2("mara", "You spent the spirit to skip a wet gate. Ivo, don't you dare agree with me out loud. I am angry enough without company.", "angry", "against")
        ],
        memories: [{ kind: "choice", text: "Sable surrendered a memory of the old road to pay the Veil Market toll." }]
      };
    }
    case "refuse": {
      next.flags.toll = "none";
      next.flags.soaked = true;
      enterScriptorium(next);
      bump2(next, "mara", 8, "proud");
      bump2(next, "ivo", -6, "sulking");
      bump2(next, "sable", 3, "bright");
      return {
        narration: `You refuse the coat. It does not argue. It simply stops being a way through. Mara finds the floodgate by the smell of old water and older stubbornness. You wade. Ivo holds the index page over his head like a saint's picture and still loses a dry cuff. The scriptorium lets you in at the leaky end, unbought.

${arriveScriptorium(next, playerName)}`,
        lines: [
          line2("mara", "Good. Let the coat keep its empty hands. I like us better wet than priced.", "proud", "for"),
          line2("ivo", "My cuff is a casualty and my dignity is filing a complaint. There was a counter, Mara. Counters exist so heroes don't have to drip.", "sulking", "against"),
          line2("sable", "The water knows you refused. It is a petty element. It will remember in your socks.", "bright", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} refused the Veil Market toll and took the floodgate instead.` }]
      };
    }
    case "read": {
      next.flags.record = "read";
      enterBellcrypt(next);
      bump2(next, "mara", -2, "unsettled");
      bump2(next, "ivo", 4, "intent");
      bump2(next, "sable", 2, "listening");
      return {
        narration: `You read the vote aloud. The water stills to hear a decision it already knew. Vellum, gathered in a year the census sharpened its pencils, chose absence over being itemized. Your voice makes the choice present tense again. When you stop, the lectern is just a lectern, and the bells under the square have started to notice the party.

${arriveBellcrypt(next, playerName)}`,
        lines: [
          line2("mara", "You put it in the air. Air carries. I would have left it on the page, where pages drown.", "unsettled", "against"),
          line2("ivo", "Spoken is not the same as copied, Mara. Don't rush me toward a crime I am still composing. The vote deserves a witness who isn't water.", "intent", "for"),
          line2("sable", "The town heard its own name for the procedure. It flinched, and then it leaned closer.", "listening", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} read Vellum's vote aloud in the drowned scriptorium.` }]
      };
    }
    case "copy": {
      next.flags.record = "copied";
      addItem2(next, "copied vote");
      enterBellcrypt(next);
      bump2(next, "ivo", 8, "elated");
      bump2(next, "mara", -8, "alarmed");
      bump2(next, "sable", 0, "wary");
      return {
        narration: `You copy the vote into the map case, charcoal faithful to every cruel comma. The original stays on the lectern, relieved or offended, it is hard to tell with paper. You now own a town's refusal in duplicate. Beneath you, the bells warm.

${arriveBellcrypt(next, playerName)}`,
        lines: [
          line2("ivo", "Yes. That is the work. A decision that exists once can be burned by accident. A decision that exists twice has to be answered.", "elated", "for"),
          line2("mara", "You just made the census a traveling companion. Ivo, if you smile any wider I will assume you've never met a consequence.", "alarmed", "against"),
          line2("sable", "The copy is heavier than the original. Words gain weight when they know they might be used.", "wary", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} copied Vellum's vote into the map case.` }]
      };
    }
    case "burn": {
      next.flags.record = "burned";
      enterBellcrypt(next);
      bump2(next, "mara", 8, "relieved");
      bump2(next, "ivo", -14, "devastated");
      bump2(next, "sable", -2, "solemn");
      return {
        narration: `You burn the record. The page takes the flame personally and is gone before Ivo finishes the word "wait." Ash salts the lectern. The vote survives only in the four of you, which is a fragile archive. Somewhere below, the bells sound almost grateful.

${arriveBellcrypt(next, playerName)}`,
        lines: [
          line2("mara", "Good. Let the census go hungry. If the town wanted to be a document it would have stayed legible.", "relieved", "for"),
          line2("ivo", "You burned a decision because it frightened you. That is not mercy, Mara. That is editing. I will remember every line you just made unprovable, and I will hate the remembering.", "devastated", "against"),
          line2("sable", "Ash is a kind of memory with the names scraped off. Be careful. Scraped things still cut.", "solemn", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} burned Vellum's vote. Ivo will not forgive it quickly.` }]
      };
    }
    case "leave": {
      next.flags.record = "left";
      enterBellcrypt(next);
      bump2(next, "mara", 4, "steady");
      bump2(next, "ivo", -6, "itching");
      bump2(next, "sable", 2, "calm");
      return {
        narration: `You leave the vote where it is. The water creeps a finger-width closer, patient as interest. Nobody owns the decision except the town that made it. You go down toward the bells with wet hems and empty hands.

${arriveBellcrypt(next, playerName)}`,
        lines: [
          line2("mara", "Leaving a thing alone is a skill. I'm glad someone on this road still has it.", "steady", "for"),
          line2("ivo", "Leaving is also a way of hoping the evidence survives without our courage. I am not edified, Mara. I am itchy.", "itching", "against"),
          line2("sable", "The page was glad not to be touched. Few pages get that ending. Enjoy the rarity.", "calm", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} left Vellum's vote untouched on the lectern.` }]
      };
    }
    case "complete_map": {
      next.flags.ending = "unveiled";
      enterEnding2(next);
      bump2(next, "ivo", 6, "awed");
      bump2(next, "mara", -10, "grieving");
      bump2(next, "sable", -4, "overbright");
      const recordNote = prior.flags.record === "burned" ? "The vote is ash, so the lines you draw are from memory, and memory is a kinder cartographer than ink. Some streets return with their worst door missing." : prior.flags.record === "copied" ? "The copied vote rides in your case and argues with every line. The town returns exactly, including the people who voted no." : "You draw what you heard and what you saw. It is accurate enough to be a summons.";
      return {
        narration: endingNarration2(
          prior,
          playerName,
          `You complete the map. The charcoal kisses the blank and the bells answer, a struck-silver sound that unfolds streets out of themselves. Vellum stands up in the square like a sleeper who did not consent to morning: confused, named, some faces grateful, some already angry at the light. Your employer will pay. ${recordNote}`
        ),
        lines: [
          line2("ivo", "There. Legible. Don't look away, Mara. A rescued record is allowed to be unhappy about the rescue.", "awed", "for"),
          line2("mara", `They voted, ${playerName}. You overruled a town with a piece of charcoal. I will stand in the square anyway. Someone should apologize in a voice that isn't proud.`, "grieving", "against"),
          line2("sable", "The names fit back into the mouths that lost them. Some mouths are bleeding. I can hold a few until they stop shaking.", "overbright", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} completed the map. Vellum woke.` }]
      };
    }
    case "seal_crypt": {
      next.flags.ending = "mercy";
      dropItem2(next, "commission letter");
      enterEnding2(next);
      bump2(next, "mara", 8, "quiet");
      bump2(next, "ivo", -8, "divided");
      bump2(next, "sable", 4, "soft");
      return {
        narration: endingNarration2(
          prior,
          playerName,
          `You seal the crypt with charcoal, wax, and the commission letter turned backward so the employer's name faces the stone. The bells go quiet in relief, a silence with shoulders. You will report the town still gone. It will be the most accurate lie of your career. The square above you remains a square, uninhabited, wind moving through it like a clerk who found an empty file and chose not to correct it.`
        ),
        lines: [
          line2("mara", "I'll keep the gate. I'm good at gates. If your employer sends another cartographer, they can argue with me and the wax.", "quiet", "for"),
          line2("ivo", "An archivist who lies is a novelist with worse hours. I haven't decided whether I resign. Give me the walk back before you ask.", "divided", "against"),
          line2("sable", "The bells are grateful and ashamed, which is how most mercies feel from the inside. Walk softly on the way out.", "soft", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} sealed the Bellcrypt and chose to report Vellum still gone.` }]
      };
    }
    case "lamp_keep": {
      if (prior.flags.sableMemorySpent) {
        next.flags.lampRefused = true;
        bump2(next, "sable", prior.flags.lampRefused ? 0 : -4, "ashamed");
        bump2(next, "mara", prior.flags.lampRefused ? 0 : -2, "bitter");
        return {
          narration: `Sable opens the lamp. There is weather inside, and the shape of a road, but not the road itself \u2014 that memory was spent on an empty coat at Veil Market. A town will not fit in the space a road left behind. The bells wait, unstruck, while Sable closes the lamp with both hands and does not apologize for the physics.`,
          lines: [
            line2("sable", "I can't. I would if the shelf were still there. Ask me for a smaller miracle or choose one of the harder honesties.", "ashamed", "against"),
            line2("mara", "This is the market, still billing us. I said not to spend the spirit. I will say it only once more.", "bitter", "against"),
            line2("ivo", "The page wouldn't have held a town either. Don't look at me for a storage solution. I am an archivist, not a pocket.", "flat", "for")
          ],
          memories: prior.flags.lampRefused ? [] : [{ kind: "fact", text: "Sable could not keep Vellum in the lamp. The memory of the old road was already spent at Veil Market." }]
        };
      }
      next.flags.ending = "kept";
      enterEnding2(next);
      bump2(next, "sable", 10, "crowded");
      bump2(next, "mara", 4, "awed");
      bump2(next, "ivo", -6, "empty-handed");
      return {
        narration: endingNarration2(
          prior,
          playerName,
          `Sable opens the lamp. The streets pour in as light, not as rubble \u2014 lanes, lintels, a bell choir compressed to a warm murmur against the brass. Vellum is not destroyed and not displayed. It is held. Sable stands a little taller and a little more careful, a person with a town for a ribcage. You leave a blank square on the survey. You do not apologize for the blank.`
        ),
        lines: [
          line2("sable", "I have them. They are arguing already, which means they are well. Walk slowly on the way back. Both of me are new at this.", "crowded", "for"),
          line2("ivo", "I don't get to file it. I want that sentence witnessed, Mara, before you call it a happy ending. A happy ending I cannot cite is a private joke.", "empty-handed", "against"),
          line2("mara", "A blank square and a clear conscience. Heavier than the seal. I'll carry the blank. You carry the lamp, Sable. Nobody else touches it.", "awed", "aside")
        ],
        memories: [{ kind: "choice", text: `${playerName} asked Sable to keep Vellum in the lamp, and the lamp accepted the town.` }]
      };
    }
    case "tomorrow": {
      const ending2 = prior.flags.ending;
      if (ending2 === "unveiled") {
        return {
          narration: `Morning is already prying at the square. Vellum is noisy in the way of places that have been silent too long. The commission will want a clean report. You have a town instead.`,
          lines: [
            line2("mara", "Tomorrow I stand in the square and learn the names that came back angry. Someone should.", "resolved", "against"),
            line2("ivo", "Tomorrow I file the map and a dissent of equal length. Mara will call that cowardice. It is also a record.", "busy", "for"),
            line2("sable", "Tomorrow I walk streets I was not allowed to touch and see if they know the lamp. I think they will.", "hopeful", "aside")
          ],
          memories: []
        };
      }
      if (ending2 === "mercy") {
        return {
          narration: `The road back is unremarkable on purpose. Your report is already composing itself in a voice you don't love. The wax over the crypt will hold unless someone cares more than they are paid to.`,
          lines: [
            line2("mara", "Tomorrow I pretend the commission was a weather report. I am good at gates. I can be good at silence.", "quiet", "for"),
            line2("ivo", "Tomorrow I decide whether an archivist who lies is still an archivist. I would like one night before I answer you.", "divided", "against"),
            line2("sable", "Tomorrow the bells stay folded. I will sit near the story of them without striking a note.", "soft", "aside")
          ],
          memories: []
        };
      }
      return {
        narration: `The lamp ticks like a small civic clock. Nothing on the map has changed. Something in the brass has. The way home is the same length it was this morning and feels shorter.`,
        lines: [
          line2("mara", "Tomorrow I carry a blank square and a clear conscience, which is heavier. Ivo can complain. The square stays blank.", "steady", "for"),
          line2("ivo", "Tomorrow I do not copy what the lamp holds. I want that restraint witnessed, since I am unlikely to enjoy it.", "wry", "against"),
          line2("sable", "Tomorrow I am a town and a person. Please walk slowly. Both of me are learning the gait.", "crowded", "aside")
        ],
        memories: []
      };
    }
    default:
      return null;
  }
}
var LOOKS = {
  waystation: "The waystation smells of wet ash and onion. The map on the table is the brightest thing in the room, and it is mostly a blank.",
  bridge: "The drop under the bridge does not end so much as lose interest in being seen. The toll-keeper sheds grit whenever it waits.",
  flats: "The flats are a page someone tried to erase with salt. The ribs creak, counting weather.",
  market: "Veil Market is all stalls and no sellers. The coat at the last counter has excellent posture and no intention of explaining it.",
  scriptorium: "Green water holds the shelves at the waist. The dry lectern looks guilty, the way evidence does.",
  bellcrypt: "The bells are large enough to live in. Inside each, a street glints and pretends to be a reflection.",
  shrine: "The mile-shrine is a pocket of stone under the span. Names crowd it, and one of them is warm.",
  orchard: "Bone chimes, white trees, and salt fruit that looks like a decision.",
  choir: "The choir stair is narrow and full of streets trying out their names.",
  wight: "The salt-wight stands between you and every softer road. Ribs, grit, and a mouth full of weather.",
  boarding: "A press-gang skiff is against the glass, hooks out, counting you by the noise you make.",
  ending: "The road has finished its demand. What remains is light, wax, or a lamp, depending on the choice you already made.",
  quay: "The night quay and a lighthouse practicing absence.",
  causeway: "Glass over a drop, singing.",
  eelbeds: "Weed, eels, and a buoy.",
  lenshouse: "A cold lens and a latch.",
  kiln: "A kiln that chose the dark.",
  bellpool: "A pool that could hold a town."
};
function look2(state, playerName) {
  return {
    narration: `${LOOKS[state.location]} ${lead2(state, playerName)}You, ${playerName}, are still in the picture.`,
    lines: [
      line2("sable", "Looking is a kind of touching. The place felt that.", "quiet", "aside"),
      line2("mara", "Eyes up. Pretty roads still send bills.", "watchful", "aside")
    ],
    memories: []
  };
}
function inventory2(state, playerName) {
  const mine = state.inventory.join(", ");
  const mara = state.partyKits.mara.join(", ") || "nothing she will admit";
  const ivo = state.partyKits.ivo.join(", ") || "nothing he can cite";
  const sable = state.partyKits.sable.join(", ") || "a thinner light";
  return {
    narration: `${playerName}, you are carrying ${mine}. Mara has ${mara}. Ivo has ${ivo}. Sable has ${sable}.`,
    lines: [
      line2(
        "ivo",
        state.partyKits.ivo.includes("index page") ? "The page is still mine. Try to look less relieved, Mara." : "Do not inventory me. I am aware of the absence. It has a shape.",
        "precise",
        "aside"
      ),
      line2(
        "mara",
        state.partyKits.mara.includes("warden seal") ? "Seal's still here. Let's keep it that way until there's a door that deserves it." : "You know what's missing. Don't make me name it for the room.",
        "flat",
        "aside"
      )
    ],
    memories: []
  };
}
function recall2(_state, playerName, memories) {
  if (memories.length === 0) {
    return {
      narration: `The Chronicle has nothing filed on you yet, ${playerName}. The road is still blank.`,
      lines: [
        line2("sable", "Blank is a kind of mercy. It rarely lasts.", "soft", "aside"),
        line2("mara", "Good. Fewer sentences to trip on.", "dry", "aside")
      ],
      memories: []
    };
  }
  const latest = memories[memories.length - 1];
  return {
    narration: `The Chronicle reads what it kept. ${memories.join(" ")}`,
    lines: [
      line2("sable", `That last one is still warm: ${latest}`, "remembering", "aside"),
      line2("ivo", "If it is written down, it will try to matter. Mara, that is not a threat. It is a job description.", "intent", "for"),
      line2("mara", "Some of those should have stayed in the mouth that made them. Too late now.", "wary", "against")
    ],
    memories: []
  };
}
function aside2(id, state, playerName) {
  const low = state.trust[id] < 40;
  if (id === "mara") {
    if (low) {
      return line2("mara", `You want my counsel after spending what I warned you about. Fine. ${playerName}, stop asking the road to like you. It won't.`, "cold", "against");
    }
    switch (state.beat) {
      case "waystation":
        return line2("mara", `Ask me plain. I want the flats. Ivo wants a sentence he can survive. Those are not the same road, ${playerName}.`, "blunt", "against");
      case "bridge":
        return line2("mara", "Give it a name that isn't living in this party. If you can't, we turn around. I have turned around before. It felt like work, not shame.", "urgent", "against");
      case "flats":
        return line2("mara", "Get in the ribs. Heroics are just weather with an audience.", "practical", "for");
      case "market":
        return line2("mara", "Don't look at the seal when you say my name. The coat can hear pockets.", "tight", "against");
      case "scriptorium":
        return line2("mara", "If you copy it, you are doing the census a favor. If you burn it, Ivo breaks. Choose like someone who has to walk back with both of us.", "grave", "against");
      case "bellcrypt":
        return line2("mara", "The town voted. Waking it is not a neutral survey. Say that out loud before you finish the map.", "grave", "against");
      case "ending":
        return line2("mara", "I'm still here. That is the whole of my report.", "steady", "aside");
      case "shrine":
        return line2("mara", "Don't pocket the stone. A shrine is a debt with better architecture.", "urgent", "against");
      case "orchard":
        return line2("mara", "If it chimes, it is trying to be noticed. We have been noticed enough.", "practical", "against");
      case "choir":
        return line2("mara", "Say your piece and go back. Stairs are where people talk themselves into bills.", "grave", "against");
      default:
        return line2("mara", `Ask me plain, ${playerName}. I will not decorate it.`, "blunt", "against");
    }
  }
  if (id === "ivo") {
    if (low) {
      return line2("ivo", "You may speak. I am not required to be generous about it. My profession is memory, and you have been expensive.", "clipped", "against");
    }
    switch (state.beat) {
      case "waystation":
        return line2("ivo", `Mara will make caution sound like a moral system, ${playerName}. Ask her how many people her closed gate kept safe, and then ask her how many it stranded.`, "arguing", "for");
      case "bridge":
        return line2("ivo", "A true name is just a name that has been believed. We have several. The tragedy would be spending yours when mine are already compromised.", "persuasive", "for");
      case "flats":
        return line2("ivo", "I will shelter if you insist. I will also mention the lost day at every future decision, so budget for it.", "dry", "against");
      case "market":
        return line2("ivo", "The coat wants proof, not blood. Try not to let Mara define proof as 'whatever hurts me least.'", "sharp", "for");
      case "scriptorium":
        return line2("ivo", "Copy it. Burning a vote is how tyrannies get a good night's sleep. Mara disagrees, and Mara is not the archive.", "fierce", "for");
      case "bellcrypt":
        return line2("ivo", "Complete the map. A town hidden by fear is still a town being governed by fear. I would rather they be angry and named.", "fierce", "for");
      case "ending":
        return line2("ivo", "If you need a footnote, I am the footnote. Try to look less surprised.", "wry", "aside");
      case "shrine":
        return line2("ivo", "That name is weathering into silence. A pocket is a kinder archive than rain.", "persuasive", "for");
      case "orchard":
        return line2("ivo", "One fruit. For the record. Mara can survive a record.", "dry", "for");
      case "choir":
        return line2("ivo", "Listen, then choose. A town that only gets counted in private is still being governed.", "fierce", "for");
      default:
        return line2("ivo", "I have a professional objection and the lung capacity for it.", "sharp", "for");
    }
  }
  if (low) {
    return line2("sable", "I am listening. I am also tired. Ask a smaller question, or ask one of the loud ones.", "thin", "aside");
  }
  switch (state.beat) {
    case "waystation":
      return line2("sable", `They love a hinge, ${playerName}. That is you. Hinges get pinched. I will say so when it happens.`, "fond", "aside");
    case "bridge":
      return line2("sable", "If you ask me for a name, I will give one. I would rather you asked because you cannot bear the other prices, not because it is convenient.", "serious", "aside");
    case "flats":
      return line2("sable", "The ribs are a guest room, not a trophy. Shelter is allowed. Boasting is not.", "gentle", "aside");
    case "market":
      return line2("sable", "I can pay in memory. I would like you to hear how much I don't want to, and then decide anyway if you must.", "honest", "aside");
    case "scriptorium":
      return line2("sable", "The vote is a person-shaped silence. Whatever you do, don't do it to impress either of them.", "steady", "aside");
    case "bellcrypt":
      return line2("sable", "I can keep the town if I still have the shelf for it. If I say I can't, believe me the first time.", "careful", "aside");
    case "ending":
      return line2("sable", "The lamp is still a lamp. I am still someone you can talk to without filing a form.", "warm", "aside");
    case "shrine":
      return line2("sable", "The carved name is asleep. Taking it wakes it. Leaving it is also a kind of touch.", "serious", "aside");
    case "orchard":
      return line2("sable", "The fruit misses nothing until it is picked. After that, it misses the branch in your pack.", "gentle", "aside");
    case "choir":
      return line2("sable", "Say what you would keep. The stair holds it better than a decision made in a hurry.", "steady", "aside");
    default:
      return line2("sable", "I am listening. The road is listening too.", "warm", "aside");
  }
}
function rebuttal2(other, target) {
  const name = companionById(target).name.split(" ")[0];
  if (other === "mara") {
    return line2("mara", `${name} will talk until the road chooses for us. I won't help it.`, "clipped", "against");
  }
  if (other === "ivo") {
    return line2("ivo", `${name} makes it sound settled. It is not settled. I still have a professional objection and the lung capacity for it.`, "sharp", "for");
  }
  return line2("sable", "You are both loud in a small lamp. The road can hear you. So can the player. Try to be worth that.", "warm", "aside");
}
function address2(state, id, playerName) {
  const other = id === "sable" ? state.trust.mara <= state.trust.ivo ? "mara" : "ivo" : id === "mara" ? "ivo" : "mara";
  return {
    narration: `You turn to ${companionById(id).name}. The others do not do you the courtesy of pretending not to listen.`,
    lines: [aside2(id, state, playerName), rebuttal2(other, id)],
    memories: []
  };
}
function unknown2(state, playerName, text) {
  return {
    narration: `You try it: "${clip2(text)}". ${PLACES[state.location]} does not take that step. It stays where it is, ${playerName}, waiting for a decision it already understands.`,
    lines: [
      line2("ivo", "Poetic. Unparsed. Give the scene a verb it already fears.", "dry", "aside"),
      line2("mara", "Pick a road. Mystery is how people get billed twice.", "impatient", "aside"),
      line2("sable", "I heard you. The place did too. It is simply not hungry for that sentence.", "kind", "aside")
    ],
    memories: []
  };
}
function resolveTurn(state, playerName, text, memories) {
  if ((state.bookId ?? "ashmarch") === "lumenferry") {
    return resolveLumenferryTurn(state, playerName, text, memories);
  }
  const intent = parseIntent(text, state.beat, suggestionsFor(state));
  if (intent.type === "look") return finish2(clone(state), look2(state, playerName));
  if (intent.type === "inventory") return finish2(clone(state), inventory2(state, playerName));
  if (intent.type === "recall") return finish2(clone(state), recall2(state, playerName, memories));
  if (intent.type === "address") return finish2(clone(state), address2(state, intent.companionId, playerName));
  if (intent.type === "choice") {
    const next = clone(state);
    const spoken = applyChoice2(next, state, intent.id, playerName);
    if (spoken) return finish2(next, spoken);
  }
  return finish2(clone(state), unknown2(state, playerName, text));
}
function clone(state) {
  return structuredClone(state);
}

// games/ashmarch/src/server/game/engine.ts
function stampTurn(state, turn) {
  const next = { ...state, turn };
  if (next.lastRoll) next.lastRoll = { ...next.lastRoll, turn };
  return next;
}
function slotLabel(playerName, bookId, state) {
  return `${playerName} \xB7 ${bookById(bookId).title} \xB7 ${PLACES[state.location]}`;
}
var GameEngine = class {
  constructor(db, llm2, images2) {
    this.db = db;
    this.llm = llm2;
    this.images = images2;
  }
  locks = /* @__PURE__ */ new Map();
  list() {
    return this.db.listCampaigns();
  }
  slot() {
    const saved = this.db.getSaveSlot();
    if (!saved) return null;
    const row = this.db.getCampaign(saved.campaignId);
    if (!row) {
      this.db.clearSaveSlot();
      return null;
    }
    return this.toSlot(row, saved.label, saved.savedAt);
  }
  save(id) {
    const row = this.db.getCampaign(id);
    if (!row) throw new HttpError(404, "That expedition is not on this road.");
    const savedAt = (/* @__PURE__ */ new Date()).toISOString();
    const label = slotLabel(row.playerName, row.bookId, row.state);
    this.db.writeSaveSlot(id, label, savedAt);
    return this.toSlot(row, label, savedAt);
  }
  get(id) {
    return this.view(id);
  }
  async start(input) {
    const playerName = cleanName(input.playerName);
    const motive = cleanMotive(input.motive);
    const bookId = cleanBook(input.bookId);
    const prior = this.db.listMemoriesByPlayer(playerName).map((memory) => memory.text);
    const resolution = resolveOpening(playerName, motive, { bookId, priorMemories: prior });
    const prose = await this.speak(resolution, playerName, motive, [], null);
    const scene = await this.illustrate(resolution);
    const id = `c_${crypto.randomUUID()}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const state = stampTurn(resolution.state, 1);
    const label = slotLabel(playerName, bookId, state);
    this.db.transaction(() => {
      this.db.insertCampaign({
        id,
        bookId,
        playerName,
        motive,
        state,
        scene,
        createdAt: now,
        updatedAt: now
      });
      this.db.writeSaveSlot(id, label, now);
      this.db.insertMessages(id, [
        {
          turn: 1,
          role: "gm",
          speaker: "The Chronicle",
          companionId: null,
          stance: null,
          mood: null,
          text: prose.narration
        },
        ...prose.lines.map((entry) => ({
          turn: 1,
          role: "companion",
          speaker: entry.speaker,
          companionId: entry.companionId,
          stance: entry.stance,
          mood: entry.mood,
          text: entry.text
        }))
      ]);
      this.db.insertMemories(id, 1, resolution.newMemories);
    });
    return this.view(id);
  }
  async act(id, text) {
    const action = cleanAction(text);
    return this.withLock(id, async () => {
      const row = this.db.getCampaign(id);
      if (!row) throw new HttpError(404, "That expedition is not on this road.");
      const own = this.db.listMemories(id).map((memory) => memory.text);
      const carried = this.db.listMemoriesByPlayer(row.playerName, id).map((memory) => memory.text);
      const memories = [...own, ...carried];
      const resolution = resolveTurn(row.state, row.playerName, action, memories);
      const prose = await this.speak(
        resolution,
        row.playerName,
        row.motive,
        [...memories, ...resolution.newMemories.map((memory) => memory.text)],
        action
      );
      const scene = await this.illustrate(resolution);
      const turn = row.state.turn + 1;
      const state = stampTurn(resolution.state, turn);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const label = slotLabel(row.playerName, row.bookId, state);
      this.db.transaction(() => {
        this.db.insertMessages(id, [
          {
            turn,
            role: "player",
            speaker: row.playerName,
            companionId: null,
            stance: null,
            mood: null,
            text: action
          },
          {
            turn,
            role: "gm",
            speaker: "The Chronicle",
            companionId: null,
            stance: null,
            mood: null,
            text: prose.narration
          },
          ...prose.lines.map((entry) => ({
            turn,
            role: "companion",
            speaker: entry.speaker,
            companionId: entry.companionId,
            stance: entry.stance,
            mood: entry.mood,
            text: entry.text
          }))
        ]);
        this.db.insertMemories(id, turn, resolution.newMemories);
        this.db.updateCampaign(id, state, scene, now);
        this.db.writeSaveSlot(id, label, now);
      });
      return this.view(id);
    });
  }
  delete(id) {
    if (!this.db.deleteCampaign(id)) throw new HttpError(404, "That expedition is not on this road.");
  }
  async speak(resolution, playerName, motive, memories, playerText) {
    const request = {
      system: chronicleSystem(resolution.state.bookId ?? "ashmarch"),
      user: chronicleUser({
        bookId: resolution.state.bookId ?? "ashmarch",
        playerName,
        motive,
        state: resolution.state,
        memories,
        playerText,
        canonNarration: resolution.narration,
        canonLines: resolution.lines
      }),
      canon: { narration: resolution.narration, lines: resolution.lines }
    };
    try {
      const produced = await this.llm.complete(request);
      const narration = produced.narration.trim();
      if (narration.length < 40 || produced.lines.length < 2) return request.canon;
      return { narration, lines: produced.lines };
    } catch (error) {
      if (this.llm.id === "stub") throw error;
      console.error("Chronicle provider failed; using the local scene.", error instanceof Error ? error.message : "error");
      return request.canon;
    }
  }
  async illustrate(resolution) {
    try {
      const image = await this.images.generate(resolution.scene);
      return {
        title: resolution.scene.title,
        alt: image.alt,
        dataUrl: image.dataUrl,
        location: resolution.scene.location,
        prompt: image.prompt
      };
    } catch (error) {
      if (this.images.id === "stub") throw error;
      console.error("Image provider failed; drawing a local plate.", error instanceof Error ? error.message : "error");
      const image = await new StubImageProvider().generate(resolution.scene);
      return {
        title: resolution.scene.title,
        alt: image.alt,
        dataUrl: image.dataUrl,
        location: resolution.scene.location,
        prompt: image.prompt
      };
    }
  }
  view(id) {
    const row = this.db.getCampaign(id);
    if (!row) throw new HttpError(404, "That expedition is not on this road.");
    const bookId = row.bookId ?? row.state.bookId ?? "ashmarch";
    const book = bookById(bookId);
    return {
      id: row.id,
      bookId,
      bookTitle: book.title,
      playerName: row.playerName,
      motive: row.motive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      state: row.state,
      memories: this.db.listMemories(id),
      messages: this.db.listMessages(id),
      scene: row.scene,
      suggestions: suggestionsFor(row.state.bookId ? row.state : { ...row.state, bookId }),
      placeTitle: PLACES[row.state.location],
      party: book.companions.map((companion) => ({
        id: companion.id,
        name: companion.name,
        title: companion.title,
        blurb: companion.blurb,
        quote: companion.quote,
        trust: row.state.trust[companion.id] ?? 50,
        mood: row.state.mood[companion.id] ?? "present",
        regard: regard(row.state.trust[companion.id] ?? 50),
        kit: row.state.partyKits[companion.id] ?? []
      }))
    };
  }
  toSlot(row, label, savedAt) {
    return {
      campaignId: row.id,
      savedAt,
      label,
      playerName: row.playerName,
      bookId: row.bookId,
      bookTitle: bookById(row.bookId).title,
      placeTitle: PLACES[row.state.location],
      ended: row.state.ended,
      motive: row.motive
    };
  }
  async withLock(id, fn) {
    const prev = this.locks.get(id) ?? Promise.resolve();
    let release = () => {
    };
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const current = prev.catch(() => void 0).then(() => gate);
    this.locks.set(id, current);
    await prev.catch(() => void 0);
    try {
      return await fn();
    } finally {
      release();
    }
  }
};

// games/ashmarch/src/server/providers/liveLlm.ts
var SPEAKERS = {
  "mara voss": "mara",
  mara: "mara",
  "ivo quill": "ivo",
  ivo: "ivo",
  sable: "sable",
  "bram holt": "bram",
  bram: "bram",
  "ness kite": "ness",
  ness: "ness",
  pell: "pell"
};
var COMPANION_IDS = /* @__PURE__ */ new Set(["mara", "ivo", "sable", "bram", "ness", "pell"]);
function asStance(value) {
  if (value === "for" || value === "against" || value === "aside") return value;
  return "aside";
}
function coerceChronicle(raw, _canon) {
  if (!raw || typeof raw !== "object") return null;
  const record = raw;
  if (typeof record.narration !== "string" || record.narration.trim().length < 40) return null;
  if (!Array.isArray(record.lines) || record.lines.length < 2) return null;
  const lines = [];
  for (const entry of record.lines) {
    if (!entry || typeof entry !== "object") return null;
    const line3 = entry;
    if (typeof line3.text !== "string" || line3.text.trim().length < 2) return null;
    const companionFromField = typeof line3.companionId === "string" && COMPANION_IDS.has(line3.companionId) ? line3.companionId : null;
    const speaker = typeof line3.speaker === "string" ? line3.speaker : "";
    const companionId = companionFromField ?? SPEAKERS[speaker.trim().toLowerCase()];
    if (!companionId) return null;
    const profile = companionById(companionId);
    lines.push({
      companionId,
      speaker: profile.name,
      text: line3.text.trim(),
      mood: typeof line3.mood === "string" && line3.mood.trim() ? line3.mood.trim() : "present",
      stance: asStance(line3.stance)
    });
  }
  const ids = new Set(lines.map((line3) => line3.companionId));
  if (ids.size < 2) return null;
  return { narration: record.narration.trim(), lines };
}
function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Provider returned no JSON object.");
  return JSON.parse(text.slice(start, end + 1));
}
var OpenAiLlmProvider = class {
  constructor(options) {
    this.options = options;
  }
  id = "openai";
  async complete(request) {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.options.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user }
        ]
      })
    });
    if (!response.ok) {
      throw new Error(`OpenAI chronicle failed (${response.status}).`);
    }
    const body = await response.json();
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI chronicle returned an empty scene.");
    const coerced = coerceChronicle(extractJson(content), request.canon);
    if (!coerced) throw new Error("OpenAI chronicle returned an unusable scene.");
    return coerced;
  }
};
var AnthropicLlmProvider = class {
  constructor(options) {
    this.options = options;
  }
  id = "anthropic";
  async complete(request) {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const response = await fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.options.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.options.model,
        max_tokens: 1400,
        system: request.system,
        messages: [{ role: "user", content: request.user }]
      })
    });
    if (!response.ok) {
      throw new Error(`Anthropic chronicle failed (${response.status}).`);
    }
    const body = await response.json();
    const text = body.content?.find((part) => part.type === "text")?.text;
    if (!text) throw new Error("Anthropic chronicle returned an empty scene.");
    const coerced = coerceChronicle(extractJson(text), request.canon);
    if (!coerced) throw new Error("Anthropic chronicle returned an unusable scene.");
    return coerced;
  }
};

// games/ashmarch/src/server/providers/liveImage.ts
var HttpImageProvider = class {
  constructor(options) {
    this.options = options;
  }
  id = "http";
  async generate(request) {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const response = await fetchImpl(this.options.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: request.prompt,
        location: request.location,
        mood: request.mood,
        title: request.title
      })
    });
    if (!response.ok) {
      throw new Error(`Image provider failed (${response.status}).`);
    }
    const body = await response.json();
    if (typeof body.dataUrl === "string" && body.dataUrl.startsWith("data:image/")) {
      return {
        mime: mimeOf(body.dataUrl),
        dataUrl: body.dataUrl,
        alt: body.alt || request.alt,
        prompt: request.prompt
      };
    }
    if (typeof body.b64 === "string" && body.b64.length > 32) {
      const mime = body.mime === "image/png" || body.mime === "image/webp" || body.mime === "image/jpeg" ? body.mime : "image/png";
      return {
        mime,
        dataUrl: `data:${mime};base64,${body.b64}`,
        alt: body.alt || request.alt,
        prompt: request.prompt
      };
    }
    throw new Error("Image provider returned no picture.");
  }
};
function mimeOf(dataUrl) {
  if (dataUrl.startsWith("data:image/svg+xml")) return "image/svg+xml";
  if (dataUrl.startsWith("data:image/webp")) return "image/webp";
  if (dataUrl.startsWith("data:image/jpeg")) return "image/jpeg";
  return "image/png";
}

// games/ashmarch/src/server/providers/stubLlm.ts
var StubLlmProvider = class {
  id = "stub";
  async complete(request) {
    if (!request.system || !request.user) {
      throw new Error("Stub chronicle received an empty prompt.");
    }
    return {
      narration: request.canon.narration,
      lines: request.canon.lines.map((line3) => ({ ...line3 }))
    };
  }
};

// games/ashmarch/src/server/providers/registry.ts
function createLlmProvider(config2) {
  if (config2.llmProvider === "stub") return new StubLlmProvider();
  if (config2.llmProvider === "openai") {
    if (!config2.openaiApiKey) {
      throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER=openai.");
    }
    return new OpenAiLlmProvider({ apiKey: config2.openaiApiKey, model: config2.openaiModel });
  }
  if (!config2.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic.");
  }
  return new AnthropicLlmProvider({ apiKey: config2.anthropicApiKey, model: config2.anthropicModel });
}
function createImageProvider(config2) {
  if (config2.imageProvider === "stub") return new StubImageProvider();
  if (!config2.imageApiUrl) {
    throw new Error("IMAGE_API_URL is required when IMAGE_PROVIDER=http.");
  }
  if (!config2.imageApiKey) {
    throw new Error("IMAGE_API_KEY is required when IMAGE_PROVIDER=http.");
  }
  return new HttpImageProvider({ apiKey: config2.imageApiKey, apiUrl: config2.imageApiUrl });
}

// games/ashmarch/src/client/portraits.ts
function portrait(id, name) {
  const label = escapeAttr(name);
  const plate = {
    mara: `<rect width="80" height="80" fill="#10131a"/><path d="M12 78c2-22 14-34 28-34s26 12 28 34" fill="#8b4518"/><path d="M18 78c2-16 12-26 22-26s20 10 22 26" fill="#e3b341"/><ellipse cx="40" cy="38" rx="15" ry="17" fill="#f0d2b4"/><path d="M24 36c1-18 10-26 16-26s15 8 16 26c-3-10-8-14-16-14s-13 4-16 14z" fill="#2a160f"/><path d="M24 40c2 14 4 20 2 26M56 40c-2 14-4 20-2 26" fill="#2a160f"/><path d="M31 34q4-3 7 1M42 35q4-3 7 1" fill="none" stroke="#2a160f" stroke-width="1.4"/><ellipse cx="34" cy="40" rx="2" ry="2.4" fill="#1a140f"/><ellipse cx="47" cy="40" rx="2" ry="2.4" fill="#1a140f"/><path d="M35 49q5 3 10 0" fill="none" stroke="#8a4030" stroke-width="1.3"/><circle cx="54" cy="62" r="5" fill="#e3b341"/><path d="M54 58v8M50 62h8" stroke="#10131a" stroke-width="1.2"/>`,
    ivo: `<rect width="80" height="80" fill="#10131a"/><path d="M14 78c3-20 12-30 26-30s23 10 26 30" fill="#f6f3ea"/><path d="M22 78c2-12 8-18 18-18s16 6 18 18" fill="#c4beb2"/><ellipse cx="40" cy="40" rx="14" ry="16" fill="#f3d7b8"/><path d="M26 36c2-16 8-22 14-22s12 6 14 22c-4-8-8-10-14-10s-10 2-14 10z" fill="#5c3b22"/><circle cx="33" cy="40" r="6" fill="none" stroke="#e3b341" stroke-width="1.6"/><circle cx="47" cy="40" r="6" fill="none" stroke="#e3b341" stroke-width="1.6"/><path d="M39 40h2" stroke="#e3b341" stroke-width="1.6"/><ellipse cx="33" cy="40" rx="1.6" ry="2" fill="#1a140f"/><ellipse cx="47" cy="40" rx="1.6" ry="2" fill="#1a140f"/><path d="M36 50q4 2 8 0" fill="none" stroke="#8a4030" stroke-width="1.2"/><path d="M54 28c6 2 8 10 4 14" fill="none" stroke="#e3b341" stroke-width="2"/><path d="M58 42l4 8" stroke="#8b83ff" stroke-width="2"/>`,
    sable: `<rect width="80" height="80" fill="#10131a"/><path d="M36 8h8v10h-8z" fill="#c4beb2"/><path d="M24 18h32l-4 12H28z" fill="#e3b341"/><path d="M26 30h28l-4 36H30z" fill="#1a1f2b" stroke="#e3b341" stroke-width="2"/><ellipse cx="40" cy="48" rx="8" ry="12" fill="#f6f3ea"/><ellipse cx="37" cy="46" rx="1.5" ry="2" fill="#10131a"/><ellipse cx="44" cy="46" rx="1.5" ry="2" fill="#10131a"/><path d="M36 54q4 3 8 0" fill="none" stroke="#8a4030" stroke-width="1.2"/><path d="M30 36l8 28M50 34l-6 30" fill="none" stroke="#e3b341" stroke-width="1.4"/><circle cx="40" cy="24" r="3" fill="#8b83ff"/>`,
    bram: `<rect width="80" height="80" fill="#10131a"/><path d="M12 78c2-20 14-28 28-28s26 8 28 28" fill="#1f6f78"/><path d="M18 78c2-12 10-18 22-18s20 6 22 18" fill="#0e2c34"/><ellipse cx="40" cy="42" rx="14" ry="15" fill="#e7c2a4"/><path d="M22 40c4-8 32-8 36 2v8H22z" fill="#123840"/><path d="M24 28h32v10H24z" fill="#123840"/><path d="M20 28h40v4H20z" fill="#e3b341"/><path d="M30 48c2 6 6 8 10 8s8-2 10-8" fill="#5c3b22"/><ellipse cx="34" cy="42" rx="1.8" ry="2.2" fill="#1a140f"/><ellipse cx="46" cy="42" rx="1.8" ry="2.2" fill="#1a140f"/><path d="M18 62c8 4 12 2 16-2" fill="none" stroke="#e3b341" stroke-width="2"/>`,
    ness: `<rect width="80" height="80" fill="#10131a"/><path d="M14 78c2-20 12-30 26-30s24 10 26 30" fill="#e07a45"/><ellipse cx="40" cy="40" rx="14" ry="16" fill="#f0d2b4"/><path d="M26 36c2-18 8-24 14-24 8 0 12 6 14 16-6-6-10-8-14-8s-10 4-14 16z" fill="#3a2418"/><path d="M48 18c6-2 10 2 10 8-6 0-10-2-10-8z" fill="#3a2418"/><ellipse cx="34" cy="40" rx="1.8" ry="2.2" fill="#1a140f"/><ellipse cx="46" cy="40" rx="1.8" ry="2.2" fill="#1a140f"/><path d="M31 34q4-2 7 1M43 35q4-2 7 1" fill="none" stroke="#2a160f" stroke-width="1.2"/><path d="M35 50q5 3 10 0" fill="none" stroke="#8a4030" stroke-width="1.2"/><path d="M54 52l12 10-8 2z" fill="#9fd7ff" stroke="#e3b341" stroke-width="1.2"/>`,
    pell: `<rect width="80" height="80" fill="#10131a"/><path d="M8 64c10-8 18-8 28 0s18 8 28 0 16-8 20 0v16H8z" fill="#1f6f78"/><path d="M22 58c6-28 30-28 36 0 2 16-4 22-18 22S20 74 22 58z" fill="#e3b341"/><path d="M28 46h24" stroke="#10131a" stroke-width="3"/><path d="M30 34c4 8 16 8 20 0" fill="none" stroke="#10131a" stroke-width="2"/><ellipse cx="34" cy="50" rx="1.8" ry="2.2" fill="#10131a"/><ellipse cx="46" cy="50" rx="1.8" ry="2.2" fill="#10131a"/><path d="M36 58q4 3 8 0" fill="none" stroke="#10131a" stroke-width="1.4"/><path d="M36 22h8l2 10h-12z" fill="#f6f3ea"/><rect x="38" y="10" width="4" height="14" fill="#8b83ff"/><path d="M26 40l6 18" stroke="#f6f3ea" stroke-width="1.4"/>`
  };
  const inner = plate[id] || plate.sable;
  return `<svg class="portrait" viewBox="0 0 80 80" role="img" aria-label="${label}">${inner}</svg>`;
}
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escapeAttr(value) {
  return escapeHtml(value);
}

// games/ashmarch/src/client/table.ts
function mountTable(root2, engine2, health) {
  const state = {
    bookId: "ashmarch",
    name: "",
    motive: "",
    active: null,
    resumed: false,
    busy: false,
    error: null,
    diceTurn: null,
    saveNote: null,
    campaigns: engine2.list(),
    slot: engine2.slot()
  };
  const refresh = () => {
    state.campaigns = engine2.list();
    state.slot = engine2.slot();
  };
  const paint = () => {
    root2.innerHTML = shell(health, state.error) + (state.active ? play(state) : home(state));
    bind(root2, state, engine2, refresh, paint);
  };
  paint();
}
function shell(health, error) {
  return `
    <header class="topbar">
      <div>
        <p class="brand">The Chronicle</p>
        <p class="brand-kicker">Ashmarch and Lumenferry</p>
      </div>
      <div class="topbar-side">
        <a class="ash-back" href="/">Arcade</a>
      </div>
    </header>
    ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}
  `;
}
function home(state) {
  const book = BOOKS.find((entry) => entry.id === state.bookId) ?? BOOKS[0];
  const slot = state.slot;
  return `
    <div class="home theme-${book.id}">
      <section class="manifesto">
        <p class="eyebrow">${escapeHtml(book.kicker)}</p>
        <h1>${escapeHtml(book.title)}</h1>
        <p class="deck">${escapeHtml(book.deck)}</p>
        <ul class="party-intro">
          ${book.companions.map(
    (companion) => `
            <li>
              ${portrait(companion.id, companion.name)}
              <div>
                <h2>${escapeHtml(companion.name)}</h2>
                <p class="role">${escapeHtml(companion.title)}</p>
                <p>${escapeHtml(companion.blurb)}</p>
                <blockquote>\u201C${escapeHtml(companion.quote)}\u201D</blockquote>
              </div>
            </li>`
  ).join("")}
        </ul>
      </section>
      <section class="ledger">
        <section class="continue-slot" aria-label="Continue slot">
          <p class="eyebrow">Continue</p>
          ${slot ? `<h2>${escapeHtml(slot.bookTitle)}</h2>
                 <p><strong>${escapeHtml(slot.playerName)}</strong><span class="role"> \xB7 ${escapeHtml(slot.placeTitle)}${slot.ended ? " \xB7 closed" : ""}</span></p>
                 <p>${escapeHtml(slot.motive)}</p>
                 <button type="button" class="primary continue" data-resume="${escapeHtml(slot.campaignId)}" ${state.busy ? "disabled" : ""}>Continue</button>` : `<p class="empty">The continue slot is empty. A new road fills it, and Save keeps the one you mean to return to.</p>`}
        </section>
        <form id="ash-begin">
          <h2>New expedition</h2>
          <p class="role" id="book-picker-label">Which road?</p>
          <div class="book-picker" role="radiogroup" aria-labelledby="book-picker-label">
            ${BOOKS.map(
    (entry) => `
              <button type="button" role="radio" aria-checked="${entry.id === book.id}" class="${entry.id === book.id ? "selected" : ""}" data-book="${entry.id}">
                <strong>${escapeHtml(entry.title)}</strong>
                <span>${escapeHtml(entry.kicker)}</span>
              </button>`
  ).join("")}
          </div>
          <label for="player-name">What should the road call you?</label>
          <input id="player-name" name="playerName" maxlength="40" autocomplete="nickname" placeholder="Nim" required value="${escapeHtml(state.name)}">
          <label for="motive">${escapeHtml(book.motiveLabel)}</label>
          <input id="motive" name="motive" maxlength="200" placeholder="${escapeHtml(book.motivePlaceholder)}" required value="${escapeHtml(state.motive)}">
          <button type="submit" class="primary" ${state.busy ? "disabled" : ""}>${state.busy ? "The road is waking\u2026" : escapeHtml(book.beginLabel)}</button>
          <p class="fine">Saved on this machine. No key, no network. No one else is on this road.</p>
        </form>
        <div class="expeditions">
          <h2>Expeditions already walked</h2>
          ${state.campaigns.length === 0 ? `<p class="empty">The table is clear. No one has signed the book.</p>` : `<ul>${state.campaigns.map(
    (campaign) => `
                  <li>
                    <div>
                      <strong>${escapeHtml(campaign.playerName)}</strong>
                      <span class="role">${escapeHtml(campaign.bookTitle)} \xB7 ${escapeHtml(campaign.placeTitle)}${campaign.ended ? " \xB7 closed" : ""}</span>
                      <p>${escapeHtml(campaign.motive)}</p>
                      <p class="fine">${campaign.memoryCount} remembered \xB7 ${escapeHtml(stamp(campaign.updatedAt))}</p>
                    </div>
                    <div class="row-actions">
                      <button type="button" data-resume="${escapeHtml(campaign.id)}" ${state.busy ? "disabled" : ""}>Resume</button>
                      <button type="button" class="ghost" data-abandon="${escapeHtml(campaign.id)}" ${state.busy ? "disabled" : ""}>Abandon</button>
                    </div>
                  </li>`
  ).join("")}</ul>`}
        </div>
      </section>
    </div>
  `;
}
function play(state) {
  const campaign = state.active;
  if (!campaign) return "";
  const turns = groupTurns(campaign.messages);
  const latest = campaign.memories[campaign.memories.length - 1];
  const roll = campaign.state.lastRoll;
  const showDice = Boolean(roll && state.diceTurn !== null && state.diceTurn === campaign.state.turn);
  return `
    <div class="play theme-${campaign.bookId}">
      <section class="stage" aria-label="Chronicle">
        <figure class="scene">
          <img id="ash-plate" src="${escapeHtml(campaign.scene.dataUrl)}" alt="${escapeHtml(campaign.scene.alt)}">
          ${showDice && roll ? diceOverlay(roll) : ""}
          <figcaption>
            <span>${escapeHtml(campaign.bookTitle)}</span>
            <strong>${escapeHtml(campaign.placeTitle)}</strong>
          </figcaption>
        </figure>
        <ul class="party-strip" aria-label="Party">
          ${campaign.party.map(
    (member) => `
            <li>
              ${portrait(member.id, member.name)}
              <div>
                <strong>${escapeHtml(member.name)}</strong>
                <span>${escapeHtml(member.mood)} \xB7 ${escapeHtml(member.regard)}</span>
              </div>
            </li>`
  ).join("")}
        </ul>
        ${latest ? `<p class="ticker">Remembered \u2014 ${escapeHtml(latest.text)}</p>` : ""}
        ${state.resumed ? `<p class="resume-banner">The Chronicle kept this road. ${campaign.memories.length} ${campaign.memories.length === 1 ? "memory is" : "memories are"} still warm.</p>` : ""}
        ${state.saveNote ? `<p class="resume-banner" role="status">${escapeHtml(state.saveNote)}</p>` : ""}
        <div class="transcript" id="ash-transcript" aria-live="polite">
          ${turns.map((turn) => turnHtml(turn)).join("")}
          ${state.busy ? `<p class="waiting">The Chronicle is writing, and the party is already interrupting.</p>` : ""}
        </div>
        <form class="composer" id="ash-act">
          <div class="suggestions" id="ash-choices" role="group" aria-label="Choices">
            ${campaign.suggestions.map(
    (suggestion) => `<button type="button" class="choice" data-choice="${escapeHtml(suggestion.label)}" ${state.busy || showDice ? "disabled" : ""}>${escapeHtml(suggestion.label)}</button>`
  ).join("")}
          </div>
          <label class="sr-only" for="action">What do you do?</label>
          <textarea id="action" maxlength="500" rows="2" placeholder="Or say it in your own words. You can look, check your pockets, or speak a companion's name." ${state.busy ? "disabled" : ""}></textarea>
          <div class="composer-row">
            <button type="submit" class="primary choice" ${state.busy || showDice ? "disabled" : ""}>Speak</button>
            <button type="button" class="choice" id="ash-save" ${state.busy || showDice ? "disabled" : ""}>Save</button>
            <button type="button" class="ghost choice" id="ash-leave">Leave the table</button>
            <p class="fine">Enter sends. Shift+Enter breaks a line. The road keeps what you choose.</p>
          </div>
        </form>
      </section>
      <aside class="rail" aria-label="Party and memory">
        <section>
          <h2>Party</h2>
          <ul class="party-cards">
            ${campaign.party.map(
    (member) => `
              <li>
                ${portrait(member.id, member.name)}
                <div>
                  <h3>${escapeHtml(member.name)}</h3>
                  <p class="role">${escapeHtml(member.title)}</p>
                  <p class="mood">${escapeHtml(member.mood)} \xB7 ${escapeHtml(member.regard)}</p>
                  <div class="meter meter-${member.id}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${member.trust}" aria-label="${escapeHtml(member.name)} trust"><span style="width:${member.trust}%"></span></div>
                  <p class="fine">Carrying ${member.kit.length ? escapeHtml(member.kit.join(", ")) : "nothing owed to the road"}</p>
                </div>
              </li>`
  ).join("")}
          </ul>
        </section>
        <section>
          <h2>Your case</h2>
          <ul class="kit">${campaign.state.inventory.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </section>
        <section>
          <h2>What the Chronicle kept</h2>
          <ol class="memories" id="ash-journal">
            ${campaign.memories.map(
    (memory) => `<li class="${memory.turn === campaign.state.turn ? "fresh" : ""}"><span>${escapeHtml(memory.kind)}</span>${escapeHtml(memory.text)}</li>`
  ).join("")}
          </ol>
        </section>
      </aside>
    </div>
  `;
}
function turnHtml(turn) {
  const player = turn.find((message) => message.role === "player");
  const gm = turn.find((message) => message.role === "gm");
  const lines = turn.filter((message) => message.role === "companion");
  const stances = lines.map((message) => message.stance);
  const argue = stances.includes("for") && stances.includes("against");
  return `
    <article class="turn">
      ${player ? `<p class="you"><span>${escapeHtml(player.speaker)}</span>${escapeHtml(player.text)}</p>` : ""}
      ${gm ? `<div class="narration">${paragraphs(gm.text).map((part) => `<p>${escapeHtml(part)}</p>`).join("")}</div>` : ""}
      ${argue ? `<p class="argument">The party does not agree.</p>` : ""}
      <ul class="lines">
        ${lines.map(
    (line3) => `
          <li class="line line-${line3.companionId ?? "sable"}">
            <span class="who">${escapeHtml(line3.speaker)}${line3.mood ? `<em>${escapeHtml(line3.mood)}</em>` : ""}</span>
            ${escapeHtml(line3.text)}
          </li>`
  ).join("")}
      </ul>
    </article>
  `;
}
function diceOverlay(roll) {
  const sign = roll.modifier >= 0 ? "+" : "";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const face = reduce ? roll.natural : roll.faces[0] ?? roll.natural;
  return `
    <div class="dice-overlay" role="status" aria-live="assertive" data-dice="1">
      <p class="dice-kind">${roll.kind === "combat" ? "Combat" : "Skill check"}</p>
      <div class="die ${reduce ? "settled" : "spinning"}" aria-hidden="true"><span>${face}</span></div>
      <p class="dice-label">${escapeHtml(roll.actor)} \xB7 ${escapeHtml(roll.label)}</p>
      <p class="dice-total">${escapeHtml(`${roll.natural} ${sign}${roll.modifier} = ${roll.total} vs DC ${roll.dc}. ${roll.success ? "Success." : "Failure."}`)}</p>
    </div>
  `;
}
function bind(root2, state, engine2, refresh, paint) {
  root2.querySelectorAll("[data-book]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.book;
      if (id === "ashmarch" || id === "lumenferry") {
        state.bookId = id;
        captureDraft(root2, state);
        paint();
      }
    });
  });
  root2.querySelector("#ash-begin")?.addEventListener("submit", (event) => {
    event.preventDefault();
    captureDraft(root2, state);
    void run(state, paint, async () => {
      state.active = await engine2.start({ playerName: state.name, motive: state.motive, bookId: state.bookId });
      state.resumed = false;
      state.diceTurn = null;
      state.saveNote = null;
      refresh();
    });
  });
  root2.querySelectorAll("[data-resume]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.resume;
      if (!id) return;
      void run(state, paint, async () => {
        state.active = engine2.get(id);
        state.resumed = true;
        state.diceTurn = null;
        state.saveNote = null;
      });
    });
  });
  root2.querySelectorAll("[data-abandon]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.abandon;
      if (!id) return;
      if (!window.confirm("Abandon this expedition? The Chronicle will forget it.")) return;
      void run(state, paint, async () => {
        engine2.delete(id);
        if (state.active?.id === id) state.active = null;
        refresh();
      });
    });
  });
  root2.querySelectorAll("[data-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      const text = button.dataset.choice;
      if (text) void act(state, engine2, refresh, paint, text);
    });
  });
  const form = root2.querySelector("#ash-act");
  const draft = root2.querySelector("#action");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (draft?.value.trim()) void act(state, engine2, refresh, paint, draft.value);
  });
  draft?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (draft.value.trim()) void act(state, engine2, refresh, paint, draft.value);
    }
  });
  root2.querySelector("#ash-save")?.addEventListener("click", () => {
    if (!state.active) return;
    void run(state, paint, async () => {
      const next = engine2.save(state.active.id);
      state.saveNote = `Saved. Continue will bring back ${next.playerName} at ${next.placeTitle}.`;
      refresh();
    });
  });
  root2.querySelector("#ash-leave")?.addEventListener("click", () => {
    state.active = null;
    state.diceTurn = null;
    state.saveNote = null;
    refresh();
    paint();
  });
  const transcript = root2.querySelector("#ash-transcript");
  if (transcript) transcript.scrollTop = transcript.scrollHeight;
  if (state.active) window.scrollTo(0, 0);
  const dice = root2.querySelector("[data-dice]");
  if (dice && state.diceTurn !== null) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => {
      if (state.diceTurn !== null) {
        state.diceTurn = null;
        paint();
      }
    }, reduce ? 700 : 1100);
  }
}
async function act(state, engine2, refresh, paint, text) {
  if (!state.active || state.busy || state.diceTurn !== null) return;
  const id = state.active.id;
  await run(state, paint, async () => {
    state.active = await engine2.act(id, text);
    state.resumed = false;
    state.saveNote = null;
    state.diceTurn = state.active.state.lastRoll ? state.active.state.turn : null;
    refresh();
  });
}
async function run(state, paint, fn) {
  state.busy = true;
  state.error = null;
  paint();
  try {
    await fn();
  } catch (error) {
    state.error = error instanceof Error ? error.message : "The Chronicle lost the sentence.";
  } finally {
    state.busy = false;
    paint();
  }
}
function captureDraft(root2, state) {
  const name = root2.querySelector("#player-name");
  const motive = root2.querySelector("#motive");
  if (name) state.name = name.value;
  if (motive) state.motive = motive.value;
}
function paragraphs(text) {
  return text.split(/\n\n+/).map((part) => part.trim()).filter(Boolean);
}
function groupTurns(messages) {
  const turns = [];
  for (const message of messages) {
    const last = turns[turns.length - 1];
    if (!last || last[0]?.turn !== message.turn) turns.push([message]);
    else last.push(message);
  }
  return turns;
}
function stamp(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(void 0, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// games/ashmarch/src/client/boot.ts
var config = loadConfig({
  LLM_PROVIDER: "stub",
  IMAGE_PROVIDER: "stub"
});
var llm = createLlmProvider(config);
var images = createImageProvider(config);
var engine = new GameEngine(new GameDb(), llm, images);
var root = document.getElementById("app");
if (!root) throw new Error("Ashmarch has no table.");
mountTable(root, engine, {
  ok: true,
  llmProvider: llm.id,
  imageProvider: images.id,
  persistence: "browser"
});
