import type { IpSet } from "../net/ipset.js";

enum Classification {
  Human = "human",
  Bot = "bot",
  Scanner = "scanner",
  Blocked = "blocked",
}

interface ClassifiableRequest {
  readonly ip: string;
  readonly path: string;
  readonly userAgent: string;
  readonly accept: string;
  readonly acceptLanguage: string;
}

interface ClassifierOptions {
  readonly allowList: IpSet;
  readonly blockList: IpSet;
  readonly reputation: () => IpSet;
  readonly crawlerRanges: () => ReadonlyMap<string, IpSet>;
}

function compile(sources: readonly string[]): readonly RegExp[] {
  return Object.freeze(sources.map((source) => new RegExp(source, "i")));
}

const SCANNER_AGENT_PATTERNS = compile([
  "sqlmap",
  "nikto",
  "nmap",
  "masscan",
  "zgrab",
  "nuclei",
  "acunetix",
  "wpscan",
  "dirbuster",
  "gobuster",
]);

const BOT_AGENT_PATTERNS = compile([
  "bot\\b",
  "crawler",
  "spider",
  "slurp",
  "facebookexternalhit",
  "python-requests",
  "python-urllib",
  "\\bcurl[/]",
  "\\bwget[/]",
  "go-http-client",
  "java[/]",
  "okhttp",
  "headlesschrome",
  "axios[/]",
  "node-fetch",
  "libwww-perl",
]);

const PROBE_PATH_PATTERNS = compile([
  "^[/]\\.env",
  "^[/]\\.git",
  "^[/]\\.ssh",
  "^[/]\\.aws",
  "^[/]\\.svn",
  "^[/]wp-login",
  "^[/]wp-admin",
  "^[/]wp-content",
  "^[/]xmlrpc\\.php",
  "^[/]phpmyadmin",
  "^[/]pma[/]",
  "^[/]actuator",
  "^[/]vendor[/]phpunit",
  "^[/]cgi-bin[/]",
  "^[/]solr[/]",
  "^[/]console[/]",
  "^[/]_ignition",
  "^[/]config\\.json",
  "^[/]telescope",
  "^[/]server-status",
]);

const CRAWLER_SIGNATURES: ReadonlyMap<string, RegExp> = new Map([
  ["googlebot", /googlebot/i],
  ["bingbot", /bingbot/i],
  ["gptbot", /gptbot/i],
  ["claudebot", /claudebot|anthropic/i],
  ["duckduckbot", /duckduckbot/i],
  ["applebot", /applebot/i],
]);

function matchesAny(patterns: readonly RegExp[], value: string): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function declaredCrawler(userAgent: string): string | undefined {
  for (const [name, pattern] of CRAWLER_SIGNATURES) {
    if (pattern.test(userAgent)) {
      return name;
    }
  }

  return undefined;
}

function createClassifier(
  options: ClassifierOptions,
): (request: ClassifiableRequest) => Classification {
  return function classify(request: ClassifiableRequest): Classification {
    if (options.allowList.contains(request.ip)) {
      return Classification.Human;
    }

    if (
      options.blockList.contains(request.ip) ||
      options.reputation().contains(request.ip)
    ) {
      return Classification.Blocked;
    }

    const crawler = declaredCrawler(request.userAgent);

    if (crawler !== undefined) {
      const ranges = options.crawlerRanges().get(crawler);

      if (ranges !== undefined && !ranges.contains(request.ip)) {
        return Classification.Scanner;
      }
    }

    if (matchesAny(PROBE_PATH_PATTERNS, request.path)) {
      return Classification.Scanner;
    }

    if (matchesAny(SCANNER_AGENT_PATTERNS, request.userAgent)) {
      return Classification.Scanner;
    }

    if (
      request.userAgent.length === 0 ||
      matchesAny(BOT_AGENT_PATTERNS, request.userAgent)
    ) {
      return Classification.Bot;
    }

    if (request.accept.length === 0) {
      return Classification.Bot;
    }

    return Classification.Human;
  };
}

export {
  type ClassifiableRequest,
  Classification,
  type ClassifierOptions,
  createClassifier,
};
