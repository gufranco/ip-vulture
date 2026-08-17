import { describe, expect, it } from "vitest";
import { catalogue, createSelector, findSimulation } from "../catalogue.js";
import { pathOf, renderSimulation } from "../render.js";
import { SUPPORTED_STATUS_CODES } from "../simulation.js";

const baseContext = {
  path: "/probe",
  method: "GET",
  host: "localhost",
  now: new Date("2026-08-16T00:00:00Z"),
};

describe("every simulation across every status", () => {
  it.each(catalogue.map((simulation) => [simulation.id, simulation] as const))(
    "%s should render and set headers for every supported status",
    (_id, simulation) => {
      for (const statusCode of SUPPORTED_STATUS_CODES) {
        const context = { ...baseContext, statusCode };
        const body = simulation.render(context);
        const headers = simulation.headers(context);

        expect(typeof body).toBe("string");
        expect(Object.isFrozen(headers)).toBe(true);
      }
    },
  );

  it.each(catalogue.map((simulation) => [simulation.id, simulation] as const))(
    "%s should render an unmapped status without throwing",
    (_id, simulation) => {
      const body = simulation.render({ ...baseContext, statusCode: 418 });

      expect(typeof body).toBe("string");
    },
  );
});

describe("render pipeline charset handling", () => {
  it("should encode a utf-8 simulation as utf-8", () => {
    const tomcat = findSimulation("tomcat");

    if (tomcat === undefined) {
      throw new Error("catalogue is missing tomcat");
    }

    const response = renderSimulation({
      simulation: tomcat,
      statusCode: 404,
      disclosure: "off",
      request: { url: "/café", method: "GET", host: "localhost" },
    });

    expect(response.body.toString("utf8")).toContain("café");
  });

  it("should encode a simulation with no content type as utf-8", () => {
    const caddy = findSimulation("caddy");

    if (caddy === undefined) {
      throw new Error("catalogue is missing caddy");
    }

    const response = renderSimulation({
      simulation: caddy,
      statusCode: 404,
      disclosure: "off",
      request: { url: "/x", method: "GET", host: "localhost" },
    });

    expect(response.body.length).toBe(0);
  });

  it("should accept an injected clock", () => {
    const apache = findSimulation("apache");

    if (apache === undefined) {
      throw new Error("catalogue is missing apache");
    }

    const response = renderSimulation({
      simulation: apache,
      statusCode: 404,
      disclosure: "off",
      request: { url: "/x", method: "GET", host: "localhost" },
      now: new Date("2001-01-01T00:00:00Z"),
    });

    expect(response.statusCode).toBe(404);
  });
});

describe("pathOf edge cases", () => {
  it.each([
    ["/a?b=1#c", "/a"],
    ["/a#c?b=1", "/a"],
    ["?only=query", "/"],
    ["#only-fragment", "/"],
  ])("should reduce %s to %s", (input, expected) => {
    expect(pathOf(input)).toBe(expected);
  });
});

describe("createSelector filter combinations", () => {
  it("should select from a single-era pool", () => {
    const select = createSelector(
      { mode: "random", scope: "request" },
      { era: "2020s" as never },
    );

    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(select().era).toBe("2020s");
    }
  });

  it("should select a fixed simulation from every catalogue id", () => {
    for (const simulation of catalogue) {
      const select = createSelector({ mode: "fixed", id: simulation.id }, {});

      expect(select().id).toBe(simulation.id);
    }
  });
});
