import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../config.js";

const simulationIds = ["apache", "nginx", "iis"] as const;
const options = { simulationIds };

faker.seed(20260817);

const adminUser = faker.internet.username();
const adminSecret = faker.internet.jwt();

describe("loadConfig defaults", () => {
  it("should load every default from an empty environment", () => {
    const config = loadConfig({}, options);

    expect(config.port).toBe(3000);
    expect(config.host).toBe("0.0.0.0");
    expect(config.trustProxy).toBe(false);
    expect(config.disclosure).toBe("off");
    expect(config.simulation).toEqual({ mode: "fixed", id: "apache" });
  });

  it("should default geolocation to disabled", () => {
    const config = loadConfig({}, options);

    expect(config.geo.enabled).toBe(false);
  });

  it("should let the operator opt into the disclosure marker", () => {
    expect(
      loadConfig({ SIMULATION_DISCLOSURE: "both" }, options).disclosure,
    ).toBe("both");
    expect(
      loadConfig({ SIMULATION_DISCLOSURE: "header" }, options).disclosure,
    ).toBe("header");
  });

  it("should return a frozen object", () => {
    const config = loadConfig({}, options);

    expect(Object.isFrozen(config)).toBe(true);
  });
});

describe("loadConfig simulation selection", () => {
  it("should accept a known simulation id", () => {
    const config = loadConfig({ SERVER_TEMPLATE: "nginx" }, options);

    expect(config.simulation).toEqual({ mode: "fixed", id: "nginx" });
  });

  it("should reject an unknown simulation id and list the valid options", () => {
    expect(() => loadConfig({ SERVER_TEMPLATE: "apache2" }, options)).toThrow(
      /apache, nginx, iis, random/,
    );
  });

  it("should treat random as a selection mode rather than an id", () => {
    const config = loadConfig({ SERVER_TEMPLATE: "random" }, options);

    expect(config.simulation).toEqual({ mode: "random", scope: "startup" });
  });

  it("should carry the random scope when set to request", () => {
    const config = loadConfig(
      { SERVER_TEMPLATE: "random", RANDOM_SCOPE: "request" },
      options,
    );

    expect(config.simulation).toEqual({ mode: "random", scope: "request" });
  });

  it("should reject an unknown random scope", () => {
    expect(() =>
      loadConfig(
        { SERVER_TEMPLATE: "random", RANDOM_SCOPE: "hourly" },
        options,
      ),
    ).toThrow(/RANDOM_SCOPE/);
  });
});

describe("loadConfig trust proxy", () => {
  it("should default to false so forwarded headers are ignored", () => {
    expect(loadConfig({}, options).trustProxy).toBe(false);
  });

  it("should accept false explicitly", () => {
    expect(loadConfig({ TRUST_PROXY: "false" }, options).trustProxy).toBe(
      false,
    );
  });

  it("should accept true", () => {
    expect(loadConfig({ TRUST_PROXY: "true" }, options).trustProxy).toBe(true);
  });

  it("should reject a hop count", () => {
    expect(() => loadConfig({ TRUST_PROXY: "1" }, options)).toThrow(
      /TRUST_PROXY/,
    );
  });

  it("should accept a CIDR list", () => {
    const config = loadConfig(
      { TRUST_PROXY: "10.0.0.0/8, 127.0.0.1" },
      options,
    );

    expect(config.trustProxy).toEqual(["10.0.0.0/8", "127.0.0.1"]);
  });

  it("should reject a negative hop count", () => {
    expect(() => loadConfig({ TRUST_PROXY: "-1" }, options)).toThrow(
      /TRUST_PROXY/,
    );
  });

  it("should reject a list that contains no usable entries", () => {
    expect(() => loadConfig({ TRUST_PROXY: ",,," }, options)).toThrow(
      /TRUST_PROXY/,
    );
  });
});

