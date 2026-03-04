import { describe, expect, it, vi } from "vitest";
import { resolveTemplate } from "../templates/registry.js";
import { ServerName } from "../templates/template.js";

describe("resolveTemplate", () => {
  it("should resolve each ServerName value to a matching template", () => {
    // Arrange
    const names = Object.values(ServerName);

    // Act
    // Assert
    for (const name of names) {
      const template = resolveTemplate(name);
      expect(template.name).toBe(name);
    }
  });

  it("should resolve 'random' to a valid template", () => {
    // Arrange
    vi.spyOn(Math, "random").mockReturnValue(0);

    // Act
    const template = resolveTemplate("random");

    // Assert
    const validNames = Object.values(ServerName) as string[];
    expect(validNames).toContain(template.name);

    vi.restoreAllMocks();
  });

  it("should throw on an unknown template name", () => {
    // Arrange
    // Act
    // Assert
    expect(() => resolveTemplate("unknown")).toThrow(
      'Unknown server template: "unknown"',
    );
  });

  it("should default to apache when given 'apache'", () => {
    // Arrange
    // Act
    const template = resolveTemplate("apache");

    // Assert
    expect(template.name).toBe(ServerName.Apache);
  });
});
