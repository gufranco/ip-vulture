import { describe, expect, it, vi } from "vitest";
import {
  APACHE_PROTOCOL,
  NGINX_PROTOCOL,
  type ProtocolProfile,
} from "../../simulations/protocol.js";
import { emitResponse, type RawResponseTarget } from "../emit.js";

function fakeTarget(): RawResponseTarget & {
  readonly calls: {
    head: unknown[];
    body: unknown[];
    removed: string[];
    sendDate: boolean[];
  };
} {
  const calls = {
    head: [] as unknown[],
    body: [] as unknown[],
    removed: [] as string[],
    sendDate: [] as boolean[],
  };

  return {
    calls,
    removeHeader(name: string) {
      calls.removed.push(name);
    },
    writeHead(status: number, reason: string, headers: string[]) {
      calls.head.push({ status, reason, headers: [...headers] });
    },
    end(body: Buffer) {
      calls.body.push(body);
    },
  };
}

const body = Buffer.from("<html>404</html>", "latin1");

describe("emitResponse Apache shape", () => {
  it("should write the status line with the server's reason phrase", () => {
    const target = fakeTarget();

    emitResponse(target, {
      profile: APACHE_PROTOCOL,
      statusCode: 404,
      headers: { "Content-Type": "text/html; charset=iso-8859-1" },
      body,
      keepAlive: true,
      serverHeader: "Apache/2.4.62 (Ubuntu)",
      now: new Date("2026-08-17T12:00:00Z"),
    });

    const head = target.calls.head[0] as {
      status: number;
      reason: string;
      headers: string[];
    };

    expect(head.status).toBe(404);
    expect(head.reason).toBe("Not Found");
  });

  it("should emit headers in Apache order with canonical casing", () => {
    const target = fakeTarget();

    emitResponse(target, {
      profile: APACHE_PROTOCOL,
      statusCode: 404,
      headers: { "Content-Type": "text/html; charset=iso-8859-1" },
      body,
      keepAlive: true,
      serverHeader: "Apache/2.4.62 (Ubuntu)",
      now: new Date("2026-08-17T12:00:00Z"),
    });

    const head = target.calls.head[0] as { headers: string[] };
    const names = head.headers.filter((_value, index) => index % 2 === 0);

    expect(names).toEqual(["Date", "Server", "Content-Length", "Content-Type"]);
  });

  it("should omit Connection on a keep-alive response", () => {
    const target = fakeTarget();

    emitResponse(target, {
      profile: APACHE_PROTOCOL,
      statusCode: 404,
      headers: {},
      body,
      keepAlive: true,
      serverHeader: "Apache/2.4.62 (Ubuntu)",
      now: new Date(),
    });

    const head = target.calls.head[0] as { headers: string[] };

    expect(head.headers).not.toContain("Connection");
  });

  it("should send Connection close when the connection is closing", () => {
    const target = fakeTarget();

    emitResponse(target, {
      profile: APACHE_PROTOCOL,
      statusCode: 400,
      headers: {},
      body,
      keepAlive: false,
      serverHeader: "Apache/2.4.62 (Ubuntu)",
      now: new Date(),
    });

    const head = target.calls.head[0] as { headers: string[] };
    const index = head.headers.indexOf("Connection");

    expect(index).toBeGreaterThan(-1);
    expect(head.headers[index + 1]).toBe("close");
  });

  it("should suppress the runtime automatic connection headers", () => {
    const target = fakeTarget();

    emitResponse(target, {
      profile: APACHE_PROTOCOL,
      statusCode: 404,
      headers: {},
      body,
      keepAlive: true,
      serverHeader: "Apache",
      now: new Date(),
    });

    expect(target.calls.removed).toContain("Connection");
    expect(target.calls.removed).toContain("Keep-Alive");
  });

  it("should always supply Date so the runtime does not add its own", () => {
    const target = fakeTarget();

    emitResponse(target, {
      profile: APACHE_PROTOCOL,
      statusCode: 404,
      headers: {},
      body,
      keepAlive: true,
      serverHeader: "Apache",
      now: new Date("2026-08-17T12:00:00Z"),
    });

    const head = target.calls.head[0] as { headers: string[] };
    const index = head.headers.indexOf("Date");

    expect(index).toBe(0);
    expect(head.headers[index + 1]).toBe("Mon, 17 Aug 2026 12:00:00 GMT");
  });

  it("should compute Content-Length from the encoded body", () => {
    const target = fakeTarget();
    const accented = Buffer.from("café", "latin1");

    emitResponse(target, {
      profile: APACHE_PROTOCOL,
      statusCode: 404,
      headers: {},
      body: accented,
      keepAlive: true,
      serverHeader: "Apache",
      now: new Date(),
    });

    const head = target.calls.head[0] as { headers: string[] };
    const index = head.headers.indexOf("Content-Length");

    expect(head.headers[index + 1]).toBe(String(accented.length));
    expect(accented.length).toBe(4);
  });
});

