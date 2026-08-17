import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AdminConfig } from "../config/config.js";
import type {
  AccessLog,
  AccessLogStats,
  AccessRecord,
} from "../monitoring/accessLog.js";
import { escapeHtml } from "../simulations/escape.js";

interface AdminRouteOptions {
  readonly admin: AdminConfig;
  readonly accessLog: AccessLog;
  readonly feedSummary: () => Readonly<Record<string, unknown>>;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function matches(supplied: string, expected: string): boolean {
  return timingSafeEqual(digest(supplied), digest(expected));
}

function credentialsFrom(
  request: FastifyRequest,
): { readonly user: string; readonly password: string } | undefined {
  const header = request.headers.authorization;

  if (typeof header !== "string" || !header.startsWith("Basic ")) {
    return undefined;
  }

  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const separator = decoded.indexOf(":");

  if (separator === -1) {
    return undefined;
  }

  return {
    user: decoded.slice(0, separator),
    password: decoded.slice(separator + 1),
  };
}

function row(record: AccessRecord): string {
  const cells = [
    record.timestamp,
    record.classification,
    String(record.statusCode),
    record.method,
    record.path,
    record.ip,
    record.userAgent,
    record.referer,
    record.simulationId,
    `${record.durationMs}ms`,
  ];

  return `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`;
}

function page(
  records: readonly AccessRecord[],
  stats: AccessLogStats,
  feeds: Readonly<Record<string, unknown>>,
): string {
  const headings = [
    "Time",
    "Class",
    "Status",
    "Method",
    "Path",
    "Address",
    "User agent",
    "Referer",
    "Simulation",
    "Duration",
  ];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ip-vulture access monitor</title>
<style>
body { font: 14px/1.5 system-ui, sans-serif; margin: 0; padding: 24px; background: #111; color: #eee; }
h1 { font-size: 18px; margin: 0 0 4px; }
p.note { color: #999; margin: 0 0 20px; }
table { border-collapse: collapse; width: 100%; font-size: 12px; }
th, td { border-bottom: 1px solid #333; padding: 6px 8px; text-align: left; vertical-align: top; }
th { position: sticky; top: 0; background: #1c1c1c; }
td { max-width: 320px; overflow-wrap: anywhere; }
dl { display: flex; flex-wrap: wrap; gap: 8px 24px; margin: 0 0 20px; }
dt { color: #999; }
dd { margin: 0 16px 0 0; font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
<h1>Access monitor</h1>
<p class="note">In-memory only. This history is lost when the process exits.</p>
<dl>
<dt>Retained</dt><dd>${escapeHtml(String(stats.retained))}</dd>
<dt>Recorded</dt><dd>${escapeHtml(String(stats.recorded))}</dd>
<dt>Suppressed</dt><dd>${escapeHtml(String(stats.suppressed))}</dd>
<dt>Feeds</dt><dd>${escapeHtml(String(feeds.loaded ?? 0))}</dd>
<dt>Blocklist ranges</dt><dd>${escapeHtml(String(feeds.ranges ?? 0))}</dd>
</dl>
<table>
<thead><tr>${headings.map((heading) => `<th>${heading}</th>`).join("")}</tr></thead>
<tbody>
${records.map(row).join("\n")}
</tbody>
</table>
</body>
</html>
`;
}

interface ListQuery {
  readonly classification?: string;
  readonly status?: string;
  readonly ip?: string;
  readonly limit?: string;
}

function selectRecords(
  records: readonly AccessRecord[],
  query: ListQuery,
): readonly AccessRecord[] {
  const limit = Number(query.limit ?? "");
  const filtered = records.filter((record) => {
    const classificationMatches =
      query.classification === undefined ||
      record.classification === query.classification;
    const statusMatches =
      query.status === undefined || String(record.statusCode) === query.status;
    const addressMatches =
      query.ip === undefined || record.ip.includes(query.ip);

    return classificationMatches && statusMatches && addressMatches;
  });

  return Number.isInteger(limit) && limit > 0
    ? filtered.slice(0, limit)
    : filtered;
}

async function adminRoutes(
  app: FastifyInstance,
  options: AdminRouteOptions,
): Promise<void> {
  const { admin, accessLog } = options;

  app.addHook("onRequest", async (request, reply) => {
    const supplied = credentialsFrom(request);

    const authorized =
      supplied !== undefined &&
      matches(supplied.user, admin.user) &&
      matches(supplied.password, admin.password);

    if (!authorized) {
      reply
        .status(401)
        .header("WWW-Authenticate", 'Basic realm="ip-vulture", charset="UTF-8"')
        .header("Cache-Control", "no-store")
        .send("");
    }
  });

  app.get<{ Querystring: ListQuery }>("/", async (request, reply) => {
    return reply
      .status(200)
      .header("Content-Type", "text/html; charset=utf-8")
      .header(
        "Content-Security-Policy",
        "default-src 'none'; style-src 'unsafe-inline'",
      )
      .header("Cache-Control", "no-store")
      .header("Referrer-Policy", "no-referrer")
      .header("X-Content-Type-Options", "nosniff")
      .send(
        page(
          selectRecords(accessLog.records(), request.query),
          accessLog.stats(),
          options.feedSummary(),
        ),
      );
  });

  app.get<{ Querystring: ListQuery }>("/json", async (request, reply) => {
    return reply
      .status(200)
      .header("Cache-Control", "no-store")
      .header("X-Content-Type-Options", "nosniff")
      .send({
        records: selectRecords(accessLog.records(), request.query),
        stats: accessLog.stats(),
        feeds: options.feedSummary(),
      });
  });
}

export { type AdminRouteOptions, adminRoutes };
