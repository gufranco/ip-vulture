import { faker } from "@faker-js/faker";
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
import { apacheTemplate } from "../templates/apache.js";

faker.seed(42);

function fakeGeolocationSuccess() {
  return {
    status: "success" as const,
    country: faker.location.country(),
    countryCode: faker.location.countryCode(),
    region: faker.location.state({ abbreviated: true }),
    regionName: faker.location.state(),
    city: faker.location.city(),
    zip: faker.location.zipCode(),
    lat: faker.location.latitude(),
    lon: faker.location.longitude(),
    timezone: faker.location.timeZone(),
    isp: faker.company.name(),
    org: faker.company.name(),
    as: `AS${faker.number.int({ min: 1000, max: 99999 })} ${faker.company.name()}`,
    query: faker.internet.ipv4(),
  };
}

function fakeGeolocationFailure() {
  return {
    status: "fail" as const,
    message: "reserved range",
    query: "127.0.0.1",
  };
}

describe("GET /:id", () => {
  let fetchSpy: MockInstance;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return a fake 404 page on successful geolocation", async () => {
    // Arrange
    fetchSpy.mockResolvedValueOnce(Response.json(fakeGeolocationSuccess()));
    const app = buildApp({ template: apacheTemplate });

    // Act
    const response = await app.inject({
      method: "GET",
      url: "/test-123",
    });

    // Assert
    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toBe(
      "text/html; charset=iso-8859-1",
    );
    expect(response.headers.server).toBe("Apache/2.4.62 (Ubuntu)");
    expect(response.body).toContain("<title>404 Not Found</title>");
    expect(response.body).toContain(
      "The requested URL /test-123 was not found",
    );
    expect(response.body).toContain("Apache/2.4.62 (Ubuntu)");
  });

  it("should return a fake 404 page even when geolocation fails", async () => {
    // Arrange
    fetchSpy.mockResolvedValueOnce(Response.json(fakeGeolocationFailure()));
    const app = buildApp({ template: apacheTemplate });

    // Act
    const response = await app.inject({
      method: "GET",
      url: "/local-test",
    });

    // Assert
    expect(response.statusCode).toBe(404);
    expect(response.body).toContain(
      "The requested URL /local-test was not found",
    );
  });

  it("should return a fake 404 page when ip-api.com returns a non-ok HTTP status", async () => {
    // Arrange
    fetchSpy.mockResolvedValueOnce(
      new Response("Too Many Requests", { status: 429 }),
    );
    const app = buildApp({ template: apacheTemplate });

    // Act
    const response = await app.inject({
      method: "GET",
      url: "/rate-limited",
    });

    // Assert
    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toBe(
      "text/html; charset=iso-8859-1",
    );
    expect(response.body).toContain(
      "The requested URL /rate-limited was not found",
    );
  });

  it("should return a fake 404 page when ip-api.com is unreachable", async () => {
    // Arrange
    fetchSpy.mockRejectedValueOnce(new Error("fetch failed"));
    const app = buildApp({ template: apacheTemplate });

    // Act
    const response = await app.inject({
      method: "GET",
      url: "/unreachable",
    });

    // Assert
    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toBe(
      "text/html; charset=iso-8859-1",
    );
    expect(response.body).toContain(
      "The requested URL /unreachable was not found",
    );
  });

  it("should call ip-api.com with the request IP", async () => {
    // Arrange
    const ip = faker.internet.ipv4();
    fetchSpy.mockResolvedValueOnce(Response.json(fakeGeolocationSuccess()));
    const app = buildApp({ template: apacheTemplate });

    // Act
    await app.inject({
      method: "GET",
      url: "/check-ip",
      headers: { "x-forwarded-for": ip },
    });

    // Assert
    expect(fetchSpy).toHaveBeenCalledWith(
      `http://ip-api.com/json/${ip}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});

describe("GET /", () => {
  let fetchSpy: MockInstance;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return a fake 404 page without calling ip-api.com", async () => {
    // Arrange
    const app = buildApp({ template: apacheTemplate });

    // Act
    const response = await app.inject({
      method: "GET",
      url: "/",
    });

    // Assert
    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toBe(
      "text/html; charset=iso-8859-1",
    );
    expect(response.body).toContain("<title>404 Not Found</title>");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("GET /health", () => {
  it("should return 200 with status ok", async () => {
    // Arrange
    const app = buildApp({ template: apacheTemplate });

    // Act
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    // Assert
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});
