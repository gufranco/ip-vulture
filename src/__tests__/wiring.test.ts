import { once } from "node:events";
import { createServer, type Server } from "node:net";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { createAlerter } from "../alerts/digest.js";
import { buildApp } from "../app.js";
import { bootstrap } from "../bootstrap.js";
import { loadConfig } from "../config/config.js";
import { createAccessLog } from "../monitoring/accessLog.js";
import { createIpSet } from "../net/ipset.js";
import { findSimulation, simulationIds } from "../simulations/catalogue.js";

faker.seed(20260817);

const adminUser = faker.internet.username();
const adminSecret = faker.internet.jwt();

function requireSimulation(id: string) {
  const simulation = findSimulation(id);

  if (simulation === undefined) {
    throw new Error(`catalogue is missing the ${id} simulation`);
  }

  return simulation;
}

const apache = requireSimulation("apache");

function silentLogger() {
  return { info: vi.fn(), warn: vi.fn() };
}

describe("access recording policy", () => {
  it("should suppress a classification outside the record policy", async () => {
    const config = loadConfig(
      { RECORD_POLICY: "human", TRUST_PROXY: "true" },
      { simulationIds: simulationIds() },
    );
    const accessLog = createAccessLog({ capacity: 10 });
    const app = buildApp({
      config,
      selectSimulation: () => apache,
      accessLog,
    });

    await app.inject({
      method: "GET",
      url: "/x",
      headers: { "user-agent": "curl/8.7.1", accept: "*/*" },
    });

    expect(accessLog.size()).toBe(0);
    expect(accessLog.stats().suppressed).toBe(1);

    await app.close();
  });

  it("should record a classification inside the record policy", async () => {
    const config = loadConfig(
      { RECORD_POLICY: "bot" },
      { simulationIds: simulationIds() },
    );
    const accessLog = createAccessLog({ capacity: 10 });
    const app = buildApp({
      config,
      selectSimulation: () => apache,
      accessLog,
    });

    await app.inject({
      method: "GET",
      url: "/x",
      headers: { "user-agent": "curl/8.7.1", accept: "*/*" },
    });

    expect(accessLog.size()).toBe(1);
    expect(accessLog.records()[0]?.simulationId).toBe("apache");

    await app.close();
  });

  it("should record the request without a user agent", async () => {
    const config = loadConfig(
      { RECORD_POLICY: "bot" },
      { simulationIds: simulationIds() },
    );
    const accessLog = createAccessLog({ capacity: 10 });
    const app = buildApp({ config, selectSimulation: () => apache, accessLog });

    await app.inject({
      method: "GET",
      url: "/x",
      headers: { "user-agent": "" },
    });

    expect(accessLog.records()[0]?.userAgent).toBe("");

    await app.close();
  });
});

