import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { escapeHtml } from "../escape.js";

const VIEW_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const VIEW_EXTENSION = ".html";

const cache = new Map<string, string>();

function viewPath(name: string): string {
  return join(VIEW_DIRECTORY, `${name}${VIEW_EXTENSION}`);
}

function listViews(): readonly string[] {
  return Object.freeze(
    readdirSync(VIEW_DIRECTORY)
      .filter((entry) => entry.endsWith(VIEW_EXTENSION))
      .map((entry) => entry.slice(0, -VIEW_EXTENSION.length))
      .toSorted(),
  );
}

function loadView(name: string): string {
  const cached = cache.get(name);

  if (cached !== undefined) {
    return cached;
  }

  try {
    const content = readFileSync(viewPath(name), "utf8");

    cache.set(name, content);

    return content;
  } catch (error) {
    throw new Error(
      `Unknown view "${name}". Expected a file at ${viewPath(name)}.`,
      { cause: error },
    );
  }
}

function renderView(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  const resolve = (key: string): string => {
    const value = values[key.trim()];

    return value === undefined ? "" : String(value);
  };

  return template
    .replaceAll(/\{\{\{\s*([\w.-]+)\s*\}\}\}/g, (_match, key: string) =>
      resolve(key),
    )
    .replaceAll(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key: string) =>
      escapeHtml(resolve(key)),
    );
}

function renderNamedView(
  name: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return renderView(loadView(name), values);
}

export { listViews, loadView, renderNamedView, renderView };
