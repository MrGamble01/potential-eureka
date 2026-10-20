import { companionById, PLACES } from "../../shared/companions";
import { makeCheck, modifierFromTrust, rollSentence } from "../../shared/dice";
import type {
  CompanionId,
  DialogueLine,
  DiceRoll,
  GameState,
  LocationId,
  MemoryKind,
  SceneBrief,
  Stance,
} from "../../shared/types";
import { parseIntent } from "./parse";
import type { Suggestion } from "../../shared/types";
import type { Resolution } from "./story";

type Spoken = {
  narration: string;
  lines: DialogueLine[];
  memories: { kind: MemoryKind; text: string }[];
  roll?: DiceRoll;
};

const PARTY: CompanionId[] = ["bram", "ness", "pell"];

export function lumenferryState(): GameState {
  return {
    bookId: "lumenferry",
    beat: "quay",
    location: "quay",
    flags: {},
    inventory: ["tide chart", "charcoal", "ferry commission"],
    partyKits: {
      bram: ["tide-charm"],
      ness: ["stolen mold"],
      pell: ["cracked buoy"],
    },
    trust: { bram: 50, ness: 54, pell: 58 },
    mood: { bram: "watchful", ness: "bright", pell: "ringing" },
    turn: 0,
    ended: false,
    lastRoll: null,
  };
}

function line(id: CompanionId, text: string, mood: string, stance: Stance): DialogueLine {
  return { companionId: id, speaker: companionById(id).name, text, mood, stance };
}

function bump(state: GameState, id: CompanionId, delta: number, mood: string): void {
  const current = state.trust[id] ?? 50;
  state.trust[id] = Math.max(0, Math.min(100, current + delta));
  state.mood[id] = mood;
}

