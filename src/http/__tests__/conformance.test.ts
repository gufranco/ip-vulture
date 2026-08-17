import net from "node:net";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { loadConfig } from "../../config/config.js";
import { findSimulation, simulationIds } from "../../simulations/catalogue.js";

const REQUESTS = {
  notFound: "GET /missing.html HTTP/1.1\r\nHost: h\r\n\r\n",
  unknownMethod: "FROB / HTTP/1.1\r\nHost: h\r\n\r\n",
  malformed: "GET\r\n\r\n",
  http10: "GET /missing.html HTTP/1.0\r\n\r\n",
  connectionClose: "GET /x HTTP/1.1\r\nHost: h\r\nConnection: close\r\n\r\n",
  badVersion: "GET / HTTP/9.9\r\nHost: h\r\n\r\n",
  headerOverflow: `GET / HTTP/1.1\r\nHost: h\r\nX: ${"a".repeat(90_000)}\r\n\r\n`,
} as const;

const APACHE_EXPECTED = {
  notFound: [
    "HTTP/1.1 404 Not Found",
    "Date: <ts>",
    "Server: <server>",
    "Content-Length: <len>",
    "Content-Type: text/html; charset=iso-8859-1",
  ],
  unknownMethod: [
    "HTTP/1.1 501 Not Implemented",
    "Date: <ts>",
    "Server: <server>",
    "Allow: <allow>",
    "Content-Length: <len>",
    "Connection: close",
    "Content-Type: text/html; charset=iso-8859-1",
  ],
  malformed: [
    "HTTP/1.1 400 Bad Request",
    "Date: <ts>",
    "Server: <server>",
    "Content-Length: <len>",
    "Connection: close",
    "Content-Type: text/html; charset=iso-8859-1",
  ],
  http10: [
    "HTTP/1.1 404 Not Found",
    "Date: <ts>",
    "Server: <server>",
    "Content-Length: <len>",
    "Connection: close",
    "Content-Type: text/html; charset=iso-8859-1",
  ],
  connectionClose: [
    "HTTP/1.1 404 Not Found",
    "Date: <ts>",
    "Server: <server>",
    "Content-Length: <len>",
    "Connection: close",
    "Content-Type: text/html; charset=iso-8859-1",
  ],
} as const;

const NGINX_EXPECTED = {
  notFound: [
    "HTTP/1.1 404 Not Found",
    "Server: <server>",
    "Date: <ts>",
    "Content-Type: text/html",
    "Content-Length: <len>",
    "Connection: keep-alive",
  ],
  unknownMethod: [
    "HTTP/1.1 405 Not Allowed",
    "Server: <server>",
    "Date: <ts>",
    "Content-Type: text/html",
    "Content-Length: <len>",
    "Connection: close",
    "Allow: <allow>",
  ],
} as const;

function requireSimulation(id: string) {
  const simulation = findSimulation(id);

  if (simulation === undefined) {
    throw new Error(`catalogue is missing ${id}`);
  }

  return simulation;
}

function normalize(raw: string): readonly string[] {
  return (raw.split("\r\n\r\n")[0] ?? "")
    .split("\r\n")
    .filter((line) => line.length > 0)
    .map((line) =>
      line
        .replace(/^Date: .*/, "Date: <ts>")
        .replace(/^Server: .*/, "Server: <server>")
        .replace(/^Content-Length: .*/, "Content-Length: <len>")
        .replace(/^Allow: .*/, "Allow: <allow>"),
    );
}

function speak(port: number, payload: string): Promise<string> {
  return new Promise((resolve) => {
    const socket = net.connect(port, "127.0.0.1", () => socket.write(payload));
    let buffer = "";

    socket.on("data", (chunk) => {
      buffer += chunk.toString("latin1");
    });

    const finish = () => {
      socket.destroy();
      resolve(buffer);
    };

    socket.on("end", finish);
    socket.on("error", finish);
    setTimeout(finish, 400);
  });
}

async function listen(simulationId: string): Promise<{
  readonly app: FastifyInstance;
  readonly port: number;
}> {
  const config = loadConfig(
    { SIMULATION_DISCLOSURE: "off" },
    { simulationIds: simulationIds() },
  );
  const app = buildApp({
    config,
    selectSimulation: () => requireSimulation(simulationId),
  });

  await app.listen({ port: 0, host: "127.0.0.1" });

  const address = app.server.address();

  if (address === null || typeof address === "string") {
    throw new Error("failed to bind the conformance server");
  }

  return { app, port: address.port };
}

