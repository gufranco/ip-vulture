import { describe, expect, it } from "vitest";
import { Era, Genre } from "../../simulation.js";
import {
  caddy,
  envoy,
  haproxy,
  traefik,
  twentiesSimulations,
} from "../twenties.js";

const context = {
  path: "/api/v1/users",
  method: "GET",
  statusCode: 404,
  host: "edge.example.com",
  now: new Date("2026-08-16T00:00:00Z"),
};

describe("twentiesSimulations", () => {
  it("should all declare the 2020s era", () => {
    for (const simulation of twentiesSimulations) {
      expect(simulation.era).toBe(Era.Twenties);
    }
  });

  it("should all declare the vendor genre", () => {
    for (const simulation of twentiesSimulations) {
      expect(simulation.genre).toBe(Genre.Vendor);
    }
  });

  it("should never render the request path, matching modern edge defaults", () => {
    for (const simulation of twentiesSimulations) {
      expect(simulation.render(context)).not.toContain("/api/v1/users");
    }
  });
});

describe("caddy", () => {
  it("should return an empty body", () => {
    expect(caddy.render(context)).toBe("");
  });

  it("should not declare a content type", () => {
    expect(caddy.headers(context)["Content-Type"]).toBeUndefined();
  });

  it("should identify as Caddy", () => {
    expect(caddy.headers(context).Server).toBe("Caddy");
  });
});

describe("traefik", () => {
  it("should return plain text", () => {
    expect(traefik.headers(context)["Content-Type"]).toBe(
      "text/plain; charset=utf-8",
    );
  });

  it("should set nosniff", () => {
    expect(traefik.headers(context)["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("should render the lowercase Go-style message for 404", () => {
    expect(traefik.render(context)).toBe("404 page not found\n");
  });

  it("should render the status text for other codes", () => {
    expect(traefik.render({ ...context, statusCode: 503 })).toContain(
      "Service Unavailable",
    );
  });
});

describe("haproxy", () => {
  it("should set no-cache", () => {
    expect(haproxy.headers(context)["Cache-Control"]).toBe("no-cache");
  });

  it("should not set a Server header", () => {
    expect(haproxy.headers(context).Server).toBeUndefined();
  });

  it("should use its characteristic wording", () => {
    expect(haproxy.render(context)).toContain(
      "No server is available to handle this request.",
    );
  });
});

describe("envoy", () => {
  it("should identify as envoy", () => {
    expect(envoy.headers(context).Server).toBe("envoy");
  });

  it("should return plain text", () => {
    expect(envoy.headers(context)["Content-Type"]).toBe("text/plain");
  });
});
