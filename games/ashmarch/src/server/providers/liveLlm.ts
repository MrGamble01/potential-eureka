import { companionById } from "../../shared/companions";
import type { CompanionId, DialogueLine, Stance } from "../../shared/types";
import type { LlmProvider, LlmRequest, LlmResponse } from "./types";

type FetchLike = typeof fetch;

const SPEAKERS: Record<string, CompanionId> = {
  "mara voss": "mara",
  mara: "mara",
  "ivo quill": "ivo",
  ivo: "ivo",
  sable: "sable",
  "bram holt": "bram",
  bram: "bram",
  "ness kite": "ness",
  ness: "ness",
  pell: "pell",
};

const COMPANION_IDS = new Set<CompanionId>(["mara", "ivo", "sable", "bram", "ness", "pell"]);

function asStance(value: unknown): Stance {
  if (value === "for" || value === "against" || value === "aside") return value;
  return "aside";
}

export function coerceChronicle(raw: unknown, _canon: LlmRequest["canon"]): LlmResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.narration !== "string" || record.narration.trim().length < 40) return null;
  if (!Array.isArray(record.lines) || record.lines.length < 2) return null;
  const lines: DialogueLine[] = [];
  for (const entry of record.lines) {
    if (!entry || typeof entry !== "object") return null;
    const line = entry as Record<string, unknown>;
    if (typeof line.text !== "string" || line.text.trim().length < 2) return null;
    const companionFromField =
      typeof line.companionId === "string" && COMPANION_IDS.has(line.companionId as CompanionId)
        ? (line.companionId as CompanionId)
        : null;
    const speaker = typeof line.speaker === "string" ? line.speaker : "";
    const companionId = companionFromField ?? SPEAKERS[speaker.trim().toLowerCase()];
    if (!companionId) return null;
    const profile = companionById(companionId);
    lines.push({
      companionId,
      speaker: profile.name,
      text: line.text.trim(),
      mood: typeof line.mood === "string" && line.mood.trim() ? line.mood.trim() : "present",
      stance: asStance(line.stance),
    });
  }
  const ids = new Set(lines.map((line) => line.companionId));
  if (ids.size < 2) return null;
  return { narration: record.narration.trim(), lines };
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Provider returned no JSON object.");
  return JSON.parse(text.slice(start, end + 1));
}

export class OpenAiLlmProvider implements LlmProvider {
  readonly id = "openai";

  constructor(
    private readonly options: { apiKey: string; model: string; fetchImpl?: FetchLike },
  ) {}

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.options.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`OpenAI chronicle failed (${response.status}).`);
    }
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI chronicle returned an empty scene.");
    const coerced = coerceChronicle(extractJson(content), request.canon);
    if (!coerced) throw new Error("OpenAI chronicle returned an unusable scene.");
    return coerced;
  }
}

export class AnthropicLlmProvider implements LlmProvider {
  readonly id = "anthropic";

  constructor(
    private readonly options: { apiKey: string; model: string; fetchImpl?: FetchLike },
  ) {}

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const response = await fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.options.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.options.model,
        max_tokens: 1400,
        system: request.system,
        messages: [{ role: "user", content: request.user }],
      }),
    });
    if (!response.ok) {
      throw new Error(`Anthropic chronicle failed (${response.status}).`);
    }
    const body = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const text = body.content?.find((part) => part.type === "text")?.text;
    if (!text) throw new Error("Anthropic chronicle returned an empty scene.");
    const coerced = coerceChronicle(extractJson(text), request.canon);
    if (!coerced) throw new Error("Anthropic chronicle returned an unusable scene.");
    return coerced;
  }
}
