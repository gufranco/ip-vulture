import { describe, expect, it } from "vitest";
import {
  collectErrors,
  parseBoolean,
  parseEnum,
  parseInteger,
  parseList,
  parseString,
  unwrap,
} from "../parse.js";

describe("parseInteger", () => {
  const bounds = { min: 1, max: 65535 };

  it("should return the fallback when the variable is unset", () => {
    const result = parseInteger({}, "PORT", 3000, bounds);

    expect(result).toEqual({ ok: true, value: 3000 });
  });

  it("should return the fallback when the variable is an empty string", () => {
    const result = parseInteger({ PORT: "" }, "PORT", 3000, bounds);

    expect(result).toEqual({ ok: true, value: 3000 });
  });

  it("should return the fallback when the variable is only whitespace", () => {
    const result = parseInteger({ PORT: "   " }, "PORT", 3000, bounds);

    expect(result).toEqual({ ok: true, value: 3000 });
  });

  it("should parse a valid integer", () => {
    const result = parseInteger({ PORT: "8080" }, "PORT", 3000, bounds);

    expect(result).toEqual({ ok: true, value: 8080 });
  });

  it("should trim surrounding whitespace before parsing", () => {
    const result = parseInteger({ PORT: " 8080 " }, "PORT", 3000, bounds);

    expect(result).toEqual({ ok: true, value: 8080 });
  });

  it("should fail on a non-numeric value", () => {
    const result = parseInteger({ PORT: "abc" }, "PORT", 3000, bounds);

    expect(result).toEqual({
      ok: false,
      error: { variable: "PORT", reason: '"abc" is not an integer' },
    });
  });

  it("should fail on a fractional value", () => {
    const result = parseInteger({ PORT: "80.5" }, "PORT", 3000, bounds);

    expect(result.ok).toBe(false);
  });

  it("should fail below the lower bound", () => {
    const result = parseInteger({ PORT: "0" }, "PORT", 3000, bounds);

    expect(result).toEqual({
      ok: false,
      error: {
        variable: "PORT",
        reason: "0 is outside the range 1 to 65535",
      },
    });
  });

  it("should fail above the upper bound", () => {
    const result = parseInteger({ PORT: "70000" }, "PORT", 3000, bounds);

    expect(result.ok).toBe(false);
  });

  it("should accept both boundary values", () => {
    expect(parseInteger({ PORT: "1" }, "PORT", 3000, bounds).ok).toBe(true);
    expect(parseInteger({ PORT: "65535" }, "PORT", 3000, bounds).ok).toBe(true);
  });
});

describe("parseString", () => {
  it("should return the fallback when unset", () => {
    const result = parseString({}, "HOST", "0.0.0.0");

    expect(result).toBe("0.0.0.0");
  });

  it("should return the fallback when empty", () => {
    const result = parseString({ HOST: "" }, "HOST", "0.0.0.0");

    expect(result).toBe("0.0.0.0");
  });

  it("should return the trimmed value when set", () => {
    const result = parseString({ HOST: " localhost " }, "HOST", "0.0.0.0");

    expect(result).toBe("localhost");
  });
});

describe("parseBoolean", () => {
  it("should return the fallback when unset", () => {
    const result = parseBoolean({}, "GEO_ENABLED", false);

    expect(result).toEqual({ ok: true, value: false });
  });

  it.each(["true", "TRUE", "1", "yes", "YES"])(
    "should parse %s as true",
    (raw) => {
      const result = parseBoolean({ FLAG: raw }, "FLAG", false);

      expect(result).toEqual({ ok: true, value: true });
    },
  );

  it.each(["false", "FALSE", "0", "no", "NO"])(
    "should parse %s as false",
    (raw) => {
      const result = parseBoolean({ FLAG: raw }, "FLAG", true);

      expect(result).toEqual({ ok: true, value: false });
    },
  );

  it("should fail on an unrecognized value", () => {
    const result = parseBoolean({ FLAG: "maybe" }, "FLAG", false);

    expect(result).toEqual({
      ok: false,
      error: {
        variable: "FLAG",
        reason: '"maybe" is not a boolean. Use true or false',
      },
    });
  });
});

