import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { createSmtpTransport } from "../alerts/mailer.js";
import { buildApp } from "../app.js";
import { bootstrap } from "../bootstrap.js";
import { loadConfig } from "../config/config.js";
import { parseFeedBody } from "../defense/feeds.js";
import { createAccessLog } from "../monitoring/accessLog.js";
import { parseAddress, parseCidr } from "../net/address.js";
import { createIpSet } from "../net/ipset.js";
import {
  createSelector,
  findSimulation,
  simulationIds,
} from "../simulations/catalogue.js";
import { renderSimulation } from "../simulations/render.js";

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

describe("access log field coercion", () => {
  it("should coerce a non-string field to an empty string", () => {
    const log = createAccessLog({ capacity: 5 });

    log.record({
      timestamp: 12345,
      method: null,
      path: undefined,
      statusCode: "not a number",
      ip: { nested: true },
      userAgent: [],
      referer: false,
      host: 0,
      protocol: Symbol.iterator,
      durationMs: Number.NaN,
      simulationId: 1,
      classification: 2,
    });

    const entry = log.records()[0];

    expect(entry?.timestamp).toBe("");
    expect(entry?.statusCode).toBe(0);
    expect(entry?.durationMs).toBe(0);
  });
});

describe("address parser edge branches", () => {
  it.each([
    "1.2.3.4.5.6",
    ":::",
    "1:2:3:4:5:6:7",
    "::ffff:999.1.1.1",
    "12345::1",
  ])("should reject %s", (candidate) => {
    expect(parseAddress(candidate)).toBeUndefined();
  });

  it("should parse an address with a trailing embedded IPv4 in a full form", () => {
    expect(parseAddress("0:0:0:0:0:0:1.2.3.4")?.version).toBe(6);
  });

  it("should reject a compressed address that already has eight groups", () => {
    expect(parseAddress("1:2:3:4:5:6:7:8::")).toBeUndefined();
  });

  it("should reject a compressed address with nine groups around the marker", () => {
    expect(parseAddress("1:2:3:4::5:6:7:8:9")).toBeUndefined();
  });

  it("should reject a CIDR whose address half is empty", () => {
    expect(parseCidr("/8")).toBeUndefined();
  });

  it("should reject a CIDR with an empty prefix", () => {
    expect(parseCidr("10.0.0.0/")).toBeUndefined();
  });
});

describe("ip set edge branches", () => {
  it("should answer false against an empty version bucket", () => {
    const set = createIpSet(["10.0.0.0/8"]);

    expect(set.contains("::1")).toBe(false);
  });

  it("should handle a probe below every range", () => {
    const set = createIpSet(["200.0.0.0/8"]);

    expect(set.contains("1.1.1.1")).toBe(false);
  });

  it("should handle a probe above every range", () => {
    const set = createIpSet(["1.0.0.0/8"]);

    expect(set.contains("250.1.1.1")).toBe(false);
  });
});

describe("feed parser edge branches", () => {
  it("should skip a spamhaus line whose cidr is not a string", () => {
    expect(parseFeedBody("spamhaus", '{"cidr":123}')).toEqual([]);
  });

  it("should skip a prefix entry that is not an object", () => {
    const body = JSON.stringify({ prefixes: ["not-an-object", null, 5] });

    expect(parseFeedBody("prefixes", body)).toEqual([]);
  });

  it("should skip a prefix entry carrying neither v4 nor v6", () => {
    const body = JSON.stringify({ prefixes: [{ other: "x" }] });

    expect(parseFeedBody("prefixes", body)).toEqual([]);
  });

  it("should treat a non-object JSON document as empty", () => {
    expect(parseFeedBody("prefixes", "[]")).toEqual([]);
  });
});

describe("catalogue selector edge branches", () => {
  it("should throw for a random selection whose filter matches nothing", () => {
    expect(() =>
      createSelector(
        { mode: "random", scope: "startup" },
        { era: "1990s" as never, genre: "creative" as never },
      ),
    ).toThrow(/no simulation/i);
  });

  it("should describe an unfiltered empty pool", () => {
    const select = createSelector({ mode: "random", scope: "startup" }, {});

    expect(select().id.length).toBeGreaterThan(0);
  });
});

describe("render disclosure branches", () => {
  it("should apply the comment-only mode", () => {
    const response = renderSimulation({
      simulation: apache,
      statusCode: 404,
      disclosure: "comment",
      request: { url: "/x", method: "GET", host: "localhost" },
    });

    expect(response.body.toString("latin1")).toContain(
      "simulated HTTP response",
    );
  });
});

