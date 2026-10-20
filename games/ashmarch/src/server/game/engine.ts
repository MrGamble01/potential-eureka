import { bookById, PLACES, regard } from "../../shared/companions";
import type { BookId, CampaignSummary, CampaignView, GameState, SaveSlot, SceneView } from "../../shared/types";
import type { GameDb } from "../db";
import { HttpError } from "../validate";
import { cleanAction, cleanBook, cleanMotive, cleanName } from "../validate";
import type { ImageProvider, LlmProvider } from "../providers/types";
import { StubImageProvider } from "../providers/stubImage";
import { chronicleSystem, chronicleUser } from "./prompt";
import { resolveOpening, resolveTurn, suggestionsFor, type Resolution } from "./story";

function stampTurn(state: GameState, turn: number): GameState {
  const next = { ...state, turn };
  if (next.lastRoll) next.lastRoll = { ...next.lastRoll, turn };
  return next;
}

function slotLabel(playerName: string, bookId: BookId, state: GameState): string {
  return `${playerName} · ${bookById(bookId).title} · ${PLACES[state.location]}`;
}

export class GameEngine {
  private readonly locks = new Map<string, Promise<unknown>>();

  constructor(
    private readonly db: GameDb,
    private readonly llm: LlmProvider,
    private readonly images: ImageProvider,
  ) {}

  list(): CampaignSummary[] {
    return this.db.listCampaigns();
  }

  slot(): SaveSlot | null {
    const saved = this.db.getSaveSlot();
    if (!saved) return null;
    const row = this.db.getCampaign(saved.campaignId);
    if (!row) {
      this.db.clearSaveSlot();
      return null;
    }
    return this.toSlot(row, saved.label, saved.savedAt);
  }

  save(id: string): SaveSlot {
    const row = this.db.getCampaign(id);
    if (!row) throw new HttpError(404, "That expedition is not on this road.");
    const savedAt = new Date().toISOString();
    const label = slotLabel(row.playerName, row.bookId, row.state);
    this.db.writeSaveSlot(id, label, savedAt);
    return this.toSlot(row, label, savedAt);
  }

  get(id: string): CampaignView {
    return this.view(id);
  }

  async start(input: { playerName: unknown; motive: unknown; bookId?: unknown }): Promise<CampaignView> {
    const playerName = cleanName(input.playerName);
    const motive = cleanMotive(input.motive);
    const bookId = cleanBook(input.bookId);
    const prior = this.db.listMemoriesByPlayer(playerName).map((memory) => memory.text);
    const resolution = resolveOpening(playerName, motive, { bookId, priorMemories: prior });
    const prose = await this.speak(resolution, playerName, motive, [], null);
    const scene = await this.illustrate(resolution);
    const id = `c_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
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
        updatedAt: now,
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
          text: prose.narration,
        },
        ...prose.lines.map((entry) => ({
          turn: 1,
          role: "companion" as const,
          speaker: entry.speaker,
          companionId: entry.companionId,
          stance: entry.stance,
          mood: entry.mood,
          text: entry.text,
        })),
      ]);
      this.db.insertMemories(id, 1, resolution.newMemories);
    });
    return this.view(id);
  }

  async act(id: string, text: unknown): Promise<CampaignView> {
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
        action,
      );
      const scene = await this.illustrate(resolution);
      const turn = row.state.turn + 1;
      const state = stampTurn(resolution.state, turn);
      const now = new Date().toISOString();
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
            text: action,
          },
          {
            turn,
            role: "gm",
            speaker: "The Chronicle",
            companionId: null,
            stance: null,
            mood: null,
            text: prose.narration,
          },
          ...prose.lines.map((entry) => ({
            turn,
            role: "companion" as const,
            speaker: entry.speaker,
            companionId: entry.companionId,
            stance: entry.stance,
            mood: entry.mood,
            text: entry.text,
          })),
        ]);
        this.db.insertMemories(id, turn, resolution.newMemories);
        this.db.updateCampaign(id, state, scene, now);
        this.db.writeSaveSlot(id, label, now);
      });
      return this.view(id);
    });
  }

  delete(id: string): void {
    if (!this.db.deleteCampaign(id)) throw new HttpError(404, "That expedition is not on this road.");
  }

  private async speak(
    resolution: Resolution,
    playerName: string,
    motive: string,
    memories: string[],
    playerText: string | null,
  ): Promise<{ narration: string; lines: Resolution["lines"] }> {
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
        canonLines: resolution.lines,
      }),
      canon: { narration: resolution.narration, lines: resolution.lines },
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

  private async illustrate(resolution: Resolution): Promise<SceneView> {
    try {
      const image = await this.images.generate(resolution.scene);
      return {
        title: resolution.scene.title,
        alt: image.alt,
        dataUrl: image.dataUrl,
        location: resolution.scene.location,
        prompt: image.prompt,
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
        prompt: image.prompt,
      };
    }
  }

  private view(id: string): CampaignView {
    const row = this.db.getCampaign(id);
    if (!row) throw new HttpError(404, "That expedition is not on this road.");
    const bookId: BookId = row.bookId ?? row.state.bookId ?? "ashmarch";
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
        kit: row.state.partyKits[companion.id] ?? [],
      })),
    };
  }

  private toSlot(
    row: { id: string; bookId: BookId; playerName: string; motive: string; state: GameState },
    label: string,
    savedAt: string,
  ): SaveSlot {
    return {
      campaignId: row.id,
      savedAt,
      label,
      playerName: row.playerName,
      bookId: row.bookId,
      bookTitle: bookById(row.bookId).title,
      placeTitle: PLACES[row.state.location],
      ended: row.state.ended,
      motive: row.motive,
    };
  }

  private async withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(id) ?? Promise.resolve();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const current = prev.catch(() => undefined).then(() => gate);
    this.locks.set(id, current);
    await prev.catch(() => undefined);
    try {
      return await fn();
    } finally {
      release();
    }
  }
}
