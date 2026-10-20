import type { ImageProvider, ImageRequest, ImageResult } from "./types";

type FetchLike = typeof fetch;

export class HttpImageProvider implements ImageProvider {
  readonly id = "http";

  constructor(
    private readonly options: { apiKey: string; apiUrl: string; fetchImpl?: FetchLike },
  ) {}

  async generate(request: ImageRequest): Promise<ImageResult> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const response = await fetchImpl(this.options.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: request.prompt,
        location: request.location,
        mood: request.mood,
        title: request.title,
      }),
    });
    if (!response.ok) {
      throw new Error(`Image provider failed (${response.status}).`);
    }
    const body = (await response.json()) as { dataUrl?: string; b64?: string; mime?: string; alt?: string };
    if (typeof body.dataUrl === "string" && body.dataUrl.startsWith("data:image/")) {
      return {
        mime: mimeOf(body.dataUrl),
        dataUrl: body.dataUrl,
        alt: body.alt || request.alt,
        prompt: request.prompt,
      };
    }
    if (typeof body.b64 === "string" && body.b64.length > 32) {
      const mime = body.mime === "image/png" || body.mime === "image/webp" || body.mime === "image/jpeg"
        ? body.mime
        : "image/png";
      return {
        mime,
        dataUrl: `data:${mime};base64,${body.b64}`,
        alt: body.alt || request.alt,
        prompt: request.prompt,
      };
    }
    throw new Error("Image provider returned no picture.");
  }
}

function mimeOf(dataUrl: string): ImageResult["mime"] {
  if (dataUrl.startsWith("data:image/svg+xml")) return "image/svg+xml";
  if (dataUrl.startsWith("data:image/webp")) return "image/webp";
  if (dataUrl.startsWith("data:image/jpeg")) return "image/jpeg";
  return "image/png";
}
