import { describe, expect, it } from "vitest";
import { Era, Genre } from "../../simulation.js";
import {
  apache13,
  cernHttpd,
  iis4,
  ncsaHttpd,
  netscapeEnterprise,
  ninetiesSimulations,
} from "../nineties.js";

const context = {
  path: "/cgi-bin/test.cgi",
  method: "GET",
  statusCode: 404,
  host: "www.example.com",
  now: new Date("1997-06-01T12:00:00Z"),
};

describe("ninetiesSimulations", () => {
  it("should all declare the 1990s era", () => {
    for (const simulation of ninetiesSimulations) {
      expect(simulation.era).toBe(Era.Nineties);
    }
  });

  it("should all declare the vendor genre", () => {
    for (const simulation of ninetiesSimulations) {
      expect(simulation.genre).toBe(Genre.Vendor);
    }
  });

  it("should carry five period servers", () => {
    expect(ninetiesSimulations).toHaveLength(5);
  });

  it("should never emit a DOCTYPE, which predates their markup conventions", () => {
    for (const simulation of ninetiesSimulations) {
      expect(simulation.render(context).toUpperCase()).not.toContain(
        "<!DOCTYPE",
      );
    }
  });

  it("should escape HTML in the path wherever the path is rendered", () => {
    const hostile = { ...context, path: "/<script>alert(1)</script>" };

    for (const simulation of ninetiesSimulations) {
      expect(simulation.render(hostile)).not.toContain("<script>");
    }
  });
});

describe("ncsaHttpd", () => {
  it("should identify as NCSA httpd", () => {
    expect(ncsaHttpd.headers(context).Server).toBe("NCSA/1.5.2");
  });

  it("should use the uppercase heading style of the era", () => {
    expect(ncsaHttpd.render(context)).toContain("<H1>");
  });

  it("should render the path", () => {
    expect(ncsaHttpd.render(context)).toContain("/cgi-bin/test.cgi");
  });
});

describe("cernHttpd", () => {
  it("should identify as CERN httpd", () => {
    expect(cernHttpd.headers(context).Server).toBe("CERN/3.0A");
  });
});

describe("apache13", () => {
  it("should identify as Apache 1.3", () => {
    expect(apache13.headers(context).Server).toBe("Apache/1.3.42 (Unix)");
  });

  it("should render the classic requested-URL sentence", () => {
    expect(apache13.render(context)).toContain(
      "The requested URL /cgi-bin/test.cgi was not found on this server.",
    );
  });

  it("should name the host in the address footer", () => {
    expect(apache13.render(context)).toContain("www.example.com");
  });
});

describe("iis4", () => {
  it("should identify as IIS 4.0", () => {
    expect(iis4.headers(context).Server).toBe("Microsoft-IIS/4.0");
  });

  it("should use the period wording for a missing object", () => {
    expect(iis4.render(context)).toContain("HTTP 404");
  });
});

describe("netscapeEnterprise", () => {
  it("should identify as Netscape Enterprise", () => {
    expect(netscapeEnterprise.headers(context).Server).toBe(
      "Netscape-Enterprise/3.6",
    );
  });

  it("should render the status text", () => {
    expect(netscapeEnterprise.render(context)).toContain("Not Found");
  });
});
