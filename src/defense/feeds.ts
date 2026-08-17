import { createIpSet, EMPTY_IP_SET, type IpSet } from "../net/ipset.js";

type FeedFormat = "plain" | "spamhaus" | "prefixes";
type FeedRole = "reputation" | "crawler";

interface FeedSource {
  readonly name: string;
  readonly url: string;
  readonly format: FeedFormat;
  readonly role: FeedRole;
  readonly licence: string;
}

interface FeedFailure {
  readonly name: string;
  readonly reason: string;
}

interface FeedSnapshot {
  readonly reputation: IpSet;
  readonly crawlers: ReadonlyMap<string, IpSet>;
  readonly failures: readonly FeedFailure[];
  readonly loadedFeeds: readonly string[];
}

interface LoadFeedsOptions {
  readonly feeds: readonly FeedSource[];
  readonly fetcher: (
    url: string,
    init: { readonly signal: AbortSignal },
  ) => Promise<Response>;
  readonly timeoutMs: number;
  readonly maxBytes: number;
}

const REPUTATION_FEEDS: readonly FeedSource[] = Object.freeze([
  {
    name: "spamhaus-drop",
    url: "https://www.spamhaus.org/drop/drop_v4.json",
    format: "spamhaus",
    role: "reputation",
    licence:
      "Spamhaus DROP terms, free for non-commercial use with attribution",
  },
  {
    name: "firehol-level1",
    url: "https://iplists.firehol.org/files/firehol_level1.netset",
    format: "plain",
    role: "reputation",
    licence: "Aggregate, per-source licences apply",
  },
  {
    name: "tor-exits",
    url: "https://check.torproject.org/torbulkexitlist",
    format: "plain",
    role: "reputation",
    licence: "Public data published by the Tor Project",
  },
  {
    name: "blocklist-de",
    url: "https://lists.blocklist.de/lists/all.txt",
    format: "plain",
    role: "reputation",
    licence: "Free for personal and commercial use per blocklist.de",
  },
  {
    name: "cins-badguys",
    url: "https://cinsscore.com/list/ci-badguys.txt",
    format: "plain",
    role: "reputation",
    licence: "CINS Score public list",
  },
  {
    name: "googlebot",
    url: "https://developers.google.com/static/search/apis/ipranges/googlebot.json",
    format: "prefixes",
    role: "crawler",
    licence: "Published by Google for crawler verification",
  },
  {
    name: "bingbot",
    url: "https://www.bing.com/toolbox/bingbot.json",
    format: "prefixes",
    role: "crawler",
    licence: "Published by Microsoft for crawler verification",
  },
  {
    name: "gptbot",
    url: "https://openai.com/gptbot.json",
    format: "prefixes",
    role: "crawler",
    licence: "Published by OpenAI for crawler verification",
  },
  {
    name: "cloudflare",
    url: "https://www.cloudflare.com/ips-v4",
    format: "plain",
    role: "crawler",
    licence: "Published by Cloudflare",
  },
]);

const DEFAULT_FEEDS: readonly string[] = Object.freeze(
  REPUTATION_FEEDS.map((feed) => feed.name),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePlain(body: string): readonly string[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 && !line.startsWith("#") && !line.startsWith(";"),
    )
    .map((line) =>
      line.slice(0, line.search(/\s/) === -1 ? undefined : line.search(/\s/)),
    )
    .filter((entry) => entry.length > 0);
}

function parseSpamhaus(body: string): readonly string[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      try {
        const parsed: unknown = JSON.parse(line);

        return isRecord(parsed) && typeof parsed.cidr === "string"
          ? parsed.cidr
          : undefined;
      } catch {
        return undefined;
      }
    })
    .filter((entry): entry is string => entry !== undefined);
}

function parsePrefixes(body: string): readonly string[] {
  try {
    const parsed: unknown = JSON.parse(body);

    if (!isRecord(parsed) || !Array.isArray(parsed.prefixes)) {
      return [];
    }

    return parsed.prefixes
      .map((prefix: unknown) => {
        if (!isRecord(prefix)) {
          return undefined;
        }

        const v4 = prefix.ipv4Prefix;
        const v6 = prefix.ipv6Prefix;

        if (typeof v4 === "string") {
          return v4;
        }

        return typeof v6 === "string" ? v6 : undefined;
      })
      .filter((entry): entry is string => entry !== undefined);
  } catch {
    return [];
  }
}

function parseFeedBody(format: FeedFormat, body: string): readonly string[] {
  if (format === "spamhaus") {
    return parseSpamhaus(body);
  }

  if (format === "prefixes") {
    return parsePrefixes(body);
  }

  return parsePlain(body);
}

interface FetchedFeed {
  readonly source: FeedSource;
  readonly entries: readonly string[];
}

async function fetchFeed(
  source: FeedSource,
  options: LoadFeedsOptions,
): Promise<FetchedFeed | FeedFailure> {
  try {
    const response = await options.fetcher(source.url, {
      signal: AbortSignal.timeout(options.timeoutMs),
    });

    if (!response.ok) {
      return {
        name: source.name,
        reason: `upstream returned status ${response.status}`,
      };
    }

    const body = await response.text();

    if (body.length > options.maxBytes) {
      return {
        name: source.name,
        reason: `response exceeded the ${options.maxBytes} byte cap`,
      };
    }

    return { source, entries: parseFeedBody(source.format, body) };
  } catch (error) {
    return {
      name: source.name,
      reason: error instanceof Error ? error.message : "unknown failure",
    };
  }
}

function isFailure(value: FetchedFeed | FeedFailure): value is FeedFailure {
  return "reason" in value;
}

async function loadFeeds(options: LoadFeedsOptions): Promise<FeedSnapshot> {
  const results = await Promise.all(
    options.feeds.map((source) => fetchFeed(source, options)),
  );

  const failures = results.filter(isFailure);
  const fetched = results.filter(
    (result): result is FetchedFeed => !isFailure(result),
  );

  const reputationEntries = fetched
    .filter((result) => result.source.role === "reputation")
    .flatMap((result) => result.entries);

  const crawlers = new Map(
    fetched
      .filter((result) => result.source.role === "crawler")
      .map((result) => [result.source.name, createIpSet(result.entries)]),
  );

  return Object.freeze({
    reputation:
      reputationEntries.length === 0
        ? EMPTY_IP_SET
        : createIpSet(reputationEntries),
    crawlers,
    failures: Object.freeze(failures),
    loadedFeeds: Object.freeze(fetched.map((result) => result.source.name)),
  });
}

const EMPTY_SNAPSHOT: FeedSnapshot = Object.freeze({
  reputation: EMPTY_IP_SET,
  crawlers: new Map<string, IpSet>(),
  failures: Object.freeze([]),
  loadedFeeds: Object.freeze([]),
});

export {
  DEFAULT_FEEDS,
  EMPTY_SNAPSHOT,
  type FeedFailure,
  type FeedFormat,
  type FeedRole,
  type FeedSnapshot,
  type FeedSource,
  type LoadFeedsOptions,
  loadFeeds,
  parseFeedBody,
  REPUTATION_FEEDS,
};
