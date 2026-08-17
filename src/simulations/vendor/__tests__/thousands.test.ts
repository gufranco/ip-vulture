import { describe, expect, it } from "vitest";
import { Era, Genre } from "../../simulation.js";
import {
  apache20,
  iis6,
  nginx07,
  thousandsSimulations,
  zeus,
} from "../thousands.js";

const context = {
  path: "/products/index.asp",
  method: "GET",
  statusCode: 404,
  host: "www.example.com",
  now: new Date("2004-03-01T12:00:00Z"),
};

describe("thousandsSimulations", () => {
  it("should all declare the 2000s era", () => {
    for (const simulation of thousandsSimulations) {
      expect(simulation.era).toBe(Era.Thousands);
    }
  });

  it("should all declare the vendor genre", () => {
    for (const simulation of thousandsSimulations) {
      expect(simulation.genre).toBe(Genre.Vendor);
    }
  });

  it("should escape HTML in the path wherever the path is rendered", () => {
    const hostile = { ...context, path: "/<script>alert(1)</script>" };

    for (const simulation of thousandsSimulations) {
      expect(simulation.render(hostile)).not.toContain("<script>");
    }
  });
});

describe("apache20", () => {
  it("should identify as Apache 2.0", () => {
    expect(apache20.headers(context).Server).toBe(
      "Apache/2.0.63 (Unix) PHP/4.4.9",
    );
  });

  it("should render the requested URL sentence", () => {
    expect(apache20.render(context)).toContain(
      "The requested URL /products/index.asp was not found on this server.",
    );
  });
});

describe("iis6", () => {
  it("should identify as IIS 6.0", () => {
    expect(iis6.headers(context).Server).toBe("Microsoft-IIS/6.0");
  });

  it("should set the ASP.NET powered-by header of the era", () => {
    expect(iis6.headers(context)["X-Powered-By"]).toBe("ASP.NET");
  });

  it("should carry the period ASP.NET version header", () => {
    expect(iis6.headers(context)["X-AspNet-Version"]).toBe("2.0.50727");
  });
});

describe("nginx07", () => {
  it("should identify as an early nginx", () => {
    expect(nginx07.headers(context).Server).toBe("nginx/0.7.65");
  });

  it("should never render the path", () => {
    expect(nginx07.render({ ...context, path: "/secret" })).not.toContain(
      "/secret",
    );
  });
});

describe("zeus", () => {
  it("should identify as Zeus", () => {
    expect(zeus.headers(context).Server).toBe("Zeus/4.3");
  });

  it("should render the status text", () => {
    expect(zeus.render(context)).toContain("Not Found");
  });
});
