import { describe, expect, it, vi } from "vitest";
import { createGeoLookup } from "../lookup.js";

const enabled = {
  enabled: true,
  timeoutMs: 5000,
  budgetPerMinute: 40,
  cacheTtlSeconds: 3600,
  cacheMax: 100,
};

function jsonResponse(body: unknown): Response {
  return Response.json(body);
}

function successBody(query: string) {
  return {
    status: "success",
    country: "Brazil",
    countryCode: "BR",
    region: "SP",
    regionName: "Sao Paulo",
    city: "Sao Paulo",
    zip: "01000-000",
    lat: -23.5,
    lon: -46.6,
    timezone: "America/Sao_Paulo",
    isp: "Example ISP",
    org: "Example Org",
    as: "AS64500 Example",
    query,
  };
}

describe("createGeoLookup when disabled", () => {
  it("should never call the network", async () => {
    const fetcher = vi.fn();
    const lookup = createGeoLookup({
      config: { ...enabled, enabled: false },
      fetcher,
    });

    const result = await lookup.locate("8.8.8.8");

    expect(result).toBeUndefined();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("createGeoLookup reserved addresses", () => {
  it.each(["127.0.0.1", "10.0.0.5", "192.168.1.1", "::1", "not-an-address"])(
    "should skip the upstream call for %s",
    async (address) => {
      const fetcher = vi.fn();
      const lookup = createGeoLookup({ config: enabled, fetcher });

      const result = await lookup.locate(address);

      expect(result).toBeUndefined();
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
});

describe("createGeoLookup success path", () => {
  it("should return the resolved geolocation", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(jsonResponse(successBody("8.8.8.8")));
    const lookup = createGeoLookup({ config: enabled, fetcher });

    const result = await lookup.locate("8.8.8.8");

    expect(result?.country).toBe("Brazil");
    expect(result?.city).toBe("Sao Paulo");
  });

  it("should pass an abort signal to the fetcher", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(jsonResponse(successBody("8.8.8.8")));
    const lookup = createGeoLookup({ config: enabled, fetcher });

    await lookup.locate("8.8.8.8");

    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("8.8.8.8"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("should serve a repeat address from the cache", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(jsonResponse(successBody("8.8.8.8")));
    const lookup = createGeoLookup({ config: enabled, fetcher });

    await lookup.locate("8.8.8.8");
    await lookup.locate("8.8.8.8");

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("should collapse concurrent lookups for one address into a single call", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(jsonResponse(successBody("8.8.8.8")));
    const lookup = createGeoLookup({ config: enabled, fetcher });

    await Promise.all(
      Array.from({ length: 20 }, () => lookup.locate("8.8.8.8")),
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("createGeoLookup budget", () => {
  it("should cap total calls regardless of how many distinct addresses arrive", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(jsonResponse(successBody(url))),
      );
    const lookup = createGeoLookup({
      config: { ...enabled, budgetPerMinute: 5 },
      fetcher,
    });

    for (let index = 0; index < 30; index += 1) {
      await lookup.locate(`8.8.${index}.1`);
    }

    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it("should return undefined once the budget is exhausted", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(jsonResponse(successBody("8.8.8.8")));
    const lookup = createGeoLookup({
      config: { ...enabled, budgetPerMinute: 1 },
      fetcher,
    });

    await lookup.locate("8.8.8.8");
    const second = await lookup.locate("9.9.9.9");

    expect(second).toBeUndefined();
  });
});

describe("createGeoLookup failure paths", () => {
  it("should return undefined when the upstream reports failure", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        status: "fail",
        message: "reserved range",
        query: "8.8.8.8",
      }),
    );
    const lookup = createGeoLookup({ config: enabled, fetcher });

    expect(await lookup.locate("8.8.8.8")).toBeUndefined();
  });

  it("should return undefined on a non-ok HTTP status", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("rate limited", { status: 429 }));
    const lookup = createGeoLookup({ config: enabled, fetcher });

    expect(await lookup.locate("8.8.8.8")).toBeUndefined();
  });

  it("should return undefined when the fetch rejects", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("network down"));
    const lookup = createGeoLookup({ config: enabled, fetcher });

    expect(await lookup.locate("8.8.8.8")).toBeUndefined();
  });

  it("should return undefined when the body is not valid JSON", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("<html>oops</html>", { status: 200 }));
    const lookup = createGeoLookup({ config: enabled, fetcher });

    expect(await lookup.locate("8.8.8.8")).toBeUndefined();
  });

  it("should return undefined when the body has an unexpected shape", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ unexpected: 1 }));
    const lookup = createGeoLookup({ config: enabled, fetcher });

    expect(await lookup.locate("8.8.8.8")).toBeUndefined();
  });

  it("should never throw out of locate", async () => {
    const fetcher = vi.fn().mockImplementation(() => {
      throw new Error("synchronous explosion");
    });
    const lookup = createGeoLookup({ config: enabled, fetcher });

    await expect(lookup.locate("8.8.8.8")).resolves.toBeUndefined();
  });
});
