import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../config.js";

describe("loadConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should use default values when env vars are not set", () => {
    // Arrange
    vi.stubEnv("PORT", "");
    vi.stubEnv("HOST", "");
    vi.stubEnv("SERVER_TEMPLATE", "");

    // Act
    // Assert
    expect(() => loadConfig()).toThrow();
  });

  it("should parse valid PORT as integer", () => {
    // Arrange
    vi.stubEnv("PORT", "8080");
    vi.stubEnv("HOST", "localhost");
    vi.stubEnv("SERVER_TEMPLATE", "nginx");

    // Act
    const config = loadConfig();

    // Assert
    expect(config.port).toBe(8080);
    expect(config.host).toBe("localhost");
    expect(config.template.name).toBe("nginx");
  });

  it("should throw on non-integer PORT", () => {
    // Arrange
    vi.stubEnv("PORT", "abc");

    // Act
    // Assert
    expect(() => loadConfig()).toThrow("Invalid PORT");
  });

  it("should throw on PORT below 1", () => {
    // Arrange
    vi.stubEnv("PORT", "0");

    // Act
    // Assert
    expect(() => loadConfig()).toThrow("Invalid PORT");
  });

  it("should throw on PORT above 65535", () => {
    // Arrange
    vi.stubEnv("PORT", "70000");

    // Act
    // Assert
    expect(() => loadConfig()).toThrow("Invalid PORT");
  });

  it("should throw on unknown SERVER_TEMPLATE", () => {
    // Arrange
    vi.stubEnv("SERVER_TEMPLATE", "unknown");

    // Act
    // Assert
    expect(() => loadConfig()).toThrow("Unknown server template");
  });

  it("should use defaults when env vars are unset", () => {
    // Arrange
    delete process.env.PORT;
    delete process.env.HOST;
    delete process.env.SERVER_TEMPLATE;

    // Act
    const config = loadConfig();

    // Assert
    expect(config.port).toBe(3000);
    expect(config.host).toBe("0.0.0.0");
    expect(config.template.name).toBe("apache");
  });
});
