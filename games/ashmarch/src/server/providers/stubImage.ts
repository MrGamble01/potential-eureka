import type { ImageProvider, ImageRequest, ImageResult } from "./types";
import { renderScene } from "../game/scenes";

export class StubImageProvider implements ImageProvider {
  readonly id = "stub";

  async generate(request: ImageRequest): Promise<ImageResult> {
    const svg = renderScene(request);
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    return {
      mime: "image/svg+xml",
      dataUrl,
      alt: request.alt,
      prompt: request.prompt,
    };
  }
}
