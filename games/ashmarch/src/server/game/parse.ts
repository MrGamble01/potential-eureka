import type { BeatId, CompanionId, Suggestion } from "../../shared/types";

export type Intent =
  | { type: "choice"; id: string }
  | { type: "look" }
  | { type: "inventory" }
  | { type: "recall" }
  | { type: "address"; companionId: CompanionId }
  | { type: "unknown" };

type PatternChoice = { id: string; patterns: RegExp[] };

const BEAT_CHOICES: Record<BeatId, PatternChoice[]> = {
  waystation: [
    { id: "fears", patterns: [/afraid/, /\bfear\b/, /afraid of losing/] },
    { id: "bridge", patterns: [/\bbridge\b/] },
    { id: "flats", patterns: [/\bflats\b/, /long way/, /salt flats/] },
    { id: "study_map", patterns: [/look at the map/, /study the map/, /the map again/] },
    { id: "rest", patterns: [/rest until/, /lamp is low/] },
  ],
  bridge: [
    { id: "own_name", patterns: [/my own name/, /give (the bridge )?my name/, /\bmy name\b/, /true name/] },
    { id: "false_name", patterns: [/false name/, /fake name/, /invent a name/, /\ba lie\b/] },
    { id: "mara_name", patterns: [/mara.{0,48}(name|offer)/, /warden-?name/] },
    { id: "ivo_name", patterns: [/ivo.{0,48}(name|offer|index)/, /stolen name/, /name from the index/] },
    { id: "sable_name", patterns: [/sable.{0,48}(name|offer|remember)/, /remembered name/, /name you remember/] },
    { id: "shrine", patterns: [/mile-shrine/, /climb down/] },
  ],
  shrine: [
    { id: "shrine_take", patterns: [/carved name/, /take the name/] },
    { id: "shrine_leave", patterns: [/leave the shrine/, /as it is/] },
  ],
  flats: [
    { id: "shelter", patterns: [/shelter/, /\bribs\b/, /rib cage/, /inside the rib/] },
    { id: "push", patterns: [/push through/, /\bstorm\b/, /keep walking/, /press on/] },
    { id: "orchard", patterns: [/bone chime/, /orchard/] },
    { id: "fight_wight", patterns: [/salt-wight/, /fight the wight/, /stand and fight/] },
  ],
  wight: [
    { id: "wight_strike", patterns: [/strike the wight/, /with mara/, /road-knife/] },
    { id: "wight_brace", patterns: [/brace/, /call sable/, /sable's lamp/] },
  ],
  orchard: [
    { id: "orchard_pick", patterns: [/salt fruit/, /pick the/] },
    { id: "orchard_leave", patterns: [/leave the fruit/, /on the branch/] },
  ],
  market: [
    { id: "trade_seal", patterns: [/warden seal/, /mara's seal/, /trade mara/, /seal for/] },
    { id: "trade_index", patterns: [/index page/, /ivo's index/, /trade ivo/, /trade the index/] },
    { id: "trade_memory", patterns: [/sable.{0,40}memor/, /give up a memory/, /let sable/] },
    { id: "refuse", patterns: [/refuse/, /another way/, /floodgate/, /don't trade/, /do not trade/, /\bsneak\b/] },
  ],
  scriptorium: [
    { id: "read", patterns: [/read (it |the vote )?aloud/, /read the vote/, /^read\b/] },
    { id: "copy", patterns: [/\bcopy\b/, /into the map/] },
    { id: "burn", patterns: [/\bburn\b/] },
    { id: "leave", patterns: [/untouched/, /leave the record/, /leave it/] },
  ],
  bellcrypt: [
    { id: "complete_map", patterns: [/complete the map/, /wake vellum/, /wake the town/, /finish the map/] },
    { id: "seal_crypt", patterns: [/seal the crypt/, /still gone/, /tell my employer/, /\blie\b/] },
    { id: "lamp_keep", patterns: [/in the lamp/, /keep the town/, /ask sable/] },
    { id: "choir", patterns: [/choir stair/, /listen at the choir/] },
  ],
  choir: [{ id: "choir_back", patterns: [/back to the bells/, /choir stair behind/] }],
  quay: [
    { id: "fears_light", patterns: [/afraid the light/, /light will show/] },
    { id: "ferry_bell", patterns: [/ferry bell/] },
    { id: "causeway", patterns: [/causeway/, /toward the lens/] },
    { id: "eelbeds", patterns: [/eelbeds/, /\bwade\b/] },
  ],
  causeway: [
    { id: "steady", patterns: [/steady the skiff/, /glass sings/] },
    { id: "cut", patterns: [/cut across/, /tide turns/] },
    { id: "fight_skiff", patterns: [/press-gang/, /fight the skiff/] },
  ],
  boarding: [
    { id: "skiff_repel", patterns: [/repel the boarding/, /boarding party/, /fight them off/] },
    { id: "skiff_slip", patterns: [/slip under the hull/, /under the hull/, /slip past/] },
  ],
  eelbeds: [
    { id: "follow_bell", patterns: [/pell's bell/, /under the water/, /follow pell/] },
    { id: "weed", patterns: [/keep to the weed/, /look down/] },
  ],
  lenshouse: [
    { id: "trade_charm", patterns: [/tide-charm/, /bram's tide/] },
    { id: "trade_mold", patterns: [/stolen mold/, /ness's stolen/] },
    { id: "trade_note", patterns: [/bell-note/, /spend a bell/] },
    { id: "weed_ladder", patterns: [/weed ladder/, /refuse and climb/] },
  ],
  kiln: [
    { id: "read_log", patterns: [/firing log aloud/, /read the firing/] },
    { id: "copy_log", patterns: [/tide-book/, /copy the log/] },
    { id: "smash_log", patterns: [/smash the firing/, /smash the log/] },
    { id: "leave_log", patterns: [/leave the log/] },
  ],
  bellpool: [
    { id: "pool_argue", patterns: [/argue the light/, /one more time/] },
    { id: "relight", patterns: [/relight/] },
    { id: "keep_dark", patterns: [/keep the light dark/, /warn the boats/] },
    { id: "hold_town", patterns: [/hold the town/, /in the buoy/] },
  ],
  ending: [{ id: "tomorrow", patterns: [/tomorrow/] }],
};

function negated(text: string, index: number): boolean {
  const window = text.slice(Math.max(0, index - 32), index);
  return /\b(don't|do not|never|won't|will not|refuse to|not)\b/.test(window);
}

function matchPattern(text: string, pattern: RegExp): boolean {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const re = new RegExp(pattern.source, flags);
  let found: RegExpExecArray | null;
  while ((found = re.exec(text))) {
    if (!negated(text, found.index)) return true;
    if (found[0].length === 0) break;
  }
  return false;
}

const NAME_PATTERNS: Record<CompanionId, RegExp> = {
  mara: /\bmara\b/,
  ivo: /\bivo\b/,
  sable: /\bsable\b/,
  bram: /\bbram\b/,
  ness: /\bness\b/,
  pell: /\bpell\b/,
};

function addressOf(text: string, party: CompanionId[]): CompanionId | null {
  const hits: { id: CompanionId; index: number }[] = [];
  for (const id of party) {
    const found = NAME_PATTERNS[id].exec(text);
    if (found) hits.push({ id, index: found.index });
  }
  hits.sort((a, b) => a.index - b.index);
  return hits[0]?.id ?? null;
}

export function parseIntent(
  text: string,
  beat: BeatId,
  suggestions: Suggestion[],
  party: CompanionId[] = ["mara", "ivo", "sable"],
): Intent {
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
  const companionId = addressOf(lower, party);
  if (companionId) return { type: "address", companionId };
  return { type: "unknown" };
}
