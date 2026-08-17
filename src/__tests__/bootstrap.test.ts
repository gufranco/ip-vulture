import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { bootstrap, digestBody } from "../bootstrap.js";

function silentLogger() {
  return { info: vi.fn(), warn: vi.fn() };
}

const offline = { FEEDS_ENABLED: "false" };

faker.seed(20260817);

const adminUser = faker.internet.username();
const adminSecret = faker.internet.jwt();

describe("bootstrap without feeds", () => {
  it("should build a working app", async () => {
    const started = await bootstrap({ env: offline, logger: silentLogger() });

    const response = await started.app.inject({ method: "GET", url: "/x" });

    expect(response.statusCode).toBe(404);

    started.stop();
    await started.app.close();
  });

  it("should never call the network when feeds are disabled", async () => {
    const fetcher = vi.fn();
    const started = await bootstrap({
      env: offline,
      logger: silentLogger(),
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(fetcher).not.toHaveBeenCalled();

    started.stop();
    await started.app.close();
  });
});

describe("bootstrap feed loading", () => {
  it("should fetch every configured feed before the app answers", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("203.0.113.0/24\n"));

    const started = await bootstrap({
      env: {
        FEEDS: "firehol-level1,tor-exits",
        FEEDS_REFRESH_MINUTES: "20160",
      },
      logger: silentLogger(),
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(fetcher).toHaveBeenCalledTimes(2);

    started.stop();
    await started.app.close();
  });

  it("should start when a feed fails and log the failure", async () => {
    const logger = silentLogger();
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));

    const started = await bootstrap({
      env: { FEEDS: "firehol-level1" },
      logger,
      fetcher: fetcher as unknown as typeof fetch,
    });

    const response = await started.app.inject({ method: "GET", url: "/x" });

    expect(response.statusCode).toBe(404);
    expect(logger.warn).toHaveBeenCalled();

    started.stop();
    await started.app.close();
  });

  it("should refuse to start when feeds are required and all fail", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));

    await expect(
      bootstrap({
        env: { FEEDS: "firehol-level1", FEEDS_REQUIRED: "true" },
        logger: silentLogger(),
        fetcher: fetcher as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/FEEDS_REQUIRED/);
  });

  it("should classify an address from a loaded feed as blocked", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("203.0.113.0/24\n"));

    const started = await bootstrap({
      env: {
        FEEDS: "firehol-level1",
        TRUST_PROXY: "true",
        ADMIN_ENABLED: "true",
        ADMIN_USER: adminUser,
        ADMIN_PASSWORD: adminSecret,
      },
      logger: silentLogger(),
      fetcher: fetcher as unknown as typeof fetch,
    });

    await started.app.inject({
      method: "GET",
      url: "/probe",
      headers: { "x-forwarded-for": "203.0.113.5" },
    });

    const admin = await started.app.inject({
      method: "GET",
      url: "/__admin/json",
      headers: {
        authorization: `Basic ${Buffer.from(`${adminUser}:${adminSecret}`).toString("base64")}`,
      },
    });

    expect(admin.json().stats.suppressed).toBe(1);
    expect(admin.json().records).toHaveLength(0);

    started.stop();
    await started.app.close();
  });

  it("should honour the startup timeout rather than hanging", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(() => new Promise(() => undefined));

    const started = await bootstrap({
      env: { FEEDS: "firehol-level1", FEEDS_STARTUP_TIMEOUT_MS: "1000" },
      logger: silentLogger(),
      fetcher: fetcher as unknown as typeof fetch,
    });

    const response = await started.app.inject({ method: "GET", url: "/x" });

    expect(response.statusCode).toBe(404);

    started.stop();
    await started.app.close();
  });
});

describe("bootstrap access recording", () => {
  it("should record ordinary traffic and expose it through the admin panel", async () => {
    const started = await bootstrap({
      env: {
        ...offline,
        ADMIN_ENABLED: "true",
        ADMIN_USER: adminUser,
        ADMIN_PASSWORD: adminSecret,
      },
      logger: silentLogger(),
    });

    await started.app.inject({
      method: "GET",
      url: "/watched",
      headers: { "user-agent": "curl/8.7.1", accept: "*/*" },
    });

    const admin = await started.app.inject({
      method: "GET",
      url: "/__admin/json",
      headers: {
        authorization: `Basic ${Buffer.from(`${adminUser}:${adminSecret}`).toString("base64")}`,
      },
    });

    expect(admin.json().records[0].path).toBe("/watched");
    expect(admin.json().records[0].classification).toBe("bot");

    started.stop();
    await started.app.close();
  });

  it("should not record its own health checks", async () => {
    const started = await bootstrap({
      env: {
        ...offline,
        ADMIN_ENABLED: "true",
        ADMIN_USER: adminUser,
        ADMIN_PASSWORD: adminSecret,
      },
      logger: silentLogger(),
    });

    await started.app.inject({ method: "GET", url: "/__health" });

    const admin = await started.app.inject({
      method: "GET",
      url: "/__admin/json",
      headers: {
        authorization: `Basic ${Buffer.from(`${adminUser}:${adminSecret}`).toString("base64")}`,
      },
    });

    expect(admin.json().records).toHaveLength(0);

    started.stop();
    await started.app.close();
  });
});

describe("digestBody", () => {
  const record = {
    timestamp: "2026-08-16T10:00:00.000Z",
    method: "GET",
    path: "/some/page",
    statusCode: 404,
    ip: "203.0.113.7",
    userAgent: "curl/8.7.1",
    referer: "",
    host: "localhost",
    protocol: "http",
    durationMs: 2,
    simulationId: "apache",
    classification: "human",
  };

  it("should state that the history is memory only", () => {
    const body = digestBody({
      count: 1,
      omitted: 0,
      firstAt: record.timestamp,
      lastAt: record.timestamp,
      records: [record],
    });

    expect(body).toContain("lost when the process exits");
    expect(body).toContain("only technical request metadata");
  });

  it("should list every record", () => {
    const body = digestBody({
      count: 2,
      omitted: 0,
      firstAt: record.timestamp,
      lastAt: record.timestamp,
      records: [record, { ...record, path: "/second" }],
    });

    expect(body).toContain("/some/page");
    expect(body).toContain("/second");
  });
});
