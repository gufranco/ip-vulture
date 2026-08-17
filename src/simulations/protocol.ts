type ConnectionPolicy = "never" | "always" | "on-close";

interface ProtocolProfile {
  readonly headerOrder: readonly string[];
  readonly connectionHeader: ConnectionPolicy;
  readonly keepAliveHeader: boolean;
  readonly unknownMethodStatus: number;
  readonly traceStatus: number;
  readonly optionsStarStatus: number;
  readonly badVersionStatus: number;
  readonly allow: string;
  readonly reasonPhrases: ReadonlyMap<number, string>;
}

const DEFAULT_REASONS: ReadonlyMap<number, string> = new Map([
  [200, "OK"],
  [400, "Bad Request"],
  [401, "Unauthorized"],
  [403, "Forbidden"],
  [404, "Not Found"],
  [405, "Method Not Allowed"],
  [410, "Gone"],
  [500, "Internal Server Error"],
  [501, "Not Implemented"],
  [502, "Bad Gateway"],
  [503, "Service Unavailable"],
  [504, "Gateway Timeout"],
  [505, "HTTP Version Not Supported"],
]);

const APACHE_PROTOCOL: ProtocolProfile = Object.freeze({
  headerOrder: Object.freeze([
    "Date",
    "Server",
    "Allow",
    "Content-Length",
    "Connection",
    "Content-Type",
  ]),
  connectionHeader: "on-close",
  keepAliveHeader: false,
  unknownMethodStatus: 501,
  traceStatus: 200,
  optionsStarStatus: 200,
  badVersionStatus: 404,
  allow: "GET,POST,OPTIONS,HEAD,TRACE",
  reasonPhrases: DEFAULT_REASONS,
});

const NGINX_PROTOCOL: ProtocolProfile = Object.freeze({
  headerOrder: Object.freeze([
    "Server",
    "Date",
    "Content-Type",
    "Content-Length",
    "Connection",
  ]),
  connectionHeader: "always",
  keepAliveHeader: false,
  unknownMethodStatus: 405,
  traceStatus: 405,
  optionsStarStatus: 400,
  badVersionStatus: 505,
  allow: "GET, HEAD",
  reasonPhrases: new Map([...DEFAULT_REASONS, [405, "Not Allowed"]]),
});

const IIS_PROTOCOL: ProtocolProfile = Object.freeze({
  headerOrder: Object.freeze([
    "Content-Type",
    "Server",
    "X-Powered-By",
    "X-AspNet-Version",
    "Date",
    "Content-Length",
    "Connection",
  ]),
  connectionHeader: "always",
  keepAliveHeader: false,
  unknownMethodStatus: 501,
  traceStatus: 501,
  optionsStarStatus: 200,
  badVersionStatus: 400,
  allow: "GET, HEAD, OPTIONS, TRACE",
  reasonPhrases: DEFAULT_REASONS,
});

const MINIMAL_PROTOCOL: ProtocolProfile = Object.freeze({
  headerOrder: Object.freeze([
    "Content-Type",
    "Server",
    "Date",
    "Content-Length",
    "Connection",
  ]),
  connectionHeader: "always",
  keepAliveHeader: false,
  unknownMethodStatus: 405,
  traceStatus: 405,
  optionsStarStatus: 405,
  badVersionStatus: 400,
  allow: "GET, HEAD",
  reasonPhrases: DEFAULT_REASONS,
});

const CADDY_PROTOCOL: ProtocolProfile = Object.freeze({
  headerOrder: Object.freeze([
    "Server",
    "Date",
    "Content-Length",
    "Content-Type",
  ]),
  connectionHeader: "never",
  keepAliveHeader: false,
  unknownMethodStatus: 404,
  traceStatus: 404,
  optionsStarStatus: 404,
  badVersionStatus: 400,
  allow: "GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS",
  reasonPhrases: DEFAULT_REASONS,
});

const TRAEFIK_PROTOCOL: ProtocolProfile = Object.freeze({
  headerOrder: Object.freeze([
    "Content-Type",
    "X-Content-Type-Options",
    "Date",
    "Content-Length",
  ]),
  connectionHeader: "never",
  keepAliveHeader: false,
  unknownMethodStatus: 404,
  traceStatus: 404,
  optionsStarStatus: 404,
  badVersionStatus: 400,
  allow: "GET, HEAD, POST, PUT, DELETE, OPTIONS",
  reasonPhrases: DEFAULT_REASONS,
});

const TOMCAT_PROTOCOL: ProtocolProfile = Object.freeze({
  headerOrder: Object.freeze([
    "Content-Type",
    "Content-Length",
    "Date",
    "Connection",
    "Keep-Alive",
  ]),
  connectionHeader: "always",
  keepAliveHeader: true,
  unknownMethodStatus: 501,
  traceStatus: 405,
  optionsStarStatus: 200,
  badVersionStatus: 400,
  allow: "GET, HEAD, POST, OPTIONS",
  reasonPhrases: DEFAULT_REASONS,
});

function canonicalName(profile: ProtocolProfile, supplied: string): string {
  const match = profile.headerOrder.find(
    (name) => name.toLowerCase() === supplied.toLowerCase(),
  );

  return match ?? supplied;
}

function orderHeaders(
  profile: ProtocolProfile,
  headers: Readonly<Record<string, string>>,
): readonly (readonly [string, string])[] {
  const normalized = Object.entries(headers)
    .filter(([, value]) => value.length > 0)
    .map(([name, value]) => [canonicalName(profile, name), value] as const);

  const ranked = normalized.map((entry) => {
    const index = profile.headerOrder.indexOf(entry[0]);

    return {
      entry,
      rank: index === -1 ? profile.headerOrder.length : index,
    };
  });

  return Object.freeze(
    ranked
      .toSorted((left, right) => left.rank - right.rank)
      .map((item) => item.entry),
  );
}

function buildHeaderLines(
  profile: ProtocolProfile,
  headers: Readonly<Record<string, string>>,
): readonly string[] {
  return Object.freeze(orderHeaders(profile, headers).flat());
}

function reasonPhrase(profile: ProtocolProfile, statusCode: number): string {
  return profile.reasonPhrases.get(statusCode) ?? "Error";
}

export {
  APACHE_PROTOCOL,
  buildHeaderLines,
  CADDY_PROTOCOL,
  type ConnectionPolicy,
  IIS_PROTOCOL,
  MINIMAL_PROTOCOL,
  NGINX_PROTOCOL,
  orderHeaders,
  type ProtocolProfile,
  reasonPhrase,
  TOMCAT_PROTOCOL,
  TRAEFIK_PROTOCOL,
};