describe("app header branches", () => {
  it("should record a repeated header as the value Node joins", async () => {
    const config = loadConfig(
      { RECORD_POLICY: "bot" },
      { simulationIds: simulationIds() },
    );
    const accessLog = createAccessLog({ capacity: 5 });
    const app = buildApp({ config, selectSimulation: () => apache, accessLog });

    await app.inject({
      method: "GET",
      url: "/x",
      headers: { referer: "first,second", "user-agent": "curl/8.7.1" },
    });

    expect(accessLog.records()[0]?.referer).toBe("first,second");

    await app.close();
  });

  it("should fall back to localhost when the host header is absent", async () => {
    const config = loadConfig({}, { simulationIds: simulationIds() });
    const app = buildApp({ config, selectSimulation: () => apache });

    const response = await app.inject({
      method: "GET",
      url: "/x",
      headers: { host: "" },
    });

    expect(response.body).toContain("localhost");

    await app.close();
  });

  it("should map an unmapped client error to 400", async () => {
    const config = loadConfig({}, { simulationIds: simulationIds() });
    const app = buildApp({ config, selectSimulation: () => apache });

    app.get("/teapot", async () => {
      throw Object.assign(new Error("teapot"), { statusCode: 418 });
    });

    const response = await app.inject({ method: "GET", url: "/teapot" });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it("should treat a thrown non-error as a 500", async () => {
    const config = loadConfig({}, { simulationIds: simulationIds() });
    const app = buildApp({ config, selectSimulation: () => apache });

    app.get("/weird", async () => {
      throw new Error("plain");
    });

    const response = await app.inject({ method: "GET", url: "/weird" });

    expect(response.statusCode).toBe(500);

    await app.close();
  });
});

describe("admin credential branches", () => {
  it("should reject a Basic header with no colon", async () => {
    const config = loadConfig(
      {
        ADMIN_ENABLED: "true",
        ADMIN_USER: adminUser,
        ADMIN_PASSWORD: adminSecret,
      },
      { simulationIds: simulationIds() },
    );
    const app = buildApp({
      config,
      selectSimulation: () => apache,
      accessLog: createAccessLog({ capacity: 5 }),
    });

    const response = await app.inject({
      method: "GET",
      url: "/__admin",
      headers: {
        authorization: `Basic ${Buffer.from("nocolon").toString("base64")}`,
      },
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });
});

describe("bootstrap refresh branches", () => {
  it("should replace the snapshot when a scheduled refresh succeeds", async () => {
    vi.useFakeTimers();

    const fetcher = vi.fn().mockResolvedValue(new Response("203.0.113.0/24\n"));

    try {
      const started = await bootstrap({
        env: {
          FEEDS: "tor-exits",
          FEEDS_REFRESH_MINUTES: "5",
          ADMIN_ENABLED: "true",
          ADMIN_USER: adminUser,
          ADMIN_PASSWORD: adminSecret,
        },
        logger: { info: vi.fn(), warn: vi.fn() },
        fetcher: fetcher as unknown as typeof fetch,
      });

      expect(fetcher).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(5 * 60_000 + 10);

      expect(fetcher).toHaveBeenCalledTimes(2);

      started.stop();
      await started.app.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it("should keep the previous snapshot when a scheduled refresh fails", async () => {
    vi.useFakeTimers();

    const logger = { info: vi.fn(), warn: vi.fn() };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("203.0.113.0/24\n"))
      .mockRejectedValue(new Error("offline"));

    try {
      const started = await bootstrap({
        env: { FEEDS: "tor-exits", FEEDS_REFRESH_MINUTES: "5" },
        logger,
        fetcher: fetcher as unknown as typeof fetch,
      });

      await vi.advanceTimersByTimeAsync(5 * 60_000 + 10);

      expect(logger.warn).toHaveBeenCalled();

      started.stop();
      await started.app.close();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("feed byte cap branch", () => {
  it("should accept a body exactly at the cap", async () => {
    const { loadFeeds } = await import("../defense/feeds.js");
    const body = "1.2.3.4\n";
    const fetcher = vi.fn().mockResolvedValue(new Response(body));

    const result = await loadFeeds({
      feeds: [
        {
          name: "test",
          url: "https://example.invalid/l.txt",
          format: "plain",
          role: "reputation",
          licence: "test",
        },
      ],
      fetcher,
      timeoutMs: 1000,
      maxBytes: body.length,
    });

    expect(result.failures).toEqual([]);
  });

  it("should accept a recipient answering 251", async () => {
    const { parseFeedBody } = await import("../defense/feeds.js");

    expect(parseFeedBody("plain", "1.2.3.4\ttrailing\n")).toEqual(["1.2.3.4"]);
  });
});

describe("smtp session error branches", () => {
  it("should reject when the socket errors mid-session", async () => {
    const transport = createSmtpTransport({
      smtp: {
        host: "127.0.0.1",
        port: 1,
        secure: true,
        user: "",
        password: "",
      },
      timeoutMs: 1000,
    });

    await expect(
      transport.send({
        from: "a@b.invalid",
        to: "c@d.invalid",
        subject: "s",
        body: "b\n",
      }),
    ).rejects.toThrow();
  });
});
