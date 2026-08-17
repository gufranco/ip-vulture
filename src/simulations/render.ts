import type { DisclosureMode } from "../config/config.js";
import { applyDisclosure } from "./disclosure.js";
import {
  charsetOf,
  type RenderContext,
  type Simulation,
} from "./simulation.js";

interface RenderRequest {
  readonly url: string;
  readonly method: string;
  readonly host: string;
}

interface RenderInput {
  readonly simulation: Simulation;
  readonly statusCode: number;
  readonly disclosure: DisclosureMode;
  readonly request: RenderRequest;
  readonly now?: Date;
}

interface RenderedResponse {
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Buffer;
}

const LATIN1_CHARSETS: ReadonlySet<string> = new Set([
  "iso-8859-1",
  "latin1",
  "windows-1252",
  "us-ascii",
]);

function pathOf(url: string): string {
  const separator = url.search(/[?#]/);
  const path = separator === -1 ? url : url.slice(0, separator);

  return path.length === 0 ? "/" : path;
}

function encodeBody(body: string, charset: string): Buffer {
  if (LATIN1_CHARSETS.has(charset)) {
    return Buffer.from(body, "latin1");
  }

  return Buffer.from(body, "utf8");
}

function renderSimulation(input: RenderInput): RenderedResponse {
  const context: RenderContext = {
    path: pathOf(input.request.url),
    method: input.request.method,
    statusCode: input.statusCode,
    host: input.request.host,
    now: input.now ?? new Date(),
  };

  const simulationHeaders = input.simulation.headers(context);
  const body = input.simulation.render(context);
  const contentType = simulationHeaders["Content-Type"];

  const disclosed = applyDisclosure(
    input.disclosure,
    body,
    contentType,
    simulationHeaders,
  );

  const encoded = encodeBody(disclosed.body, charsetOf(contentType));

  return Object.freeze({
    statusCode: input.statusCode,
    headers: Object.freeze({
      ...disclosed.headers,
      "Content-Length": String(encoded.length),
    }),
    body: encoded,
  });
}

export {
  pathOf,
  type RenderedResponse,
  type RenderInput,
  type RenderRequest,
  renderSimulation,
};
