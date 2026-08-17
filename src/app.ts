import rateLimit from "@fastify/rate-limit";
import fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
  LogController,
} from "fastify";
import type { Config } from "./config/config.js";
import { Classification, createClassifier } from "./defense/classify.js";
import type { Geolocation } from "./geo/lookup.js";
import { emitResponse } from "./http/emit.js";
import type { AccessLog, AccessRecord } from "./monitoring/accessLog.js";
import { createIpSet, EMPTY_IP_SET, type IpSet } from "./net/ipset.js";
import { adminRoutes } from "./routes/admin.js";
import type { ProtocolProfile } from "./simulations/protocol.js";
import { pathOf, renderSimulation } from "./simulations/render.js";
import {
  type Simulation,
  SUPPORTED_STATUS_CODES,
} from "./simulations/simulation.js";

const MAX_PARAM_LENGTH = 65_536;
const RATE_LIMITED_STATUS = 503;

const RATE_LIMIT_HEADERS = Object.freeze({
  "x-ratelimit-limit": false,
  "x-ratelimit-remaining": false,
  "x-ratelimit-reset": false,
  "retry-after": false,
});

interface GeoPort {
  locate(address: string): Promise<Geolocation | undefined>;
}

interface AlertPort {
  enqueue(record: AccessRecord): void;
}

interface FeedPort {
  reputation(): IpSet;
  crawlers(): ReadonlyMap<string, IpSet>;
  summary(): Readonly<Record<string, unknown>>;
}

interface AppOptions {
  readonly config: Config;
  readonly selectSimulation: () => Simulation;
  readonly geo?: GeoPort;
  readonly accessLog?: AccessLog;
  readonly alerts?: AlertPort;
  readonly feeds?: FeedPort;
  readonly logger?: boolean;
  readonly onRequestAddress?: (address: string) => void;
}

function headerOf(request: FastifyRequest, name: string): string {
  const value = request.headers[name];

  return typeof value === "string" ? value : "";
}

function hostOf(request: FastifyRequest): string {
  const header = request.headers.host;

  return typeof header === "string" && header.length > 0 ? header : "localhost";
}

function toSupportedStatus(statusCode: number): number {
  if (SUPPORTED_STATUS_CODES.includes(statusCode)) {
    return statusCode;
  }

  if (statusCode === 429) {
    return RATE_LIMITED_STATUS;
  }

  return statusCode >= 500 ? 500 : 400;
}

