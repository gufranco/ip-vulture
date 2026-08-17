import { describe, expect, it } from "vitest";
import {
  applyDisclosure,
  DISCLOSURE_COMMENT,
  DISCLOSURE_HEADER,
  DISCLOSURE_VALUE,
} from "../disclosure.js";

const htmlBody = "<html><body><h1>404</h1></body></html>\n";
const textBody = "404 page not found\n";

describe("applyDisclosure header modes", () => {
  it("should add the header in header mode", () => {
    const result = applyDisclosure("header", htmlBody, "text/html", {});

    expect(result.headers[DISCLOSURE_HEADER]).toBe(DISCLOSURE_VALUE);
  });

  it("should add the header in both mode", () => {
    const result = applyDisclosure("both", htmlBody, "text/html", {});

    expect(result.headers[DISCLOSURE_HEADER]).toBe(DISCLOSURE_VALUE);
  });

  it("should not add the header in comment mode", () => {
    const result = applyDisclosure("comment", htmlBody, "text/html", {});

    expect(result.headers[DISCLOSURE_HEADER]).toBeUndefined();
  });

  it("should not add the header in off mode", () => {
    const result = applyDisclosure("off", htmlBody, "text/html", {});

    expect(result.headers[DISCLOSURE_HEADER]).toBeUndefined();
  });

  it("should preserve headers the simulation already set", () => {
    const result = applyDisclosure("header", htmlBody, "text/html", {
      Server: "nginx/1.27.4",
    });

    expect(result.headers.Server).toBe("nginx/1.27.4");
  });
});

describe("applyDisclosure body modes", () => {
  it("should append the comment to an HTML body in comment mode", () => {
    const result = applyDisclosure("comment", htmlBody, "text/html", {});

    expect(result.body).toContain(DISCLOSURE_COMMENT);
    expect(result.body.startsWith(htmlBody)).toBe(true);
  });

  it("should append the comment to an HTML body in both mode", () => {
    const result = applyDisclosure("both", htmlBody, "text/html", {});

    expect(result.body).toContain(DISCLOSURE_COMMENT);
  });

  it("should leave the body untouched in header mode", () => {
    const result = applyDisclosure("header", htmlBody, "text/html", {});

    expect(result.body).toBe(htmlBody);
  });

  it("should leave the body untouched in off mode", () => {
    const result = applyDisclosure("off", htmlBody, "text/html", {});

    expect(result.body).toBe(htmlBody);
  });

  it("should never inject an HTML comment into a plain-text body", () => {
    const result = applyDisclosure("both", textBody, "text/plain", {});

    expect(result.body).toBe(textBody);
    expect(result.headers[DISCLOSURE_HEADER]).toBe(DISCLOSURE_VALUE);
  });

  it("should never inject an HTML comment when there is no content type", () => {
    const result = applyDisclosure("both", "", undefined, {});

    expect(result.body).toBe("");
  });

  it("should not inject a comment into an empty HTML body", () => {
    const result = applyDisclosure("both", "", "text/html", {});

    expect(result.body).toBe("");
  });
});

describe("applyDisclosure marker content", () => {
  it("should state plainly that the response is simulated", () => {
    expect(DISCLOSURE_COMMENT.toLowerCase()).toContain("simulated");
  });

  it("should not carry a real server identity in the marker", () => {
    expect(DISCLOSURE_VALUE).toBe("ip-vulture; simulated-response");
  });
});