describe("parseEnum", () => {
  const allowed = ["startup", "request"] as const;

  it("should return the fallback when unset", () => {
    const result = parseEnum({}, "RANDOM_SCOPE", allowed, "startup");

    expect(result).toEqual({ ok: true, value: "startup" });
  });

  it("should return the value when it is allowed", () => {
    const result = parseEnum(
      { RANDOM_SCOPE: "request" },
      "RANDOM_SCOPE",
      allowed,
      "startup",
    );

    expect(result).toEqual({ ok: true, value: "request" });
  });

  it("should fail on a value outside the allowed set and list the options", () => {
    const result = parseEnum(
      { RANDOM_SCOPE: "hourly" },
      "RANDOM_SCOPE",
      allowed,
      "startup",
    );

    expect(result).toEqual({
      ok: false,
      error: {
        variable: "RANDOM_SCOPE",
        reason: '"hourly" is not one of: startup, request',
      },
    });
  });

  it("should be case sensitive", () => {
    const result = parseEnum(
      { RANDOM_SCOPE: "STARTUP" },
      "RANDOM_SCOPE",
      allowed,
      "startup",
    );

    expect(result.ok).toBe(false);
  });
});

describe("parseList", () => {
  it("should return the fallback when unset", () => {
    const result = parseList({}, "IP_BLOCKLIST", []);

    expect(result).toEqual({ ok: true, value: [] });
  });

  it("should split on commas and trim each entry", () => {
    const result = parseList(
      { IP_BLOCKLIST: "10.0.0.0/8, 192.168.0.0/16 ,172.16.0.0/12" },
      "IP_BLOCKLIST",
      [],
    );

    expect(result).toEqual({
      ok: true,
      value: ["10.0.0.0/8", "192.168.0.0/16", "172.16.0.0/12"],
    });
  });

  it("should drop empty entries produced by trailing or repeated commas", () => {
    const result = parseList({ LIST: "a,,b," }, "LIST", []);

    expect(result).toEqual({ ok: true, value: ["a", "b"] });
  });

  it("should return a frozen array", () => {
    const result = parseList({ LIST: "a,b" }, "LIST", []);

    expect(Object.isFrozen(unwrap(result))).toBe(true);
  });
});

describe("collectErrors", () => {
  it("should return an empty list when every result succeeded", () => {
    const results = [parseInteger({}, "PORT", 3000, { min: 1, max: 65535 })];

    expect(collectErrors(results)).toEqual([]);
  });

  it("should collect every failure rather than stopping at the first", () => {
    const results = [
      parseInteger({ PORT: "abc" }, "PORT", 3000, { min: 1, max: 65535 }),
      parseBoolean({ FLAG: "maybe" }, "FLAG", false),
      parseEnum({ MODE: "nope" }, "MODE", ["a", "b"] as const, "a"),
    ];

    const errors = collectErrors(results);

    expect(errors).toHaveLength(3);
    expect(errors.map((error) => error.variable)).toEqual([
      "PORT",
      "FLAG",
      "MODE",
    ]);
  });

  it("should skip successes while collecting failures", () => {
    const results = [
      parseInteger({}, "PORT", 3000, { min: 1, max: 65535 }),
      parseBoolean({ FLAG: "maybe" }, "FLAG", false),
    ];

    const errors = collectErrors(results);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.variable).toBe("FLAG");
  });
});

describe("unwrap", () => {
  it("should return the value of a successful parse", () => {
    const result = parseInteger({ PORT: "8080" }, "PORT", 3000, {
      min: 1,
      max: 65535,
    });

    expect(unwrap(result)).toBe(8080);
  });

  it("should throw when given a failed parse", () => {
    const result = parseBoolean({ FLAG: "maybe" }, "FLAG", false);

    expect(() => unwrap(result)).toThrow("FLAG");
  });
});
