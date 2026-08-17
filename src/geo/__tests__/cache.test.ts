import { describe, expect, it, vi } from "vitest";
import { createLookupCache } from "../cache.js";

describe("createLookupCache", () => {
  it("should call the loader on a miss", async () => {
    const loader = vi.fn().mockResolvedValue("result");
    const cache = createLookupCache<string>({ ttlSeconds: 60, max: 10 });

    const value = await cache.resolve("key", loader);

    expect(value).toBe("result");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("should serve a second request from the cache", async () => {
    const loader = vi.fn().mockResolvedValue("result");
    const cache = createLookupCache<string>({ ttlSeconds: 60, max: 10 });

    await cache.resolve("key", loader);
    const second = await cache.resolve("key", loader);

    expect(second).toBe("result");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("should keep distinct keys separate", async () => {
    const loader = vi
      .fn()
      .mockImplementation((key: string) => Promise.resolve(key));
    const cache = createLookupCache<string>({ ttlSeconds: 60, max: 10 });

    const first = await cache.resolve("a", () => loader("a"));
    const second = await cache.resolve("b", () => loader("b"));

    expect(first).toBe("a");
    expect(second).toBe("b");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("should reload after the entry expires", async () => {
    let clock = 0;
    const loader = vi.fn().mockResolvedValue("result");
    const cache = createLookupCache<string>({
      ttlSeconds: 1,
      max: 10,
      now: () => clock,
    });

    await cache.resolve("key", loader);
    clock = 1001;
    await cache.resolve("key", loader);

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("should collapse concurrent misses into a single load", async () => {
    let resolveLoader: (value: string) => void = () => undefined;
    const loader = vi.fn().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveLoader = resolve;
        }),
    );
    const cache = createLookupCache<string>({ ttlSeconds: 60, max: 10 });

    const inFlight = Array.from({ length: 20 }, () =>
      cache.resolve("key", loader),
    );
    resolveLoader("result");
    const results = await Promise.all(inFlight);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(results.every((value) => value === "result")).toBe(true);
  });

  it("should not cache a rejected load", async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error("upstream down"))
      .mockResolvedValueOnce("result");
    const cache = createLookupCache<string>({ ttlSeconds: 60, max: 10 });

    await expect(cache.resolve("key", loader)).rejects.toThrow("upstream down");
    const second = await cache.resolve("key", loader);

    expect(second).toBe("result");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("should reject every concurrent caller when the shared load fails", async () => {
    const loader = vi.fn().mockRejectedValue(new Error("upstream down"));
    const cache = createLookupCache<string>({ ttlSeconds: 60, max: 10 });

    const settled = await Promise.allSettled(
      Array.from({ length: 5 }, () => cache.resolve("key", loader)),
    );

    expect(settled.every((result) => result.status === "rejected")).toBe(true);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("should evict the oldest entry when the capacity is exceeded", async () => {
    const loader = vi.fn().mockResolvedValue("result");
    const cache = createLookupCache<string>({ ttlSeconds: 60, max: 2 });

    await cache.resolve("a", loader);
    await cache.resolve("b", loader);
    await cache.resolve("c", loader);

    expect(cache.size()).toBe(2);

    await cache.resolve("a", loader);

    expect(loader).toHaveBeenCalledTimes(4);
  });

  it("should report its current size", async () => {
    const loader = vi.fn().mockResolvedValue("result");
    const cache = createLookupCache<string>({ ttlSeconds: 60, max: 10 });

    expect(cache.size()).toBe(0);

    await cache.resolve("a", loader);

    expect(cache.size()).toBe(1);
  });
});
