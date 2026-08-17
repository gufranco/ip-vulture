import type { FastifyInstance } from "fastify";
import { createAlerter, type Digest } from "./alerts/digest.js";
import { createSmtpTransport } from "./alerts/mailer.js";
import { buildApp } from "./app.js";
import { type Config, loadConfig } from "./config/config.js";
import {
  EMPTY_SNAPSHOT,
  type FeedSnapshot,
  loadFeeds,
  REPUTATION_FEEDS,
} from "./defense/feeds.js";
import { createGeoLookup } from "./geo/lookup.js";
import { type AccessRecord, createAccessLog } from "./monitoring/accessLog.js";
import { createSelector, simulationIds } from "./simulations/catalogue.js";

interface BootstrapLogger {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
}

interface BootstrapOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly logger?: BootstrapLogger;
  readonly fetcher?: typeof fetch;
}

interface Bootstrapped {
  readonly app: FastifyInstance;
  readonly config: Config;
  readonly stop: () => void;
}

const silentLogger: BootstrapLogger = {
  info: () => undefined,
  warn: () => undefined,
};

function digestBody(digest: Digest): string {
  const lines = digest.records.map((record: AccessRecord) =>
    [
      `${record.timestamp}  ${record.classification}  ${String(record.statusCode)}  ${record.method}  ${record.ip}  ${record.path}`,
      `    user-agent: ${record.userAgent}`,
      `    referer:    ${record.referer}`,
      `    host:       ${record.host}  protocol: ${record.protocol}  duration: ${String(record.durationMs)}ms`,
    ].join("\n"),
  );

  const omittedNote =
    digest.omitted > 0
      ? `Showing the most recent ${String(digest.records.length)}; ${String(digest.omitted)} older event(s) in this window are omitted.`
      : "";

  return [
    `ip-vulture recorded ${String(digest.count)} access event(s).`,
    `Window: ${digest.firstAt} to ${digest.lastAt}`,
    omittedNote,
    "",
    "This message contains only technical request metadata.",
    "The full history lives in memory and is lost when the process exits.",
    "",
    ...lines,
    "",
  ].join("\n");
}

async function fetchSnapshot(
  config: Config,
  logger: BootstrapLogger,
  fetcher: typeof fetch,
): Promise<FeedSnapshot> {
  if (!config.feeds.enabled) {
    logger.info({}, "reputation feeds are disabled");

    return EMPTY_SNAPSHOT;
  }

  const selected = REPUTATION_FEEDS.filter((feed) =>
    config.feeds.names.includes(feed.name),
  );

  const budget = new Promise<FeedSnapshot>((resolve) => {
    const timer = setTimeout(
      () => resolve(EMPTY_SNAPSHOT),
      config.feeds.startupTimeoutMs,
    );

    timer.unref?.();
  });

  const snapshot = await Promise.race([
    loadFeeds({
      feeds: selected,
      fetcher: (url, init) => fetcher(url, init),
      timeoutMs: config.feeds.perFeedTimeoutMs,
      maxBytes: config.feeds.maxBytes,
    }),
    budget,
  ]);

  for (const failure of snapshot.failures) {
    logger.warn(
      { feed: failure.name, reason: failure.reason },
      "reputation feed failed to load",
    );
  }

  logger.info(
    {
      loaded: snapshot.loadedFeeds.length,
      requested: selected.length,
      ranges: snapshot.reputation.size,
    },
    "reputation feeds loaded",
  );

  if (config.feeds.required && snapshot.loadedFeeds.length === 0) {
    throw new Error(
      "FEEDS_REQUIRED is true and no reputation feed could be loaded. Refusing to start unfiltered.",
    );
  }

  return snapshot;
}

async function bootstrap(
  options: BootstrapOptions = {},
): Promise<Bootstrapped> {
  const env = options.env ?? process.env;
  const logger = options.logger ?? silentLogger;
  const fetcher = options.fetcher ?? fetch;

  const config = loadConfig(env, { simulationIds: simulationIds() });

  let snapshot = await fetchSnapshot(config, logger, fetcher);

  const accessLog = createAccessLog({ capacity: config.monitoring.capacity });

  const transport = config.alerts.enabled
    ? createSmtpTransport({
        smtp: config.alerts.smtp,
        timeoutMs: config.geo.timeoutMs,
      })
    : undefined;

  const alerts = createAlerter({
    enabled: config.alerts.enabled,
    windowSeconds: config.alerts.windowSeconds,
    maxPerHour: config.alerts.maxPerHour,
    maxQueued: config.alerts.maxQueued,
    send: async (digest) => {
      if (transport === undefined) {
        return;
      }

      await transport.send({
        from: config.alerts.from,
        to: config.alerts.to,
        subject: `ip-vulture: ${String(digest.count)} access event(s)`,
        body: digestBody(digest),
      });
    },
    onFailure: (error) =>
      logger.warn({ err: String(error) }, "alert delivery failed"),
  });

  const geo = createGeoLookup({
    config: config.geo,
    fetcher: (url, init) => fetcher(url, init),
    onFailure: (reason) => logger.warn({ reason }, "geolocation lookup failed"),
  });

  const refreshTimer =
    config.feeds.enabled && config.feeds.refreshMinutes > 0
      ? setInterval(() => {
          void fetchSnapshot(config, logger, fetcher)
            .then((refreshed) => {
              if (refreshed.loadedFeeds.length > 0) {
                snapshot = refreshed;
              }
            })
            .catch((error: unknown) =>
              logger.warn({ err: String(error) }, "feed refresh failed"),
            );
        }, config.feeds.refreshMinutes * 60_000)
      : undefined;

  refreshTimer?.unref?.();

  const app = buildApp({
    config,
    selectSimulation: createSelector(
      config.simulation,
      config.simulationFilter,
    ),
    geo,
    accessLog,
    alerts,
    feeds: {
      reputation: () => snapshot.reputation,
      crawlers: () => snapshot.crawlers,
      summary: () => ({
        loaded: snapshot.loadedFeeds.length,
        ranges: snapshot.reputation.size,
        failures: snapshot.failures.length,
        names: snapshot.loadedFeeds,
      }),
    },
    logger: options.logger === undefined,
  });

  return {
    app,
    config,
    stop: () => {
      if (refreshTimer !== undefined) {
        clearInterval(refreshTimer);
      }
    },
  };
}

export { type BootstrapOptions, type Bootstrapped, bootstrap, digestBody };
