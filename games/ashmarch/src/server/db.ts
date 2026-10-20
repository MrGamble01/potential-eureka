import type {
  BookId,
  CampaignSummary,
  CompanionId,
  GameState,
  MemoryKind,
  MemoryRecord,
  SceneView,
  Stance,
  TranscriptMessage,
  TranscriptRole,
} from "../shared/types";
import { bookById, PLACES } from "../shared/companions";

export type CampaignRow = {
  id: string;
  bookId: BookId;
  playerName: string;
  motive: string;
  state: GameState;
  scene: SceneView;
  createdAt: string;
  updatedAt: string;
};

type MessageInsert = Omit<TranscriptMessage, "id" | "campaignId">;

type StoredMessage = MessageInsert & { id: number; campaignId: string };
type StoredMemory = { id: number; campaignId: string; turn: number; kind: MemoryKind; text: string };

type ChronicleFile = {
  campaigns: CampaignRow[];
  messages: StoredMessage[];
  memories: StoredMemory[];
  saveSlot: { campaignId: string; label: string; savedAt: string } | null;
  nextMessageId: number;
  nextMemoryId: number;
};

export type ChronicleStorage = {
  load(): ChronicleFile | null;
  save(file: ChronicleFile): void;
};

const STORAGE_KEY = "ashmarch-chronicle-v1";

function emptyFile(): ChronicleFile {
  return { campaigns: [], messages: [], memories: [], saveSlot: null, nextMessageId: 1, nextMemoryId: 1 };
}

export function browserStorage(): ChronicleStorage {
  return {
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as ChronicleFile;
        if (!parsed || !Array.isArray(parsed.campaigns)) return null;
        return parsed;
      } catch {
        return null;
      }
    },
    save(file) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
    },
  };
}

export function memoryStorage(): ChronicleStorage {
  let file: ChronicleFile | null = null;
  return {
    load() {
      return file ? structuredClone(file) : null;
    },
    save(next) {
      file = structuredClone(next);
    },
  };
}

/** The Chronicle's journal. Same records the SQLite book kept: campaigns, transcript, memories, and one continue slot. This build writes them in the browser. */
export class GameDb {
  private file: ChronicleFile;
  private readonly storage: ChronicleStorage;

  constructor(storage: ChronicleStorage = browserStorage()) {
    this.storage = storage;
    const loaded = storage.load();
    this.file = loaded ?? emptyFile();
    this.file.campaigns ??= [];
    this.file.messages ??= [];
    this.file.memories ??= [];
    this.file.saveSlot ??= null;
    this.file.nextMessageId ??= 1;
    this.file.nextMemoryId ??= 1;
  }

  close(): void {}

  transaction(fn: () => void): void {
    const snapshot = structuredClone(this.file);
    try {
      fn();
      this.storage.save(this.file);
    } catch (error) {
      this.file = snapshot;
      this.storage.save(this.file);
      throw error;
    }
  }

  insertCampaign(row: CampaignRow): void {
    this.file.campaigns.push(structuredClone(row));
  }

  updateCampaign(id: string, state: GameState, scene: SceneView, updatedAt: string): void {
    const row = this.file.campaigns.find((campaign) => campaign.id === id);
    if (!row) throw new Error(`Campaign ${id} disappeared during save.`);
    row.state = structuredClone(state);
    row.scene = structuredClone(scene);
    row.updatedAt = updatedAt;
  }

  insertMessages(campaignId: string, messages: MessageInsert[]): void {
    for (const message of messages) {
      this.file.messages.push({
        ...message,
        id: this.file.nextMessageId++,
        campaignId,
      });
    }
  }

  insertMemories(campaignId: string, turn: number, memories: { kind: MemoryKind; text: string }[]): void {
    for (const memory of memories) {
      this.file.memories.push({
        id: this.file.nextMemoryId++,
        campaignId,
        turn,
        kind: memory.kind,
        text: memory.text,
      });
    }
  }

  getCampaign(id: string): CampaignRow | null {
    const row = this.file.campaigns.find((campaign) => campaign.id === id);
    if (!row) return null;
    return {
      ...structuredClone(row),
      bookId: row.bookId === "lumenferry" ? "lumenferry" : "ashmarch",
      state: normalizeState(row.state),
    };
  }

  listMessages(campaignId: string): TranscriptMessage[] {
    return this.file.messages
      .filter((message) => message.campaignId === campaignId)
      .map((row) => ({
        id: row.id,
        campaignId: row.campaignId,
        turn: row.turn,
        role: row.role as TranscriptRole,
        speaker: row.speaker,
        companionId: (row.companionId as CompanionId | null) ?? null,
        stance: (row.stance as Stance | null) ?? null,
        mood: row.mood,
        text: row.text,
      }));
  }

  listMemories(campaignId: string): MemoryRecord[] {
    return this.file.memories
      .filter((memory) => memory.campaignId === campaignId)
      .map((row) => ({
        id: row.id,
        campaignId: row.campaignId,
        turn: row.turn,
        kind: row.kind,
        text: row.text,
      }));
  }

  listCampaigns(): CampaignSummary[] {
    return [...this.file.campaigns]
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .map((row) => {
        const state = normalizeState(row.state);
        const bookId: BookId = row.bookId === "lumenferry" ? "lumenferry" : "ashmarch";
        const last = [...this.file.messages].reverse().find((message) => message.campaignId === row.id);
        return {
          id: row.id,
          bookId,
          bookTitle: bookById(bookId).title,
          playerName: row.playerName,
          motive: row.motive,
          updatedAt: row.updatedAt,
          placeTitle: PLACES[state.location],
          ended: state.ended,
          ending: state.flags.ending,
          memoryCount: this.file.memories.filter((memory) => memory.campaignId === row.id).length,
          lastLine: last?.text ?? "",
        };
      });
  }

  listMemoriesByPlayer(playerName: string, exceptCampaignId?: string): MemoryRecord[] {
    const name = playerName.toLowerCase();
    const ids = new Set(
      this.file.campaigns
        .filter((campaign) => campaign.playerName.toLowerCase() === name && campaign.id !== exceptCampaignId)
        .map((campaign) => campaign.id),
    );
    return this.file.memories
      .filter((memory) => ids.has(memory.campaignId))
      .map((row) => ({
        id: row.id,
        campaignId: row.campaignId,
        turn: row.turn,
        kind: row.kind,
        text: row.text,
      }));
  }

  deleteCampaign(id: string): boolean {
    const before = this.file.campaigns.length;
    this.file.campaigns = this.file.campaigns.filter((campaign) => campaign.id !== id);
    if (this.file.campaigns.length === before) return false;
    this.file.messages = this.file.messages.filter((message) => message.campaignId !== id);
    this.file.memories = this.file.memories.filter((memory) => memory.campaignId !== id);
    if (this.file.saveSlot?.campaignId === id) this.file.saveSlot = null;
    this.storage.save(this.file);
    return true;
  }

  writeSaveSlot(campaignId: string, label: string, savedAt: string): void {
    this.file.saveSlot = { campaignId, label, savedAt };
    this.storage.save(this.file);
  }

  getSaveSlot(): { campaignId: string; label: string; savedAt: string } | null {
    return this.file.saveSlot ? { ...this.file.saveSlot } : null;
  }

  clearSaveSlot(): void {
    this.file.saveSlot = null;
    this.storage.save(this.file);
  }
}

function normalizeState(state: GameState): GameState {
  return { ...state, lastRoll: state.lastRoll ?? null };
}
