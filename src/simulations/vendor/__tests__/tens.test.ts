import { describe, expect, it } from "vitest";
import { Era, Genre } from "../../simulation.js";
import {
  apache24,
  iis10,
  lighttpd,
  litespeed,
  nginx1,
  openresty,
  tensSimulations,
  tomcat10,
} from "../tens.js";

const context = {
  path: "/some/page",
  method: "GET",
  statusCode: 404,
  host: "localhost",
  now: new Date("2026-08-16T00:00:00Z"),
};

describe("tensSimulations", () => {
  it("should all declare the 2010s era", () => {
    for (const simulation of tensSimulations) {
      expect(simulation.era).toBe(Era.Tens);
    }
  });

  it("should all declare the vendor genre", () => {
    for (const simulation of tensSimulations) {
      expect(simulation.genre).toBe(Genre.Vendor);
    }
  });

  it("should expose unique ids", () => {
    const ids = tensSimulations.map((simulation) => simulation.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("apache24", () => {
  it("should render the requested path in the body", () => {
    expect(apache24.render(context)).toContain(
      "The requested URL /some/page was not found on this server.",
    );
  });

  it("should escape HTML in the path", () => {
    const body = apache24.render({
      ...context,
      path: "/<script>alert(1)</script>",
    });

    expect(body).not.toContain("<script>");
    expect(body).toContain("&lt;script&gt;");
  });

  it("should declare the iso-8859-1 charset it historically used", () => {
    expect(apache24.headers(context)["Content-Type"]).toBe(
      "text/html; charset=iso-8859-1",
    );
  });

  it("should identify itself in the Server header", () => {
    expect(apache24.headers(context).Server).toBe("Apache/2.4.62 (Ubuntu)");
  });

  it("should render a distinct body per status code", () => {
    const forbidden = apache24.render({ ...context, statusCode: 403 });
    const notFound = apache24.render(context);

    expect(forbidden).toContain("Forbidden");
    expect(forbidden).not.toBe(notFound);
  });

  it("should not leak the path into a 500 body, matching real Apache", () => {
    const body = apache24.render({ ...context, statusCode: 500 });

    expect(body).toContain("Internal Server Error");
    expect(body).not.toContain("/some/page");
  });
});

describe("nginx1", () => {
  it("should never render the path", () => {
    expect(nginx1.render({ ...context, path: "/secret" })).not.toContain(
      "/secret",
    );
  });

  it("should show its version in the footer and the header", () => {
    expect(nginx1.headers(context).Server).toBe("nginx/1.27.4");
    expect(nginx1.render(context)).toContain("nginx/1.27.4");
  });

  it("should render the status text for each supported code", () => {
    expect(nginx1.render({ ...context, statusCode: 502 })).toContain(
      "502 Bad Gateway",
    );
  });
});

describe("openresty", () => {
  it("should identify as openresty in the footer", () => {
    expect(openresty.render(context)).toContain("openresty/1.27.1.1");
  });
});

describe("iis10", () => {
  it("should set the ASP.NET powered-by header", () => {
    expect(iis10.headers(context)["X-Powered-By"]).toBe("ASP.NET");
  });

  it("should identify as IIS 10", () => {
    expect(iis10.headers(context).Server).toBe("Microsoft-IIS/10.0");
  });
});

describe("tomcat10", () => {
  it("should render the path in the message block", () => {
    expect(tomcat10.render({ ...context, path: "/admin" })).toContain("/admin");
  });

  it("should escape HTML in the path", () => {
    const body = tomcat10.render({
      ...context,
      path: "/<script>alert(1)</script>",
    });

    expect(body).not.toContain("<script>");
  });

  it("should not set a Server header, matching a default Tomcat", () => {
    expect(tomcat10.headers(context).Server).toBeUndefined();
  });
});

describe("lighttpd", () => {
  it("should identify itself in the Server header", () => {
    expect(lighttpd.headers(context).Server).toBe("lighttpd/1.4.76");
  });
});

describe("litespeed", () => {
  it("should identify itself in the Server header", () => {
    expect(litespeed.headers(context).Server).toBe("LiteSpeed");
  });

  it("should render the status code prominently", () => {
    expect(litespeed.render(context)).toContain("404");
  });
});
