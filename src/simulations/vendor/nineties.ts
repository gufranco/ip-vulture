import { escapeHtml } from "../escape.js";
import {
  APACHE_PROTOCOL,
  IIS_PROTOCOL,
  MINIMAL_PROTOCOL,
} from "../protocol.js";
import {
  Era,
  Genre,
  type RenderContext,
  type Simulation,
  SUPPORTED_STATUS_CODES,
  statusText,
} from "../simulation.js";
import { renderNamedView } from "../views/index.js";

const ncsaHttpd: Simulation = {
  id: "ncsa-httpd",
  displayName: "NCSA httpd 1.5.2",
  era: Era.Nineties,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: APACHE_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html",
      Server: "NCSA/1.5.2",
    });
  },

  render(context: RenderContext): string {
    return renderNamedView("ncsa-httpd", {
      statusCode: context.statusCode,
      statusText: statusText(context.statusCode),
      path: context.path,
    });
  },
};

const cernHttpd: Simulation = {
  id: "cern-httpd",
  displayName: "CERN httpd 3.0A",
  era: Era.Nineties,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: APACHE_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html",
      Server: "CERN/3.0A",
    });
  },

  render(context: RenderContext): string {
    return renderNamedView("cern-httpd", {
      statusCode: context.statusCode,
      statusText: statusText(context.statusCode),
      path: context.path,
    });
  },
};

const apache13: Simulation = {
  id: "apache-1.3",
  displayName: "Apache 1.3.42 (Unix)",
  era: Era.Nineties,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: APACHE_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html; charset=iso-8859-1",
      Server: "Apache/1.3.42 (Unix)",
    });
  },

  render(context: RenderContext): string {
    const detail =
      context.statusCode === 404
        ? `The requested URL ${escapeHtml(context.path)} was not found on this server.`
        : "The server encountered an error while processing your request.";

    return renderNamedView("apache-1.3", {
      statusCode: context.statusCode,
      statusText: statusText(context.statusCode),
      detail,
      host: context.host,
    });
  },
};

const iis4: Simulation = {
  id: "iis-4",
  displayName: "Microsoft IIS 4.0",
  era: Era.Nineties,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: IIS_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html",
      Server: "Microsoft-IIS/4.0",
    });
  },

  render(context: RenderContext): string {
    return renderNamedView("iis-4", {
      statusCode: context.statusCode,
      statusText: statusText(context.statusCode),
    });
  },
};

const netscapeEnterprise: Simulation = {
  id: "netscape-enterprise",
  displayName: "Netscape Enterprise 3.6",
  era: Era.Nineties,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: MINIMAL_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html",
      Server: "Netscape-Enterprise/3.6",
    });
  },

  render(context: RenderContext): string {
    return renderNamedView("netscape-enterprise", {
      statusText: statusText(context.statusCode),
      path: context.path,
    });
  },
};

const ninetiesSimulations: readonly Simulation[] = Object.freeze([
  ncsaHttpd,
  cernHttpd,
  apache13,
  iis4,
  netscapeEnterprise,
]);

export {
  apache13,
  cernHttpd,
  iis4,
  ncsaHttpd,
  netscapeEnterprise,
  ninetiesSimulations,
};
