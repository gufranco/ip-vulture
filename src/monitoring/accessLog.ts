const MAX_PATH_LENGTH = 2048;
const MAX_TEXT_LENGTH = 512;
const MAX_HOST_LENGTH = 253;

const ACCESS_RECORD_FIELDS = Object.freeze([
  "timestamp",
  "method",
  "path",
  "statusCode",
  "ip",
  "userAgent",
  "referer",
  "host",
  "protocol",
  "durationMs",
  "simulationId",
  "classification",
] as const);

interface AccessRecord {
  readonly timestamp: string;
  readonly method: string;
  readonly path: string;
  readonly statusCode: number;
  readonly ip: string;
  readonly userAgent: string;
  readonly referer: string;
  readonly host: string;
  readonly protocol: string;
  readonly durationMs: number;
  readonly simulationId: string;
  readonly classification: string;
}

interface AccessLogOptions {
  readonly capacity: number;
}

interface ReadOptions {
  readonly limit?: number;
}

interface AccessLogStats {
  readonly recorded: number;
  readonly suppressed: number;
  readonly retained: number;
  readonly byClassification: Readonly<Record<string, number>>;
}

interface AccessLog {
  record(input: Readonly<Record<string, unknown>>): void;
  suppress(): void;
  records(options?: ReadOptions): readonly AccessRecord[];
  size(): number;
  stats(): AccessLogStats;
}

function text(value: unknown, limit: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.length > limit ? value.slice(0, limit) : value;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toRecord(input: Readonly<Record<string, unknown>>): AccessRecord {
  return Object.freeze({
    timestamp: text(input.timestamp, 32),
    method: text(input.method, 16),
    path: text(input.path, MAX_PATH_LENGTH),
    statusCode: count(input.statusCode),
    ip: text(input.ip, 64),
    userAgent: text(input.userAgent, MAX_TEXT_LENGTH),
    referer: text(input.referer, MAX_TEXT_LENGTH),
    host: text(input.host, MAX_HOST_LENGTH),
    protocol: text(input.protocol, 16),
    durationMs: count(input.durationMs),
    simulationId: text(input.simulationId, 64),
    classification: text(input.classification, 32),
  });
}

function createAccessLog(options: AccessLogOptions): AccessLog {
  let entries: readonly AccessRecord[] = [];
  let recorded = 0;
  let suppressed = 0;
  let byClassification: Readonly<Record<string, number>> = {};

  return Object.freeze({
    record(input: Readonly<Record<string, unknown>>): void {
      const entry = toRecord(input);

      entries = [entry, ...entries].slice(0, options.capacity);
      recorded += 1;
      byClassification = {
        ...byClassification,
        [entry.classification]:
          (byClassification[entry.classification] ?? 0) + 1,
      };
    },

    suppress(): void {
      suppressed += 1;
    },

    records(readOptions?: ReadOptions): readonly AccessRecord[] {
      const limit = readOptions?.limit;

      return limit === undefined ? entries : entries.slice(0, limit);
    },

    size(): number {
      return entries.length;
    },

    stats(): AccessLogStats {
      return Object.freeze({
        recorded,
        suppressed,
        retained: entries.length,
        byClassification,
      });
    },
  });
}

export {
  ACCESS_RECORD_FIELDS,
  type AccessLog,
  type AccessLogOptions,
  type AccessLogStats,
  type AccessRecord,
  createAccessLog,
  MAX_HOST_LENGTH,
  MAX_PATH_LENGTH,
  MAX_TEXT_LENGTH,
};
