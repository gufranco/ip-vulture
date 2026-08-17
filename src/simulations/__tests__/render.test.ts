import { describe, expect, it } from "vitest";
import { findSimulation } from "../catalogue.js";
import { DISCLOSURE_HEADER } from "../disclosure.js";
import { pathOf, renderSimulation } from "../render.js";

const apache = findSimulation("apache");
const traefik = findSimulation("traefik");
const caddy = findSimulation("caddy");

if (apache === undefined || traefik === undefined || caddy === undefined) {
  throw new Error("catalogue is missing a simulation the tests depend on");
}

const request = {
  url: "/some/page",
  method: "GET",
  host: "localhost",
};

describe("pathOf", () => {
  it("should keep a plain path unchanged", () => {
    expect(pathOf("/some/page")).toBe("/some/page");
  });

  it("should drop the query string", () => {
    expect(pathOf("/some/page?token=secret")).toBe("/some/page");
  });

  it("should drop a bare query marker", () => {
    expect(pathOf("/some/page?")).toBe("/some/page");
  });

  it("should drop a fragment", () => {
    expect(pathOf("/some/page#anchor")).toBe("/some/page");
  });

  it("should handle the root path", () => {
    expect(pathOf("/")).toBe("/");
  });

  it("should return the root path for an empty url", () => {
    expect(pathOf("")).toBe("/");
  });
});

describe("renderSimulation", () => {
  it("should return the simulation status, headers, and body", () => {
    const response = renderSimulation({
      simulation: apache,
      statusCode: 404,
      disclosure: "off",
      request,
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers.Server).toBe("Apache/2.4.62 (Ubuntu)");
    expect(response.body.toString("utf8")).toContain("<title>404 Not Found");
  });

  it("should exclude the query string from the rendered path", () => {
    const response = renderSimulation({
      simulation: apache,
      statusCode: 404,
      disclosure: "off",
      request: { ...request, url: "/some/page?token=secret" },
    });

    const body = response.body.toString("utf8");

    expect(body).toContain("/some/page");
    expect(body).not.toContain("token=secret");
  });

  it("should never expose a framework error shape", () => {
    for (const statusCode of [400, 404, 500, 503]) {
      const response = renderSimulation({
        simulation: apache,
        statusCode,
        disclosure: "both",
        request,
      });

      const body = response.body.toString("utf8");

      expect(body).not.toContain('"statusCode"');
      expect(body).not.toContain('"error"');
    }
  });

  it("should add the disclosure header by default", () => {
    const response = renderSimulation({
      simulation: apache,
      statusCode: 404,
      disclosure: "both",
      request,
    });

    expect(response.headers[DISCLOSURE_HEADER]).toBeDefined();
  });

  it("should omit the disclosure header when disabled", () => {
    const response = renderSimulation({
      simulation: apache,
      statusCode: 404,
      disclosure: "off",
      request,
    });

    expect(response.headers[DISCLOSURE_HEADER]).toBeUndefined();
  });

  it("should return a Buffer so the byte length is authoritative", () => {
    const response = renderSimulation({
      simulation: apache,
      statusCode: 404,
      disclosure: "off",
      request,
    });

    expect(Buffer.isBuffer(response.body)).toBe(true);
  });

  it("should encode the body in the charset the simulation declares", () => {
    const response = renderSimulation({
      simulation: apache,
      statusCode: 404,
      disclosure: "off",
      request: { ...request, url: "/café" },
    });

    const latin1 = response.body.toString("latin1");

    expect(latin1).toContain("café");
    expect(response.body).not.toContain(Buffer.from("Ã©", "latin1"));
  });

  it("should set a content length matching the encoded byte length", () => {
    const response = renderSimulation({
      simulation: apache,
      statusCode: 404,
      disclosure: "off",
      request: { ...request, url: "/café" },
    });

    expect(Number(response.headers["Content-Length"])).toBe(
      response.body.length,
    );
  });

  it("should not inject an HTML comment into a plain-text simulation", () => {
    const response = renderSimulation({
      simulation: traefik,
      statusCode: 404,
      disclosure: "both",
      request,
    });

    expect(response.body.toString("utf8")).toBe("404 page not found\n");
  });

  it("should handle a simulation with an empty body and no content type", () => {
    const response = renderSimulation({
      simulation: caddy,
      statusCode: 404,
      disclosure: "both",
      request,
    });

    expect(response.body.length).toBe(0);
    expect(response.headers["Content-Length"]).toBe("0");
  });

  it("should escape a hostile host header", () => {
    const response = renderSimulation({
      simulation: apache,
      statusCode: 404,
      disclosure: "off",
      request: { ...request, host: "<script>alert(1)</script>" },
    });

    expect(response.body.toString("utf8")).not.toContain("<script>");
  });
});
