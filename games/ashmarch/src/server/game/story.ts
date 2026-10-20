import { companionById, PLACES } from "../../shared/companions";
import { makeCheck, modifierFromTrust, rollSentence } from "../../shared/dice";
import type {
  BookId,
  CompanionId,
  DialogueLine,
  DiceRoll,
  GameState,
  LocationId,
  MemoryKind,
  SceneBrief,
  Stance,
  Suggestion,
} from "../../shared/types";
import { lumenferrySuggestions, resolveLumenferryOpening, resolveLumenferryTurn } from "./lumenferry";
import { parseIntent } from "./parse";

export type Resolution = {
  state: GameState;
  narration: string;
  lines: DialogueLine[];
  newMemories: { kind: MemoryKind; text: string }[];
  scene: SceneBrief;
};

type Spoken = {
  narration: string;
  lines: DialogueLine[];
  memories: { kind: MemoryKind; text: string }[];
  roll?: DiceRoll;
};

const SUGGESTIONS: Partial<Record<GameState["beat"], Suggestion[]>> = {
  waystation: [
    { id: "bridge", label: "We cross the Bridge of Names." },
    { id: "flats", label: "We take the long way across the salt flats." },
    { id: "fears", label: "What are you each afraid of losing?" },
    { id: "study_map", label: "Look at the map again." },
    { id: "rest", label: "Rest until the lamp is low." },
  ],
  bridge: [
    { id: "own_name", label: "I give the bridge my own name." },
    { id: "false_name", label: "I give a false name." },
    { id: "mara_name", label: "Mara, offer your warden-name." },
    { id: "ivo_name", label: "Ivo, offer a name from the index." },
    { id: "sable_name", label: "Sable, offer a name you remember." },
    { id: "shrine", label: "Climb down to the mile-shrine." },
  ],
  flats: [
    { id: "shelter", label: "Shelter inside the ribs." },
    { id: "push", label: "Push through the storm." },
    { id: "orchard", label: "Follow the bone chimes into the orchard." },
    { id: "fight_wight", label: "Fight the salt-wight." },
  ],
  wight: [
    { id: "wight_strike", label: "Strike the wight with Mara." },
    { id: "wight_brace", label: "Brace and call Sable's lamp." },
  ],
  market: [
    { id: "trade_seal", label: "Trade Mara's warden seal." },
    { id: "trade_index", label: "Trade Ivo's index page." },
    { id: "trade_memory", label: "Let Sable give up a memory." },
    { id: "refuse", label: "Refuse the coat and find another way." },
  ],
  scriptorium: [
    { id: "read", label: "Read the vote aloud." },
    { id: "copy", label: "Copy the vote into the map case." },
    { id: "burn", label: "Burn the record." },
    { id: "leave", label: "Leave the record untouched." },
  ],
  bellcrypt: [
    { id: "complete_map", label: "Complete the map and wake Vellum." },
    { id: "seal_crypt", label: "Seal the crypt and report the town still gone." },
    { id: "lamp_keep", label: "Ask Sable to keep the town in the lamp." },
    { id: "choir", label: "Listen at the choir stair before you decide." },
  ],
  shrine: [
    { id: "shrine_take", label: "Take the carved name." },
    { id: "shrine_leave", label: "Leave the shrine as it is." },
  ],
  orchard: [
    { id: "orchard_pick", label: "Pick the salt fruit." },
    { id: "orchard_leave", label: "Leave the fruit on the branch." },
  ],
  choir: [{ id: "choir_back", label: "Leave the choir stair behind and go back to the bells." }],
  ending: [
    { id: "tomorrow", label: "What will you each do tomorrow?" },
    { id: "recall", label: "Read the road back to me." },
  ],
};

export function initialState(): GameState {
  return {
    bookId: "ashmarch",
    beat: "waystation",
    location: "waystation",
    flags: {},
    inventory: ["field map", "charcoal sticks", "commission letter"],
    partyKits: {
      mara: ["warden seal"],
      ivo: ["index page"],
      sable: ["brass lamp"],
    },
    trust: { mara: 52, ivo: 48, sable: 55 },
    mood: { mara: "braced", ivo: "eager", sable: "watching" },
    turn: 0,
    ended: false,
    lastRoll: null,
  };
}

export function suggestionsFor(state: GameState): Suggestion[] {
  if ((state.bookId ?? "ashmarch") === "lumenferry") return lumenferrySuggestions(state);
  return (SUGGESTIONS[state.beat] ?? []).map((suggestion) => ({ ...suggestion }));
}

