import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { loadConfig } from "../config/config.js";
import { findSimulation, simulationIds } from "../simulations/catalogue.js";

function requireSimulation(id: string) {
  const simulation = findSimulation(id);

  if (simulation === undefined) {
    throw new Error(`catalogue is missing the ${id} simulation`);
  }

  return simulation;
}

const apache = requireSimulation("apache");

function buildTestApp(env: Record<string, string> = {}) {
  const config = loadConfig(env, { simulationIds: simulationIds() });

  return buildApp({ config, selectSimulation: () => apache });
}

const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"] as const;

const PATHS = [
  "/",
  "/single",
  "/a/b/c/d/e",
  `/${"x".repeat(300)}`,
  "/path%20with%20encoding",
  "/?only=query",
  "/.env",
  "/wp-admin/setup-config.php",
];

describe("catch-all coverage", () => {
  it.each(METHODS)(
    "should return the simulation for %s across every path shape",
    async (method) => {
      const app = buildTestApp();

      for (const url of PATHS) {
        const response = await app.inject({ method, url });

        expect(response.statusCode).toBe(404);
        expect(response.headers.server).toBe("Apache/2.4.62 (Ubuntu)");
        expect(response.headers["content-type"]).toBe(
          "text/html; charset=iso-8859-1",
        );
      }

      await app.close();
    },
  );

  it("should never expose a framework error shape on any method or path", async () => {
    const app = buildTestApp();

    for (const method of METHODS) {
      for (const url of PATHS) {
        const response = await app.inject({ method, url });

        expect(response.body).not.toContain('"statusCode"');
        expect(response.body).not.toContain('"error":"Not Found"');
        expect(response.body).not.toContain("Route ");
      }
    }

    await app.close();
  });

  it("should answer HEAD with the simulation headers and an empty body", async () => {
    const app = buildTestApp();

    const response = await app.inject({ method: "HEAD", url: "/anything" });

    expect(response.statusCode).toBe(404);
    expect(response.headers.server).toBe("Apache/2.4.62 (Ubuntu)");
    expect(response.body).toBe("");

    await app.close();
  });

  it("should render a path far longer than the Fastify parameter default", async () => {
    const app = buildTestApp();

    const response = await app.inject({
      method: "GET",
      url: `/${"y".repeat(2000)}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toBe(
      "text/html; charset=iso-8859-1",
    );

    await app.close();
  });

  it("should exclude the query string from the rendered page", async () => {
    const app = buildTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/report?token=secret",
    });

    expect(response.body).toContain("/report");
    expect(response.body).not.toContain("secret");

    await app.close();
  });
});

describe("error handling", () => {
  it("should render the simulation on an internal failure and hide the message", async () => {
    const app = buildTestApp();

    app.get("/boom", async () => {
      throw new Error("kaboom-secret-detail");
    });

    const response = await app.inject({ method: "GET", url: "/boom" });

    expect(response.statusCode).toBe(500);
    expect(response.headers.server).toBe("Apache/2.4.62 (Ubuntu)");
    expect(response.body).not.toContain("kaboom-secret-detail");
    expect(response.body).toContain("Internal Server Error");

    await app.close();
  });
});

describe("rate limiting", () => {
  it("should render the simulation rather than JSON when the limit is exceeded", async () => {
    const app = buildTestApp({ RATE_LIMIT_MAX: "2", TRUST_PROXY: "true" });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await app.inject({
        method: "GET",
        url: "/x",
        headers: { "x-forwarded-for": "9.9.9.9" },
      });
    }

    const limited = await app.inject({
      method: "GET",
      url: "/x",
      headers: { "x-forwarded-for": "9.9.9.9" },
    });

    expect(limited.statusCode).toBe(503);
    expect(limited.headers.server).toBe("Apache/2.4.62 (Ubuntu)");
    expect(limited.body).not.toContain('"statusCode"');

    await app.close();
  });
});

describe("trust proxy boundary", () => {
  it("should ignore a forwarded header by default", async () => {
    const seen: string[] = [];
    const config = loadConfig({}, { simulationIds: simulationIds() });
    const app = buildApp({
      config,
      selectSimulation: () => apache,
      onRequestAddress: (address) => seen.push(address),
    });

    await app.inject({
      method: "GET",
      url: "/x",
      headers: { "x-forwarded-for": "9.9.9.9" },
    });

    expect(seen[0]).not.toBe("9.9.9.9");

    await app.close();
  });

  it("should honour a forwarded header when the proxy is trusted", async () => {
    const seen: string[] = [];
    const config = loadConfig(
      { TRUST_PROXY: "true" },
      { simulationIds: simulationIds() },
    );
    const app = buildApp({
      config,
      selectSimulation: () => apache,
      onRequestAddress: (address) => seen.push(address),
    });

    await app.inject({
      method: "GET",
      url: "/x",
      headers: { "x-forwarded-for": "9.9.9.9" },
    });

    expect(seen[0]).toBe("9.9.9.9");

    await app.close();
  });
});

describe("geolocation wiring", () => {
  it("should not call the geolocation lookup when it is disabled", async () => {
    const locate = vi.fn().mockResolvedValue(undefined);
    const config = loadConfig({}, { simulationIds: simulationIds() });
    const app = buildApp({
      config,
      selectSimulation: () => apache,
      geo: { locate },
    });

    await app.inject({ method: "GET", url: "/x" });

    expect(locate).not.toHaveBeenCalled();

    await app.close();
  });

  it("should call the geolocation lookup when it is enabled", async () => {
    const locate = vi.fn().mockResolvedValue(undefined);
    const config = loadConfig(
      { GEO_ENABLED: "true" },
      { simulationIds: simulationIds() },
    );
    const app = buildApp({
      config,
      selectSimulation: () => apache,
      geo: { locate },
    });

    await app.inject({ method: "GET", url: "/x" });

    expect(locate).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it("should still render the simulation when the lookup rejects", async () => {
    const locate = vi.fn().mockRejectedValue(new Error("boom"));
    const config = loadConfig(
      { GEO_ENABLED: "true" },
      { simulationIds: simulationIds() },
    );
    const app = buildApp({
      config,
      selectSimulation: () => apache,
      geo: { locate },
    });

    const response = await app.inject({ method: "GET", url: "/x" });

    expect(response.statusCode).toBe(404);
    expect(response.headers.server).toBe("Apache/2.4.62 (Ubuntu)");

    await app.close();
  });
});

describe("per-request simulation selection", () => {
  it("should ask the selector on every request", async () => {
    const selectSimulation = vi.fn().mockReturnValue(apache);
    const config = loadConfig({}, { simulationIds: simulationIds() });
    const app = buildApp({ config, selectSimulation });

    await app.inject({ method: "GET", url: "/a" });
    await app.inject({ method: "GET", url: "/b" });

    expect(selectSimulation).toHaveBeenCalledTimes(2);

    await app.close();
  });
});

describe("header hygiene", () => {
  const FRAMEWORK_HEADERS = new Set([
    "content-length",
    "connection",
    "date",
    "transfer-encoding",
    "keep-alive",
  ]);

  it("should emit no header the simulation did not declare", async () => {
    const app = buildTestApp();

    const response = await app.inject({ method: "GET", url: "/x" });
    const declared = new Set(
      Object.keys(
        apache.headers({
          path: "/x",
          method: "GET",
          statusCode: 404,
          host: "localhost",
          now: new Date(),
        }),
      ).map((name) => name.toLowerCase()),
    );

    declared.add("x-simulated-response");

    const unexpected = Object.keys(response.headers).filter(
      (name) => !declared.has(name) && !FRAMEWORK_HEADERS.has(name),
    );

    expect(unexpected).toEqual([]);

    await app.close();
  });

  it("should not leak rate-limit headers on an ordinary response", async () => {
    const app = buildTestApp();

    const response = await app.inject({ method: "GET", url: "/x" });

    expect(response.headers["x-ratelimit-limit"]).toBeUndefined();
    expect(response.headers["x-ratelimit-remaining"]).toBeUndefined();
    expect(response.headers["x-ratelimit-reset"]).toBeUndefined();

    await app.close();
  });

  it("should not leak rate-limit or retry headers on a throttled response", async () => {
    const app = buildTestApp({ RATE_LIMIT_MAX: "1", TRUST_PROXY: "true" });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await app.inject({
        method: "GET",
        url: "/x",
        headers: { "x-forwarded-for": "9.9.9.9" },
      });
    }

    const limited = await app.inject({
      method: "GET",
      url: "/x",
      headers: { "x-forwarded-for": "9.9.9.9" },
    });

    expect(limited.statusCode).toBe(503);
    expect(limited.headers["x-ratelimit-limit"]).toBeUndefined();
    expect(limited.headers["retry-after"]).toBeUndefined();

    await app.close();
  });

  it("should not leak the internal simulation header", async () => {
    const app = buildTestApp();

    const response = await app.inject({ method: "GET", url: "/x" });

    expect(response.headers["x-ip-vulture-simulation"]).toBeUndefined();

    await app.close();
  });
});