describe("loadConfig validation failures", () => {
  it("should reject a non-integer port", () => {
    expect(() => loadConfig({ PORT: "abc" }, options)).toThrow(/PORT/);
  });

  it("should reject a port outside the valid range", () => {
    expect(() => loadConfig({ PORT: "70000" }, options)).toThrow(/PORT/);
  });

  it("should reject an unknown disclosure mode", () => {
    expect(() =>
      loadConfig({ SIMULATION_DISCLOSURE: "loud" }, options),
    ).toThrow(/SIMULATION_DISCLOSURE/);
  });

  it("should report every failure at once rather than stopping at the first", () => {
    let caught: unknown;

    try {
      loadConfig(
        { PORT: "abc", GEO_ENABLED: "maybe", SIMULATION_DISCLOSURE: "loud" },
        options,
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ConfigError);
    expect((caught as ConfigError).errors).toHaveLength(3);
    expect((caught as ConfigError).errors.map((e) => e.variable)).toEqual([
      "PORT",
      "SIMULATION_DISCLOSURE",
      "GEO_ENABLED",
    ]);
  });

  it("should name every failing variable in the thrown message", () => {
    expect(() =>
      loadConfig({ PORT: "abc", GEO_ENABLED: "maybe" }, options),
    ).toThrow(/PORT[\s\S]*GEO_ENABLED/);
  });
});

describe("loadConfig geolocation", () => {
  it("should read the geolocation settings when enabled", () => {
    const config = loadConfig(
      {
        GEO_ENABLED: "true",
        GEO_TIMEOUT_MS: "2000",
        GEO_BUDGET_PER_MINUTE: "30",
        GEO_CACHE_TTL_SECONDS: "600",
        GEO_CACHE_MAX: "100",
      },
      options,
    );

    expect(config.geo).toEqual({
      enabled: true,
      timeoutMs: 2000,
      budgetPerMinute: 30,
      cacheTtlSeconds: 600,
      cacheMax: 100,
    });
  });

  it("should reject a zero geolocation budget", () => {
    expect(() => loadConfig({ GEO_BUDGET_PER_MINUTE: "0" }, options)).toThrow(
      /GEO_BUDGET_PER_MINUTE/,
    );
  });
});

describe("loadConfig feature gating", () => {
  it("should disable the admin panel by default", () => {
    expect(loadConfig({}, options).admin.enabled).toBe(false);
  });

  it("should require credentials when the admin panel is enabled", () => {
    expect(() => loadConfig({ ADMIN_ENABLED: "true" }, options)).toThrow(
      /ADMIN_USER[\s\S]*ADMIN_PASSWORD/,
    );
  });

  it("should accept the admin panel with credentials supplied", () => {
    const config = loadConfig(
      {
        ADMIN_ENABLED: "true",
        ADMIN_USER: adminUser,
        ADMIN_PASSWORD: adminSecret,
      },
      options,
    );

    expect(config.admin.user).toBe(adminUser);
    expect(config.admin.path).toBe("/__admin");
  });

  it("should disable alerting by default", () => {
    expect(loadConfig({}, options).alerts.enabled).toBe(false);
  });

  it("should require mail settings when alerting is enabled", () => {
    expect(() => loadConfig({ ALERT_ENABLED: "true" }, options)).toThrow(
      /ALERT_FROM[\s\S]*ALERT_TO[\s\S]*SMTP_HOST/,
    );
  });

  it("should enable every reputation feed by default", () => {
    const config = loadConfig({}, options);

    expect(config.feeds.enabled).toBe(true);
    expect(config.feeds.names.length).toBeGreaterThan(0);
  });

  it("should not require feeds to load for startup by default", () => {
    expect(loadConfig({}, options).feeds.required).toBe(false);
  });

  it("should reject an unknown feed name", () => {
    expect(() => loadConfig({ FEEDS: "not-a-feed" }, options)).toThrow(/FEEDS/);
  });

  it("should reject an unknown classification in a policy", () => {
    expect(() => loadConfig({ RECORD_POLICY: "wizard" }, options)).toThrow(
      /RECORD_POLICY/,
    );
  });

  it("should default the record policy to everything except blocked traffic", () => {
    expect(loadConfig({}, options).defense.recordPolicy).toEqual([
      "human",
      "bot",
      "scanner",
    ]);
  });

  it("should default the alert policy to human traffic only", () => {
    expect(loadConfig({}, options).defense.alertPolicy).toEqual(["human"]);
  });

  it("should parse an era filter", () => {
    expect(
      loadConfig({ SIMULATION_ERA: "1990s" }, options).simulationFilter,
    ).toEqual({ era: "1990s" });
  });

  it("should reject an unknown era filter", () => {
    expect(() => loadConfig({ SIMULATION_ERA: "1980s" }, options)).toThrow(
      /SIMULATION_ERA/,
    );
  });

  it("should leave the simulation filter empty by default", () => {
    expect(loadConfig({}, options).simulationFilter).toEqual({});
  });
});

describe("loadConfig rate limit", () => {
  it("should default to 40 requests per minute", () => {
    const config = loadConfig({}, options);

    expect(config.rateLimit).toEqual({ max: 40, windowMs: 60000 });
  });

  it("should read overrides", () => {
    const config = loadConfig(
      { RATE_LIMIT_MAX: "10", RATE_LIMIT_WINDOW_MS: "1000" },
      options,
    );

    expect(config.rateLimit).toEqual({ max: 10, windowMs: 1000 });
  });
});
