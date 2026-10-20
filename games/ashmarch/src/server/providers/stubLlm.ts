import type { LlmProvider, LlmRequest, LlmResponse } from "./types";

/**
 * Local chronicle. Returns the rules engine's authored scene so the game
 * runs with no API key and no network. The request still carries the full
 * prompt, memories, and canon so the call shape matches the live providers.
 */
export class StubLlmProvider implements LlmProvider {
  readonly id = "stub";

  async complete(request: LlmRequest): Promise<LlmResponse> {
    if (!request.system || !request.user) {
      throw new Error("Stub chronicle received an empty prompt.");
    }
    return {
      narration: request.canon.narration,
      lines: request.canon.lines.map((line) => ({ ...line })),
    };
  }
}