function buildApp(options: AppOptions): FastifyInstance {
  const { accessLog, config, selectSimulation } = options;

  function clientErrorResponse(
    profile: ProtocolProfile,
    code: string,
    message: string,
  ): { readonly statusCode: number; readonly withAllow: boolean } {
    const unrecognizedMethod =
      code === "HPE_INVALID_METHOD" && message.includes("Invalid method");

    if (unrecognizedMethod) {
      return { statusCode: profile.unknownMethodStatus, withAllow: true };
    }

    if (code === "HPE_INVALID_VERSION") {
      return { statusCode: profile.badVersionStatus, withAllow: false };
    }

    return { statusCode: 400, withAllow: false };
  }

  const app = fastify({
    clientErrorHandler: (error, socket) => {
      const simulation = selectSimulation();
      const profile = simulation.protocol;
      const code = String((error as { readonly code?: unknown }).code ?? "");
      const { statusCode, withAllow } = clientErrorResponse(
        profile,
        code,
        error.message,
      );

      const context = {
        path: "/",
        method: "GET",
        statusCode,
        host: "localhost",
        now: new Date(),
      };

      const declared = simulation.headers(context);
      const { Server: serverHeader, ...rest } = declared;
      const body = Buffer.from(simulation.render(context), "latin1");

      emitResponse(
        {
          writeHead: (status, reason, headers) => {
            const lines = [`HTTP/1.1 ${String(status)} ${reason}`];
            const pairs = headers
              .filter((_value, index) => index % 2 === 0)
              .map((name, pair) => `${name}: ${headers[pair * 2 + 1] ?? ""}`);

            socket.write(`${[...lines, ...pairs].join("\r\n")}\r\n\r\n`);

            return undefined;
          },
          end: (payload: Buffer) => {
            socket.end(payload);

            return undefined;
          },
        },
        {
          profile,
          statusCode,
          headers: rest,
          body,
          keepAlive: false,
          serverHeader: serverHeader ?? "",
          now: new Date(),
          ...(withAllow ? { extraHeaders: { Allow: profile.allow } } : {}),
        },
      );
    },
    logger:
      options.logger === true
        ? {
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "res.headers['set-cookie']",
                "smtp.password",
                "admin.password",
              ],
              remove: true,
            },
          }
        : false,
    trustProxy: config.trustProxy as boolean | number | string[],
    bodyLimit: config.limits.bodyLimit,
    requestTimeout: config.limits.requestTimeoutMs,
    connectionTimeout: config.limits.connectionTimeoutMs,
    keepAliveTimeout: config.limits.keepAliveTimeoutMs,
    logController: new LogController({ disableRequestLogging: true }),
    routerOptions: { maxParamLength: MAX_PARAM_LENGTH },
  });

  const classify = createClassifier({
    allowList: createIpSet(config.defense.allowList),
    blockList: createIpSet(config.defense.blockList),
    reputation: () => options.feeds?.reputation() ?? EMPTY_IP_SET,
    crawlerRanges: () => options.feeds?.crawlers() ?? new Map(),
  });

  const recordPolicy = new Set<string>(config.defense.recordPolicy);
  const alertPolicy = new Set<string>(config.defense.alertPolicy);
  const adminPrefix = config.admin.enabled ? config.admin.path : undefined;

  function isOperatorPath(url: string): boolean {
    const path = pathOf(url);

    if (config.health.enabled && path === config.health.path) {
      return true;
    }

    return adminPrefix !== undefined && path.startsWith(adminPrefix);
  }

  function respond(
    request: FastifyRequest,
    reply: FastifyReply,
    statusCode: number,
    extraHeaders?: Readonly<Record<string, string>>,
  ): FastifyReply {
    const simulation = selectSimulation();
    const rendered = renderSimulation({
      simulation,
      statusCode: toSupportedStatus(statusCode),
      disclosure: config.disclosure,
      request: {
        url: request.url,
        method: request.method,
        host: hostOf(request),
      },
    });

    const keepAlive =
      request.raw.httpVersion === "1.1" &&
      String(request.headers.connection ?? "").toLowerCase() !== "close";

    const { Server: serverHeader, ...rest } = rendered.headers;

    reply.hijack();
    emitResponse(reply.raw, {
      profile: simulation.protocol,
      statusCode: rendered.statusCode,
      headers: rest,
      body: rendered.body,
      keepAlive,
      serverHeader: serverHeader ?? "",
      now: new Date(),
      ...(request.method === "HEAD" ? { omitBody: true } : {}),
      ...(extraHeaders === undefined ? {} : { extraHeaders }),
    });

    recordAccess(request, reply, rendered.statusCode, simulation.id);

    return reply;
  }

  app.setNotFoundHandler((request, reply) => respond(request, reply, 404));

  app.setErrorHandler((error: unknown, request, reply) => {
    const candidate =
      typeof error === "object" && error !== null && "statusCode" in error
        ? (error as { readonly statusCode?: unknown }).statusCode
        : undefined;

    const statusCode =
      typeof candidate === "number" && candidate >= 400 ? candidate : 500;

    request.log.warn(
      { err: error, url: request.url },
      "request failed, rendering the simulation",
    );

    return respond(request, reply, statusCode);
  });

  app.addHook("onRequest", async (request) => {
    options.onRequestAddress?.(request.ip);
  });

  function recordAccess(
    request: FastifyRequest,
    reply: FastifyReply,
    statusCode: number,
    simulationId: string,
  ): void {
    if (accessLog === undefined || isOperatorPath(request.url)) {
      return;
    }

    const classification = classify({
      ip: request.ip,
      path: pathOf(request.url),
      userAgent: headerOf(request, "user-agent"),
      accept: headerOf(request, "accept"),
      acceptLanguage: headerOf(request, "accept-language"),
    });

    if (!recordPolicy.has(classification)) {
      accessLog.suppress();

      return;
    }

    const entry = {
      timestamp: new Date().toISOString(),
      method: request.method,
      path: pathOf(request.url),
      statusCode,
      ip: request.ip,
      userAgent: headerOf(request, "user-agent"),
      referer: headerOf(request, "referer"),
      host: hostOf(request),
      protocol: request.protocol,
      durationMs: Math.round(reply.elapsedTime),
      simulationId,
      classification,
    };

    accessLog.record(entry);

    if (
      options.alerts !== undefined &&
      alertPolicy.has(classification) &&
      classification !== Classification.Blocked
    ) {
      options.alerts.enqueue(entry);
    }
  }

  app.register(rateLimit, {
    global: true,
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.windowMs,
    addHeaders: RATE_LIMIT_HEADERS,
    addHeadersOnExceeding: RATE_LIMIT_HEADERS,
  });

  if (config.health.enabled) {
    app.register(async (instance) => {
      instance.get(
        config.health.path,
        { config: { rateLimit: false } },
        async (_request, reply) => {
          return reply
            .status(200)
            .header("Cache-Control", "no-store")
            .send({ status: "ok" });
        },
      );
    });
  }

  if (config.admin.enabled && accessLog !== undefined) {
    app.register(
      async (instance) => {
        await adminRoutes(instance, {
          admin: config.admin,
          accessLog,
          feedSummary: () => options.feeds?.summary() ?? {},
        });
      },
      { prefix: config.admin.path },
    );
  }

  app.register(async (instance) => {
    instance.route({
      method: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
      url: "/*",
      handler: async (request, reply) => {
        if (config.geo.enabled && options.geo !== undefined) {
          try {
            const geolocation = await options.geo.locate(request.ip);

            if (geolocation !== undefined) {
              request.log.info(
                { ip: request.ip, geolocation },
                "geolocation resolved",
              );
            }
          } catch (error) {
            request.log.warn({ err: error }, "geolocation lookup failed");
          }
        }

        return respond(request, reply, 404);
      },
    });
  });

  return app;
}

export {
  type AlertPort,
  type AppOptions,
  buildApp,
  type FeedPort,
  type GeoPort,
};
