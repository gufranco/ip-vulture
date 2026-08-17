import { escapeHtml } from "../escape.js";
import {
  APACHE_PROTOCOL,
  IIS_PROTOCOL,
  MINIMAL_PROTOCOL,
  NGINX_PROTOCOL,
  TOMCAT_PROTOCOL,
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

const apacheDetails: ReadonlyMap<number, string> = new Map([
  [400, "Your browser sent a request that this server could not understand."],
  [
    401,
    "This server could not verify that you are authorized to access the document requested.",
  ],
  [403, "You don't have permission to access this resource."],
  [410, "The requested resource is no longer available on this server."],
  [
    500,
    "The server encountered an internal error or misconfiguration and was unable to complete your request.",
  ],
  [
    502,
    "The proxy server received an invalid response from an upstream server.",
  ],
  [
    503,
    "The server is temporarily unable to service your request due to maintenance downtime or capacity problems.",
  ],
  [
    504,
    "The gateway did not receive a timely response from the upstream server.",
  ],
]);

function apacheBody(context: RenderContext, signature: string): string {
  const title = statusText(context.statusCode);

  const detail =
    context.statusCode === 404
      ? `The requested URL ${escapeHtml(context.path)} was not found on this server.`
      : (apacheDetails.get(context.statusCode) ??
        "The server encountered an error.");

  return renderNamedView("apache", {
    statusCode: context.statusCode,
    title,
    detail,
    signature,
    host: context.host,
  });
}

const apache24: Simulation = {
  id: "apache",
  displayName: "Apache 2.4.62 (Ubuntu)",
  era: Era.Tens,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: APACHE_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html; charset=iso-8859-1",
      Server: "Apache/2.4.62 (Ubuntu)",
    });
  },

  render(context: RenderContext): string {
    return apacheBody(context, "Apache/2.4.62 (Ubuntu)");
  },
};

function nginxBody(context: RenderContext, signature: string): string {
  const title = `${context.statusCode} ${statusText(context.statusCode)}`;

  return renderNamedView("nginx", { title, signature });
}

const nginx1: Simulation = {
  id: "nginx",
  displayName: "nginx 1.27.4",
  era: Era.Tens,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: NGINX_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html",
      Server: "nginx/1.27.4",
    });
  },

  render(context: RenderContext): string {
    return nginxBody(context, "nginx/1.27.4");
  },
};

const openresty: Simulation = {
  id: "openresty",
  displayName: "OpenResty 1.27.1.1",
  era: Era.Tens,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: NGINX_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html",
      Server: "openresty/1.27.1.1",
    });
  },

  render(context: RenderContext): string {
    return nginxBody(context, "openresty/1.27.1.1");
  },
};

const iisDescriptions: ReadonlyMap<number, string> = new Map([
  [400, "The request could not be understood by the server."],
  [401, "You do not have permission to view this directory or page."],
  [403, "You do not have permission to view this directory or page."],
  [404, "File or directory not found."],
  [410, "The requested resource is no longer available."],
  [500, "There is a problem with the resource you are looking for."],
  [502, "The server received an invalid response from an upstream server."],
  [503, "The service is unavailable."],
  [504, "The gateway did not respond in time."],
]);

const iis10: Simulation = {
  id: "iis",
  displayName: "Microsoft IIS 10.0",
  era: Era.Tens,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: IIS_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html",
      Server: "Microsoft-IIS/10.0",
      "X-Powered-By": "ASP.NET",
    });
  },

  render(context: RenderContext): string {
    const summary =
      iisDescriptions.get(context.statusCode) ?? statusText(context.statusCode);

    return renderNamedView("iis", { statusCode: context.statusCode, summary });
  },
};

const tomcat10: Simulation = {
  id: "tomcat",
  displayName: "Apache Tomcat 10.1.34",
  era: Era.Tens,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: TOMCAT_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html;charset=utf-8",
    });
  },

  render(context: RenderContext): string {
    const title = `HTTP Status ${context.statusCode} – ${statusText(context.statusCode)}`;

    return renderNamedView("tomcat", { title, path: context.path });
  },
};

const lighttpd: Simulation = {
  id: "lighttpd",
  displayName: "lighttpd 1.4.76",
  era: Era.Tens,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: MINIMAL_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html",
      Server: "lighttpd/1.4.76",
    });
  },

  render(context: RenderContext): string {
    const title = `${context.statusCode} ${statusText(context.statusCode)}`;

    return renderNamedView("lighttpd", { title });
  },
};

const litespeed: Simulation = {
  id: "litespeed",
  displayName: "LiteSpeed",
  era: Era.Tens,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: MINIMAL_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html",
      Server: "LiteSpeed",
    });
  },

  render(context: RenderContext): string {
    return renderNamedView("litespeed", {
      statusCode: context.statusCode,
      statusText: statusText(context.statusCode),
    });
  },
};

const tensSimulations: readonly Simulation[] = Object.freeze([
  apache24,
  nginx1,
  openresty,
  iis10,
  tomcat10,
  lighttpd,
  litespeed,
]);

export {
  apache24,
  iis10,
  lighttpd,
  litespeed,
  nginx1,
  openresty,
  tensSimulations,
  tomcat10,
};
