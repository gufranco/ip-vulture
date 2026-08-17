import {
  CADDY_PROTOCOL,
  MINIMAL_PROTOCOL,
  TRAEFIK_PROTOCOL,
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

const caddy: Simulation = {
  id: "caddy",
  displayName: "Caddy 2",
  era: Era.Twenties,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: CADDY_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      Server: "Caddy",
    });
  },

  render(): string {
    return "";
  },
};

const traefik: Simulation = {
  id: "traefik",
  displayName: "Traefik 3",
  era: Era.Twenties,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: TRAEFIK_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    });
  },

  render(context: RenderContext): string {
    if (context.statusCode === 404) {
      return "404 page not found\n";
    }

    return renderNamedView("traefik", {
      statusCode: context.statusCode,
      statusText: statusText(context.statusCode),
    });
  },
};

const haproxy: Simulation = {
  id: "haproxy",
  displayName: "HAProxy 3",
  era: Era.Twenties,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: MINIMAL_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html",
      "Cache-Control": "no-cache",
    });
  },

  render(context: RenderContext): string {
    return renderNamedView("haproxy", {
      statusCode: context.statusCode,
      statusText: statusText(context.statusCode),
    });
  },
};

const envoy: Simulation = {
  id: "envoy",
  displayName: "Envoy 1.33",
  era: Era.Twenties,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: MINIMAL_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/plain",
      Server: "envoy",
    });
  },

  render(context: RenderContext): string {
    if (context.statusCode === 404) {
      return "no healthy upstream";
    }

    if (context.statusCode === 503) {
      return "no healthy upstream";
    }

    if (context.statusCode === 504) {
      return "upstream request timeout";
    }

    return renderNamedView("envoy", {
      statusText: statusText(context.statusCode),
    });
  },
};

const twentiesSimulations: readonly Simulation[] = Object.freeze([
  caddy,
  traefik,
  haproxy,
  envoy,
]);

export { caddy, envoy, haproxy, traefik, twentiesSimulations };
