import { loadConfig } from "../server/config";
import { GameDb } from "../server/db";
import { GameEngine } from "../server/game/engine";
import { createImageProvider, createLlmProvider } from "../server/providers/registry";
import { mountTable } from "./table";

const config = loadConfig({
  LLM_PROVIDER: "stub",
  IMAGE_PROVIDER: "stub",
});

const llm = createLlmProvider(config);
const images = createImageProvider(config);
const engine = new GameEngine(new GameDb(), llm, images);

const root = document.getElementById("app");
if (!root) throw new Error("Ashmarch has no table.");

mountTable(root, engine, {
  ok: true,
  llmProvider: llm.id,
  imageProvider: images.id,
  persistence: "browser",
});
