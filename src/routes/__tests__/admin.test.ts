import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { loadConfig } from "../../config/config.js";
import { createAccessLog } from "../../monitoring/accessLog.js";
import { findSimulation, simulationIds } from "../../simulations/catalogue.js";

function requireSimulation(id: string) {
  const simulation = findSimulation(id);

  if (simulation === undefined) {
    throw new Error(`catalogue is missing the ${id} simulation`);
  }

  return simulation;
}

const apache = requireSimulation("apache");

faker.seed(20260817);

const adminUser = faker.internet.username();
const adminSecret = faker.internet.jwt();

const enabledEnv = {
  ADMIN_ENABLED: "true",
  ADMIN_USER: adminUser,
  ADMIN_PASSWORD: adminSecret,
};

function basic(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

function buildWithAdmin(env: Record<string, string> = enabledEnv) {
  const config = loadConfig(env, { simulationIds: simulationIds() });
  const accessLog = createAccessLog({ capacity: 50 });

  return {
    app: buildApp({ config, selectSimulation: () => apache, accessLog }),
    accessLog,
    config,
  };
}

describe("admin route when disabled", () => {
  it("should render the simulation rather than challenge for credentials", async () => {
    const { app } = buildWithAdmin({});

    const response = await app.inject({ method: "GET", url: "/__admin" });

    expect(response.statusCode).toBe(404);
    expect(response.headers["www-authenticate"]).toBeUndefined();
    expect(response.headers.server).toBe("Apache/2.4.62 (Ubuntu)");

    await app.close();
  });

  it("should not reveal the admin path through a different status", async () => {
    const { app } = buildWithAdmin({});

    const admin = await app.inject({ method: "GET", url: "/__admin" });
    const ordinary = await app.inject({ method: "GET", url: "/ordinary" });

    expect(admin.statusCode).toBe(ordinary.statusCode);
    expect(admin.headers["content-type"]).toBe(
      ordinary.headers["content-type"],
    );

    await app.close();
  });
});

describe("admin authentication", () => {
  it("should challenge when no credentials are supplied", async () => {
    const { app } = buildWithAdmin();

    const response = await app.inject({ method: "GET", url: "/__admin" });

    expect(response.statusCode).toBe(401);
    expect(response.headers["www-authenticate"]).toContain("Basic");

    await app.close();
  });

  it("should reject a wrong password", async () => {
    const { app } = buildWithAdmin();

    const response = await app.inject({
      method: "GET",
      url: "/__admin",
      headers: { authorization: basic(adminUser, faker.internet.jwt()) },
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });

  it("should reject a wrong user", async () => {
    const { app } = buildWithAdmin();

    const response = await app.inject({
      method: "GET",
      url: "/__admin",
      headers: { authorization: basic(faker.internet.username(), adminSecret) },
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });

  it("should reject a malformed authorization header", async () => {
    const { app } = buildWithAdmin();

    const response = await app.inject({
      method: "GET",
      url: "/__admin",
      headers: { authorization: "Bearer something" },
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });

  it("should accept correct credentials", async () => {
    const { app } = buildWithAdmin();

    const response = await app.inject({
      method: "GET",
      url: "/__admin",
      headers: { authorization: basic(adminUser, adminSecret) },
    });

    expect(response.statusCode).toBe(200);

    await app.close();
  });
});

describe("admin views", () => {
  it("should render recorded access entries", async () => {
    const { app, accessLog } = buildWithAdmin();

    accessLog.record({
      timestamp: "2026-08-16T10:00:00.000Z",
      method: "GET",
      path: "/marker-path",
      statusCode: 404,
      ip: "203.0.113.7",
      userAgent: "curl/8.7.1",
      referer: "",
      host: "localhost",
      protocol: "http",
      durationMs: 2,
      simulationId: "apache",
      classification: "bot",
    });

    const response = await app.inject({
      method: "GET",
      url: "/__admin",
      headers: { authorization: basic(adminUser, adminSecret) },
    });

    expect(response.body).toContain("/marker-path");
    expect(response.body).toContain("203.0.113.7");

    await app.close();
  });

  it("should serve JSON on the json endpoint", async () => {
    const { app, accessLog } = buildWithAdmin();

    accessLog.record({
      timestamp: "2026-08-16T10:00:00.000Z",
      method: "GET",
      path: "/json-path",
      statusCode: 404,
      ip: "203.0.113.7",
      userAgent: "curl/8.7.1",
      referer: "",
      host: "localhost",
      protocol: "http",
      durationMs: 2,
      simulationId: "apache",
      classification: "bot",
    });

    const response = await app.inject({
      method: "GET",
      url: "/__admin/json",
      headers: { authorization: basic(adminUser, adminSecret) },
    });

    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.json().records[0].path).toBe("/json-path");
    expect(response.json().stats.recorded).toBe(1);

    await app.close();
  });

  it("should set a restrictive content security policy", async () => {
    const { app } = buildWithAdmin();

    const response = await app.inject({
      method: "GET",
      url: "/__admin",
      headers: { authorization: basic(adminUser, adminSecret) },
    });

    expect(response.headers["content-security-policy"]).toContain(
      "default-src 'none'",
    );

    await app.close();
  });
});

describe("admin stored XSS protection", () => {
  it.each([
    ["userAgent", "<script>alert('ua')</script>"],
    ["referer", "<script>alert('ref')</script>"],
    ["path", "/<script>alert('path')</script>"],
    ["ip", "<img src=x onerror=alert(1)>"],
    ["simulationId", "<svg onload=alert(1)>"],
  ])("should escape a hostile %s before rendering", async (field, payload) => {
    const { app, accessLog } = buildWithAdmin();

    accessLog.record({
      timestamp: "2026-08-16T10:00:00.000Z",
      method: "GET",
      path: "/x",
      statusCode: 404,
      ip: "203.0.113.7",
      userAgent: "curl",
      referer: "",
      host: "localhost",
      protocol: "http",
      durationMs: 2,
      simulationId: "apache",
      classification: "bot",
      [field]: payload,
    });

    const response = await app.inject({
      method: "GET",
      url: "/__admin",
      headers: { authorization: basic(adminUser, adminSecret) },
    });

    const body = response.body;
    const tableStart = body.indexOf("<tbody>");
    const rendered = body.slice(tableStart);

    expect(rendered).not.toMatch(/<(script|img|svg|iframe|object|embed)\b/i);
    expect(rendered).toContain("&lt;");
    expect(rendered).not.toContain(payload);

    await app.close();
  });

  it("should escape the quote characters that would break out of an attribute", async () => {
    const { app, accessLog } = buildWithAdmin();

    accessLog.record({
      timestamp: "2026-08-16T10:00:00.000Z",
      method: "GET",
      path: `/x"onmouseover="alert(1)`,
      statusCode: 404,
      ip: "203.0.113.7",
      userAgent: "curl",
      referer: "",
      host: "localhost",
      protocol: "http",
      durationMs: 2,
      simulationId: "apache",
      classification: "bot",
    });

    const response = await app.inject({
      method: "GET",
      url: "/__admin",
      headers: { authorization: basic(adminUser, adminSecret) },
    });

    const rendered = response.body.slice(response.body.indexOf("<tbody>"));

    expect(rendered).toContain("&quot;");
    expect(rendered).not.toContain('"onmouseover="');

    await app.close();
  });
});

describe("admin isolation from the access log", () => {
  it("should not record its own requests", async () => {
    const { app, accessLog } = buildWithAdmin();

    await app.inject({
      method: "GET",
      url: "/__admin",
      headers: { authorization: basic(adminUser, adminSecret) },
    });

    expect(accessLog.size()).toBe(0);

    await app.close();
  });

  it("should not record a failed authentication attempt as ordinary traffic", async () => {
    const { app, accessLog } = buildWithAdmin();

    await app.inject({ method: "GET", url: "/__admin" });

    expect(accessLog.size()).toBe(0);

    await app.close();
  });
});

describe("admin filtering", () => {
  function seed(accessLog: ReturnType<typeof createAccessLog>) {
    accessLog.record({
      timestamp: "2026-08-16T10:00:00.000Z",
      method: "GET",
      path: "/human-path",
      statusCode: 404,
      ip: "203.0.113.7",
      userAgent: "Mozilla/5.0",
      referer: "",
      host: "localhost",
      protocol: "http",
      durationMs: 2,
      simulationId: "apache",
      classification: "human",
    });
    accessLog.record({
      timestamp: "2026-08-16T10:00:01.000Z",
      method: "GET",
      path: "/bot-path",
      statusCode: 503,
      ip: "198.51.100.9",
      userAgent: "curl/8.7.1",
      referer: "",
      host: "localhost",
      protocol: "http",
      durationMs: 3,
      simulationId: "nginx",
      classification: "bot",
    });
  }

  const auth = { authorization: basic(adminUser, adminSecret) };

  it("should filter by classification", async () => {
    const { app, accessLog } = buildWithAdmin();
    seed(accessLog);

    const response = await app.inject({
      method: "GET",
      url: "/__admin/json?classification=bot",
      headers: auth,
    });

    expect(response.json().records).toHaveLength(1);
    expect(response.json().records[0].path).toBe("/bot-path");

    await app.close();
  });

  it("should filter by status code", async () => {
    const { app, accessLog } = buildWithAdmin();
    seed(accessLog);

    const response = await app.inject({
      method: "GET",
      url: "/__admin/json?status=404",
      headers: auth,
    });

    expect(response.json().records).toHaveLength(1);
    expect(response.json().records[0].statusCode).toBe(404);

    await app.close();
  });

  it("should filter by address fragment", async () => {
    const { app, accessLog } = buildWithAdmin();
    seed(accessLog);

    const response = await app.inject({
      method: "GET",
      url: "/__admin/json?ip=198.51",
      headers: auth,
    });

    expect(response.json().records).toHaveLength(1);

    await app.close();
  });

  it("should apply a limit", async () => {
    const { app, accessLog } = buildWithAdmin();
    seed(accessLog);

    const response = await app.inject({
      method: "GET",
      url: "/__admin/json?limit=1",
      headers: auth,
    });

    expect(response.json().records).toHaveLength(1);

    await app.close();
  });

  it("should ignore a non-numeric limit", async () => {
    const { app, accessLog } = buildWithAdmin();
    seed(accessLog);

    const response = await app.inject({
      method: "GET",
      url: "/__admin/json?limit=abc",
      headers: auth,
    });

    expect(response.json().records).toHaveLength(2);

    await app.close();
  });

  it("should combine filters", async () => {
    const { app, accessLog } = buildWithAdmin();
    seed(accessLog);

    const response = await app.inject({
      method: "GET",
      url: "/__admin/json?classification=bot&status=404",
      headers: auth,
    });

    expect(response.json().records).toHaveLength(0);

    await app.close();
  });

  it("should escape a hostile filter value in the HTML view", async () => {
    const { app, accessLog } = buildWithAdmin();
    seed(accessLog);

    const response = await app.inject({
      method: "GET",
      url: "/__admin?ip=%3Cscript%3Ealert(1)%3C%2Fscript%3E",
      headers: auth,
    });

    expect(response.body).not.toContain("<script>alert");

    await app.close();
  });
});
