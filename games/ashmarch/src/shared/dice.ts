import type { DiceRoll } from "./types";

/** Stable d20. The same seed always lands on the same face, so tests can force both outcomes. */
export function rollD20(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 20 + 1;
}

export function modifierFromTrust(trust: number | undefined): number {
  const value = trust ?? 50;
  return Math.max(-1, Math.min(4, Math.round((value - 50) / 10)));
}

export function makeCheck(input: {
  playerName: string;
  turn: number;
  choiceId: string;
  kind: DiceRoll["kind"];
  label: string;
  actor: string;
  modifier: number;
  dc: number;
}): DiceRoll {
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
    turn: input.turn,
  };
}

export function rollSentence(roll: DiceRoll): string {
  const sign = roll.modifier >= 0 ? "+" : "";
  const verdict = roll.success ? "The roll holds." : "The roll fails.";
  return `${roll.actor} throws a d20 for ${roll.label}: ${roll.natural} ${sign}${roll.modifier} = ${roll.total} against DC ${roll.dc}. ${verdict}`;
}
