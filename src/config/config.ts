import { Classification } from "../defense/classify.js";
import { DEFAULT_FEEDS } from "../defense/feeds.js";
import { Era, Genre } from "../simulations/simulation.js";
import {
  collectErrors,
  type EnvSource,
  type FieldError,
  fail,
  ok,
  type Parsed,
  parseBoolean,
  parseEnum,
  parseInteger,
  parseList,
  parseString,
  unwrap,
} from "./parse.js";

const RANDOM_SELECTION = "random";

const randomScopes = ["startup", "request"] as const;
const disclosureModes = ["header", "comment", "both", "off"] as const;

type RandomScope = (typeof randomScopes)[number];
type DisclosureMode = (typeof disclosureModes)[number];

type SimulationSelection =
  | { readonly mode: "fixed"; readonly id: string }
  | { readonly mode: "random"; readonly scope: RandomScope };

type TrustProxy = boolean | number | readonly string[];

interface SimulationFilter {
  readonly era?: Era;
  readonly genre?: Genre;
}

interface GeoConfig {
  readonly enabled: boolean;
  readonly timeoutMs: number;
  readonly budgetPerMinute: number;
  readonly cacheTtlSeconds: number;
  readonly cacheMax: number;
}

interface RateLimitConfig {
  readonly max: number;
  readonly windowMs: number;
}

interface ServerLimitsConfig {
  readonly requestTimeoutMs: number;
  readonly connectionTimeoutMs: number;
  readonly keepAliveTimeoutMs: number;
  readonly bodyLimit: number;
}

interface HealthConfig {
  readonly enabled: boolean;
  readonly path: string;
}

interface MonitoringConfig {
  readonly capacity: number;
}

interface DefenseConfig {
  readonly allowList: readonly string[];
  readonly blockList: readonly string[];
  readonly recordPolicy: readonly Classification[];
  readonly alertPolicy: readonly Classification[];
}

interface FeedsConfig {
  readonly enabled: boolean;
  readonly required: boolean;
  readonly names: readonly string[];
  readonly startupTimeoutMs: number;
  readonly perFeedTimeoutMs: number;
  readonly refreshMinutes: number;
  readonly maxBytes: number;
}

interface AdminConfig {
  readonly enabled: boolean;
  readonly path: string;
  readonly user: string;
  readonly password: string;
}

interface SmtpConfig {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly user: string;
  readonly password: string;
}

interface AlertsConfig {
  readonly enabled: boolean;
  readonly windowSeconds: number;
  readonly maxPerHour: number;
  readonly maxQueued: number;
  readonly from: string;
  readonly to: string;
  readonly smtp: SmtpConfig;
}

interface Config {
  readonly port: number;
  readonly host: string;
  readonly trustProxy: TrustProxy;
  readonly simulation: SimulationSelection;
  readonly simulationFilter: SimulationFilter;
  readonly disclosure: DisclosureMode;
  readonly health: HealthConfig;
  readonly geo: GeoConfig;
  readonly rateLimit: RateLimitConfig;
  readonly limits: ServerLimitsConfig;
  readonly monitoring: MonitoringConfig;
  readonly defense: DefenseConfig;
  readonly feeds: FeedsConfig;
  readonly admin: AdminConfig;
  readonly alerts: AlertsConfig;
}

interface LoadOptions {
  readonly simulationIds: readonly string[];
}

function describeErrors(errors: readonly FieldError[]): string {
  const detail = errors
    .map((error) => `  ${error.variable}: ${error.reason}`)
    .join("\n");

  return `Invalid configuration:\n${detail}`;
}

class ConfigError extends Error {
  readonly name: string = "ConfigError";

  constructor(readonly errors: readonly FieldError[]) {
    super(describeErrors(errors));
  }
}

function parseSimulationId(
  env: EnvSource,
  simulationIds: readonly string[],
): Parsed<string> {
  const fallback = simulationIds[0] ?? RANDOM_SELECTION;
  const raw = parseString(env, "SERVER_TEMPLATE", fallback);

  if (raw === RANDOM_SELECTION || simulationIds.includes(raw)) {
    return ok(raw);
  }

  return fail(
    "SERVER_TEMPLATE",
    `"${raw}" is not one of: ${simulationIds.join(", ")}, ${RANDOM_SELECTION}`,
  );
}

