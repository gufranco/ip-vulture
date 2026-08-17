import { describe, expect, it } from "vitest";
import { Era, Genre } from "../../simulation.js";
import {
  constructionZone,
  creativeSimulations,
  cyberCafe,
  lostInSpace,
  webringHub,
} from "../pages.js";

const context = {
  path: "/fotos/ferias.html",
  method: "GET",
  statusCode: 404,
  host: "www.example.com",
  now: new Date("2003-11-09T14:30:00Z"),
};

describe("creativeSimulations", () => {
  it("should all declare the creative genre", () => {
    for (const simulation of creativeSimulations) {
      expect(simulation.genre).toBe(Genre.Creative);
    }
  });

  it("should all sit in the 2000s era", () => {
    for (const simulation of creativeSimulations) {
      expect(simulation.era).toBe(Era.Thousands);
    }
  });

  it("should expose unique ids", () => {
    const ids = creativeSimulations.map((simulation) => simulation.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should escape HTML in the path", () => {
    const hostile = { ...context, path: "/<script>alert(1)</script>" };

    for (const simulation of creativeSimulations) {
      expect(simulation.render(hostile)).not.toContain("<script>alert");
    }
  });

  it("should never reference a real company or product brand", () => {
    const forbidden = [
      "geocities",
      "angelfire",
      "tripod",
      "yahoo",
      "google",
      "microsoft",
      "facebook",
      "orkut",
    ];

    for (const simulation of creativeSimulations) {
      const body = simulation.render(context).toLowerCase();

      for (const brand of forbidden) {
        expect(body).not.toContain(brand);
      }
    }
  });

  it("should embed no binary or remote assets", () => {
    for (const simulation of creativeSimulations) {
      const body = simulation.render(context);

      expect(body).not.toMatch(/<img\b/i);
      expect(body).not.toMatch(/\bsrc\s*=/i);
      expect(body).not.toMatch(/url\(/i);
      expect(body).not.toMatch(/<link\b/i);
    }
  });

  it("should point every hyperlink at a relative path", () => {
    for (const simulation of creativeSimulations) {
      const body = simulation.render(context);
      const hrefs = [...body.matchAll(/href="([^"]*)"/gi)].map(
        (match) => match[1],
      );

      expect(hrefs.length).toBeGreaterThan(0);

      for (const href of hrefs) {
        expect(href).toMatch(/^\//);
      }
    }
  });

  it("should reference a remote origin only as an SVG namespace, never as a fetch", () => {
    const svgNamespace = /w3\.org\/2000\/svg/;

    for (const simulation of creativeSimulations) {
      const remote = [...simulation.render(context).matchAll(/https?:\S+/g)]
        .map((match) => match[0])
        .filter((url) => !svgNamespace.test(url));

      expect(remote).toEqual([]);
    }
  });

  it("should serve HTML", () => {
    for (const simulation of creativeSimulations) {
      expect(simulation.headers(context)["Content-Type"]).toContain(
        "text/html",
      );
    }
  });
});

describe("constructionZone", () => {
  it("should carry the period under-construction motif", () => {
    expect(constructionZone.render(context).toLowerCase()).toContain(
      "under construction",
    );
  });

  it("should render a visitor counter", () => {
    expect(constructionZone.render(context)).toMatch(/\d{5,}/);
  });
});

describe("lostInSpace", () => {
  it("should name the missing path", () => {
    expect(lostInSpace.render(context)).toContain("/fotos/ferias.html");
  });

  it("should use inline SVG rather than an image file", () => {
    expect(lostInSpace.render(context)).toContain("<svg");
  });
});

describe("webringHub", () => {
  it("should carry a webring footer", () => {
    expect(webringHub.render(context).toLowerCase()).toContain("webring");
  });
});

describe("cyberCafe", () => {
  it("should use a fixed-width table layout of the era", () => {
    expect(cyberCafe.render(context)).toContain("<table");
    expect(cyberCafe.render(context)).toContain('width="760"');
  });

  it("should use a font tag, which the era relied on", () => {
    expect(cyberCafe.render(context)).toContain("<font");
  });
});
