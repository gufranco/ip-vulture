import { describe, expect, it } from "vitest";
import { createIpSet, EMPTY_IP_SET } from "../../net/ipset.js";
import { Classification, createClassifier } from "../classify.js";

function request(overrides: Record<string, unknown> = {}) {
  return {
    ip: "203.0.113.10",
    path: "/index.html",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
    accept: "text/html,application/xhtml+xml",
    acceptLanguage: "en-US,en;q=0.9",
    ...overrides,
  };
}

const defaults = {
  allowList: EMPTY_IP_SET,
  blockList: EMPTY_IP_SET,
  reputation: () => EMPTY_IP_SET,
  crawlerRanges: () => new Map(),
};

describe("createClassifier human traffic", () => {
  it("should classify a normal browser request as human", () => {
    const classify = createClassifier(defaults);

    expect(classify(request())).toBe(Classification.Human);
  });
});

describe("createClassifier bot traffic", () => {
  it.each([
    "Googlebot/2.1 (+http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0)",
    "facebookexternalhit/1.1",
    "Mozilla/5.0 (compatible; SemrushBot/7~bl)",
    "GPTBot/1.0",
    "ClaudeBot/1.0",
    "python-requests/2.32.3",
    "curl/8.7.1",
    "Wget/1.21.4",
    "Go-http-client/2.0",
  ])("should classify %s as bot", (userAgent) => {
    const classify = createClassifier(defaults);

    expect(classify(request({ userAgent }))).toBe(Classification.Bot);
  });

  it("should classify a request with no user agent as bot", () => {
    const classify = createClassifier(defaults);

    expect(classify(request({ userAgent: "" }))).toBe(Classification.Bot);
  });

  it("should classify a request with no accept header as bot", () => {
    const classify = createClassifier(defaults);

    expect(classify(request({ accept: "" }))).toBe(Classification.Bot);
  });
});

describe("createClassifier scanner traffic", () => {
  it.each([
    "/.env",
    "/.git/config",
    "/wp-login.php",
    "/wp-admin/setup-config.php",
    "/phpmyadmin/index.php",
    "/.aws/credentials",
    "/actuator/env",
    "/vendor/phpunit/phpunit/phpunit.xml",
    "/cgi-bin/luci",
    "/.ssh/id_rsa",
  ])("should classify a request for %s as scanner", (path) => {
    const classify = createClassifier(defaults);

    expect(classify(request({ path }))).toBe(Classification.Scanner);
  });

  it.each([
    "sqlmap/1.8",
    "Nikto/2.5.0",
    "Nmap Scripting Engine",
    "masscan/1.3",
    "zgrab/0.x",
  ])("should classify the %s tool as scanner", (userAgent) => {
    const classify = createClassifier(defaults);

    expect(classify(request({ userAgent }))).toBe(Classification.Scanner);
  });

  it("should rank a probe path above a bot user agent", () => {
    const classify = createClassifier(defaults);

    expect(classify(request({ path: "/.env", userAgent: "curl/8.7.1" }))).toBe(
      Classification.Scanner,
    );
  });
});

describe("createClassifier lists", () => {
  it("should classify a blocklisted address as blocked", () => {
    const classify = createClassifier({
      ...defaults,
      blockList: createIpSet(["203.0.113.0/24"]),
    });

    expect(classify(request())).toBe(Classification.Blocked);
  });

  it("should classify a reputation-listed address as blocked", () => {
    const classify = createClassifier({
      ...defaults,
      reputation: () => createIpSet(["203.0.113.0/24"]),
    });

    expect(classify(request())).toBe(Classification.Blocked);
  });

  it("should let the allowlist win over the blocklist", () => {
    const classify = createClassifier({
      ...defaults,
      allowList: createIpSet(["203.0.113.10"]),
      blockList: createIpSet(["203.0.113.0/24"]),
    });

    expect(classify(request())).toBe(Classification.Human);
  });

  it("should let the allowlist win over a probe path", () => {
    const classify = createClassifier({
      ...defaults,
      allowList: createIpSet(["203.0.113.10"]),
    });

    expect(classify(request({ path: "/.env" }))).toBe(Classification.Human);
  });

  it("should read the reputation set on every call so refreshes take effect", () => {
    let set = EMPTY_IP_SET;
    const classify = createClassifier({ ...defaults, reputation: () => set });

    expect(classify(request())).toBe(Classification.Human);

    set = createIpSet(["203.0.113.0/24"]);

    expect(classify(request())).toBe(Classification.Blocked);
  });
});

describe("createClassifier crawler verification", () => {
  it("should accept a declared crawler from its published range", () => {
    const classify = createClassifier({
      ...defaults,
      crawlerRanges: () =>
        new Map([["googlebot", createIpSet(["203.0.113.0/24"])]]),
    });

    const result = classify(
      request({ userAgent: "Googlebot/2.1 (+http://www.google.com/bot.html)" }),
    );

    expect(result).toBe(Classification.Bot);
  });

  it("should treat a declared crawler from outside its range as a scanner", () => {
    const classify = createClassifier({
      ...defaults,
      crawlerRanges: () =>
        new Map([["googlebot", createIpSet(["198.51.100.0/24"])]]),
    });

    const result = classify(
      request({ userAgent: "Googlebot/2.1 (+http://www.google.com/bot.html)" }),
    );

    expect(result).toBe(Classification.Scanner);
  });

  it("should leave a declared crawler as bot when no ranges are loaded", () => {
    const classify = createClassifier(defaults);

    expect(classify(request({ userAgent: "Googlebot/2.1" }))).toBe(
      Classification.Bot,
    );
  });
});
