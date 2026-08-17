import type { ProtocolProfile } from "./protocol.js";

enum Era {
  Nineties = "1990s",
  Thousands = "2000s",
  Tens = "2010s",
  Twenties = "2020s",
}

enum Genre {
  Vendor = "vendor",
  Creative = "creative",
}

const SUPPORTED_STATUS_CODES: readonly number[] = Object.freeze([
  400, 401, 403, 404, 410, 500, 502, 503, 504,
]);

const statusTexts: ReadonlyMap<number, string> = new Map([
  [400, "Bad Request"],
  [401, "Unauthorized"],
  [403, "Forbidden"],
  [404, "Not Found"],
  [410, "Gone"],
  [500, "Internal Server Error"],
  [502, "Bad Gateway"],
  [503, "Service Unavailable"],
  [504, "Gateway Timeout"],
]);

function statusText(code: number): string {
  return statusTexts.get(code) ?? "Error";
}

function charsetOf(contentType: string | undefined): string {
  if (contentType === undefined) {
    return "utf-8";
  }

  const match = /;\s*charset\s*=\s*([^;\s]+)/i.exec(contentType);

  return match?.[1]?.toLowerCase() ?? "utf-8";
}

interface RenderContext {
  readonly path: string;
  readonly method: string;
  readonly statusCode: number;
  readonly host: string;
  readonly now: Date;
}

interface Simulation {
  readonly id: string;
  readonly displayName: string;
  readonly era: Era;
  readonly genre: Genre;
  readonly statusCodes: readonly number[];
  readonly protocol: ProtocolProfile;
  headers(context: RenderContext): Readonly<Record<string, string>>;
  render(context: RenderContext): string;
}

export {
  charsetOf,
  Era,
  Genre,
  type RenderContext,
  type Simulation,
  SUPPORTED_STATUS_CODES,
  statusText,
};
