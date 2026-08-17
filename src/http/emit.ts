import {
  buildHeaderLines,
  type ProtocolProfile,
  reasonPhrase,
} from "../simulations/protocol.js";

interface RawResponseTarget {
  removeHeader?(name: string): void;
  writeHead(statusCode: number, reason: string, headers: string[]): unknown;
  end(body: Buffer): unknown;
}

interface EmitOptions {
  readonly profile: ProtocolProfile;
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Buffer;
  readonly keepAlive: boolean;
  readonly serverHeader: string;
  readonly now: Date;
  readonly extraHeaders?: Readonly<Record<string, string>>;
  readonly omitBody?: boolean;
}

function connectionValue(profile: ProtocolProfile, keepAlive: boolean): string {
  if (profile.connectionHeader === "never") {
    return "";
  }

  if (profile.connectionHeader === "on-close") {
    return keepAlive ? "" : "close";
  }

  return keepAlive ? "keep-alive" : "close";
}

function composeHeaders(
  options: EmitOptions,
): Readonly<Record<string, string>> {
  const connection = connectionValue(options.profile, options.keepAlive);
  const wantsKeepAlive = options.profile.keepAliveHeader && options.keepAlive;

  return Object.freeze({
    ...options.headers,
    ...options.extraHeaders,
    Date: options.now.toUTCString(),
    "Content-Length": String(options.body.length),
    ...(options.serverHeader.length > 0
      ? { Server: options.serverHeader }
      : {}),
    ...(connection.length > 0 ? { Connection: connection } : {}),
    ...(wantsKeepAlive ? { "Keep-Alive": "timeout=5, max=100" } : {}),
  });
}

function emitResponse(target: RawResponseTarget, options: EmitOptions): void {
  const headers = composeHeaders(options);

  target.removeHeader?.("Connection");
  target.removeHeader?.("Keep-Alive");

  target.writeHead(
    options.statusCode,
    reasonPhrase(options.profile, options.statusCode),
    [...buildHeaderLines(options.profile, headers)],
  );

  target.end(options.omitBody === true ? Buffer.alloc(0) : options.body);
}

export { type EmitOptions, emitResponse, type RawResponseTarget };
