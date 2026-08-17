import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_FEEDS,
  loadFeeds,
  parseFeedBody,
  REPUTATION_FEEDS,
} from "../feeds.js";

describe("parseFeedBody plain lists", () => {
  it("should parse one address per line", () => {
    const entries = parseFeedBody("plain", "1.2.3.4\n5.6.7.8\n");

    expect(entries).toEqual(["1.2.3.4", "5.6.7.8"]);
  });

  it("should skip comment lines", () => {
    const entries = parseFeedBody(
      "plain",
      "# a comment\n1.2.3.4\n; another\n5.6.7.8\n",
    );

    expect(entries).toEqual(["1.2.3.4", "5.6.7.8"]);
  });

  it("should skip blank lines", () => {
    expect(parseFeedBody("plain", "\n\n1.2.3.4\n\n")).toEqual(["1.2.3.4"]);
  });

  it("should keep CIDR notation intact", () => {
    expect(parseFeedBody("plain", "10.0.0.0/8\n")).toEqual(["10.0.0.0/8"]);
  });

  it("should take only the first field of a whitespace-separated line", () => {
    expect(parseFeedBody("plain", "1.2.3.4 some trailing note\n")).toEqual([
      "1.2.3.4",
    ]);
  });

  it("should return nothing for an empty body", () => {
    expect(parseFeedBody("plain", "")).toEqual([]);
  });
});

describe("parseFeedBody Spamhaus DROP", () => {
  it("should read the cidr field from each JSON line", () => {
    const body = [
      '{"cidr":"1.2.3.0/24","sblid":"SBL1","rir":"arin"}',
      '{"cidr":"5.6.0.0/16","sblid":"SBL2","rir":"ripe"}',
    ].join("\n");

    expect(parseFeedBody("spamhaus", body)).toEqual([
      "1.2.3.0/24",
      "5.6.0.0/16",
    ]);
  });

  it("should skip metadata lines that carry no cidr", () => {
    const body = [
      '{"type":"metadata","timestamp":1750000000}',
      '{"cidr":"1.2.3.0/24"}',
    ].join("\n");

    expect(parseFeedBody("spamhaus", body)).toEqual(["1.2.3.0/24"]);
  });

  it("should skip malformed JSON lines rather than throwing", () => {
    const body = ['{"cidr":"1.2.3.0/24"}', "not json at all"].join("\n");

    expect(parseFeedBody("spamhaus", body)).toEqual(["1.2.3.0/24"]);
  });
});

describe("parseFeedBody prefix JSON", () => {
  it("should read ipv4Prefix and ipv6Prefix entries", () => {
    const body = JSON.stringify({
      prefixes: [
        { ipv4Prefix: "192.178.5.0/27" },
        { ipv6Prefix: "2001:4860:4801::/48" },
      ],
    });

    expect(parseFeedBody("prefixes", body)).toEqual([
      "192.178.5.0/27",
      "2001:4860:4801::/48",
    ]);
  });

  it("should tolerate a missing prefixes array", () => {
    expect(parseFeedBody("prefixes", JSON.stringify({}))).toEqual([]);
  });

  it("should tolerate malformed JSON", () => {
    expect(parseFeedBody("prefixes", "<html>error</html>")).toEqual([]);
  });
});

describe("REPUTATION_FEEDS", () => {
  it("should declare every feed with a name, url, format, and role", () => {
    for (const feed of REPUTATION_FEEDS) {
      expect(feed.name.length).toBeGreaterThan(0);
      expect(feed.url.startsWith("https:")).toBe(true);
      expect(["plain", "spamhaus", "prefixes"]).toContain(feed.format);
      expect(["reputation", "crawler"]).toContain(feed.role);
    }
  });

  it("should enable every feed by default", () => {
    expect(DEFAULT_FEEDS).toHaveLength(REPUTATION_FEEDS.length);
  });

  it("should carry both reputation and crawler feeds", () => {
    const roles = new Set(REPUTATION_FEEDS.map((feed) => feed.role));

    expect(roles).toContain("reputation");
    expect(roles).toContain("crawler");
  });

  it("should name a licence for every feed", () => {
    for (const feed of REPUTATION_FEEDS) {
      expect(feed.licence.length).toBeGreaterThan(0);
    }
  });
});

