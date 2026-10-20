import type { BookId } from "../shared/types";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function cleanName(raw: unknown): string {
  if (typeof raw !== "string") throw new HttpError(400, "Give a name the road can hold.");
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < 1 || name.length > 40) {
    throw new HttpError(400, "Give a name the road can hold (1–40 characters).");
  }
  if (!/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} '’.-]{0,39}$/u.test(name)) {
    throw new HttpError(400, "Use a name made of letters, numbers, spaces, and simple punctuation.");
  }
  return name;
}

export function cleanMotive(raw: unknown): string {
  if (typeof raw !== "string") throw new HttpError(400, "Say why you took the commission.");
  const motive = raw.replace(/[\u0000-\u001F]+/g, " ").replace(/\s+/g, " ").trim();
  if (motive.length < 1 || motive.length > 200) {
    throw new HttpError(400, "Keep the reason between 1 and 200 characters.");
  }
  return motive;
}

export function cleanBook(raw: unknown): BookId {
  if (raw === undefined || raw === null || raw === "") return "ashmarch";
  if (raw === "ashmarch" || raw === "lumenferry") return raw;
  throw new HttpError(400, "Choose Ashmarch or Lumenferry.");
}

export function cleanAction(raw: unknown): string {
  if (typeof raw !== "string") throw new HttpError(400, "Say what you do.");
  const text = raw.replace(/[\u0000-\u001F]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text) throw new HttpError(400, "Say what you do.");
  if (text.length > 500) {
    throw new HttpError(400, "Keep it to 500 characters. The road is listening, not filing.");
  }
  return text;
}
