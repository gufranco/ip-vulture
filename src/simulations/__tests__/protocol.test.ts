import { describe, expect, it } from "vitest";
import {
  APACHE_PROTOCOL,
  buildHeaderLines,
  MINIMAL_PROTOCOL,
  NGINX_PROTOCOL,
  orderHeaders,
  type ProtocolProfile,
  reasonPhrase,
} from "../protocol.js";

describe("orderHeaders", () => {
  it("should emit Apache order", () => {
    const ordered = orderHeaders(APACHE_PROTOCOL, {
      "Content-Type": "text/html; charset=iso-8859-1",
      Server: "Apache/2.4.62 (Ubuntu)",
      "Content-Length": "236",
      Date: "Mon, 17 Aug 2026 12:00:00 GMT",
    });

    expect(ordered.map(([name]) => name)).toEqual([
      "Date",
      "Server",
      "Content-Length",
      "Content-Type",
    ]);
  });

  it("should emit nginx order, which differs from Apache", () => {
    const ordered = orderHeaders(NGINX_PROTOCOL, {
      "Content-Type": "text/html",
      Server: "nginx/1.27.4",
      "Content-Length": "153",
      Date: "Mon, 17 Aug 2026 12:00:00 GMT",
      Connection: "keep-alive",
    });

    expect(ordered.map(([name]) => name)).toEqual([
      "Server",
      "Date",
      "Content-Type",
      "Content-Length",
      "Connection",
    ]);
  });

  it("should place a header absent from the order list at the end", () => {
    const ordered = orderHeaders(APACHE_PROTOCOL, {
      Date: "d",
      "X-Custom": "v",
      Server: "s",
    });

    expect(ordered.at(-1)?.[0]).toBe("X-Custom");
  });

  it("should preserve the declared casing rather than the supplied casing", () => {
    const ordered = orderHeaders(APACHE_PROTOCOL, {
      "content-type": "text/html",
      server: "Apache",
      date: "d",
    });

    expect(ordered.map(([name]) => name)).toEqual([
      "Date",
      "Server",
      "Content-Type",
    ]);
  });

  it("should drop an empty header value", () => {
    const ordered = orderHeaders(APACHE_PROTOCOL, { Date: "d", Server: "" });

    expect(ordered.map(([name]) => name)).toEqual(["Date"]);
  });
});

describe("buildHeaderLines", () => {
  it("should flatten to the array writeHead expects", () => {
    const flat = buildHeaderLines(APACHE_PROTOCOL, {
      Date: "d",
      Server: "s",
    });

    expect(flat).toEqual(["Date", "d", "Server", "s"]);
  });
});

describe("connection policy", () => {
  it("should omit Connection on a keep-alive Apache response", () => {
    expect(APACHE_PROTOCOL.connectionHeader).toBe("on-close");
  });

  it("should always send Connection on nginx", () => {
    expect(NGINX_PROTOCOL.connectionHeader).toBe("always");
  });
});

describe("method semantics", () => {
  it("should answer an unknown method with 501 on Apache", () => {
    expect(APACHE_PROTOCOL.unknownMethodStatus).toBe(501);
  });

  it("should answer an unknown method with 405 on nginx", () => {
    expect(NGINX_PROTOCOL.unknownMethodStatus).toBe(405);
  });

  it("should answer OPTIONS star with 200 on Apache and 400 on nginx", () => {
    expect(APACHE_PROTOCOL.optionsStarStatus).toBe(200);
    expect(NGINX_PROTOCOL.optionsStarStatus).toBe(400);
  });

  it("should answer a bad HTTP version with 505 on nginx", () => {
    expect(NGINX_PROTOCOL.badVersionStatus).toBe(505);
  });

  it("should advertise an Allow list on Apache", () => {
    expect(APACHE_PROTOCOL.allow).toContain("GET");
    expect(APACHE_PROTOCOL.allow).toContain("TRACE");
  });
});

describe("reasonPhrase", () => {
  it.each([
    [200, "OK"],
    [400, "Bad Request"],
    [404, "Not Found"],
    [405, "Not Allowed"],
    [501, "Not Implemented"],
    [505, "HTTP Version Not Supported"],
  ])("should map %i to %s", (code, phrase) => {
    expect(reasonPhrase(NGINX_PROTOCOL, code)).toBe(phrase);
  });

  it("should use the server's own wording where it differs", () => {
    expect(reasonPhrase(APACHE_PROTOCOL, 405)).toBe("Method Not Allowed");
    expect(reasonPhrase(NGINX_PROTOCOL, 405)).toBe("Not Allowed");
  });

  it("should fall back for an unmapped code", () => {
    expect(reasonPhrase(APACHE_PROTOCOL, 599)).toBe("Error");
  });
});

describe("profiles are complete", () => {
  const profiles: readonly [string, ProtocolProfile][] = [
    ["apache", APACHE_PROTOCOL],
    ["nginx", NGINX_PROTOCOL],
    ["minimal", MINIMAL_PROTOCOL],
  ];

  it.each(profiles)("%s should declare a header order", (_name, profile) => {
    expect(profile.headerOrder.length).toBeGreaterThan(0);
  });

  it.each(profiles)("%s should declare method semantics", (_name, profile) => {
    expect(profile.unknownMethodStatus).toBeGreaterThan(0);
    expect(profile.traceStatus).toBeGreaterThan(0);
    expect(profile.optionsStarStatus).toBeGreaterThan(0);
    expect(profile.badVersionStatus).toBeGreaterThan(0);
  });

  it.each(profiles)(
    "%s should use canonical header casing",
    (_name, profile) => {
      for (const name of profile.headerOrder) {
        expect(name).toMatch(/^[A-Z][A-Za-z-]*$/);
      }
    },
  );
});
