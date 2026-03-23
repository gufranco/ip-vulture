import { describe, expect, it } from "vitest";
import { escapeHtml } from "../templates/escape.js";

describe("escapeHtml", () => {
  it("should escape ampersands", () => {
    // Arrange
    // Act
    // Assert
    expect(escapeHtml("a&b")).toBe("a&amp;b");
  });

  it("should escape angle brackets", () => {
    // Arrange
    // Act
    // Assert
    expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
  });

  it("should escape quotes", () => {
    // Arrange
    // Act
    // Assert
    expect(escapeHtml("\"hello'")).toBe("&quot;hello&#39;");
  });

  it("should handle strings with no special characters", () => {
    // Arrange
    // Act
    // Assert
    expect(escapeHtml("/normal/path")).toBe("/normal/path");
  });

  it("should escape a full XSS payload", () => {
    // Arrange
    const payload = '<script>alert("xss")</script>';

    // Act
    const result = escapeHtml(payload);

    // Assert
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
    expect(result).toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
  });
});
