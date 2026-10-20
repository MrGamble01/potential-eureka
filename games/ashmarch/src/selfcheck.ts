import { loadConfig } from "./server/config";
import { GameDb, memoryStorage } from "./server/db";
import { GameEngine } from "./server/game/engine";
import { createImageProvider, createLlmProvider } from "./server/providers/registry";

const config = loadConfig({ LLM_PROVIDER: "stub", IMAGE_PROVIDER: "stub" });
if (config.llmProvider !== "stub" || config.imageProvider !== "stub") {
  throw new Error("defaults are not stubs");
}

async function main(): Promise<void> {
  let threw = false;
  try {
    createLlmProvider({ ...config, llmProvider: "openai", openaiApiKey: "" });
  } catch (error) {
    threw = /OPENAI_API_KEY/.test(String(error));
  }
  if (!threw) throw new Error("openai provider was constructed without a key");

  const engine = new GameEngine(new GameDb(memoryStorage()), createLlmProvider(config), createImageProvider(config));
  const ash = await engine.start({ playerName: "Nim", motive: "To pay a debt", bookId: "ashmarch" });
  const names = ash.party.map((member) => member.name).join(",");
  if (names !== "Mara Voss,Ivo Quill,Sable") throw new Error("ash party " + names);
  if (!ash.scene.dataUrl.startsWith("data:image/svg+xml")) throw new Error("plate " + ash.scene.dataUrl.slice(0, 40));
  if (ash.memories.length < 1) throw new Error("no journal");
  if (ash.messages.some((message) => message.speaker === "The Chronicle") === false) throw new Error("no chronicle");
  const flats = await engine.act(ash.id, "We take the long way across the salt flats.");
  if (flats.state.location !== "flats" && flats.state.beat !== "flats") {
    throw new Error("flats route " + flats.state.location + " " + flats.state.beat);
  }
  const stood = await engine.act(ash.id, "Fight the salt-wight.");
  if (stood.state.beat !== "wight") throw new Error("wight beat " + stood.state.beat);
  const fight = await engine.act(ash.id, "Strike the wight with Mara.");
  if (!fight.state.lastRoll || fight.state.lastRoll.die !== "d20") throw new Error("no d20");
  const ferry = await engine.start({ playerName: "Nim", motive: "To keep the boats uncounted", bookId: "lumenferry" });
  const ferryNames = ferry.party.map((member) => member.name).join(",");
  if (ferryNames !== "Bram Holt,Ness Kite,Pell") throw new Error("ferry party " + ferryNames);
  const chronicle = ferry.messages.find((message) => message.role === "gm")?.text ?? "";
  if (!/other road/i.test(chronicle)) throw new Error("cross-book memory missing");
  if (!ferry.scene.dataUrl.includes("svg")) throw new Error("ferry plate");
  const saved = engine.save(ferry.id);
  if (engine.slot()?.campaignId !== saved.campaignId) throw new Error("slot");
  console.log("ashmarch selfcheck ok", fight.state.lastRoll.natural, fight.state.flags.wightFought);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