function parseTrustProxy(env: EnvSource): Parsed<TrustProxy> {
  const value = parseString(env, "TRUST_PROXY", "false");
  const normalized = value.toLowerCase();

  if (normalized === "false") {
    return ok(false);
  }

  if (normalized === "true") {
    return ok(true);
  }

  if (/^-?\d+$/.test(value)) {
    const hops = Number(value);

    if (hops < 0) {
      return fail(
        "TRUST_PROXY",
        `${hops} is not a valid hop count. Use a non-negative integer`,
      );
    }

    return ok(hops);
  }

  const entries = unwrap(parseList({ TRUST_PROXY: value }, "TRUST_PROXY", []));

  if (entries.length === 0) {
    return fail(
      "TRUST_PROXY",
      `"${value}" is not true, false, a hop count, or a comma-separated address list`,
    );
  }

  return ok(entries);
}

function parseOptionalEnum<T extends string>(
  env: EnvSource,
  variable: string,
  allowed: readonly T[],
): Parsed<T | undefined> {
  const raw = parseString(env, variable, "");

  if (raw.length === 0) {
    return ok(undefined);
  }

  const match = allowed.find((candidate) => candidate === raw);

  if (match === undefined) {
    return fail(variable, `"${raw}" is not one of: ${allowed.join(", ")}`);
  }

  return ok(match);
}

function parseClassifications(
  env: EnvSource,
  variable: string,
  fallback: readonly Classification[],
): Parsed<readonly Classification[]> {
  const raw = unwrap(parseList(env, variable, []));

  if (raw.length === 0) {
    return ok(fallback);
  }

  const allowed = Object.values(Classification) as string[];
  const invalid = raw.filter((entry) => !allowed.includes(entry));

  if (invalid.length > 0) {
    return fail(
      variable,
      `${invalid.map((entry) => `"${entry}"`).join(", ")} not in: ${allowed.join(", ")}`,
    );
  }

  return ok(Object.freeze(raw as Classification[]));
}

function parseFeedNames(env: EnvSource): Parsed<readonly string[]> {
  const raw = unwrap(parseList(env, "FEEDS", []));

  if (raw.length === 0) {
    return ok(DEFAULT_FEEDS);
  }

  const invalid = raw.filter((entry) => !DEFAULT_FEEDS.includes(entry));

  if (invalid.length > 0) {
    return fail(
      "FEEDS",
      `${invalid.map((entry) => `"${entry}"`).join(", ")} not in: ${DEFAULT_FEEDS.join(", ")}`,
    );
  }

  return ok(Object.freeze(raw));
}

function requiredWhenEnabled(
  enabled: boolean,
  variable: string,
  value: string,
): Parsed<string> {
  if (enabled && value.length === 0) {
    return fail(variable, "is required when the feature is enabled");
  }

  return ok(value);
}