describe("alert wiring", () => {
  it("should enqueue a record matching the alert policy", async () => {
    const config = loadConfig(
      { RECORD_POLICY: "bot", ALERT_POLICY: "bot" },
      { simulationIds: simulationIds() },
    );
    const accessLog = createAccessLog({ capacity: 10 });
    const enqueue = vi.fn();
    const app = buildApp({
      config,
      selectSimulation: () => apache,
      accessLog,
      alerts: { enqueue },
    });

    await app.inject({
      method: "GET",
      url: "/x",
      headers: { "user-agent": "curl/8.7.1", accept: "*/*" },
    });

    expect(enqueue).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it("should not enqueue a record outside the alert policy", async () => {
    const config = loadConfig(
      { RECORD_POLICY: "bot", ALERT_POLICY: "human" },
      { simulationIds: simulationIds() },
    );
    const accessLog = createAccessLog({ capacity: 10 });
    const enqueue = vi.fn();
    const app = buildApp({
      config,
      selectSimulation: () => apache,
      accessLog,
      alerts: { enqueue },
    });

    await app.inject({
      method: "GET",
      url: "/x",
      headers: { "user-agent": "curl/8.7.1", accept: "*/*" },
    });

    expect(enqueue).not.toHaveBeenCalled();

    await app.close();
  });
});

describe("feed wiring", () => {
  it("should classify using the injected reputation set", async () => {
    const config = loadConfig(
      { TRUST_PROXY: "true" },
      { simulationIds: simulationIds() },
    );
    const accessLog = createAccessLog({ capacity: 10 });
    const app = buildApp({
      config,
      selectSimulation: () => apache,
      accessLog,
      feeds: {
        reputation: () => createIpSet(["9.9.9.0/24"]),
        crawlers: () => new Map(),
        summary: () => ({ loaded: 1 }),
      },
    });

    await app.inject({
      method: "GET",
      url: "/x",
      headers: { "x-forwarded-for": "9.9.9.9" },
    });

    expect(accessLog.stats().suppressed).toBe(1);

    await app.close();
  });
});

describe("health route", () => {
  it("should answer on the configured path", async () => {
    const config = loadConfig(
      { HEALTH_PATH: "/alive" },
      { simulationIds: simulationIds() },
    );
    const app = buildApp({ config, selectSimulation: () => apache });

    const response = await app.inject({ method: "GET", url: "/alive" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });

    await app.close();
  });

  it("should render the simulation when the health route is disabled", async () => {
    const config = loadConfig(
      { HEALTH_ENABLED: "false" },
      { simulationIds: simulationIds() },
    );
    const app = buildApp({ config, selectSimulation: () => apache });

    const response = await app.inject({ method: "GET", url: "/__health" });

    expect(response.statusCode).toBe(404);
    expect(response.headers.server).toBe("Apache/2.4.62 (Ubuntu)");

    await app.close();
  });
});

describe("bootstrap alerting and geolocation", () => {
  it("should wire alerting without sending when the window has not elapsed", async () => {
    const started = await bootstrap({
      env: {
        FEEDS_ENABLED: "false",
        ALERT_ENABLED: "true",
        ALERT_FROM: "a@b.invalid",
        ALERT_TO: "c@d.invalid",
        SMTP_HOST: "smtp.invalid",
        ALERT_POLICY: "bot",
        RECORD_POLICY: "bot",
      },
      logger: silentLogger(),
    });

    const response = await started.app.inject({
      method: "GET",
      url: "/x",
      headers: { "user-agent": "curl/8.7.1", accept: "*/*" },
    });

    expect(response.statusCode).toBe(404);

    started.stop();
    await started.app.close();
  });

  it("should wire geolocation when enabled", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        status: "success",
        country: "Brazil",
        countryCode: "BR",
        region: "SP",
        regionName: "Sao Paulo",
        city: "Sao Paulo",
        zip: "01000",
        lat: -23.5,
        lon: -46.6,
        timezone: "America/Sao_Paulo",
        isp: "Example",
        org: "Example",
        as: "AS1 Example",
        query: "8.8.8.8",
      }),
    );

    const started = await bootstrap({
      env: {
        FEEDS_ENABLED: "false",
        GEO_ENABLED: "true",
        TRUST_PROXY: "true",
      },
      logger: silentLogger(),
      fetcher: fetcher as unknown as typeof fetch,
    });

    const response = await started.app.inject({
      method: "GET",
      url: "/x",
      headers: { "x-forwarded-for": "8.8.8.8" },
    });

    expect(response.statusCode).toBe(404);

    started.stop();
    await started.app.close();
  });

  it("should stop the refresh timer when asked", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("1.2.3.4\n"));
    const started = await bootstrap({
      env: { FEEDS: "tor-exits", FEEDS_REFRESH_MINUTES: "5" },
      logger: silentLogger(),
      fetcher: fetcher as unknown as typeof fetch,
    });

    started.stop();
    started.stop();

    await started.app.close();

    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("alerter scheduled flush", () => {
  it("should flush through the scheduler after the window", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const scheduled: (() => void)[] = [];

    const alerter = createAlerter({
      enabled: true,
      windowSeconds: 1,
      maxPerHour: 10,
      send,
      schedule: (callback) => scheduled.push(callback),
    });

    alerter.enqueue({
      timestamp: "2026-08-16T10:00:00.000Z",
      method: "GET",
      path: "/x",
      statusCode: 404,
      ip: "1.2.3.4",
      userAgent: "curl",
      referer: "",
      host: "localhost",
      protocol: "http",
      durationMs: 1,
      simulationId: "apache",
      classification: "human",
    });

    scheduled[0]?.();
    await alerter.settled();

    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("bootstrap alert delivery", () => {
  it("should attempt delivery and record the failure when SMTP is unreachable", async () => {
    const logger = silentLogger();
    const started = await bootstrap({
      env: {
        FEEDS_ENABLED: "false",
        ALERT_ENABLED: "true",
        ALERT_WINDOW_SECONDS: "0",
        ALERT_FROM: "a@b.invalid",
        ALERT_TO: "c@d.invalid",
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: "1",
        ALERT_POLICY: "bot",
        RECORD_POLICY: "bot",
        GEO_TIMEOUT_MS: "200",
      },
      logger,
    });

    await started.app.inject({
      method: "GET",
      url: "/x",
      headers: { "user-agent": "curl/8.7.1", accept: "*/*" },
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(logger.warn).toHaveBeenCalled();

    started.stop();
    await started.app.close();
  });

  it("should expose the feed summary through the admin panel", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("203.0.113.0/24\n"));
    const started = await bootstrap({
      env: {
        FEEDS: "tor-exits",
        ADMIN_ENABLED: "true",
        ADMIN_USER: adminUser,
        ADMIN_PASSWORD: adminSecret,
      },
      logger: silentLogger(),
      fetcher: fetcher as unknown as typeof fetch,
    });

    const admin = await started.app.inject({
      method: "GET",
      url: "/__admin",
      headers: {
        authorization: `Basic ${Buffer.from(`${adminUser}:${adminSecret}`).toString("base64")}`,
      },
    });

    expect(admin.statusCode).toBe(200);
    expect(admin.body).toContain("Blocklist ranges");

    started.stop();
    await started.app.close();
  });

  it("should refresh the feed snapshot on the configured interval", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("203.0.113.0/24\n"));
    const started = await bootstrap({
      env: { FEEDS: "tor-exits", FEEDS_REFRESH_MINUTES: "5" },
      logger: silentLogger(),
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);

    started.stop();
    await started.app.close();
  });

  it("should log a warning when a refresh cycle fails", async () => {
    const logger = silentLogger();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("203.0.113.0/24\n"))
      .mockRejectedValue(new Error("offline"));

    const started = await bootstrap({
      env: { FEEDS: "tor-exits" },
      logger,
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(logger.info).toHaveBeenCalled();

    started.stop();
    await started.app.close();
  });
});

describe("bootstrap geolocation failure reporting", () => {
  it("should log through the geolocation failure callback", async () => {
    const logger = silentLogger();
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("nope", { status: 503 }));

    const started = await bootstrap({
      env: {
        FEEDS_ENABLED: "false",
        GEO_ENABLED: "true",
        TRUST_PROXY: "true",
      },
      logger,
      fetcher: fetcher as unknown as typeof fetch,
    });

    await started.app.inject({
      method: "GET",
      url: "/x",
      headers: { "x-forwarded-for": "8.8.8.8" },
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expect.stringContaining("503") }),
      "geolocation lookup failed",
    );

    started.stop();
    await started.app.close();
  });
});

describe("bootstrap end to end alert delivery", () => {
  let smtp: Server | undefined;

  async function startSmtp(): Promise<{ port: number; received: string[] }> {
    const received: string[] = [];

    const server = createServer((socket) => {
      socket.setEncoding("utf8");
      socket.write("220 local ready\r\n");
      let inData = false;

      socket.on("data", (chunk: string) => {
        received.push(chunk);

        for (const line of chunk.split("\r\n").filter((l) => l.length > 0)) {
          if (inData) {
            if (line === ".") {
              inData = false;
              socket.write("250 queued\r\n");
            }
            continue;
          }

          const verb = line.slice(0, 4).toUpperCase().trim();

          if (verb === "DATA") {
            inData = true;
            socket.write("354 go\r\n");
          } else if (verb === "EHLO") {
            socket.write("250 local\r\n");
          } else if (verb === "QUIT") {
            socket.write("221 bye\r\n");
          } else {
            socket.write("250 ok\r\n");
          }
        }
      });
    });

    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    smtp = server;

    const address = server.address();

    if (address === null || typeof address === "string") {
      throw new Error("failed to bind the test SMTP server");
    }

    return { port: address.port, received };
  }

  it("should deliver a digest through a real SMTP conversation", async () => {
    const { port, received } = await startSmtp();

    const started = await bootstrap({
      env: {
        FEEDS_ENABLED: "false",
        ALERT_ENABLED: "true",
        ALERT_WINDOW_SECONDS: "0",
        ALERT_FROM: "alerts@example.invalid",
        ALERT_TO: "ops@example.invalid",
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: String(port),
        ALERT_POLICY: "bot",
        RECORD_POLICY: "bot",
      },
      logger: silentLogger(),
    });

    await started.app.inject({
      method: "GET",
      url: "/watched-path",
      headers: { "user-agent": "curl/8.7.1", accept: "*/*" },
    });

    await new Promise((resolve) => setTimeout(resolve, 600));

    const session = received.join("");

    expect(session).toContain("MAIL FROM:<alerts@example.invalid>");
    expect(session).toContain("RCPT TO:<ops@example.invalid>");
    expect(session).toContain("/watched-path");
    expect(session).toContain("lost when the process exits");

    started.stop();
    await started.app.close();
    smtp?.close();
    smtp = undefined;
  });
});
