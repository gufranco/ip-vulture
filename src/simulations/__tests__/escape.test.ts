import { describe, expect, it } from "vitest";
import { escapeHtml } from "../escape.js";

describe("escapeHtml", () => {
  it("should escape ampersands", () => {
    expect(escapeHtml("a&b")).toBe("a&amp;b");
  });

  it("should escape angle brackets", () => {
    expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
  });

  it("should escape quotes", () => {
    expect(escapeHtml("\"hello'")).toBe("&quot;hello&#39;");
  });

  it("should handle strings with no special characters", () => {
    expect(escapeHtml("/normal/path")).toBe("/normal/path");
  });

  it("should escape a full XSS payload", () => {
    const payload = '<script>alert("xss")</script>';

    const result = escapeHtml(payload);

    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
    expect(result).toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
  });

  it("should escape the ampersand first so entities are not double decoded", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("should return an empty string unchanged", () => {
    expect(escapeHtml("")).toBe("");
  });
});