describe("Apache wire conformance", () => {
  let server: { app: FastifyInstance; port: number };

  beforeAll(async () => {
    server = await listen("apache");
  });

  afterAll(async () => {
    await server.app.close();
  });

  it.each(
    Object.entries(APACHE_EXPECTED) as [
      keyof typeof REQUESTS,
      readonly string[],
    ][],
  )("should match the captured Apache shape for %s", async (name, expected) => {
    const raw = await speak(server.port, REQUESTS[name]);

    expect(normalize(raw)).toEqual([...expected]);
  });

  it("should never emit a lowercase header name", async () => {
    const raw = await speak(server.port, REQUESTS.notFound);

    for (const line of normalize(raw).slice(1)) {
      expect(line).toMatch(/^[A-Z][A-Za-z-]*:/);
    }
  });

  it("should never emit a framework header", async () => {
    const raw = await speak(server.port, REQUESTS.notFound);
    const lowered = raw.toLowerCase();

    expect(lowered).not.toContain("x-powered-by: express");
    expect(lowered).not.toContain("keep-alive: timeout=72");
    expect(lowered).not.toContain("application/json");
  });

  it("should answer a bad HTTP version with the Apache lenient status", async () => {
    const lines = normalize(await speak(server.port, REQUESTS.badVersion));

    expect(lines[0]).toBe("HTTP/1.1 404 Not Found");
    expect(lines[1]).toBe("Date: <ts>");
  });

  it("should answer a header overflow as a bad request, not a framework error", async () => {
    const raw = await speak(server.port, REQUESTS.headerOverflow);
    const lines = normalize(raw);

    expect(lines[0]).toBe("HTTP/1.1 400 Bad Request");
    expect(raw.toLowerCase()).not.toContain("application/json");
  });

  it("should serve two requests on one keep-alive connection", async () => {
    const port = server.port;

    const raw = await new Promise<string>((resolve) => {
      const socket = net.connect(port, "127.0.0.1", () => {
        socket.write(REQUESTS.notFound);
        setTimeout(() => socket.write(REQUESTS.notFound), 150);
      });
      let buffer = "";

      socket.on("data", (chunk) => {
        buffer += chunk.toString("latin1");
      });
      setTimeout(() => {
        socket.destroy();
        resolve(buffer);
      }, 500);
    });

    expect(raw.split("HTTP/1.1 404").length - 1).toBe(2);
  });
});

describe("nginx wire conformance", () => {
  let server: { app: FastifyInstance; port: number };

  beforeAll(async () => {
    server = await listen("nginx");
  });

  afterAll(async () => {
    await server.app.close();
  });

  it.each(
    Object.entries(NGINX_EXPECTED) as [
      keyof typeof REQUESTS,
      readonly string[],
    ][],
  )("should match the captured nginx shape for %s", async (name, expected) => {
    const raw = await speak(server.port, REQUESTS[name]);

    expect(normalize(raw)).toEqual([...expected]);
  });

  it("should answer a bad HTTP version with 505, unlike Apache", async () => {
    const lines = normalize(await speak(server.port, REQUESTS.badVersion));

    expect(lines[0]).toBe("HTTP/1.1 505 HTTP Version Not Supported");
  });

  it("should order Server before Date, unlike Apache", async () => {
    const lines = normalize(await speak(server.port, REQUESTS.notFound));

    expect(lines[1]).toBe("Server: <server>");
    expect(lines[2]).toBe("Date: <ts>");
  });
});

describe("edge proxy wire conformance", () => {
  it("should match the captured Caddy shape, which sends no Connection", async () => {
    const server = await listen("caddy");
    const lines = normalize(await speak(server.port, REQUESTS.notFound));

    expect(lines).toEqual([
      "HTTP/1.1 404 Not Found",
      "Server: <server>",
      "Date: <ts>",
      "Content-Length: <len>",
    ]);

    await server.app.close();
  });

  it("should match the captured Traefik shape, which sends no Server", async () => {
    const server = await listen("traefik");
    const lines = normalize(await speak(server.port, REQUESTS.notFound));

    expect(lines).toEqual([
      "HTTP/1.1 404 Not Found",
      "Content-Type: text/plain; charset=utf-8",
      "X-Content-Type-Options: nosniff",
      "Date: <ts>",
      "Content-Length: <len>",
    ]);

    await server.app.close();
  });

  it("should never emit Connection for a profile that suppresses it", async () => {
    const server = await listen("caddy");
    const raw = await speak(server.port, REQUESTS.connectionClose);

    expect(raw.toLowerCase()).not.toContain("connection:");

    await server.app.close();
  });
});