function dropKit(state: GameState, id: CompanionId, item: string): void {
  state.partyKits[id] = (state.partyKits[id] ?? []).filter((entry) => entry !== item);
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

function echoes(state: GameState, playerName: string): string[] {
  const flags = state.flags;
  const out: string[] = [];
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

function lead(state: GameState, playerName: string): string {
  const all = echoes(state, playerName);
  const latest = all[all.length - 1];
  return latest ? `${latest} ` : "";
}

function sceneFor(state: GameState): SceneBrief {
  const title = PLACES[state.location];
  const mood = state.location === "ending" ? (state.flags.ending ?? "dark") : state.location;
  const altBits: Partial<Record<LocationId, string>> = {
    quay: "A night quay, a dark lighthouse, and a ferry tied under an unlit lens.",
    causeway: "Slabs of sea-glass crossing black water toward a lightless tower.",
    boarding: "A press-gang skiff against the glass, hooks out, the party braced to meet it.",
    eelbeds: "Weed, eel-shine, and a cracked buoy ringing under the surface.",
    lenshouse: "A huge cold lens in a round room, and a latch that wants a toll.",
    kiln: "A glass kiln gone dark, with one firing log on the anneal shelf.",
    bellpool: "A tide pool under the tower where a buoy can hold a whole town.",
    ending:
      state.flags.ending === "relit"
        ? "The lighthouse beam rakes the boats and makes every hull easy to count."
        : state.flags.ending === "held"
          ? "A cracked buoy glowing with a town folded inside the note."
          : "A dark shore, and boats slipping past an unlit lens.",
  };
  return {
    bookId: "lumenferry",
    location: state.location,
    title,
    alt: `${title}. ${altBits[state.location] ?? "The night ferry and a light that was put out on purpose."}`,
    mood,
    ending: state.flags.ending,
    prompt: `Illustrated field plate of ${title}, mood ${mood}, night glassworks and a darkened lighthouse, sea-glass colors, no lettering`,
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
      "bram",
      `You said debt, ${playerName}. A lit lens is how collectors find a harbor. I will not pay your ledger with my boats.`,
      "warning",
      "against",
    );
  }
  if (/\b(light|lens|glass|dark)\b/.test(text)) {
    return line(
      "ness",
      "You came talking about the light. Good. Bram will call that a threat. I call it the job.",
      "hopeful",
      "for",
    );
  }
  return null;
}

export function resolveLumenferryOpening(playerName: string, motive: string): Resolution {
  const state = lumenferryState();
  const extra = motiveLine(motive, playerName);
  const lines = [
    line(
      "bram",
      "Leave it dark. I have ferried children under that unlit lens while a press-gang counted hulls by the shine. Ness wants a beacon. Beacons make a list.",
      "watchful",
      "against",
    ),
    line(
      "ness",
      "The kiln has been cold for nine years, Bram. You call the dark a mercy and it is only a room where no one can see what broke. The mold is in my coat. The lens can be born again.",
      "bright",
      "for",
    ),
    line(
      "pell",
      `${playerName}, they will ring this argument until the tide turns. Bram fears a counted boat. Ness fears a craft that dies of caution. I am the bell that used to warn both. I am down one note already, and I feel the missing.`,
      "ringing",
      "aside",
    ),
  ];
  if (extra) lines.push(extra);
  return finish(state, {
    narration: `The Night Quay smells of tar, cold glass, and a lighthouse that has agreed to be a shadow. Lumenferry's lenshouse is a black coin against the stars. The ferry bumps the piles as if it would rather leave. You are ${playerName}. You were hired to learn why the light stays out.

You told them you came because ${motive}. Bram Holt keeps a hand on the rope and will not look at the tower. Ness Kite has glass-dust on her cuff and the stolen mold knocking her ribs when she breathes. Between them a cracked buoy ticks: Pell, a tide-bell that should have sunk, still ringing.`,
    lines,
    memories: [{ kind: "fact", text: `${playerName} took the Lumenferry commission because: ${motive}` }],
  });
}

function arriveLenshouse(state: GameState, playerName: string): string {
  return `${lead(state, playerName)}The lenshouse is a round dark room and one lens the size of a wagon wheel, filmed with salt. It could throw a road of light across every boat in the reach. The latch on the kiln stair will not move for free.

"Proof," says a voice in the glass, ${playerName}. "A tide-charm. A mold. Or a bell-note warm enough to steer by."`;
}

function arriveKiln(state: GameState, playerName: string): string {
  return `${lead(state, playerName)}The kiln is cold in a way that feels chosen. Crucibles hold the ghosts of bowls. On the anneal shelf, a firing log in a glassblower's hand: the town darkened the lens on purpose, ${playerName}. A press-gang was coming up the reach, counting boats by the beam. They put the sun out so the count would fail.

The log can be read, copied, smashed, or left in the cold.`;
}

function arriveBellpool(state: GameState, playerName: string): string {
  return `${lead(state, playerName)}Under the tower, the bellpool holds a buoy-ring of still water. Relighting the lens would save the craft and expose every hull. Keeping the dark would save the boats and finish the kiln. Pell could hold the town in the buoy the way a bell holds a note — kept, not displayed — if the note is still there, ${playerName}.`;
}

function enterKiln(next: GameState): void {
  next.location = "kiln";
  next.beat = "kiln";
  next.flags.knowsBlackout = true;
}

function enterBellpool(next: GameState): void {
  next.location = "bellpool";
  next.beat = "bellpool";
  next.flags.knowsBlackout = true;
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
            "against",
          ),
          line(
            "ness",
            "The kiln. If we never relight, the last honest craft in Lumenferry dies and Bram will call the corpse a strategy. I am afraid of becoming a person who agrees.",
            "serious",
            "for",
          ),
          line(
            "pell",
            "I am afraid the light will show the drownings I already carry, and I am afraid the dark will make me forget the note I have left. Spend me carefully.",
            "open",
            "aside",
          ),
        ],
        memories: repeat
          ? []
          : [
              {
                kind: "relationship",
                text: "On the Night Quay the party named their fears: Bram's counted boats, Ness's dying kiln, and Pell's last bell-note.",
              },
            ],
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
          line("pell", "I like this smaller ringing. It does not ask me to be a sun.", "pleased", "aside"),
        ],
        memories: repeat ? [] : [{ kind: "fact", text: `${playerName} made the party listen to the ferry bell before choosing a road.` }],
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
          line("pell", "The note is honest and too loud. We can keep time with it, or we can cut it short.", "alert", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} took the glass causeway toward the lens over Bram's objection.` }],
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
          line("pell", "The eels know the old bell-line. Follow me under, or keep to the weed and don't look where I look.", "wide", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} waded the eelbeds so the party would not shine on the causeway.` }],
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
          line("pell", `${playerName}, the hull has a shadow big enough for three and a buoy. Say which fear you trust.`, "low", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} met the press-gang skiff on the glass causeway.` }],
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
      const clash = roll.success
        ? "Bram takes the first hook on a boat-hook of his own and the skiff sheers off, short two grips and a count. You reach the lenshouse with the fight still loud in your wrists."
        : "The hook finds Bram's sleeve and the count almost finds you. You break free bloodied, and the lenshouse door is the only thing that does not try to inventory you.";
      return {
        narration: `${rollSentence(roll)}

${clash}

${arriveLenshouse(next, playerName)}`,
        lines: roll.success
          ? [
              line("bram", "Off my rail. If they come back they come back missing a story. I can live with that.", "grim", "for"),
              line("ness", "You made a noise the whole reach will repeat. I am glad we are alive and I am not glad about the method.", "shaken", "against"),
              line("pell", "The bell kept time. That is all a buoy can promise in a fight. The lens is next, and it is still cold.", "ringing", "aside"),
            ]
          : [
              line("bram", "They marked me. Don't make a speech about it. Get inside before they finish the number.", "cut", "against"),
              line("ness", "This is what a lit fear looks like even in the dark, Bram. I still have the mold. Try not to bleed on it.", "angry", "for"),
              line("pell", "I can smell the iron. The drownings can too. Walk. The latch will argue, but it will not bite.", "thin", "aside"),
            ],
        memories: [
          {
            kind: "choice",
            text: `${playerName} fought the press-gang beside Bram. ${rollSentence(roll)} Outcome: ${roll.success ? "repelled" : "bloodied"}.`,
          },
        ],
        roll,
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
      const slip = roll.success
        ? "Pell takes you under the hull. The gang's oars comb the wrong dark. You surface at the lenshouse stair uncounted, which Bram treats as a professional miracle."
        : "The slip is a half-second late. An oar finds a shoulder, the water finds a lung, and you arrive at the lenshouse coughing and counted at the edge of a number.";
      return {
        narration: `${rollSentence(roll)}

${slip}

${arriveLenshouse(next, playerName)}`,
        lines: roll.success
          ? [
              line("pell", "Uncounted. Hold that word the way I hold a note. It does not last unless you keep your mouth off the light.", "pleased", "aside"),
              line("bram", "I hate owing a buoy. I hate being counted more. Thank you, and do not expect a speech.", "grudging", "for"),
              line("ness", "We are wet and we are here and the lens is still a corpse. I can work with the last fact if you two are done being proud.", "wet", "against"),
            ]
          : [
              line("pell", "I missed the shadow. That is on me. Don't spend the next note pretending I am bottomless.", "sorry", "against"),
              line("ness", "So the elegant drowning failed too. Bram, your hook is looking less ridiculous and I am furious about it.", "coughing", "for"),
              line("bram", "Inside. Bleed later. The latch is a problem I understand.", "cut", "aside"),
            ],
        memories: [
          {
            kind: "choice",
            text: `${playerName} tried to slip the press-gang under the hull. ${rollSentence(roll)} Outcome: ${roll.success ? "slipped" : "bloodied"}.`,
          },
        ],
        roll,
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
        narration: `You steady the skiff — there is always a skiff, even on a road — and let the glass finish its phrase. The causeway answers more quietly once it has been heard. You reach the lenshouse with the song behind you instead of under an accusation.

${arriveLenshouse(next, playerName)}`,
        lines: [
          line("pell", "Thank you for not cutting a note in half. Most people do, and then blame the bell.", "calm", "aside"),
          line("bram", "Quieter is not safe. It is only less rude. I will take less rude and still hate the door.", "grudging", "against"),
          line("ness", "The glass let us pass because we listened. Bram, write that next to your fear so they have to share a page.", "pleased", "for"),
        ],
        memories: [{ kind: "choice", text: `${playerName} steadied the crossing and let the glass causeway finish its note.` }],
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
          line("pell", "That note will scar. I keep scars. I do not enjoy collecting them for sport.", "clipped", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} cut across the glass causeway and left a nick in the road.` }],
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
          line("ness", "I still have the mold. I also have a lungful of other people's lost bells. Bram, don't you dare call that a victory speech.", "shaken", "against"),
        ],
        memories: [{ kind: "choice", text: `${playerName} followed Pell's bell under the eelbeds to the lenshouse.` }],
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
          line("pell", "You didn't look. The drownings noticed the politeness. They are not offended. They are lonely.", "wistful", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} kept to the weed in the eelbeds and did not look down.` }],
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
          line("pell", "A tide-charm is a small bell. The latch is wearing it better than is fair.", "sorry", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} traded Bram Holt's tide-charm to open the lenshouse.` }],
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
          line("pell", "The mold screamed in a voice like cooling glass. The latch has indigestion. Good, and not good.", "watchful", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} traded Ness Kite's stolen mold for the kiln stair.` }],
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
          line("bram", "You spent the bell to skip a wet climb. I am angry enough without company. Don't you dare agree with me out loud.", "angry", "against"),
        ],
        memories: [{ kind: "choice", text: "Pell spent a bell-note to pay the lenshouse latch." }],
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
          line("pell", "The weed knows you refused. It is a petty plant. It will remember in your cuffs.", "bright", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} refused the lenshouse toll and climbed the weed ladder.` }],
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
          line("pell", "The press-gang's count failed. The drownings did not. A dark lens does not unmake a storm.", "listening", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} read the firing log: Lumenferry darkened the lens so a press-gang could not count the boats.` }],
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
          line("pell", "The copy is heavier than the log. Words gain weight when they know they might be used.", "wary", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} copied Lumenferry's blackout into the tide-book.` }],
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
          line("pell", "Ash and glass-dust sound the same if you are a bell. I will not pick a side while my metal is still deciding.", "solemn", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} smashed the firing log in the cold kiln.` }],
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
          line("pell", "Untouched is a kind of respect. It is also a kind of delay. I can ring either.", "quiet", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} left the firing log untouched in the cold kiln.` }],
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
          line("pell", `${playerName}, they are both describing a real drowning. Choose the one you can bear to hear about later.`, "steady", "aside"),
        ],
        memories: repeat ? [] : [{ kind: "relationship", text: "At the bellpool Bram and Ness argued the light one last time, and neither called the other's fear fake." }],
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
          `You relight the lens. Ness strikes the mold's memory against cold glass — or the idea of the mold, if the latch already ate it — and the tower remembers its job in one hard breath. A white road lies down on the reach. Every boat is suddenly a fact. Somewhere downcurrent, a slate can be written again.

Bram does not look at the beam. He looks at the hulls, counting them himself so the gang will not be the first.`,
        ),
        lines: [
          line("ness", "There. A town with a craft again. Bram, hate me in the light. At least you can see the person you're hating.", "blazing", "for"),
          line("bram", "I can see them. So can anyone with a pencil. If a child is taken off my ferry, this beam is the hand that pointed.", "afraid", "against"),
          line("pell", "The note is enormous. I will ring inside it as long as I can. Do not ask me to call it only beautiful.", "exposed", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} relit the Lumenferry lens, and the boats became easy to count.` }],
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

The kiln will not be warm tonight. The ferry will leave on time.`,
        ),
        lines: [
          line("bram", "The boats go. Unlisted. I can live in a town that is harder to find. I have been practicing.", "steadfast", "for"),
          line("ness", "You chose a harbor that will forget how to make the thing that saved it. I will stay. I will not call the cold a friend.", "grieving", "against"),
          line("pell", "A small bell can still be a shore. I will be that, since I am not allowed to be a sun.", "low", "aside"),
        ],
        memories: [{ kind: "choice", text: `${playerName} kept the Lumenferry lens dark and warned the boats instead.` }],
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
            line("bram", "I am relieved and I am ashamed of the shape of it. Pick a real dark or a real light. The buoy is spent.", "sorry", "against"),
          ],
          memories: [{ kind: "fact", text: `${playerName} could not hold Lumenferry in the buoy after Pell's bell-note was spent.` }],
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