describe("loadFeeds", () => {
  const feed = {
    name: "test-feed",
    url: "https://example.invalid/list.txt",
    format: "plain" as const,
    role: "reputation" as const,
    licence: "test",
  };

  it("should build a set from a successful fetch", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("1.2.3.0/24\n5.6.7.8\n"));

    const result = await loadFeeds({
      feeds: [feed],
      fetcher,
      timeoutMs: 1000,
      maxBytes: 1_000_000,
    });

    expect(result.reputation.contains("1.2.3.10")).toBe(true);
    expect(result.reputation.contains("9.9.9.9")).toBe(false);
    expect(result.failures).toEqual([]);
  });

  it("should keep going when one feed fails", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(new Response("5.6.7.8\n"));

    const result = await loadFeeds({
      feeds: [feed, { ...feed, name: "second" }],
      fetcher,
      timeoutMs: 1000,
      maxBytes: 1_000_000,
    });

    expect(result.reputation.contains("5.6.7.8")).toBe(true);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.name).toBe("test-feed");
  });

  it("should record a failure for a non-ok response", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("nope", { status: 503 }));

    const result = await loadFeeds({
      feeds: [feed],
      fetcher,
      timeoutMs: 1000,
      maxBytes: 1_000_000,
    });

    expect(result.failures[0]?.reason).toContain("503");
  });

  it("should reject a response larger than the byte cap", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("x".repeat(5000)));

    const result = await loadFeeds({
      feeds: [feed],
      fetcher,
      timeoutMs: 1000,
      maxBytes: 100,
    });

    expect(result.failures[0]?.reason).toContain("exceeded");
    expect(result.reputation.size).toBe(0);
  });

  it("should return an empty result when every feed fails", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));

    const result = await loadFeeds({
      feeds: [feed],
      fetcher,
      timeoutMs: 1000,
      maxBytes: 1_000_000,
    });

    expect(result.reputation.size).toBe(0);
    expect(result.failures).toHaveLength(1);
  });

  it("should keep crawler ranges separate from reputation ranges", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ prefixes: [{ ipv4Prefix: "66.249.64.0/19" }] }),
        ),
      );

    const result = await loadFeeds({
      feeds: [
        {
          name: "googlebot",
          url: "https://example.invalid/googlebot.json",
          format: "prefixes",
          role: "crawler",
          licence: "test",
        },
      ],
      fetcher,
      timeoutMs: 1000,
      maxBytes: 1_000_000,
    });

    expect(result.reputation.contains("66.249.70.1")).toBe(false);
    expect(result.crawlers.get("googlebot")?.contains("66.249.70.1")).toBe(
      true,
    );
  });

  it("should fetch every feed concurrently rather than in sequence", async () => {
    const started: number[] = [];
    const fetcher = vi.fn().mockImplementation(async () => {
      started.push(started.length);
      await new Promise((resolve) => setTimeout(resolve, 20));

      return new Response("1.2.3.4\n");
    });

    const feeds = Array.from({ length: 5 }, (_unused, index) => ({
      ...feed,
      name: `feed-${index}`,
    }));

    const begin = Date.now();
    await loadFeeds({ feeds, fetcher, timeoutMs: 1000, maxBytes: 1_000_000 });
    const elapsed = Date.now() - begin;

    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(elapsed).toBeLessThan(80);
  });

  it("should return an empty result when given no feeds", async () => {
    const result = await loadFeeds({
      feeds: [],
      fetcher: vi.fn(),
      timeoutMs: 1000,
      maxBytes: 1_000_000,
    });

    expect(result.reputation.size).toBe(0);
    expect(result.crawlers.size).toBe(0);
  });
});
