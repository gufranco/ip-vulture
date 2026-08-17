import { escapeHtml } from "../escape.js";
import {
  APACHE_PROTOCOL,
  IIS_PROTOCOL,
  MINIMAL_PROTOCOL,
  NGINX_PROTOCOL,
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

const apache20: Simulation = {
  id: "apache-2.0",
  displayName: "Apache 2.0.63 (Unix)",
  era: Era.Thousands,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: APACHE_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html; charset=iso-8859-1",
      Server: "Apache/2.0.63 (Unix) PHP/4.4.9",
    });
  },

  render(context: RenderContext): string {
    const detail =
      context.statusCode === 404
        ? `The requested URL ${escapeHtml(context.path)} was not found on this server.`
        : "The server encountered an internal error or misconfiguration and was unable to complete your request.";

    return renderNamedView("apache-2.0", {
      statusCode: context.statusCode,
      statusText: statusText(context.statusCode),
      detail,
      host: context.host,
    });
  },
};

const iis6: Simulation = {
  id: "iis-6",
  displayName: "Microsoft IIS 6.0",
  era: Era.Thousands,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: IIS_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html",
      Server: "Microsoft-IIS/6.0",
      "X-Powered-By": "ASP.NET",
      "X-AspNet-Version": "2.0.50727",
    });
  },

  render(context: RenderContext): string {
    return renderNamedView("iis-6", {
      statusCode: context.statusCode,
      statusText: statusText(context.statusCode),
    });
  },
};

const nginx07: Simulation = {
  id: "nginx-0.7",
  displayName: "nginx 0.7.65",
  era: Era.Thousands,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: NGINX_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html",
      Server: "nginx/0.7.65",
    });
  },

  render(context: RenderContext): string {
    const title = `${context.statusCode} ${statusText(context.statusCode)}`;

    return renderNamedView("nginx-0.7", { title });
  },
};

const zeus: Simulation = {
  id: "zeus",
  displayName: "Zeus 4.3",
  era: Era.Thousands,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: MINIMAL_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html",
      Server: "Zeus/4.3",
    });
  },

  render(context: RenderContext): string {
    return renderNamedView("zeus", {
      statusText: statusText(context.statusCode),
    });
  },
};

const thousandsSimulations: readonly Simulation[] = Object.freeze([
  apache20,
  iis6,
  nginx07,
  zeus,
]);

export { apache20, iis6, nginx07, thousandsSimulations, zeus };