Pell is larger, and harder to talk to, and still answering.`,
        ),
        lines: [
          line("pell", "I have them. Not displayed. Not erased. If you knock, knock gently. I am a town now, and towns startle.", "vast", "aside"),
          line("bram", "A harbor in a bell. I don't know how to pilot that. I know the gang can't chalk it. That will have to do.", "uneasy", "for"),
          line("ness", "The craft is alive in there. I hate that I can't watch it cool. I love that it isn't dead. Don't make me pick which sentence is the true one.", "awed", "against"),
        ],
        memories: [{ kind: "choice", text: `${playerName} asked Pell to hold Lumenferry in the buoy, and the town went private instead of dark or displayed.` }],
      };
    }
    case "tomorrow": {
      const ending = prior.flags.ending ?? "dark";
      const ness =
        ending === "relit"
          ? "Tomorrow I sweep the kiln and pretend I am not listening for pencils."
          : ending === "held"
            ? "Tomorrow I knock once on the buoy and see if the town knocks back."
            : "Tomorrow I sit in the cold kiln and refuse to call it a chapel.";
      const bram =
        ending === "relit"
          ? "Tomorrow I move the ferry to a cove the beam only grazes."
          : ending === "held"
            ? "Tomorrow I learn a route that pilots by a bell instead of a shore."
            : "Tomorrow I run the night crossing as if the dark were a contract I signed.";
      return {
        narration: `Morning is a rumor on the reach. You ask them what they will do tomorrow, and for once the answer is smaller than the tower.`,
        lines: [
          line("bram", bram, "plain", ending === "relit" ? "against" : "for"),
          line("ness", ness, "plain", ending === "dark" ? "against" : "for"),
          line("pell", "Tomorrow I ring once for the boats and once for the drownings, and I will not explain the interval.", "plain", "aside"),
        ],
        memories: [{ kind: "relationship", text: `After the lens, the Lumenferry party said what they would do tomorrow.` }],
      };
    }
    default:
      return null;
  }
}

function look(state: GameState, playerName: string): Spoken {
  const text: Partial<Record<LocationId, string>> = {
    quay: "The quay is tar, rope, and a lighthouse practicing being absent. The ferry would like a decision more than a speech.",
    causeway: "The glass slabs show the drop and sing when ashamed. The tower is a black coin.",
    boarding: "The press-gang skiff grinds the glass. Hooks, hooded lantern, and a count that has not finished.",
    eelbeds: "Weed writes on your wrists. Eels write under it. The buoy dips when Pell is thinking.",
    lenshouse: "The lens is huge, cold, and filmed with salt. The latch has the patience of a toll.",
    kiln: "Crucibles, ash, and a firing log that has already chosen a side and written it down.",
    bellpool: "Still water under the tower. A town could fit in it, or a refusal could.",
    ending: "The reach has finished its demand. What remains is a beam, a dark, or a buoy, depending on the choice you already made.",
  };
  return {
    narration: `${text[state.location] ?? "The night ferry waits."} ${lead(state, playerName)}You, ${playerName}, are still in the picture.`,
    lines: [
      line("pell", "Looking is a kind of ringing. The place felt that.", "quiet", "aside"),
      line("bram", "Eyes up. Pretty lights still make lists.", "watchful", "aside"),
    ],
    memories: [],
  };
}

function inventory(state: GameState, playerName: string): Spoken {
  const mine = state.inventory.join(", ") || "nothing";
  const bram = state.partyKits.bram?.join(", ") || "nothing he will show";
  const ness = state.partyKits.ness?.join(", ") || "empty pockets and an opinion";
  const pell = state.partyKits.pell?.join(", ") || "a thinner note";
  return {
    narration: `${playerName}, you are carrying ${mine}. Bram has ${bram}. Ness has ${ness}. Pell has ${pell}.`,
    lines: [
      line(
        "ness",
        state.partyKits.ness?.includes("stolen mold")
          ? "The mold is still mine. Try to look less relieved, Bram."
          : "Do not inventory me. I am aware of the absence. It has a shape.",
        "precise",
        "aside",
      ),
      line(
        "bram",
        state.partyKits.bram?.includes("tide-charm")
          ? "Charm's still here. Let's keep it that way until a harbor deserves it."
          : "You know what's missing. Don't make me name it for the water.",
        "flat",
        "aside",
      ),
    ],
    memories: [],
  };
}

function recall(playerName: string, memories: string[]): Spoken {
  if (memories.length === 0) {
    return {
      narration: `The Chronicle has nothing filed on you yet, ${playerName}. The reach is still blank.`,
      lines: [
        line("pell", "Blank is a kind of dark. It rarely stays kind.", "soft", "aside"),
        line("bram", "Good. Fewer sentences to steer by.", "dry", "aside"),
      ],
      memories: [],
    };
  }
  const latest = memories[memories.length - 1];
  return {
    narration: `The Chronicle reads what it kept, including any other road walked under your name. ${memories.join(" ")}`,
    lines: [
      line("pell", `That last one is still warm: ${latest}`, "remembering", "aside"),
      line("ness", "If it is written down, it will try to matter. Bram, that is not a threat. It is a job description.", "intent", "for"),
      line("bram", "Some of those should have stayed in the mouth that made them. Too late now. A road is a road, even the other one.", "wary", "against"),
    ],
    memories: [],
  };
}

function aside(id: CompanionId, state: GameState, playerName: string): DialogueLine {
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

function rebuttal(other: CompanionId, target: CompanionId): DialogueLine {
  const name = companionById(target).name.split(" ")[0];
  if (other === "bram") return line("bram", `${name} will talk until the tide chooses for us. I won't help it.`, "clipped", "against");
  if (other === "ness") return line("ness", `${name} makes it sound settled. It is not settled. I still have a furnace and the lung capacity for this.`, "sharp", "for");
  return line("pell", "You are both loud in a small buoy. The reach can hear you. So can the player. Try to be worth that.", "warm", "aside");
}