export function echoes(state: GameState, playerName: string): string[] {
  const out: string[] = [];
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

function lead(state: GameState, playerName: string): string {
  const all = echoes(state, playerName);
  const latest = all[all.length - 1];
  return latest ? `${latest} ` : "";
}

function line(id: CompanionId, text: string, mood: string, stance: Stance): DialogueLine {
  return { companionId: id, speaker: companionById(id).name, text, mood, stance };
}

function bump(state: GameState, id: CompanionId, delta: number, mood: string): void {
  state.trust[id] = Math.max(0, Math.min(100, state.trust[id] + delta));
  state.mood[id] = mood;
}

function dropKit(state: GameState, id: CompanionId, item: string): void {
  state.partyKits[id] = state.partyKits[id].filter((entry) => entry !== item);
}

function addItem(state: GameState, item: string): void {
  if (!state.inventory.includes(item)) state.inventory.push(item);
}

function dropItem(state: GameState, item: string): void {
  state.inventory = state.inventory.filter((entry) => entry !== item);
}

function clip(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 80 ? `${clean.slice(0, 77)}…` : clean;
}

function sceneFor(state: GameState): SceneBrief {
  const title = PLACES[state.location];
  const mood =
    state.location === "ending"
      ? (state.flags.ending ?? "unveiled")
      : state.flags.lampDim
        ? "dim"
        : state.location;
  const altBits: Record<LocationId, string> = {
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
    ending:
      state.flags.ending === "mercy"
        ? "A sealed arch and a road that has agreed to stay quiet."
        : state.flags.ending === "kept"
          ? "A brass lamp burning large enough to hold a town."
          : "A town returned at dawn, windows lighting one by one.",
  };
  return {
    bookId: state.bookId ?? "ashmarch",
    location: state.location,
    title,
    alt: `${title}. ${altBits[state.location] ?? title}`,
    mood,
    ending: state.flags.ending,
    prompt: `Illustrated field plate of ${title}, mood ${mood}, salt-ash pilgrimage, woodcut colors, no lettering`,
  };
}

function finish(state: GameState, spoken: Spoken): Resolution {
  state.lastRoll = spoken.roll ?? null;
  return {
    state,
    narration: spoken.narration,
    lines: spoken.lines,
    newMemories: spoken.memories,
    scene: sceneFor(state),
  };
}

function throwCheck(
  prior: GameState,
  playerName: string,
  choiceId: string,
  kind: DiceRoll["kind"],
  label: string,
  actor: CompanionId,
  dc: number,
): DiceRoll {
  return makeCheck({
    playerName,
    turn: prior.turn,
    choiceId,
    kind,
    label,
    actor: companionById(actor).name,
    modifier: modifierFromTrust(prior.trust[actor]),
    dc,
  });
}

function motiveLine(motive: string, playerName: string): DialogueLine | null {
  const text = motive.toLowerCase();
  if (/\b(debt|owe|owing|coin|unpaid)\b/.test(text)) {
    return line(
      "mara",
      `You said debt, ${playerName}. Then you will be tempted to spend us like money. I have watched people clear a ledger with the wrong coin.`,
      "knowing",
      "aside",
    );
  }
  if (/\b(lost|forget|forgotten|missing)\b/.test(text)) {
    return line(
      "sable",
      "You came looking for something already misplaced. I am familiar with that errand. It rarely ends in the pocket you planned.",
      "gentle",
      "aside",
    );
  }
  if (/\b(map|chart|draw|survey|commission)\b/.test(text)) {
    return line(
      "ivo",
      "A commission is a reader with a purse. If the purse wants Vellum drawn, I want to know who profits from a town becoming legible again.",
      "bright",
      "aside",
    );
  }
  return null;
}

export type OpeningOptions = {
  bookId?: BookId;
  priorMemories?: string[];
};

function rememberOtherRoads(resolution: Resolution, prior: string[] | undefined): Resolution {
  if (!prior?.length) return resolution;
  const latest = prior[prior.length - 1];
  return {
    ...resolution,
    narration: `${resolution.narration}\n\nThe Chronicle has not forgotten your other road. ${latest}`,
    newMemories: [...resolution.newMemories, { kind: "fact", text: `Carried from another road: ${latest}` }],
  };
}

export function resolveOpening(playerName: string, motive: string, options?: OpeningOptions): Resolution {
  const bookId = options?.bookId ?? "ashmarch";
  if (bookId === "lumenferry") {
    return rememberOtherRoads(resolveLumenferryOpening(playerName, motive), options?.priorMemories);
  }
  const state = initialState();
  const extra = motiveLine(motive, playerName);
  const lines = [
    line(
      "mara",
      "Flats. We lose a day. We keep our names. I have already lost a gate. I will not lose a person to a toll that doesn't write receipts.",
      "braced",
      "against",
    ),
    line(
      "ivo",
      "A day on the flats will scour the only clean page I have left. The bridge asks for a sentence, Mara. Sentences are my trade. You spend fear like coin and call it discipline.",
      "eager",
      "for",
    ),
    line(
      "sable",
      `I have crossed both. The flats forget your footprints. The bridge remembers your mouth. ${playerName}, they will argue until the lamp burns low. They are already fond of you, in the way people are fond of a hinge.`,
      "watching",
      "aside",
    ),
  ];
  if (extra) lines.push(extra);
  const opened = finish(state, {
    narration: `Dusk salts the windows of the Salt Waystation until the road outside looks erased. On the table the field map drinks the lamplight and gives nothing back. You are ${playerName}. You were hired to draw Vellum — a town that stepped out of the world thirty years ago — onto a map again.

You told the commission you came because ${motive}. The waystation does not care. Your companions do. Mara Voss has turned the map so the Bridge of Names sits under her palm, as if she could hide it. Ivo Quill has turned it back. Between them a cracked brass lamp ticks, and the light inside it watches you decide.`,
    lines,
    memories: [{ kind: "fact", text: `${playerName} took the Vellum commission because: ${motive}` }],
  });
  return rememberOtherRoads(opened, options?.priorMemories);
}

function arriveMarket(state: GameState, playerName: string): string {
  let recognition =
    "A coat with gloves in the pockets stands behind the last counter, neatly, as if a person had just stepped out of it.";
  if (state.flags.nameGiven === "player") {
    recognition = `A coat with gloves in the pockets tips its empty collar toward you. "You are thinner than you were at the bridge, ${playerName}," it says, in a voice like cloth folded twice.`;
  } else if (state.flags.nameGiven === "mara") {
    recognition =
      "A coat with gloves in the pockets bows toward Mara, the way a clerk bows to paperwork it has already stamped.";
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
  return `${lead(state, playerName)}Veil Market kept its stalls and lost its sellers. Canvas roofs clap in no wind. ${recognition}

"Passage to the scriptorium," the coat says. "I take proof. A warden's seal. An index page. Or a memory warm enough to wear."`;
}

function arriveScriptorium(state: GameState, playerName: string): string {
  return `${lead(state, playerName)}The scriptorium is a nave of shelves sunk to the waist in green water. The books have swelled shut. One lectern stays dry. On it, in a clerk's careful hand: Vellum voted to be forgotten. A census was coming that did not count people so much as take the names it counted. The map in your case, ${playerName}, would call them back.

The vote waits. It can be spoken, copied, burned, or left where the water has not yet climbed.`;
}

function arriveBellcrypt(state: GameState, playerName: string): string {
  return `${lead(state, playerName)}Under the square, the bells hang in a ring, and inside each bell a street is folded small. They hum when you breathe. Completing the map would strike them, ${playerName}. Sealing the crypt would leave your employer with a beautiful lie. The lamp could hold the town the way it holds Sable: kept, not displayed.`;
}

function enterScriptorium(next: GameState): void {
  next.location = "scriptorium";
  next.beat = "scriptorium";
  next.flags.knowsTruth = true;
}

function enterBellcrypt(next: GameState): void {
  next.location = "bellcrypt";
  next.beat = "bellcrypt";
  next.flags.knowsTruth = true;
}

function enterEnding(next: GameState): void {
  next.location = "ending";
  next.beat = "ending";
  next.ended = true;
}

function endingNarration(prior: GameState, playerName: string, body: string): string {
  const carried = echoes(prior, playerName).join(" ");
  return `${body}${carried ? `\n\n${carried}` : ""}`;
}

function applyChoice(next: GameState, prior: GameState, id: string, playerName: string): Spoken | null {
  switch (id) {
    case "fears": {
      const repeat = prior.flags.fearsNamed === true;
      next.flags.fearsNamed = true;
      bump(next, "mara", repeat ? 0 : 3, "unguarded");
      bump(next, "ivo", repeat ? 0 : 3, "serious");
      bump(next, "sable", repeat ? 0 : 3, "open");
      return {
        narration: `You ask what each of them is afraid of losing. The map between you suddenly looks like a thing that can be spent. Nobody reaches for the bridge or the flats. They reach, carefully, for the truth.`,
        lines: [
          line(
            "mara",
            "My seal. It is the last proof I closed a gate when closing it mattered. Ivo would trade it for a footnote and call the footnote a rescue.",
            "unguarded",
            "against",
          ),
          line(
            "ivo",
            "The index page. It is the only copy of a list the College burned. Mara thinks paper is a kind of treason. Paper is how I refuse to be the only one who remembers.",
            "serious",
            "for",
          ),
          line(
            "sable",
            "The lamp keeps me shaped. If it goes dark I become weather. I would rather not become weather. Please do not spend me to win an argument with either of them.",
            "open",
            "aside",
          ),
        ],
        memories: repeat ? [] : [{ kind: "relationship", text: "The party named what they are afraid to lose: Mara's seal, Ivo's index page, and Sable's lamp." }],
      };
    }
    case "study_map": {
      const repeat = prior.flags.studiedMap === true;
      next.flags.studiedMap = true;
      return {
        narration: `You smooth the field map. Vellum is a blank the size of a palm, and around the blank the road has been redrawn so many times the charcoal has a shine. Distances disagree with themselves. Someone has written, in a warden's block letters, DO NOT PAY THE BRIDGE, and someone else has answered underneath, in a scholar's hand, everything costs.`,
        lines: [
          line("mara", "That first line is mine. I wrote it before I met you. It remains accurate.", "firm", "against"),
          line("ivo", "And the answer is mine. Accuracy is not the same as a plan, Mara.", "pleased", "for"),
          line("sable", "The blank is warm. Towns that want to stay gone give off heat, like a hand over a mouth.", "hushed", "aside"),
        ],
        memories: repeat ? [] : [{ kind: "fact", text: "The field map shows Vellum as a blank, with Mara's warning and Ivo's reply written in the margin." }],
      };
    }
    case "bridge": {
      next.flags.route = "bridge";
      next.location = "bridge";
      next.beat = "bridge";
      bump(next, "mara", -4, "set");
      bump(next, "ivo", 5, "vindicated");
      bump(next, "sable", 0, "attentive");
      return {
        narration: `You choose the bridge. Mara's jaw sets so hard the lamplight skids off it. Ivo is already rolling the map, tender as a nurse.

The walk is shorter than the argument. The Bridge of Names arrives as a pale span over a drop with no floor, only moving air. At the crown a toll-keeper stands, built from stacked mile-markers. Its face is a plaque rubbed almost blank.

"A true name," it says. Grit ticks off the letters. "One that has been used."`,
        lines: [
          line("mara", `Give it nothing of yours, ${playerName}. Look at me. Nothing.`, "set", "against"),
          line("ivo", "It said true. A fiction will be charged interest. I have names in the index that were used very loudly.", "vindicated", "for"),
          line("sable", "I keep a few that no one is wearing. They are cold. They still open doors.", "attentive", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} chose the Bridge of Names over Mara's objection.` }],
      };
    }
    case "flats": {
      next.flags.route = "flats";
      next.location = "flats";
      next.beat = "flats";
      bump(next, "mara", 5, "relieved");
      bump(next, "ivo", -4, "thwarted");
      bump(next, "sable", 1, "wide");
      return {
        narration: `You choose the long way. Ivo makes a small, injured sound and tucks the index page deeper into his coat. Mara nods once, which for her is a speech.

By midmorning the salt flats have erased the horizon. The wind grows a spine. Something large died here and was kind enough to leave its ribs as a house. The storm walks toward you without hurrying.`,
        lines: [
          line("mara", "Ribs. We get inside them or we get stupid. I prefer the ribs.", "relieved", "for"),
          line("ivo", "A day, a storm, and a carcass. Mara, your victories have a texture I do not enjoy.", "thwarted", "against"),
          line("sable", "The bones remember being carried. If we shelter, ask before you lean.", "wide", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} chose the salt flats, and Ivo objected to the lost day.` }],
      };
    }
    case "own_name": {
      next.flags.nameGiven = "player";
      next.location = "market";
      next.beat = "market";
      bump(next, "mara", -8, "frightened");
      bump(next, "ivo", 8, "impressed");
      bump(next, "sable", 4, "careful");
      return {
        narration: `You give the bridge your own name. It tastes ${playerName} the way a clerk tastes ink, and the plaque warms. Something leaves your mouth that is not breath. The far side accepts your boots. You are still yourself. You are also, now, a little archived.

${arriveMarket(next, playerName)}`,
        lines: [
          line("mara", "That was ours to spend, not the road's. I will say your name twice tonight so it remembers the way back.", "frightened", "against"),
          line("ivo", "Efficient. A little devastating. I admire it, and I wish I didn't. Mara, don't glare the plaque back open.", "impressed", "for"),
          line("sable", "I will hold the shape of it. If the town asks, I can answer without spending you twice.", "careful", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} gave their own name to the Bridge of Names.` }],
      };
    }
    case "false_name": {
      next.flags.nameGiven = "false";
      next.flags.mapTorn = true;
      next.location = "market";
      next.beat = "market";
      bump(next, "mara", -4, "wary");
      bump(next, "ivo", 5, "amused");
      bump(next, "sable", -2, "uneasy");
      return {
        narration: `You offer a name you have never worn. The plaque considers the lie, and a crack runs from the toll-keeper's foot to the near bank, thin as a hair and eager. The map's edge tears itself in sympathy. You are allowed across anyway. The bridge dislikes being unpaid, but it dislikes being bored more.

${arriveMarket(next, playerName)}`,
        lines: [
          line("mara", "It knows. Cracks are how roads collect later. Don't look so spared.", "wary", "against"),
          line("ivo", "A workable forgery. The College would have marked it passable and then burned the examiner. I respect the craft.", "amused", "for"),
          line("sable", "The lie is still walking behind us. It has your stride.", "uneasy", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} gave the Bridge of Names a false name, and the span cracked.` }],
      };
    }
    case "mara_name": {
      next.flags.nameGiven = "mara";
      next.location = "market";
      next.beat = "market";
      bump(next, "mara", -6, "hollowed");
      bump(next, "ivo", 3, "clinical");
      bump(next, "sable", 2, "quiet");
      return {
        narration: `Mara steps up before you can soften it. "Mara Voss," she tells the plaque, "warden of the south post." The bridge accepts the name with the sound of a lock giving way. She crosses without looking at her hands. On the far side she is still Mara. The title she paid with stays behind, glowing faintly in the grit.

${arriveMarket(next, playerName)}`,
        lines: [
          line("mara", "Don't thank me. Thanks make it a favor, and this was a bill. Ivo, if you call it noble I will put you in the crack.", "hollowed", "against"),
          line("ivo", "I was going to call it efficient. Noble is your dialect. You did spend a real thing, Mara. I am not too much of a thief to notice.", "clinical", "for"),
          line("sable", "Warden-names are heavy. The bridge will wear hers more comfortably than she will, for a while.", "quiet", "aside"),
        ],
        memories: [{ kind: "choice", text: `Mara Voss gave her warden-name to the bridge so ${playerName} would not have to.` }],
      };
    }
    case "ivo_name": {
      next.flags.nameGiven = "ivo";
      next.location = "market";
      next.beat = "market";
      bump(next, "mara", -10, "furious");
      bump(next, "ivo", 6, "defensive");
      bump(next, "sable", -6, "troubled");
      return {
        narration: `Ivo opens the index with two fingers, as if the page might bite, and reads a name that is not his. The plaque drinks it. Somewhere a stranger becomes slightly harder to find. The bridge, satisfied, lets you pass. Ivo does not look as triumphant as he expected to.

${arriveMarket(next, playerName)}`,
        lines: [
          line("mara", "That was a person, Ivo. Not a key. You heard a life snag and you kept reading.", "furious", "against"),
          line("ivo", "It was a duplicate of a person. The original is ash in a College grate. I refuse to be scolded for using a ghost as a key, Mara. The ghost was already unpaid.", "defensive", "for"),
          line("sable", "The ghost stumbled. I felt the stumble. Don't do that again unless you mean to.", "troubled", "aside"),
        ],
        memories: [{ kind: "choice", text: `Ivo Quill spent a stolen name from the index to pay the bridge. Mara called it a person.` }],
      };
    }
    case "sable_name": {
      next.flags.nameGiven = "sable";
      next.flags.lampDim = true;
      next.location = "market";
      next.beat = "market";
      bump(next, "mara", 6, "respectful");
      bump(next, "ivo", -4, "annoyed");
      bump(next, "sable", 5, "dim");
      return {
        narration: `Sable speaks a name you have never heard, old enough that the consonants feel dusty. The lamp gutters. For three steps the bridge is only a rumor under your boots, and then the light returns, smaller. The name does not.

${arriveMarket(next, playerName)}`,
        lines: [
          line("mara", "Even the spirit pays cleaner than the archivist. Sable, if you dim again, say so before you do it.", "respectful", "for"),
          line("ivo", "We have spent a rarity on a toll. I hope the scriptorium is worth walking in a poorer light. Rarities do not regrow out of politeness.", "annoyed", "against"),
          line("sable", "I am still here. The name is not. Please do not thank me. Thanks make a debt, and I have just spent one.", "dim", "aside"),
        ],
        memories: [{ kind: "choice", text: "Sable gave the bridge a remembered name. The lamp burned lower." }],
      };
    }
    case "shelter": {
      next.flags.flatsChoice = "shelter";
      next.flags.hasRibCharm = true;
      addItem(next, "rib-charm");
      next.location = "market";
      next.beat = "market";
      bump(next, "mara", 6, "steady");
      bump(next, "ivo", -3, "impatient");
      bump(next, "sable", 4, "pleased");
      return {
        narration: `You duck into the ribs as the storm arrives. The bone ticks with blown salt, and the wind goes around you instead of through. Wired to one rib with a twist of copper is a charm the size of a thumb, warm from no visible fire. You take it. When the white air thins, the market is already a stain on the next rise.

${arriveMarket(next, playerName)}`,
        lines: [
          line("mara", "That was the correct kind of cowardice. Write it down, Ivo, since writing is your pulse.", "steady", "for"),
          line("ivo", "I am writing that we lost half a day and gained a souvenir. Forgive me for not composing an ode to the souvenir.", "impatient", "against"),
          line("sable", "The bones were willing. The charm was lonelier than the bones. It will like your pocket.", "pleased", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} sheltered in the ribs on the salt flats and kept a rib-charm.` }],
      };
    }
    case "rest": {
      const repeat = prior.flags.rested === true;
      next.flags.rested = true;
      bump(next, "mara", repeat ? 0 : 2, "quiet");
      bump(next, "ivo", repeat ? 0 : 1, "impatient");
      bump(next, "sable", repeat ? 0 : 3, "dim");
      return {
        narration: `You rest until the lamp is low. Nobody takes the bridge and nobody takes the flats. The argument has to sit in a room with less light, which makes it smaller and more precise. Mara counts the door. Ivo counts the sentences he is not saying. Sable counts nothing, and is the reason the room still has a shape.`,
        lines: [
          line("mara", "This is the only toll I like. Time, paid by sitting still. Ivo, you may survive it.", "quiet", "against"),
          line("ivo", "I am surviving it loudly, on the inside. When the lamp is low enough for Mara, it is already too low for a footnote.", "impatient", "for"),
          line("sable", "Thank you. A low lamp is still a lamp. I would rather be dim with you than bright on a road that hasn't been chosen.", "dim", "aside"),
        ],
        memories: repeat ? [] : [{ kind: "relationship", text: `${playerName} rested at the Salt Waystation until Sable's lamp burned low, and the party argued more quietly.` }],
      };
    }
    case "shrine": {
      next.location = "shrine";
      next.beat = "shrine";
      bump(next, "mara", 2, "wary");
      bump(next, "ivo", 3, "hungry");
      bump(next, "sable", 1, "hushed");
      return {
        narration: `You climb down from the span to the mile-shrine cut into the bank. The drop is still there, pretending to be weather. The stone is crowded with carved names, some warm, some only a habit of the chisel. A niche holds one name that has not been spent. It would fit a pocket.

Mara looks at your hands. Ivo looks at the niche. Sable looks at neither, which is how you know the name is listening.`,
        lines: [
          line("mara", "Leave it. A name in a pocket is a name that can be traded by someone more frightened than you.", "wary", "against"),
          line("ivo", "Or it is a name rescued from a shrine that will weather it into nothing. Mara, preservation is not always a theft. Sometimes it is just a pocket.", "hungry", "for"),
          line("sable", "It is sleeping. If you wake it, wake it gently, and do not tell the bridge you have it.", "hushed", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} climbed down to the mile-shrine under the Bridge of Names.` }],
      };
    }
    case "shrine_take": {
      next.flags.shrineTaken = true;
      addItem(next, "carved name");
      next.location = "market";
      next.beat = "market";
      bump(next, "ivo", 4, "pleased");
      bump(next, "mara", -4, "tight");
      bump(next, "sable", -2, "watchful");
      return {
        narration: `You take the carved name. It is warmer than stone and lighter than a secret. The shrine does not stop you. The bridge, above, ticks once, as if a clerk made a note it will not read aloud yet. The far path lets you out into the market's dust.

${arriveMarket(next, playerName)}`,
        lines: [
          line("ivo", "Good. A name that survives is a small archive. I will not spend it unless the road becomes unbearable, and I will tell you when I start defining unbearable.", "pleased", "for"),
          line("mara", "You picked up a person-shaped stone. Don't look so scholarly. Ivo's compliments are how relics learn to leave.", "tight", "against"),
          line("sable", "It is awake. I can hear it getting used to the pocket. Speak softly around it.", "watchful", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} took a carved name from the mile-shrine.` }],
      };
    }
    case "shrine_leave": {
      next.location = "market";
      next.beat = "market";
      bump(next, "mara", 4, "relieved");
      bump(next, "ivo", -2, "disappointed");
      bump(next, "sable", 3, "grateful");
      return {
        narration: `You leave the shrine as it is. The carved name stays in the niche, warm from other people's almost. Climbing back to the span, you feel oddly unpaid and oddly clean. The market takes you in with the dust of a road that did not get a souvenir.

${arriveMarket(next, playerName)}`,
        lines: [
          line("mara", "Good. Let the stone keep its own dead. We have enough names already walking.", "relieved", "for"),
          line("ivo", "A preservation opportunity, declined. I will mention it only five or six times.", "disappointed", "against"),
          line("sable", "It went back to sleep. That was kind. Kindness is a loud thing, even when it is only not taking.", "grateful", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} left the mile-shrine's carved name where it slept.` }],
      };
    }
    case "orchard": {
      next.location = "orchard";
      next.beat = "orchard";
      bump(next, "sable", 3, "wide");
      bump(next, "mara", 1, "suspicious");
      bump(next, "ivo", 2, "curious");
      return {
        narration: `You follow the bone chimes. They are ribs strung in the trees, or trees that learned ribs from the wind. The orchard is white and musical and slightly unkind. Salt fruit hangs in the crooks, the color of a warning you could still pick.

Mara does not eat road fruit. Ivo would like a sample. Sable says the fruit remembers the branch, and will say so in your pack.`,
        lines: [
          line("mara", "Leave it. Fruit on a salt road is bait or a bill. I have paid both.", "suspicious", "against"),
          line("ivo", "A sample is not a meal, Mara. It is evidence. You distrust evidence because it keeps talking after the danger has left.", "curious", "for"),
          line("sable", "The fruit is lonely, which is not the same as safe. If you pick it, expect it to miss the tree out loud.", "wide", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} followed the bone chimes off the salt flats into the orchard.` }],
      };
    }
    case "orchard_pick": {
      next.flags.orchardFruit = true;
      addItem(next, "salt fruit");
      next.location = "market";
      next.beat = "market";
      bump(next, "ivo", 3, "pleased");
      bump(next, "mara", -3, "wary");
      bump(next, "sable", 2, "fond");
      return {
        narration: `You pick the salt fruit. It comes away with a chime, as if the tree had been holding a note and was glad to stop. The fruit is heavy for its size and already staining the map case at the corner. Beyond the last white tree, the market is a stain of canvas.

${arriveMarket(next, playerName)}`,
        lines: [
          line("ivo", "Evidence, as promised. It is also, regrettably, leaking. Mara, your face is a whole essay.", "pleased", "for"),
          line("mara", "We are carrying bait into a market that already wants proof. Try to look less delighted.", "wary", "against"),
          line("sable", "It misses the branch. I can hear the missing. It will quiet if you don't brag.", "fond", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} picked a salt fruit in the bone orchard.` }],
      };
    }
    case "orchard_leave": {
      next.location = "market";
      next.beat = "market";
      bump(next, "mara", 3, "steady");
      bump(next, "ivo", -1, "dry");
      bump(next, "sable", 2, "pleased");
      return {
        narration: `You leave the fruit on the branch. The chimes go on counting weather without your help. The orchard lets you out the far side, where the salt thins and Veil Market has been waiting with its empty sleeves.

${arriveMarket(next, playerName)}`,
        lines: [
          line("mara", "Correct. Not every bright thing is a ration.", "steady", "for"),
          line("ivo", "I will record the refusal as 'prudence' and pronounce it skeptically.", "dry", "against"),
          line("sable", "The branch kept its note. That was a gift you didn't have to wrap.", "pleased", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} left the salt fruit on the branch in the bone orchard.` }],
      };
    }
    case "choir": {
      next.location = "choir";
      next.beat = "choir";
      bump(next, "mara", 1, "low");
      bump(next, "ivo", 1, "listening");
      bump(next, "sable", 2, "open");
      return {
        narration: `You take the choir stair before anyone finishes the map. It is a narrow throat beside the bells, and the air in it is full of streets practicing their names. If you stand still, the party starts to answer in the voices they use when they think the town can hear them.`,
        lines: [
          line("mara", "If I had a street, I would keep it shut. A woken town is a town that can be knocked on. I have been the knock.", "low", "against"),
          line("ivo", "If I had a street, I would copy its name twice and give one copy to someone who was not afraid. Fear has had the archive long enough.", "listening", "for"),
          line("sable", "If I had a street, I would keep it in the lamp until it asked to leave. Asking matters. Most maps forget to let a place ask.", "open", "aside"),
        ],
        memories: [{ kind: "relationship", text: "On the choir stair Mara, Ivo, and Sable each said what they would do with a street of Vellum." }],
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
          line("mara", "We said it. Saying it is not doing it. Don't confuse the stair with a verdict.", "firm", "against"),
          line("ivo", "A verdict is just a sentence that survived its speakers. I am still here, Mara. So is the map.", "intent", "for"),
          line("sable", "I heard all three of us. I will not pretend we agreed. The bells can hold a disagreement without dropping it.", "steady", "aside"),
        ],
        memories: [{ kind: "fact", text: `${playerName} listened at the choir stair, then returned to the bellcrypt with the argument still intact.` }],
      };
    }
    case "fight_wight": {
      next.location = "wight";
      next.beat = "wight";
      bump(next, "mara", 2, "ready");
      bump(next, "ivo", -2, "appalled");
      bump(next, "sable", 1, "bright");
      return {
        narration: `The salt rises into a wight: ribs, grit, and a mouth where the storm kept its teeth. It wants the map case. The flats offer no second road until somebody answers it, ${playerName}.

Mara already has a knife out. Sable's lamp can blind it if you ask. Ivo is pricing both, which the wight does not respect.`,
        lines: [
          line("mara", "Strike with me. A thing made of salt dies the way a debt dies: all at once, or not at all.", "ready", "for"),
          line("ivo", "Or we do not donate our blood to a weather system. The lamp is a tool, Mara, not a dare.", "appalled", "against"),
          line("sable", `${playerName}, say the word and I will spend light. Say the other word and I will watch Mara spend a knife. I will not choose for a hinge.`, "bright", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} stood to fight the salt-wight on the flats.` }],
      };
    }
    case "wight_strike": {
      const roll = throwCheck(prior, playerName, "wight_strike", "combat", "strike the salt-wight", "mara", 12);
      next.location = "market";
      next.beat = "market";
      if (roll.success) {
        next.flags.wightFought = "felled";
        addItem(next, "wight-salt");
        bump(next, "mara", 6, "spent");
        bump(next, "ivo", 1, "shaken");
        bump(next, "sable", 2, "proud");
      } else {
        next.flags.wightFought = "bitten";
        next.flags.exhausted = true;
        bump(next, "mara", -4, "hurt");
        bump(next, "ivo", -2, "angry");
        bump(next, "sable", 1, "worried");
      }
      const blow = roll.success
        ? "Mara's knife goes in where a heart would be if salt had one. The wight folds into a glittering crust. You pocket a palm of it and the market is suddenly there, as if the flats had been waiting to bill you."
        : "The wight takes the knife on a rib and gives the bite back. Salt burns the seam of a sleeve. You are through it anyway — bleeding, upright — and Veil Market receives you like a clerk who expected the wound.";
      return {
        narration: `${rollSentence(roll)}

${blow}

${arriveMarket(next, playerName)}`,
        lines: roll.success
          ? [
              line("mara", "Down. Don't admire it. The market will charge us for standing still.", "spent", "for"),
              line("ivo", "You solved a monster and opened a shop. Mara, that is not the triumph you think it is.", "shaken", "against"),
              line("sable", "The lamp stayed lit. I am glad. I did not want to be the weapon and the witness.", "proud", "aside"),
            ]
          : [
              line("mara", "I missed. Say it once and then walk. The bite is a receipt, not a verdict.", "hurt", "against"),
              line("ivo", "A receipt written in Mara's arm. I would have preferred a footnote. I am not glad to be right.", "angry", "for"),
              line("sable", "I can keep the burn from spreading. I cannot make the wight unhappen. Come to the stalls before it stands up again.", "worried", "aside"),
            ],
        memories: [
          {
            kind: "choice",
            text: `${playerName} fought the salt-wight with Mara. ${rollSentence(roll)} Outcome: ${roll.success ? "felled" : "bitten"}.`,
          },
        ],
        roll,
      };
    }
    case "wight_brace": {
      const roll = throwCheck(prior, playerName, "wight_brace", "skill", "hold the salt-wight in the lamp", "sable", 12);
      next.location = "market";
      next.beat = "market";
      if (roll.success) {
        next.flags.wightFought = "held";
        bump(next, "sable", 6, "bright");
        bump(next, "mara", 2, "relieved");
        bump(next, "ivo", 2, "awed");
      } else {
        next.flags.wightFought = "bitten";
        next.flags.exhausted = true;
        next.flags.lampDim = true;
        bump(next, "sable", -5, "dim");
        bump(next, "mara", -2, "grim");
        bump(next, "ivo", -1, "hoarse");
      }
      const beam = roll.success
        ? "Sable opens the lamp and the beam pins the wight like a moth made of grit. It cannot step. You walk around the light and the market takes you in with the creature still burning behind you."
        : "The lamp flares and gutters. The wight steps through the failed beam and bites anyway. Sable is dimmer. You reach the market leaning on each other, and the coat at the counter has already smelled the salt.";
      return {
        narration: `${rollSentence(roll)}

${beam}

${arriveMarket(next, playerName)}`,
        lines: roll.success
          ? [
              line("sable", "Held, not killed. A lamp can do that once. Don't ask me to do it as a lifestyle, Mara.", "bright", "aside"),
              line("mara", "You spent light instead of blood. I will allow it. I will not applaud it where the market can hear.", "relieved", "against"),
              line("ivo", "A creature filed under illumination. I want that sentence in the index. Sable, you just wrote a chapter Mara was going to stab.", "awed", "for"),
            ]
          : [
              line("sable", "The light missed. I am smaller for it. Don't spend me again until I say the wick is back.", "dim", "against"),
              line("ivo", "So much for the elegant solution. Mara, your knife is looking prophetic and I hate that.", "hoarse", "for"),
              line("mara", "We're upright. That's the whole review. Get to the counter before the bite decides it owns the map.", "grim", "aside"),
            ],
        memories: [
          {
            kind: "choice",
            text: `${playerName} tried to hold the salt-wight in Sable's lamp. ${rollSentence(roll)} Outcome: ${roll.success ? "held" : "bitten"}.`,
          },
        ],
        roll,
      };
    }
    case "push": {
      next.flags.flatsChoice = "push";
      next.flags.exhausted = true;
      next.location = "market";
      next.beat = "market";
      bump(next, "mara", 4, "proud");
      bump(next, "ivo", -6, "scraped");
      bump(next, "sable", 0, "enduring");
      return {
        narration: `You walk into the storm because stopping feels like a decision the wind would mock. Salt finds every seam. Ivo loses the only dry corner of a blank page and does not forgive the page, or you, or the sky. When the market appears it looks like a mercy and is probably a bill.

${arriveMarket(next, playerName)}`,
        lines: [
          line("mara", "You didn't flinch. I notice. Don't make a habit of proving it when a ribcage is available.", "proud", "for"),
          line("ivo", "My page is ruined and my temper is educational. Mara, if you say this built character I will inventory your faults alphabetically.", "scraped", "against"),
          line("sable", "The storm liked the attention. Next time, give it less.", "enduring", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} pushed through the salt storm. The party arrived hoarse, and Ivo lost a dry page.` }],
      };
    }
    case "trade_seal": {
      dropKit(next, "mara", "warden seal");
      next.flags.toll = "seal";
      enterScriptorium(next);
      bump(next, "mara", -16, "betrayed");
      bump(next, "ivo", 4, "relieved");
      bump(next, "sable", -4, "sorry");
      return {
        narration: `You put Mara's warden seal on the counter. The coat's gloves close over it with tailor's care. Mara does not grab your wrist. That restraint costs her more than the seal. A seam opens behind the last stall, dry and dark, and the market forgets you on purpose.

${arriveScriptorium(next, playerName)}`,
        lines: [
          line("mara", "That was the last door I closed properly. You sold the door. Don't tell me it was only brass.", "betrayed", "against"),
          line("ivo", "It was a tool, Mara. The scriptorium is the point of the walking. You can hate me from the dry side of the gate. I accept the posting.", "relieved", "for"),
          line("sable", "A seal is a promise with a hinge. You sold a hinge. The coat will wear it better than is fair.", "sorry", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} traded Mara Voss's warden seal for passage through Veil Market.` }],
      };
    }
    case "trade_index": {
      dropKit(next, "ivo", "index page");
      next.flags.toll = "index";
      enterScriptorium(next);
      bump(next, "ivo", -16, "stricken");
      bump(next, "mara", 6, "grim");
      bump(next, "sable", -2, "watchful");
      return {
        narration: `Ivo puts the index page down as if it might still be rescued by a better sentence. The gloves take it. He watches the pocket that swallows it and memorizes the pocket, which is not the same as having the page. The seam behind the stall opens.

${arriveScriptorium(next, playerName)}`,
        lines: [
          line("ivo", "That was the last copy. Congratulate yourselves quietly. I am busy becoming a worse archivist in real time.", "stricken", "against"),
          line("mara", "Paper for a door. I won't gloat. I will also not pretend I'm sorry the ghost-list is out of his coat.", "grim", "for"),
          line("sable", "The page screamed in a voice like footnotes. The coat has indigestion. Good.", "watchful", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} traded Ivo Quill's index page to the coat at Veil Market.` }],
      };
    }
    case "trade_memory": {
      next.flags.toll = "memory";
      next.flags.sableMemorySpent = true;
      enterScriptorium(next);
      bump(next, "sable", -14, "faded");
      bump(next, "mara", -6, "angry");
      bump(next, "ivo", 5, "archival");
      return {
        narration: `Sable gives the coat a memory of the road before Vellum vanished: carts, a bell-rehearsal, ordinary dust. The lamp goes briefly clear, like glass with nothing behind it, then clouded again. The coat wears the memory as a better posture. You are let through.

${arriveScriptorium(next, playerName)}`,
        lines: [
          line("sable", "I know the road is under me. I no longer remember what it was like when it was only a road. Leave me a minute before you ask me to hold anything else.", "faded", "against"),
          line("ivo", "An archive is an archive. It hurts the shelf. I will not insult Sable by calling the hurt beautiful.", "archival", "for"),
          line("mara", "You spent the spirit to skip a wet gate. Ivo, don't you dare agree with me out loud. I am angry enough without company.", "angry", "against"),
        ],
        memories: [{ kind: "choice", text: "Sable surrendered a memory of the old road to pay the Veil Market toll." }],
      };
    }
    case "refuse": {
      next.flags.toll = "none";
      next.flags.soaked = true;
      enterScriptorium(next);
      bump(next, "mara", 8, "proud");
      bump(next, "ivo", -6, "sulking");
      bump(next, "sable", 3, "bright");
      return {
        narration: `You refuse the coat. It does not argue. It simply stops being a way through. Mara finds the floodgate by the smell of old water and older stubbornness. You wade. Ivo holds the index page over his head like a saint's picture and still loses a dry cuff. The scriptorium lets you in at the leaky end, unbought.

${arriveScriptorium(next, playerName)}`,
        lines: [
          line("mara", "Good. Let the coat keep its empty hands. I like us better wet than priced.", "proud", "for"),
          line("ivo", "My cuff is a casualty and my dignity is filing a complaint. There was a counter, Mara. Counters exist so heroes don't have to drip.", "sulking", "against"),
          line("sable", "The water knows you refused. It is a petty element. It will remember in your socks.", "bright", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} refused the Veil Market toll and took the floodgate instead.` }],
      };
    }
    case "read": {
      next.flags.record = "read";
      enterBellcrypt(next);
      bump(next, "mara", -2, "unsettled");
      bump(next, "ivo", 4, "intent");
      bump(next, "sable", 2, "listening");
      return {
        narration: `You read the vote aloud. The water stills to hear a decision it already knew. Vellum, gathered in a year the census sharpened its pencils, chose absence over being itemized. Your voice makes the choice present tense again. When you stop, the lectern is just a lectern, and the bells under the square have started to notice the party.

${arriveBellcrypt(next, playerName)}`,
        lines: [
          line("mara", "You put it in the air. Air carries. I would have left it on the page, where pages drown.", "unsettled", "against"),
          line("ivo", "Spoken is not the same as copied, Mara. Don't rush me toward a crime I am still composing. The vote deserves a witness who isn't water.", "intent", "for"),
          line("sable", "The town heard its own name for the procedure. It flinched, and then it leaned closer.", "listening", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} read Vellum's vote aloud in the drowned scriptorium.` }],
      };
    }
    case "copy": {
      next.flags.record = "copied";
      addItem(next, "copied vote");
      enterBellcrypt(next);
      bump(next, "ivo", 8, "elated");
      bump(next, "mara", -8, "alarmed");
      bump(next, "sable", 0, "wary");
      return {
        narration: `You copy the vote into the map case, charcoal faithful to every cruel comma. The original stays on the lectern, relieved or offended, it is hard to tell with paper. You now own a town's refusal in duplicate. Beneath you, the bells warm.

${arriveBellcrypt(next, playerName)}`,
        lines: [
          line("ivo", "Yes. That is the work. A decision that exists once can be burned by accident. A decision that exists twice has to be answered.", "elated", "for"),
          line("mara", "You just made the census a traveling companion. Ivo, if you smile any wider I will assume you've never met a consequence.", "alarmed", "against"),
          line("sable", "The copy is heavier than the original. Words gain weight when they know they might be used.", "wary", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} copied Vellum's vote into the map case.` }],
      };
    }
    case "burn": {
      next.flags.record = "burned";
      enterBellcrypt(next);
      bump(next, "mara", 8, "relieved");
      bump(next, "ivo", -14, "devastated");
      bump(next, "sable", -2, "solemn");
      return {
        narration: `You burn the record. The page takes the flame personally and is gone before Ivo finishes the word "wait." Ash salts the lectern. The vote survives only in the four of you, which is a fragile archive. Somewhere below, the bells sound almost grateful.

${arriveBellcrypt(next, playerName)}`,
        lines: [
          line("mara", "Good. Let the census go hungry. If the town wanted to be a document it would have stayed legible.", "relieved", "for"),
          line("ivo", "You burned a decision because it frightened you. That is not mercy, Mara. That is editing. I will remember every line you just made unprovable, and I will hate the remembering.", "devastated", "against"),
          line("sable", "Ash is a kind of memory with the names scraped off. Be careful. Scraped things still cut.", "solemn", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} burned Vellum's vote. Ivo will not forgive it quickly.` }],
      };
    }
    case "leave": {
      next.flags.record = "left";
      enterBellcrypt(next);
      bump(next, "mara", 4, "steady");
      bump(next, "ivo", -6, "itching");
      bump(next, "sable", 2, "calm");
      return {
        narration: `You leave the vote where it is. The water creeps a finger-width closer, patient as interest. Nobody owns the decision except the town that made it. You go down toward the bells with wet hems and empty hands.

${arriveBellcrypt(next, playerName)}`,
        lines: [
          line("mara", "Leaving a thing alone is a skill. I'm glad someone on this road still has it.", "steady", "for"),
          line("ivo", "Leaving is also a way of hoping the evidence survives without our courage. I am not edified, Mara. I am itchy.", "itching", "against"),
          line("sable", "The page was glad not to be touched. Few pages get that ending. Enjoy the rarity.", "calm", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} left Vellum's vote untouched on the lectern.` }],
      };
    }
    case "complete_map": {
      next.flags.ending = "unveiled";
      enterEnding(next);
      bump(next, "ivo", 6, "awed");
      bump(next, "mara", -10, "grieving");
      bump(next, "sable", -4, "overbright");
      const recordNote =
        prior.flags.record === "burned"
          ? "The vote is ash, so the lines you draw are from memory, and memory is a kinder cartographer than ink. Some streets return with their worst door missing."
          : prior.flags.record === "copied"
            ? "The copied vote rides in your case and argues with every line. The town returns exactly, including the people who voted no."
            : "You draw what you heard and what you saw. It is accurate enough to be a summons.";
      return {
        narration: endingNarration(
          prior,
          playerName,
          `You complete the map. The charcoal kisses the blank and the bells answer, a struck-silver sound that unfolds streets out of themselves. Vellum stands up in the square like a sleeper who did not consent to morning: confused, named, some faces grateful, some already angry at the light. Your employer will pay. ${recordNote}`,
        ),
        lines: [
          line("ivo", "There. Legible. Don't look away, Mara. A rescued record is allowed to be unhappy about the rescue.", "awed", "for"),
          line("mara", `They voted, ${playerName}. You overruled a town with a piece of charcoal. I will stand in the square anyway. Someone should apologize in a voice that isn't proud.`, "grieving", "against"),
          line("sable", "The names fit back into the mouths that lost them. Some mouths are bleeding. I can hold a few until they stop shaking.", "overbright", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} completed the map. Vellum woke.` }],
      };
    }
    case "seal_crypt": {
      next.flags.ending = "mercy";
      dropItem(next, "commission letter");
      enterEnding(next);
      bump(next, "mara", 8, "quiet");
      bump(next, "ivo", -8, "divided");
      bump(next, "sable", 4, "soft");
      return {
        narration: endingNarration(
          prior,
          playerName,
          `You seal the crypt with charcoal, wax, and the commission letter turned backward so the employer's name faces the stone. The bells go quiet in relief, a silence with shoulders. You will report the town still gone. It will be the most accurate lie of your career. The square above you remains a square, uninhabited, wind moving through it like a clerk who found an empty file and chose not to correct it.`,
        ),
        lines: [
          line("mara", "I'll keep the gate. I'm good at gates. If your employer sends another cartographer, they can argue with me and the wax.", "quiet", "for"),
          line("ivo", "An archivist who lies is a novelist with worse hours. I haven't decided whether I resign. Give me the walk back before you ask.", "divided", "against"),
          line("sable", "The bells are grateful and ashamed, which is how most mercies feel from the inside. Walk softly on the way out.", "soft", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} sealed the Bellcrypt and chose to report Vellum still gone.` }],
      };
    }
    case "lamp_keep": {
      if (prior.flags.sableMemorySpent) {
        next.flags.lampRefused = true;
        bump(next, "sable", prior.flags.lampRefused ? 0 : -4, "ashamed");
        bump(next, "mara", prior.flags.lampRefused ? 0 : -2, "bitter");
        return {
          narration: `Sable opens the lamp. There is weather inside, and the shape of a road, but not the road itself — that memory was spent on an empty coat at Veil Market. A town will not fit in the space a road left behind. The bells wait, unstruck, while Sable closes the lamp with both hands and does not apologize for the physics.`,
          lines: [
            line("sable", "I can't. I would if the shelf were still there. Ask me for a smaller miracle or choose one of the harder honesties.", "ashamed", "against"),
            line("mara", "This is the market, still billing us. I said not to spend the spirit. I will say it only once more.", "bitter", "against"),
            line("ivo", "The page wouldn't have held a town either. Don't look at me for a storage solution. I am an archivist, not a pocket.", "flat", "for"),
          ],
          memories: prior.flags.lampRefused
            ? []
            : [{ kind: "fact", text: "Sable could not keep Vellum in the lamp. The memory of the old road was already spent at Veil Market." }],
        };
      }
      next.flags.ending = "kept";
      enterEnding(next);
      bump(next, "sable", 10, "crowded");
      bump(next, "mara", 4, "awed");
      bump(next, "ivo", -6, "empty-handed");
      return {
        narration: endingNarration(
          prior,
          playerName,
          `Sable opens the lamp. The streets pour in as light, not as rubble — lanes, lintels, a bell choir compressed to a warm murmur against the brass. Vellum is not destroyed and not displayed. It is held. Sable stands a little taller and a little more careful, a person with a town for a ribcage. You leave a blank square on the survey. You do not apologize for the blank.`,
        ),
        lines: [
          line("sable", "I have them. They are arguing already, which means they are well. Walk slowly on the way back. Both of me are new at this.", "crowded", "for"),
          line("ivo", "I don't get to file it. I want that sentence witnessed, Mara, before you call it a happy ending. A happy ending I cannot cite is a private joke.", "empty-handed", "against"),
          line("mara", "A blank square and a clear conscience. Heavier than the seal. I'll carry the blank. You carry the lamp, Sable. Nobody else touches it.", "awed", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} asked Sable to keep Vellum in the lamp, and the lamp accepted the town.` }],
      };
    }
    case "tomorrow": {
      const ending = prior.flags.ending;
      if (ending === "unveiled") {
        return {
          narration: `Morning is already prying at the square. Vellum is noisy in the way of places that have been silent too long. The commission will want a clean report. You have a town instead.`,
          lines: [
            line("mara", "Tomorrow I stand in the square and learn the names that came back angry. Someone should.", "resolved", "against"),
            line("ivo", "Tomorrow I file the map and a dissent of equal length. Mara will call that cowardice. It is also a record.", "busy", "for"),
            line("sable", "Tomorrow I walk streets I was not allowed to touch and see if they know the lamp. I think they will.", "hopeful", "aside"),
          ],
          memories: [],
        };
      }
      if (ending === "mercy") {
        return {
          narration: `The road back is unremarkable on purpose. Your report is already composing itself in a voice you don't love. The wax over the crypt will hold unless someone cares more than they are paid to.`,
          lines: [
            line("mara", "Tomorrow I pretend the commission was a weather report. I am good at gates. I can be good at silence.", "quiet", "for"),
            line("ivo", "Tomorrow I decide whether an archivist who lies is still an archivist. I would like one night before I answer you.", "divided", "against"),
            line("sable", "Tomorrow the bells stay folded. I will sit near the story of them without striking a note.", "soft", "aside"),
          ],
          memories: [],
        };
      }
      return {
        narration: `The lamp ticks like a small civic clock. Nothing on the map has changed. Something in the brass has. The way home is the same length it was this morning and feels shorter.`,
        lines: [
          line("mara", "Tomorrow I carry a blank square and a clear conscience, which is heavier. Ivo can complain. The square stays blank.", "steady", "for"),
          line("ivo", "Tomorrow I do not copy what the lamp holds. I want that restraint witnessed, since I am unlikely to enjoy it.", "wry", "against"),
          line("sable", "Tomorrow I am a town and a person. Please walk slowly. Both of me are learning the gait.", "crowded", "aside"),
        ],
        memories: [],
      };
    }
    default:
      return null;
  }
}

const LOOKS: Record<LocationId, string> = {
  waystation:
    "The waystation smells of wet ash and onion. The map on the table is the brightest thing in the room, and it is mostly a blank.",
  bridge:
    "The drop under the bridge does not end so much as lose interest in being seen. The toll-keeper sheds grit whenever it waits.",
  flats:
    "The flats are a page someone tried to erase with salt. The ribs creak, counting weather.",
  market:
    "Veil Market is all stalls and no sellers. The coat at the last counter has excellent posture and no intention of explaining it.",
  scriptorium:
    "Green water holds the shelves at the waist. The dry lectern looks guilty, the way evidence does.",
  bellcrypt:
    "The bells are large enough to live in. Inside each, a street glints and pretends to be a reflection.",
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
  bellpool: "A pool that could hold a town.",
};

function look(state: GameState, playerName: string): Spoken {
  return {
    narration: `${LOOKS[state.location]} ${lead(state, playerName)}You, ${playerName}, are still in the picture.`,
    lines: [
      line("sable", "Looking is a kind of touching. The place felt that.", "quiet", "aside"),
      line("mara", "Eyes up. Pretty roads still send bills.", "watchful", "aside"),
    ],
    memories: [],
  };
}

function inventory(state: GameState, playerName: string): Spoken {
  const mine = state.inventory.join(", ");
  const mara = state.partyKits.mara.join(", ") || "nothing she will admit";
  const ivo = state.partyKits.ivo.join(", ") || "nothing he can cite";
  const sable = state.partyKits.sable.join(", ") || "a thinner light";
  return {
    narration: `${playerName}, you are carrying ${mine}. Mara has ${mara}. Ivo has ${ivo}. Sable has ${sable}.`,
    lines: [
      line(
        "ivo",
        state.partyKits.ivo.includes("index page")
          ? "The page is still mine. Try to look less relieved, Mara."
          : "Do not inventory me. I am aware of the absence. It has a shape.",
        "precise",
        "aside",
      ),
      line(
        "mara",
        state.partyKits.mara.includes("warden seal")
          ? "Seal's still here. Let's keep it that way until there's a door that deserves it."
          : "You know what's missing. Don't make me name it for the room.",
        "flat",
        "aside",
      ),
    ],
    memories: [],
  };
}

function recall(_state: GameState, playerName: string, memories: string[]): Spoken {
  if (memories.length === 0) {
    return {
      narration: `The Chronicle has nothing filed on you yet, ${playerName}. The road is still blank.`,
      lines: [
        line("sable", "Blank is a kind of mercy. It rarely lasts.", "soft", "aside"),
        line("mara", "Good. Fewer sentences to trip on.", "dry", "aside"),
      ],
      memories: [],
    };
  }
  const latest = memories[memories.length - 1];
  return {
    narration: `The Chronicle reads what it kept. ${memories.join(" ")}`,
    lines: [
      line("sable", `That last one is still warm: ${latest}`, "remembering", "aside"),
      line("ivo", "If it is written down, it will try to matter. Mara, that is not a threat. It is a job description.", "intent", "for"),
      line("mara", "Some of those should have stayed in the mouth that made them. Too late now.", "wary", "against"),
    ],
    memories: [],
  };
}

function aside(id: CompanionId, state: GameState, playerName: string): DialogueLine {
  const low = state.trust[id] < 40;
  if (id === "mara") {
    if (low) {
      return line("mara", `You want my counsel after spending what I warned you about. Fine. ${playerName}, stop asking the road to like you. It won't.`, "cold", "against");
    }
    switch (state.beat) {
      case "waystation":
        return line("mara", `Ask me plain. I want the flats. Ivo wants a sentence he can survive. Those are not the same road, ${playerName}.`, "blunt", "against");
      case "bridge":
        return line("mara", "Give it a name that isn't living in this party. If you can't, we turn around. I have turned around before. It felt like work, not shame.", "urgent", "against");
      case "flats":
        return line("mara", "Get in the ribs. Heroics are just weather with an audience.", "practical", "for");
      case "market":
        return line("mara", "Don't look at the seal when you say my name. The coat can hear pockets.", "tight", "against");
      case "scriptorium":
        return line("mara", "If you copy it, you are doing the census a favor. If you burn it, Ivo breaks. Choose like someone who has to walk back with both of us.", "grave", "against");
      case "bellcrypt":
        return line("mara", "The town voted. Waking it is not a neutral survey. Say that out loud before you finish the map.", "grave", "against");
      case "ending":
        return line("mara", "I'm still here. That is the whole of my report.", "steady", "aside");
      case "shrine":
        return line("mara", "Don't pocket the stone. A shrine is a debt with better architecture.", "urgent", "against");
      case "orchard":
        return line("mara", "If it chimes, it is trying to be noticed. We have been noticed enough.", "practical", "against");
      case "choir":
        return line("mara", "Say your piece and go back. Stairs are where people talk themselves into bills.", "grave", "against");
      default:
        return line("mara", `Ask me plain, ${playerName}. I will not decorate it.`, "blunt", "against");
    }
  }
  if (id === "ivo") {
    if (low) {
      return line("ivo", "You may speak. I am not required to be generous about it. My profession is memory, and you have been expensive.", "clipped", "against");
    }
    switch (state.beat) {
      case "waystation":
        return line("ivo", `Mara will make caution sound like a moral system, ${playerName}. Ask her how many people her closed gate kept safe, and then ask her how many it stranded.`, "arguing", "for");
      case "bridge":
        return line("ivo", "A true name is just a name that has been believed. We have several. The tragedy would be spending yours when mine are already compromised.", "persuasive", "for");
      case "flats":
        return line("ivo", "I will shelter if you insist. I will also mention the lost day at every future decision, so budget for it.", "dry", "against");
      case "market":
        return line("ivo", "The coat wants proof, not blood. Try not to let Mara define proof as 'whatever hurts me least.'", "sharp", "for");
      case "scriptorium":
        return line("ivo", "Copy it. Burning a vote is how tyrannies get a good night's sleep. Mara disagrees, and Mara is not the archive.", "fierce", "for");
      case "bellcrypt":
        return line("ivo", "Complete the map. A town hidden by fear is still a town being governed by fear. I would rather they be angry and named.", "fierce", "for");
      case "ending":
        return line("ivo", "If you need a footnote, I am the footnote. Try to look less surprised.", "wry", "aside");
      case "shrine":
        return line("ivo", "That name is weathering into silence. A pocket is a kinder archive than rain.", "persuasive", "for");
      case "orchard":
        return line("ivo", "One fruit. For the record. Mara can survive a record.", "dry", "for");
      case "choir":
        return line("ivo", "Listen, then choose. A town that only gets counted in private is still being governed.", "fierce", "for");
      default:
        return line("ivo", "I have a professional objection and the lung capacity for it.", "sharp", "for");
    }
  }
  if (low) {
    return line("sable", "I am listening. I am also tired. Ask a smaller question, or ask one of the loud ones.", "thin", "aside");
  }
  switch (state.beat) {
    case "waystation":
      return line("sable", `They love a hinge, ${playerName}. That is you. Hinges get pinched. I will say so when it happens.`, "fond", "aside");
    case "bridge":
      return line("sable", "If you ask me for a name, I will give one. I would rather you asked because you cannot bear the other prices, not because it is convenient.", "serious", "aside");
    case "flats":
      return line("sable", "The ribs are a guest room, not a trophy. Shelter is allowed. Boasting is not.", "gentle", "aside");
    case "market":
      return line("sable", "I can pay in memory. I would like you to hear how much I don't want to, and then decide anyway if you must.", "honest", "aside");
    case "scriptorium":
      return line("sable", "The vote is a person-shaped silence. Whatever you do, don't do it to impress either of them.", "steady", "aside");
    case "bellcrypt":
      return line("sable", "I can keep the town if I still have the shelf for it. If I say I can't, believe me the first time.", "careful", "aside");
    case "ending":
      return line("sable", "The lamp is still a lamp. I am still someone you can talk to without filing a form.", "warm", "aside");
    case "shrine":
      return line("sable", "The carved name is asleep. Taking it wakes it. Leaving it is also a kind of touch.", "serious", "aside");
    case "orchard":
      return line("sable", "The fruit misses nothing until it is picked. After that, it misses the branch in your pack.", "gentle", "aside");
    case "choir":
      return line("sable", "Say what you would keep. The stair holds it better than a decision made in a hurry.", "steady", "aside");
    default:
      return line("sable", "I am listening. The road is listening too.", "warm", "aside");
  }
}

function rebuttal(other: CompanionId, target: CompanionId): DialogueLine {
  const name = companionById(target).name.split(" ")[0];
  if (other === "mara") {
    return line("mara", `${name} will talk until the road chooses for us. I won't help it.`, "clipped", "against");
  }
  if (other === "ivo") {
    return line("ivo", `${name} makes it sound settled. It is not settled. I still have a professional objection and the lung capacity for it.`, "sharp", "for");
  }
  return line("sable", "You are both loud in a small lamp. The road can hear you. So can the player. Try to be worth that.", "warm", "aside");
}

function address(state: GameState, id: CompanionId, playerName: string): Spoken {
  const other: CompanionId = id === "sable" ? (state.trust.mara <= state.trust.ivo ? "mara" : "ivo") : id === "mara" ? "ivo" : "mara";
  return {
    narration: `You turn to ${companionById(id).name}. The others do not do you the courtesy of pretending not to listen.`,
    lines: [aside(id, state, playerName), rebuttal(other, id)],
    memories: [],
  };
}

function unknown(state: GameState, playerName: string, text: string): Spoken {
  return {
    narration: `You try it: "${clip(text)}". ${PLACES[state.location]} does not take that step. It stays where it is, ${playerName}, waiting for a decision it already understands.`,
    lines: [
      line("ivo", "Poetic. Unparsed. Give the scene a verb it already fears.", "dry", "aside"),
      line("mara", "Pick a road. Mystery is how people get billed twice.", "impatient", "aside"),
      line("sable", "I heard you. The place did too. It is simply not hungry for that sentence.", "kind", "aside"),
    ],
    memories: [],
  };
}

export function resolveTurn(state: GameState, playerName: string, text: string, memories: string[]): Resolution {
  if ((state.bookId ?? "ashmarch") === "lumenferry") {
    return resolveLumenferryTurn(state, playerName, text, memories);
  }
  const intent = parseIntent(text, state.beat, suggestionsFor(state));
  if (intent.type === "look") return finish(clone(state), look(state, playerName));
  if (intent.type === "inventory") return finish(clone(state), inventory(state, playerName));
  if (intent.type === "recall") return finish(clone(state), recall(state, playerName, memories));
  if (intent.type === "address") return finish(clone(state), address(state, intent.companionId, playerName));
  if (intent.type === "choice") {
    const next = clone(state);
    const spoken = applyChoice(next, state, intent.id, playerName);
    if (spoken) return finish(next, spoken);
  }
  return finish(clone(state), unknown(state, playerName, text));
}

function clone(state: GameState): GameState {
  return structuredClone(state);
}

export function partyArgues(lines: DialogueLine[]): boolean {
  const stances = new Set(lines.map((entry) => entry.stance));
  return stances.has("for") && stances.has("against");
}
