import { APACHE_PROTOCOL } from "../protocol.js";
import {
  Era,
  Genre,
  type RenderContext,
  type Simulation,
  SUPPORTED_STATUS_CODES,
  statusText,
} from "../simulation.js";
import { renderNamedView } from "../views/index.js";

const htmlHeaders: Readonly<Record<string, string>> = Object.freeze({
  "Content-Type": "text/html; charset=iso-8859-1",
  Server: "Apache/1.3.42 (Unix)",
});

function visitorCount(context: RenderContext): string {
  const seed = context.path.length * 1373 + context.statusCode * 7919;

  return String(100000 + (seed % 899999)).padStart(6, "0");
}

const constructionZone: Simulation = {
  id: "construction-zone",
  displayName: "Under Construction (2001 personal page)",
  era: Era.Thousands,
  genre: Genre.Creative,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: APACHE_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return htmlHeaders;
  },

  render(context: RenderContext): string {
    return renderNamedView("construction-zone", {
      statusCode: context.statusCode,
      statusText: statusText(context.statusCode),
      path: context.path,
      visitors: visitorCount(context),
    });
  },
};

const lostInSpace: Simulation = {
  id: "lost-in-space",
  displayName: "Lost In Space (2003 hobby site)",
  era: Era.Thousands,
  genre: Genre.Creative,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: APACHE_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return htmlHeaders;
  },

  render(context: RenderContext): string {
    return renderNamedView("lost-in-space", {
      statusCode: context.statusCode,
      statusText: statusText(context.statusCode),
      path: context.path,
    });
  },
};

const webringHub: Simulation = {
  id: "webring-hub",
  displayName: "Webring Hub (2002 fan site)",
  era: Era.Thousands,
  genre: Genre.Creative,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: APACHE_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return htmlHeaders;
  },

  render(context: RenderContext): string {
    return renderNamedView("webring-hub", {
      statusCode: context.statusCode,
      statusText: statusText(context.statusCode),
      path: context.path,
    });
  },
};

const cyberCafe: Simulation = {
  id: "cyber-cafe",
  displayName: "Cyber Cafe (2000 small business site)",
  era: Era.Thousands,
  genre: Genre.Creative,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: APACHE_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return htmlHeaders;
  },

  render(context: RenderContext): string {
    return renderNamedView("cyber-cafe", {
      statusCode: context.statusCode,
      statusText: statusText(context.statusCode),
      path: context.path,
      method: context.method,
    });
  },
};

const creativeSimulations: readonly Simulation[] = Object.freeze([
  constructionZone,
  lostInSpace,
  webringHub,
  cyberCafe,
]);

export {
  constructionZone,
  creativeSimulations,
  cyberCafe,
  lostInSpace,
  webringHub,
};
