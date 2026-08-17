import { describe, expect, it } from "vitest";
import {
  charsetOf,
  Era,
  Genre,
  SUPPORTED_STATUS_CODES,
  statusText,
} from "../simulation.js";

describe("Era", () => {
  it("should span the 1990s to the 2020s", () => {
    expect(Object.values(Era)).toEqual(["1990s", "2000s", "2010s", "2020s"]);
  });
});

describe("Genre", () => {
  it("should separate vendor pages from creative ones", () => {
    expect(Object.values(Genre)).toEqual(["vendor", "creative"]);
  });
});

describe("SUPPORTED_STATUS_CODES", () => {
  it("should cover the client and server error codes the catch-all needs", () => {
    expect(SUPPORTED_STATUS_CODES).toEqual([
      400, 401, 403, 404, 410, 500, 502, 503, 504,
    ]);
  });

  it("should include 404 as the primary code", () => {
    expect(SUPPORTED_STATUS_CODES).toContain(404);
  });

  it("should include the codes the error and rate-limit handlers emit", () => {
    expect(SUPPORTED_STATUS_CODES).toContain(500);
    expect(SUPPORTED_STATUS_CODES).toContain(503);
  });
});

describe("statusText", () => {
  it.each([
    [400, "Bad Request"],
    [401, "Unauthorized"],
    [403, "Forbidden"],
    [404, "Not Found"],
    [410, "Gone"],
    [500, "Internal Server Error"],
    [502, "Bad Gateway"],
    [503, "Service Unavailable"],
    [504, "Gateway Timeout"],
  ])("should map %i to %s", (code, text) => {
    expect(statusText(code)).toBe(text);
  });

  it("should fall back to a generic label for an unmapped code", () => {
    expect(statusText(418)).toBe("Error");
  });
});

describe("charsetOf", () => {
  it("should extract a declared charset", () => {
    expect(charsetOf("text/html; charset=iso-8859-1")).toBe("iso-8859-1");
  });

  it("should be case insensitive on the parameter name", () => {
    expect(charsetOf("text/html; CHARSET=UTF-8")).toBe("utf-8");
  });

  it("should tolerate the absence of a space after the semicolon", () => {
    expect(charsetOf("text/html;charset=utf-8")).toBe("utf-8");
  });

  it("should default to utf-8 when no charset is declared", () => {
    expect(charsetOf("text/html")).toBe("utf-8");
  });

  it("should default to utf-8 when the header is absent", () => {
    expect(charsetOf(undefined)).toBe("utf-8");
  });
});
