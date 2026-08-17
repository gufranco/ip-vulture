import { randomInt } from "node:crypto";
import type { SimulationSelection } from "../config/config.js";
import { creativeSimulations } from "./creative/pages.js";
import type { Era, Genre, Simulation } from "./simulation.js";
import { ninetiesSimulations } from "./vendor/nineties.js";
import { tensSimulations } from "./vendor/tens.js";
import { thousandsSimulations } from "./vendor/thousands.js";
import { twentiesSimulations } from "./vendor/twenties.js";

const catalogue: readonly Simulation[] = Object.freeze([
  ...tensSimulations,
  ...twentiesSimulations,
  ...thousandsSimulations,
  ...ninetiesSimulations,
  ...creativeSimulations,
]);

interface CatalogueFilter {
  readonly era?: Era;
  readonly genre?: Genre;
}

function simulationIds(): readonly string[] {
  return Object.freeze(catalogue.map((simulation) => simulation.id));
}

function findSimulation(id: string): Simulation | undefined {
  return catalogue.find((simulation) => simulation.id === id);
}

function filterCatalogue(filter: CatalogueFilter): readonly Simulation[] {
  return Object.freeze(
    catalogue.filter((simulation) => {
      const eraMatches =
        filter.era === undefined || simulation.era === filter.era;
      const genreMatches =
        filter.genre === undefined || simulation.genre === filter.genre;

      return eraMatches && genreMatches;
    }),
  );
}

function describeFilter(filter: CatalogueFilter): string {
  const parts = [
    filter.era === undefined ? undefined : `era ${filter.era}`,
    filter.genre === undefined ? undefined : `genre ${filter.genre}`,
  ].filter((part): part is string => part !== undefined);

  return parts.length === 0 ? "the catalogue" : parts.join(" and ");
}

function pickFrom(pool: readonly Simulation[]): Simulation {
  const chosen = pool[randomInt(pool.length)];

  if (chosen === undefined) {
    throw new Error("Simulation pool is empty");
  }

  return chosen;
}

function createSelector(
  selection: SimulationSelection,
  filter: CatalogueFilter,
): () => Simulation {
  if (selection.mode === "fixed") {
    const simulation = findSimulation(selection.id);

    if (simulation === undefined) {
      throw new Error(
        `Unknown simulation "${selection.id}". Valid ids: ${simulationIds().join(", ")}`,
      );
    }

    return () => simulation;
  }

  const pool = filterCatalogue(filter);

  if (pool.length === 0) {
    throw new Error(
      `Found no simulation matching ${describeFilter(filter)}. Widen SIMULATION_FILTER.`,
    );
  }

  if (selection.scope === "startup") {
    const chosen = pickFrom(pool);

    return () => chosen;
  }

  return () => pickFrom(pool);
}

export {
  type CatalogueFilter,
  catalogue,
  createSelector,
  filterCatalogue,
  findSimulation,
  simulationIds,
};
