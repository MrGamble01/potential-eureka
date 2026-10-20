import { bookById, PLACES } from "../../shared/companions";
import { rollSentence } from "../../shared/dice";
import type { BookId, DialogueLine, GameState } from "../../shared/types";

export function chronicleSystem(bookId: BookId = "ashmarch"): string {
  const book = bookById(bookId);
  const people = book.companions
    .map((companion) => `${companion.name} (companionId ${companion.id}) — ${companion.title}. ${companion.blurb}`)
    .join("\n");
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
    people,
  ].join("\n");
}

export function chronicleUser(input: {
  bookId?: BookId;
  playerName: string;
  motive: string;
  state: GameState;
  memories: string[];
  playerText: string | null;
  canonNarration: string;
  canonLines: DialogueLine[];
}): string {
  const book = bookById(input.bookId ?? input.state.bookId ?? "ashmarch");
  const memories = input.memories.length ? input.memories.map((memory) => `- ${memory}`).join("\n") : "- none yet";
  const guidance = input.canonLines
    .map((line) => `- ${line.speaker} [${line.stance}/${line.mood}]: ${line.text}`)
    .join("\n");
  const kits = book.companions
    .map((companion) => `${companion.name} carries: ${(input.state.partyKits[companion.id] ?? []).join(", ") || "nothing"}`)
    .join("\n");
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
    guidance,
  ].join("\n");
}
