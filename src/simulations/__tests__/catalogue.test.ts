import { describe, expect, it } from "vitest";
import {
  catalogue,
  createSelector,
  filterCatalogue,
  findSimulation,
  simulationIds,
} from "../catalogue.js";
import { Era, Genre, SUPPORTED_STATUS_CODES } from "../simulation.js";

const context = {
  path: "/some/page",
  method: "GET",
  statusCode: 404,
  host: "localhost",
  now: new Date("2026-08-16T00:00:00Z"),
};

describe("catalogue contract", () => {
  it("should expose every simulation with a unique id", () => {
    const ids = catalogue.map((simulation) => simulation.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should cover every era", () => {
    const eras = new Set(catalogue.map((simulation) => simulation.era));

    for (const era of Object.values(Era)) {
      expect(eras).toContain(era);
    }
  });

  it("should cover every genre", () => {
    const genres = new Set(catalogue.map((simulation) => simulation.genre));

    for (const genre of Object.values(Genre)) {
      expect(genres).toContain(genre);
    }
  });

  it.each(SUPPORTED_STATUS_CODES)(
    "should render a string for every simulation at status %i",
    (statusCode) => {
      for (const simulation of catalogue) {
        const body = simulation.render({ ...context, statusCode });

        expect(typeof body).toBe("string");
      }
    },
  );

  it("should return frozen headers for every simulation", () => {
    for (const simulation of catalogue) {
      expect(Object.isFrozen(simulation.headers(context))).toBe(true);
    }
  });

  it("should never render an unescaped angle bracket from the path", () => {
    const hostile = { ...context, path: '/"><script>alert(1)</script>' };

    for (const simulation of catalogue) {
      expect(simulation.render(hostile)).not.toContain("<script>alert");
    }
  });

  it("should declare a display name for every simulation", () => {
    for (const simulation of catalogue) {
      expect(simulation.displayName.length).toBeGreaterThan(0);
    }
  });
});

describe("simulationIds", () => {
  it("should list every catalogue id", () => {
    expect(simulationIds()).toHaveLength(catalogue.length);
  });

  it("should include the historical default", () => {
    expect(simulationIds()).toContain("apache");
  });
});

describe("findSimulation", () => {
  it("should resolve a known id", () => {
    expect(findSimulation("nginx")?.id).toBe("nginx");
  });

  it("should return undefined for an unknown id", () => {
    expect(findSimulation("does-not-exist")).toBeUndefined();
  });
});

describe("filterCatalogue", () => {
  it("should return the whole catalogue with no filter", () => {
    expect(filterCatalogue({})).toHaveLength(catalogue.length);
  });

  it("should narrow by era", () => {
    const result = filterCatalogue({ era: Era.Nineties });

    expect(result.length).toBeGreaterThan(0);
    for (const simulation of result) {
      expect(simulation.era).toBe(Era.Nineties);
    }
  });

  it("should narrow by genre", () => {
    const result = filterCatalogue({ genre: Genre.Creative });

    expect(result.length).toBeGreaterThan(0);
    for (const simulation of result) {
      expect(simulation.genre).toBe(Genre.Creative);
    }
  });

  it("should narrow by era and genre together", () => {
    const result = filterCatalogue({
      era: Era.Thousands,
      genre: Genre.Creative,
    });

    expect(result.length).toBeGreaterThan(0);
    for (const simulation of result) {
      expect(simulation.era).toBe(Era.Thousands);
      expect(simulation.genre).toBe(Genre.Creative);
    }
  });
});

describe("createSelector fixed mode", () => {
  it("should return the named simulation every time", () => {
    const select = createSelector({ mode: "fixed", id: "nginx" }, {});

    expect(select().id).toBe("nginx");
    expect(select().id).toBe("nginx");
  });

  it("should throw for an unknown id", () => {
    expect(() => createSelector({ mode: "fixed", id: "nope" }, {})).toThrow(
      /nope/,
    );
  });
});

describe("createSelector startup scope", () => {
  it("should pick once and return the same simulation on every call", () => {
    const select = createSelector({ mode: "random", scope: "startup" }, {});
    const first = select().id;

    for (let attempt = 0; attempt < 50; attempt += 1) {
      expect(select().id).toBe(first);
    }
  });
});

describe("createSelector request scope", () => {
  it("should vary across calls", () => {
    const select = createSelector({ mode: "random", scope: "request" }, {});
    const seen = new Set<string>();

    for (let attempt = 0; attempt < 300; attempt += 1) {
      seen.add(select().id);
    }

    expect(seen.size).toBeGreaterThan(1);
  });

  it("should only pick from the filtered subset", () => {
    const select = createSelector(
      { mode: "random", scope: "request" },
      { genre: Genre.Creative },
    );

    for (let attempt = 0; attempt < 100; attempt += 1) {
      expect(select().genre).toBe(Genre.Creative);
    }
  });

  it("should throw when the filter excludes everything", () => {
    expect(() =>
      createSelector(
        { mode: "random", scope: "request" },
        { era: Era.Nineties, genre: Genre.Creative },
      ),
    ).toThrow(/no simulation/i);
  });
});