describe("emitResponse nginx shape", () => {
  it("should emit headers in nginx order", () => {
    const target = fakeTarget();

    emitResponse(target, {
      profile: NGINX_PROTOCOL,
      statusCode: 404,
      headers: { "Content-Type": "text/html" },
      body,
      keepAlive: true,
      serverHeader: "nginx/1.27.4",
      now: new Date(),
    });

    const head = target.calls.head[0] as { headers: string[] };
    const names = head.headers.filter((_value, index) => index % 2 === 0);

    expect(names).toEqual([
      "Server",
      "Date",
      "Content-Type",
      "Content-Length",
      "Connection",
    ]);
  });

  it("should always send Connection, including on keep-alive", () => {
    const target = fakeTarget();

    emitResponse(target, {
      profile: NGINX_PROTOCOL,
      statusCode: 404,
      headers: {},
      body,
      keepAlive: true,
      serverHeader: "nginx/1.27.4",
      now: new Date(),
    });

    const head = target.calls.head[0] as { headers: string[] };
    const index = head.headers.indexOf("Connection");

    expect(head.headers[index + 1]).toBe("keep-alive");
  });

  it("should use the nginx reason phrase for 405", () => {
    const target = fakeTarget();

    emitResponse(target, {
      profile: NGINX_PROTOCOL,
      statusCode: 405,
      headers: {},
      body,
      keepAlive: true,
      serverHeader: "nginx/1.27.4",
      now: new Date(),
    });

    expect((target.calls.head[0] as { reason: string }).reason).toBe(
      "Not Allowed",
    );
  });
});

describe("emitResponse body handling", () => {
  it("should send the body", () => {
    const target = fakeTarget();

    emitResponse(target, {
      profile: APACHE_PROTOCOL,
      statusCode: 404,
      headers: {},
      body,
      keepAlive: true,
      serverHeader: "Apache",
      now: new Date(),
    });

    expect(target.calls.body[0]).toEqual(body);
  });

  it("should send an empty body but still declare its length", () => {
    const target = fakeTarget();

    emitResponse(target, {
      profile: APACHE_PROTOCOL,
      statusCode: 200,
      headers: {},
      body: Buffer.alloc(0),
      keepAlive: true,
      serverHeader: "Apache",
      now: new Date(),
    });

    const head = target.calls.head[0] as { headers: string[] };
    const index = head.headers.indexOf("Content-Length");

    expect(head.headers[index + 1]).toBe("0");
  });

  it("should omit the Server header when the simulation declares none", () => {
    const target = fakeTarget();

    emitResponse(target, {
      profile: APACHE_PROTOCOL,
      statusCode: 404,
      headers: {},
      body,
      keepAlive: true,
      serverHeader: "",
      now: new Date(),
    });

    expect(
      (target.calls.head[0] as { headers: string[] }).headers,
    ).not.toContain("Server");
  });

  it("should survive a target with no removeHeader support", () => {
    const minimal = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as RawResponseTarget;

    expect(() =>
      emitResponse(minimal, {
        profile: APACHE_PROTOCOL,
        statusCode: 404,
        headers: {},
        body,
        keepAlive: true,
        serverHeader: "Apache",
        now: new Date(),
      }),
    ).not.toThrow();
  });
});

describe("emitResponse never policy", () => {
  const silent: ProtocolProfile = {
    ...APACHE_PROTOCOL,
    connectionHeader: "never",
  };

  it("should omit Connection even when the connection is closing", () => {
    const target = fakeTarget();

    emitResponse(target, {
      profile: silent,
      statusCode: 400,
      headers: {},
      body,
      keepAlive: false,
      serverHeader: "s",
      now: new Date(),
    });

    expect(
      (target.calls.head[0] as { headers: string[] }).headers,
    ).not.toContain("Connection");
  });
});

describe("emitResponse keep-alive header profile", () => {
  const chatty: ProtocolProfile = {
    ...APACHE_PROTOCOL,
    keepAliveHeader: true,
    headerOrder: [...APACHE_PROTOCOL.headerOrder, "Keep-Alive"],
  };

  it("should send Keep-Alive when the profile declares it", () => {
    const target = fakeTarget();

    emitResponse(target, {
      profile: chatty,
      statusCode: 404,
      headers: {},
      body,
      keepAlive: true,
      serverHeader: "s",
      now: new Date(),
    });

    const head = target.calls.head[0] as { headers: string[] };
    const index = head.headers.indexOf("Keep-Alive");

    expect(head.headers[index + 1]).toBe("timeout=5, max=100");
  });

  it("should omit Keep-Alive when the connection is closing", () => {
    const target = fakeTarget();

    emitResponse(target, {
      profile: chatty,
      statusCode: 404,
      headers: {},
      body,
      keepAlive: false,
      serverHeader: "s",
      now: new Date(),
    });

    expect(
      (target.calls.head[0] as { headers: string[] }).headers,
    ).not.toContain("Keep-Alive");
  });

  it("should merge extra headers supplied by the caller", () => {
    const target = fakeTarget();

    emitResponse(target, {
      profile: APACHE_PROTOCOL,
      statusCode: 501,
      headers: {},
      body,
      keepAlive: false,
      serverHeader: "s",
      now: new Date(),
      extraHeaders: { Allow: "GET,HEAD" },
    });

    const head = target.calls.head[0] as { headers: string[] };
    const index = head.headers.indexOf("Allow");

    expect(head.headers[index + 1]).toBe("GET,HEAD");
  });

  it("should omit the body but keep the declared length for HEAD", () => {
    const target = fakeTarget();

    emitResponse(target, {
      profile: NGINX_PROTOCOL,
      statusCode: 404,
      headers: {},
      body,
      keepAlive: true,
      serverHeader: "s",
      now: new Date(),
      omitBody: true,
    });

    const head = target.calls.head[0] as { headers: string[] };
    const index = head.headers.indexOf("Content-Length");

    expect(head.headers[index + 1]).toBe(String(body.length));
    expect((target.calls.body[0] as Buffer).length).toBe(0);
  });
});
