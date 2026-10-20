import type { DialogueLine, SceneBrief } from "../../shared/types";

export type LlmRequest = {
  system: string;
  user: string;
  canon: {
    narration: string;
    lines: DialogueLine[];
  };
};

export type LlmResponse = {
  narration: string;
  lines: DialogueLine[];
};

export interface LlmProvider {
  readonly id: string;
  complete(request: LlmRequest): Promise<LlmResponse>;
}

export type ImageRequest = SceneBrief;

export type ImageResult = {
  mime: "image/svg+xml" | "image/png" | "image/webp" | "image/jpeg";
  dataUrl: string;
  alt: string;
  prompt: string;
};

export interface ImageProvider {
  readonly id: string;
  generate(request: ImageRequest): Promise<ImageResult>;
}
