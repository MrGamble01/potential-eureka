export type BookId = "ashmarch" | "lumenferry";

export type CompanionId = "mara" | "ivo" | "sable" | "bram" | "ness" | "pell";

export type BeatId =
  | "waystation"
  | "bridge"
  | "shrine"
  | "flats"
  | "orchard"
  | "market"
  | "scriptorium"
  | "bellcrypt"
  | "choir"
  | "wight"
  | "quay"
  | "causeway"
  | "eelbeds"
  | "lenshouse"
  | "kiln"
  | "bellpool"
  | "boarding"
  | "ending";

export type LocationId =
  | "waystation"
  | "bridge"
  | "shrine"
  | "flats"
  | "orchard"
  | "market"
  | "scriptorium"
  | "bellcrypt"
  | "choir"
  | "wight"
  | "quay"
  | "causeway"
  | "eelbeds"
  | "lenshouse"
  | "kiln"
  | "bellpool"
  | "boarding"
  | "ending";

export type EndingId = "unveiled" | "mercy" | "kept" | "relit" | "dark" | "held";

export type Stance = "for" | "against" | "aside";

export type Flags = {
  route?: "bridge" | "flats";
  nameGiven?: "player" | "false" | "mara" | "ivo" | "sable";
  flatsChoice?: "shelter" | "push";
  toll?: "seal" | "index" | "memory" | "none";
  record?: "read" | "copied" | "burned" | "left";
  ending?: EndingId;
  mapTorn?: true;
  exhausted?: true;
  lampDim?: true;
  sableMemorySpent?: true;
  soaked?: true;
  knowsTruth?: true;
  hasRibCharm?: true;
  lampRefused?: true;
  studiedMap?: true;
  fearsNamed?: true;
  rested?: true;
  shrineTaken?: true;
  orchardFruit?: true;
  choirVoice?: true;
  wightFought?: "felled" | "held" | "bitten";
  ferryRoute?: "causeway" | "eelbeds";
  glassChoice?: "steady" | "cut";
  eelChoice?: "follow" | "weed";
  lensToll?: "charm" | "mold" | "note" | "none";
  kilnRecord?: "read" | "copied" | "smashed" | "left";
  pellNoteSpent?: true;
  buoyRefused?: true;
  fearsOfLight?: true;
  bellListened?: true;
  poolArgued?: true;
  knowsBlackout?: true;
  skiffFought?: "repelled" | "slipped" | "bloodied";
};

export type DiceRoll = {
  id: string;
  kind: "combat" | "skill";
  label: string;
  actor: string;
  die: "d20";
  natural: number;
  modifier: number;
  total: number;
  dc: number;
  success: boolean;
  faces: number[];
  turn: number;
};

export type GameState = {
  bookId?: BookId;
  beat: BeatId;
  location: LocationId;
  flags: Flags;
  inventory: string[];
  partyKits: Record<string, string[]>;
  trust: Record<string, number>;
  mood: Record<string, string>;
  turn: number;
  ended: boolean;
  lastRoll: DiceRoll | null;
};

export type Suggestion = {
  id: string;
  label: string;
};

export type DialogueLine = {
  companionId: CompanionId;
  speaker: string;
  text: string;
  mood: string;
  stance: Stance;
};

export type SceneBrief = {
  bookId?: BookId;
  location: LocationId;
  title: string;
  alt: string;
  mood: string;
  prompt: string;
  ending?: EndingId;
};

export type MemoryKind = "choice" | "fact" | "relationship";

export type MemoryRecord = {
  id: number;
  campaignId: string;
  turn: number;
  kind: MemoryKind;
  text: string;
};

export type TranscriptRole = "gm" | "companion" | "player";

export type TranscriptMessage = {
  id: number;
  campaignId: string;
  turn: number;
  role: TranscriptRole;
  speaker: string;
  companionId: CompanionId | null;
  stance: Stance | null;
  mood: string | null;
  text: string;
};

export type SceneView = {
  title: string;
  alt: string;
  dataUrl: string;
  location: LocationId;
  prompt: string;
};

export type PartyMemberView = {
  id: CompanionId;
  name: string;
  title: string;
  blurb: string;
  quote: string;
  trust: number;
  mood: string;
  regard: string;
  kit: string[];
};

export type CampaignView = {
  id: string;
  bookId: BookId;
  bookTitle: string;
  playerName: string;
  motive: string;
  createdAt: string;
  updatedAt: string;
  state: GameState;
  memories: MemoryRecord[];
  messages: TranscriptMessage[];
  scene: SceneView;
  suggestions: Suggestion[];
  party: PartyMemberView[];
  placeTitle: string;
};

export type CampaignSummary = {
  id: string;
  bookId: BookId;
  bookTitle: string;
  playerName: string;
  motive: string;
  updatedAt: string;
  placeTitle: string;
  ended: boolean;
  ending?: EndingId;
  memoryCount: number;
  lastLine: string;
};

export type HealthInfo = {
  ok: true;
  llmProvider: string;
  imageProvider: string;
  persistence: "browser" | "sqlite";
};

export type SaveSlot = {
  campaignId: string;
  savedAt: string;
  label: string;
  playerName: string;
  bookId: BookId;
  bookTitle: string;
  placeTitle: string;
  ended: boolean;
  motive: string;
};