function address(state: GameState, id: CompanionId, playerName: string): Spoken {
  const other: CompanionId = id === "pell" ? ((state.trust.bram ?? 0) <= (state.trust.ness ?? 0) ? "bram" : "ness") : id === "bram" ? "ness" : "bram";
  return {
    narration: `You turn to ${companionById(id).name}. The others do not do you the courtesy of pretending the water isn't listening.`,
    lines: [aside(id, state, playerName), rebuttal(other, id)],
    memories: [],
  };
}

function unknown(state: GameState, playerName: string, text: string): Spoken {
  return {
    narration: `You try it: "${clip(text)}". ${PLACES[state.location]} does not take that step. It stays where it is, ${playerName}, waiting for a decision it already understands.`,
    lines: [
      line("ness", "Poetic. Unparsed. Give the scene a verb it already fears.", "dry", "aside"),
      line("bram", "Pick a heading. Mystery is how people get counted twice.", "impatient", "aside"),
      line("pell", "I heard you. The water did too. It is simply not hungry for that sentence.", "kind", "aside"),
    ],
    memories: [],
  };
}

export function resolveLumenferryTurn(state: GameState, playerName: string, text: string, memories: string[]): Resolution {
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

export function lumenferrySuggestions(state: GameState): Suggestion[] {
  return LUMEN_SUGGESTIONS[state.beat].map((suggestion) => ({ ...suggestion }));
}

const LUMEN_SUGGESTIONS: Record<GameState["beat"], { id: string; label: string }[]> = {
  quay: [
    { id: "causeway", label: "We take the glass causeway toward the lens." },
    { id: "eelbeds", label: "We wade the eelbeds and stay off the road." },
    { id: "fears_light", label: "What are you each afraid the light will show?" },
    { id: "ferry_bell", label: "Listen to the ferry bell." },
  ],
  causeway: [
    { id: "steady", label: "Steady the skiff while the glass sings." },
    { id: "cut", label: "Cut across before the tide turns." },
    { id: "fight_skiff", label: "Fight the press-gang skiff." },
  ],
  boarding: [
    { id: "skiff_repel", label: "Repel the boarding party." },
    { id: "skiff_slip", label: "Slip under the hull." },
  ],
  eelbeds: [
    { id: "follow_bell", label: "Follow Pell's bell under the water." },
    { id: "weed", label: "Keep to the weed and don't look down." },
  ],
  lenshouse: [
    { id: "trade_charm", label: "Trade Bram's tide-charm." },
    { id: "trade_mold", label: "Trade Ness's stolen mold." },
    { id: "trade_note", label: "Let Pell spend a bell-note." },
    { id: "weed_ladder", label: "Refuse and climb the weed ladder." },
  ],
  kiln: [
    { id: "read_log", label: "Read the firing log aloud." },
    { id: "copy_log", label: "Copy the log into the tide-book." },
    { id: "smash_log", label: "Smash the firing log." },
    { id: "leave_log", label: "Leave the log in the kiln." },
  ],
  bellpool: [
    { id: "relight", label: "Relight the lens." },
    { id: "keep_dark", label: "Keep the light dark and warn the boats." },
    { id: "hold_town", label: "Ask Pell to hold the town in the buoy." },
    { id: "pool_argue", label: "Let them argue the light one more time." },
  ],
  ending: [
    { id: "tomorrow", label: "What will you each do tomorrow?" },
    { id: "recall", label: "Read the road back to me." },
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
  wight: [],
};
