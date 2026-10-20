import type { BookId, CompanionId, LocationId } from "./types";

export type CompanionProfile = {
  id: CompanionId;
  name: string;
  title: string;
  blurb: string;
  quote: string;
};

export type BookProfile = {
  id: BookId;
  title: string;
  kicker: string;
  deck: string;
  motiveLabel: string;
  motivePlaceholder: string;
  beginLabel: string;
  companions: CompanionProfile[];
};

export const ASHMARCH_PARTY: CompanionProfile[] = [
  {
    id: "mara",
    name: "Mara Voss",
    title: "Road warden, retired badly",
    blurb:
      "Terse, protective, and finished with cleverness that gets people erased. She lost a gate once. She will not lose a person the same way.",
    quote: "Bridges that charge names don't give receipts.",
  },
  {
    id: "ivo",
    name: "Ivo Quill",
    title: "Expelled archivist",
    blurb:
      "Eloquent, hungry, and convinced a copied page is a rescued life. He will argue with weather if it has a footnote.",
    quote: "The bridge is one sentence. Sentences are my trade.",
  },
  {
    id: "sable",
    name: "Sable",
    title: "Lantern-spirit",
    blurb:
      "Bound to a cracked brass lamp. Speaks warmly, a little sideways, and remembers roads the map refuses to admit.",
    quote: "If the lamp goes dark I become weather. I would rather not.",
  },
];

export const LUMENFERRY_PARTY: CompanionProfile[] = [
  {
    id: "bram",
    name: "Bram Holt",
    title: "Ferry captain",
    blurb:
      "Keeps the night crossing and trusts a dark shore more than a counted one. He has ferried people away from lights that made them easy to take.",
    quote: "A lit lens is a finger pointing at every boat I love.",
  },
  {
    id: "ness",
    name: "Ness Kite",
    title: "Glassblower's apprentice",
    blurb:
      "Still has glass in the creases of her hands. She stole the mold that could recast the lens, and she is done pretending the dark is a kindness.",
    quote: "They put the sun out and called it safety. I call it a kiln gone cold.",
  },
  {
    id: "pell",
    name: "Pell",
    title: "Tide-bell in a cracked buoy",
    blurb:
      "A spirit housed in a buoy that should have sunk. Speaks in small bells, remembers drownings, and will not spend a note twice.",
    quote: "I can hold a town the way a bell holds a note. Only while the note remains.",
  },
];

export const COMPANIONS = ASHMARCH_PARTY;

export const BOOKS: BookProfile[] = [
  {
    id: "ashmarch",
    title: "Ashmarch",
    kicker: "Field survey, thirty years late",
    deck: "A town voted to be forgotten. You were hired to draw it back onto a map. Three companions come with you, and they do not share a conscience.",
    motiveLabel: "Why did you take the commission?",
    motivePlaceholder: "To pay a debt",
    beginLabel: "Take the road",
    companions: ASHMARCH_PARTY,
  },
  {
    id: "lumenferry",
    title: "Lumenferry",
    kicker: "A lighthouse that chose the dark",
    deck: "The glassworks town put its own light out. You were hired to learn why the lens stays cold. The captain, the apprentice, and the buoy do not agree that it should ever burn again.",
    motiveLabel: "Why did you take the night crossing?",
    motivePlaceholder: "To keep the boats uncounted",
    beginLabel: "Take the ferry",
    companions: LUMENFERRY_PARTY,
  },
];

const ALL_COMPANIONS = [...ASHMARCH_PARTY, ...LUMENFERRY_PARTY];

export function bookById(id: BookId): BookProfile {
  const found = BOOKS.find((book) => book.id === id);
  if (!found) throw new Error(`Unknown book ${id}`);
  return found;
}

export function companionById(id: CompanionId): CompanionProfile {
  const found = ALL_COMPANIONS.find((companion) => companion.id === id);
  if (!found) throw new Error(`Unknown companion ${id}`);
  return found;
}

export function regard(trust: number): string {
  if (trust >= 70) return "steadfast";
  if (trust >= 55) return "with you";
  if (trust >= 40) return "unsettled";
  if (trust >= 25) return "estranged";
  return "near a break";
}

export const PLACES: Record<LocationId, string> = {
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
  boarding: "The Press-Gang Skiff",
};
