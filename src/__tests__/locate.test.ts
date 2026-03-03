import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";
import { buildApp } from "../app.js";

const GEOLOCATION_SUCCESS = {
  status: "success" as const,
  country: "Brazil",
  countryCode: "BR",
  region: "SP",
  regionName: "Sao Paulo",
  city: "Sao Paulo",
  zip: "01000-000",
  lat: -23.5505,
  lon: -46.6333,
  timezone: "America/Sao_Paulo",
  isp: "Vivo",
  org: "Vivo S.A.",
  as: "AS18881 Vivo",
  query: "200.100.50.25",
};

const GEOLOCATION_FAILURE = {
  status: "fail" as const,
  message: "reserved range",
  query: "127.0.0.1",
};

describe("GET /:id", () => {
  let fetchSpy: MockInstance;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return a random number between 0 and 100 on successful geolocation", async () => {
    // Arrange
    fetchSpy.mockResolvedValueOnce(Response.json(GEOLOCATION_SUCCESS));
    const app = buildApp();

    // Act
    const response = await app.inject({
      method: "GET",
      url: "/test-123",
    });

    // Assert
    expect(response.statusCode).toBe(200);
    const value = Number(response.body);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(100);
    expect(Number.isInteger(value)).toBe(true);
  });

  it("should return a random number even when geolocation fails for reserved IPs", async () => {
    // Arrange
    fetchSpy.mockResolvedValueOnce(Response.json(GEOLOCATION_FAILURE));
    const app = buildApp();

    // Act
    const response = await app.inject({
      method: "GET",
      url: "/local-test",
    });

    // Assert
    expect(response.statusCode).toBe(200);
    const value = Number(response.body);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(100);
  });

  it("should return 502 when ip-api.com returns a non-ok HTTP status", async () => {
    // Arrange
    fetchSpy.mockResolvedValueOnce(
      new Response("Too Many Requests", { status: 429 }),
    );
    const app = buildApp();

    // Act
    const response = await app.inject({
      method: "GET",
      url: "/rate-limited",
    });

    // Assert
    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({ error: "geolocation lookup failed" });
  });

  it("should return 502 when ip-api.com is unreachable", async () => {
    // Arrange
    fetchSpy.mockRejectedValueOnce(new Error("fetch failed"));
    const app = buildApp();

    // Act
    const response = await app.inject({
      method: "GET",
      url: "/unreachable",
    });

    // Assert
    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({ error: "geolocation lookup failed" });
  });

  it("should call ip-api.com with the request IP", async () => {
    // Arrange
    fetchSpy.mockResolvedValueOnce(Response.json(GEOLOCATION_SUCCESS));
    const app = buildApp();

    // Act
    await app.inject({
      method: "GET",
      url: "/check-ip",
      headers: { "x-forwarded-for": "200.100.50.25" },
    });

    // Assert
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://ip-api.com/json/200.100.50.25",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