function loadConfig(env: EnvSource, options: LoadOptions): Config {
  const port = parseInteger(env, "PORT", 3000, { min: 1, max: 65535 });
  const host = parseString(env, "HOST", "0.0.0.0");
  const trustProxy = parseTrustProxy(env);
  const simulationId = parseSimulationId(env, options.simulationIds);
  const randomScope = parseEnum(env, "RANDOM_SCOPE", randomScopes, "startup");
  const disclosure = parseEnum(
    env,
    "SIMULATION_DISCLOSURE",
    disclosureModes,
    "off",
  );
  const filterEra = parseOptionalEnum(
    env,
    "SIMULATION_ERA",
    Object.values(Era),
  );
  const filterGenre = parseOptionalEnum(
    env,
    "SIMULATION_GENRE",
    Object.values(Genre),
  );
  const healthEnabled = parseBoolean(env, "HEALTH_ENABLED", true);
  const healthPath = parseString(env, "HEALTH_PATH", "/__health");

  const geoEnabled = parseBoolean(env, "GEO_ENABLED", false);
  const geoTimeoutMs = parseInteger(env, "GEO_TIMEOUT_MS", 5000, {
    min: 100,
    max: 60_000,
  });
  const geoBudget = parseInteger(env, "GEO_BUDGET_PER_MINUTE", 40, {
    min: 1,
    max: 10_000,
  });
  const geoCacheTtl = parseInteger(env, "GEO_CACHE_TTL_SECONDS", 3600, {
    min: 1,
    max: 86_400,
  });
  const geoCacheMax = parseInteger(env, "GEO_CACHE_MAX", 5000, {
    min: 1,
    max: 1_000_000,
  });

  const rateLimitMax = parseInteger(env, "RATE_LIMIT_MAX", 40, {
    min: 1,
    max: 1_000_000,
  });
  const rateLimitWindowMs = parseInteger(env, "RATE_LIMIT_WINDOW_MS", 60_000, {
    min: 1000,
    max: 3_600_000,
  });

  const requestTimeoutMs = parseInteger(env, "REQUEST_TIMEOUT_MS", 30_000, {
    min: 1000,
    max: 600_000,
  });
  const connectionTimeoutMs = parseInteger(
    env,
    "CONNECTION_TIMEOUT_MS",
    30_000,
    { min: 0, max: 600_000 },
  );
  const keepAliveTimeoutMs = parseInteger(env, "KEEP_ALIVE_TIMEOUT_MS", 5000, {
    min: 1000,
    max: 600_000,
  });
  const bodyLimit = parseInteger(env, "BODY_LIMIT", 1_048_576, {
    min: 1024,
    max: 104_857_600,
  });

  const monitoringCapacity = parseInteger(env, "ACCESS_LOG_CAPACITY", 1000, {
    min: 1,
    max: 100_000,
  });

  const allowList = parseList(env, "IP_ALLOWLIST", []);
  const blockList = parseList(env, "IP_BLOCKLIST", []);
  const recordPolicy = parseClassifications(env, "RECORD_POLICY", [
    Classification.Human,
    Classification.Bot,
    Classification.Scanner,
  ]);
  const alertPolicy = parseClassifications(env, "ALERT_POLICY", [
    Classification.Human,
  ]);

  const feedsEnabled = parseBoolean(env, "FEEDS_ENABLED", true);
  const feedsRequired = parseBoolean(env, "FEEDS_REQUIRED", false);
  const feedNames = parseFeedNames(env);
  const feedsStartupTimeoutMs = parseInteger(
    env,
    "FEEDS_STARTUP_TIMEOUT_MS",
    30_000,
    { min: 1000, max: 600_000 },
  );
  const feedsPerFeedTimeoutMs = parseInteger(env, "FEEDS_TIMEOUT_MS", 15_000, {
    min: 1000,
    max: 600_000,
  });
  const feedsRefreshMinutes = parseInteger(env, "FEEDS_REFRESH_MINUTES", 720, {
    min: 5,
    max: 20_160,
  });
  const feedsMaxBytes = parseInteger(env, "FEEDS_MAX_BYTES", 20_971_520, {
    min: 1024,
    max: 209_715_200,
  });

  const adminEnabled = parseBoolean(env, "ADMIN_ENABLED", false);
  const adminPath = parseString(env, "ADMIN_PATH", "/__admin");
  const adminUser = requiredWhenEnabled(
    unwrap(adminEnabled),
    "ADMIN_USER",
    parseString(env, "ADMIN_USER", ""),
  );
  const adminPassword = requiredWhenEnabled(
    unwrap(adminEnabled),
    "ADMIN_PASSWORD",
    parseString(env, "ADMIN_PASSWORD", ""),
  );

  const alertsEnabled = parseBoolean(env, "ALERT_ENABLED", false);
  const alertWindowSeconds = parseInteger(env, "ALERT_WINDOW_SECONDS", 60, {
    min: 0,
    max: 3600,
  });
  const alertMaxPerHour = parseInteger(env, "ALERT_MAX_PER_HOUR", 20, {
    min: 1,
    max: 1000,
  });
  const alertMaxQueued = parseInteger(env, "ALERT_MAX_QUEUED", 500, {
    min: 1,
    max: 100_000,
  });
  const alertFrom = requiredWhenEnabled(
    unwrap(alertsEnabled),
    "ALERT_FROM",
    parseString(env, "ALERT_FROM", ""),
  );
  const alertTo = requiredWhenEnabled(
    unwrap(alertsEnabled),
    "ALERT_TO",
    parseString(env, "ALERT_TO", ""),
  );
  const smtpHost = requiredWhenEnabled(
    unwrap(alertsEnabled),
    "SMTP_HOST",
    parseString(env, "SMTP_HOST", ""),
  );
  const smtpPort = parseInteger(env, "SMTP_PORT", 587, { min: 1, max: 65535 });
  const smtpSecure = parseBoolean(env, "SMTP_SECURE", false);
  const smtpUser = parseString(env, "SMTP_USER", "");
  const smtpPassword = parseString(env, "SMTP_PASSWORD", "");

  const errors = collectErrors([
    port,
    trustProxy,
    simulationId,
    randomScope,
    disclosure,
    healthEnabled,
    filterEra,
    filterGenre,
    geoEnabled,
    geoTimeoutMs,
    geoBudget,
    geoCacheTtl,
    geoCacheMax,
    rateLimitMax,
    rateLimitWindowMs,
    requestTimeoutMs,
    connectionTimeoutMs,
    keepAliveTimeoutMs,
    bodyLimit,
    monitoringCapacity,
    allowList,
    blockList,
    recordPolicy,
    alertPolicy,
    feedsEnabled,
    feedsRequired,
    feedNames,
    feedsStartupTimeoutMs,
    feedsPerFeedTimeoutMs,
    feedsRefreshMinutes,
    feedsMaxBytes,
    adminEnabled,
    adminUser,
    adminPassword,
    alertsEnabled,
    alertWindowSeconds,
    alertMaxPerHour,
    alertMaxQueued,
    alertFrom,
    alertTo,
    smtpHost,
    smtpPort,
    smtpSecure,
  ]);

  if (errors.length > 0) {
    throw new ConfigError(errors);
  }

  const resolvedId = unwrap(simulationId);

  const simulation: SimulationSelection =
    resolvedId === RANDOM_SELECTION
      ? { mode: "random", scope: unwrap(randomScope) }
      : { mode: "fixed", id: resolvedId };

  const era = unwrap(filterEra);
  const genre = unwrap(filterGenre);

  return Object.freeze({
    port: unwrap(port),
    host,
    trustProxy: unwrap(trustProxy),
    simulation: Object.freeze(simulation),
    simulationFilter: Object.freeze({
      ...(era === undefined ? {} : { era }),
      ...(genre === undefined ? {} : { genre }),
    }),
    disclosure: unwrap(disclosure),
    health: Object.freeze({
      enabled: unwrap(healthEnabled),
      path: healthPath,
    }),
    geo: Object.freeze({
      enabled: unwrap(geoEnabled),
      timeoutMs: unwrap(geoTimeoutMs),
      budgetPerMinute: unwrap(geoBudget),
      cacheTtlSeconds: unwrap(geoCacheTtl),
      cacheMax: unwrap(geoCacheMax),
    }),
    rateLimit: Object.freeze({
      max: unwrap(rateLimitMax),
      windowMs: unwrap(rateLimitWindowMs),
    }),
    limits: Object.freeze({
      requestTimeoutMs: unwrap(requestTimeoutMs),
      connectionTimeoutMs: unwrap(connectionTimeoutMs),
      keepAliveTimeoutMs: unwrap(keepAliveTimeoutMs),
      bodyLimit: unwrap(bodyLimit),
    }),
    monitoring: Object.freeze({ capacity: unwrap(monitoringCapacity) }),
    defense: Object.freeze({
      allowList: unwrap(allowList),
      blockList: unwrap(blockList),
      recordPolicy: unwrap(recordPolicy),
      alertPolicy: unwrap(alertPolicy),
    }),
    feeds: Object.freeze({
      enabled: unwrap(feedsEnabled),
      required: unwrap(feedsRequired),
      names: unwrap(feedNames),
      startupTimeoutMs: unwrap(feedsStartupTimeoutMs),
      perFeedTimeoutMs: unwrap(feedsPerFeedTimeoutMs),
      refreshMinutes: unwrap(feedsRefreshMinutes),
      maxBytes: unwrap(feedsMaxBytes),
    }),
    admin: Object.freeze({
      enabled: unwrap(adminEnabled),
      path: adminPath,
      user: unwrap(adminUser),
      password: unwrap(adminPassword),
    }),
    alerts: Object.freeze({
      enabled: unwrap(alertsEnabled),
      windowSeconds: unwrap(alertWindowSeconds),
      maxPerHour: unwrap(alertMaxPerHour),
      maxQueued: unwrap(alertMaxQueued),
      from: unwrap(alertFrom),
      to: unwrap(alertTo),
      smtp: Object.freeze({
        host: unwrap(smtpHost),
        port: unwrap(smtpPort),
        secure: unwrap(smtpSecure),
        user: smtpUser,
        password: smtpPassword,
      }),
    }),
  });
}

export {
  type AdminConfig,
  type AlertsConfig,
  type Config,
  ConfigError,
  type DefenseConfig,
  type DisclosureMode,
  type FeedsConfig,
  type GeoConfig,
  type HealthConfig,
  type LoadOptions,
  loadConfig,
  type MonitoringConfig,
  type RandomScope,
  type RateLimitConfig,
  type ServerLimitsConfig,
  type SimulationFilter,
  type SimulationSelection,
  type SmtpConfig,
  type TrustProxy,
};
