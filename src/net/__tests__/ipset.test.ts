import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { parseAddress, parseCidr } from "../address.js";
import { createIpSet, EMPTY_IP_SET } from "../ipset.js";

faker.seed(20260816);

describe("createIpSet membership", () => {
  it("should match an address inside a network", () => {
    const set = createIpSet(["10.0.0.0/8"]);

    expect(set.contains("10.1.2.3")).toBe(true);
  });

  it("should reject an address outside every network", () => {
    const set = createIpSet(["10.0.0.0/8"]);

    expect(set.contains("11.0.0.1")).toBe(false);
  });

  it("should match both boundaries of a network", () => {
    const set = createIpSet(["10.0.0.0/8"]);

    expect(set.contains("10.0.0.0")).toBe(true);
    expect(set.contains("10.255.255.255")).toBe(true);
  });

  it("should reject the addresses immediately outside a network", () => {
    const set = createIpSet(["10.0.0.0/8"]);

    expect(set.contains("9.255.255.255")).toBe(false);
    expect(set.contains("11.0.0.0")).toBe(false);
  });

  it("should match a single-host entry", () => {
    const set = createIpSet(["8.8.8.8"]);

    expect(set.contains("8.8.8.8")).toBe(true);
    expect(set.contains("8.8.8.9")).toBe(false);
  });

  it("should keep IPv4 and IPv6 spaces separate", () => {
    const set = createIpSet(["::/0"]);

    expect(set.contains("::1")).toBe(true);
    expect(set.contains("10.0.0.1")).toBe(false);
  });

  it("should match inside an IPv6 network", () => {
    const set = createIpSet(["2001:db8::/32"]);

    expect(set.contains("2001:db8::dead:beef")).toBe(true);
    expect(set.contains("2001:db9::1")).toBe(false);
  });

  it("should treat an IPv4-mapped address as IPv4", () => {
    const set = createIpSet(["10.0.0.0/8"]);

    expect(set.contains("::ffff:10.1.2.3")).toBe(true);
  });

  it("should return false for an unparsable address", () => {
    const set = createIpSet(["10.0.0.0/8"]);

    expect(set.contains("not-an-address")).toBe(false);
  });

  it("should be empty when given no entries", () => {
    expect(createIpSet([]).size).toBe(0);
    expect(createIpSet([]).contains("10.0.0.1")).toBe(false);
  });

  it("should skip unparsable entries rather than throwing", () => {
    const set = createIpSet(["10.0.0.0/8", "garbage", "999.0.0.0/8"]);

    expect(set.size).toBe(1);
    expect(set.contains("10.1.1.1")).toBe(true);
  });
});

describe("createIpSet merging", () => {
  it("should merge overlapping networks", () => {
    const set = createIpSet(["10.0.0.0/8", "10.1.0.0/16"]);

    expect(set.size).toBe(1);
    expect(set.contains("10.1.2.3")).toBe(true);
  });

  it("should merge adjacent networks", () => {
    const set = createIpSet(["10.0.0.0/9", "10.128.0.0/9"]);

    expect(set.size).toBe(1);
    expect(set.contains("10.200.0.1")).toBe(true);
  });

  it("should keep disjoint networks separate", () => {
    const set = createIpSet(["10.0.0.0/8", "192.168.0.0/16"]);

    expect(set.size).toBe(2);
  });

  it("should deduplicate identical entries", () => {
    const set = createIpSet(["10.0.0.0/8", "10.0.0.0/8"]);

    expect(set.size).toBe(1);
  });

  it("should collapse a run of adjacent networks into one range", () => {
    expect(createIpSet(["1.0.0.0/8", "2.0.0.0/8", "3.0.0.0/8"]).size).toBe(1);
  });

  it("should report one range per disjoint network", () => {
    expect(createIpSet(["1.0.0.0/8", "50.0.0.0/8", "200.0.0.0/8"]).size).toBe(
      3,
    );
  });
});

describe("EMPTY_IP_SET", () => {
  it("should contain nothing", () => {
    expect(EMPTY_IP_SET.contains("10.0.0.1")).toBe(false);
    expect(EMPTY_IP_SET.size).toBe(0);
  });
});

describe("createIpSet against a naive implementation", () => {
  const entries = Array.from({ length: 400 }, () => {
    const prefix = faker.number.int({ min: 8, max: 32 });

    return `${faker.internet.ipv4()}/${prefix}`;
  });

  const ranges = entries
    .map((entry) => parseCidr(entry))
    .filter((range) => range !== undefined);

  const set = createIpSet(entries);

  function naiveContains(candidate: string): boolean {
    const address = parseAddress(candidate);

    if (address === undefined) {
      return false;
    }

    return ranges.some(
      (range) =>
        range.version === address.version &&
        address.value >= range.start &&
        address.value <= range.end,
    );
  }

  it("should agree with a linear scan across random probes", () => {
    const probes = Array.from({ length: 2000 }, () => faker.internet.ipv4());

    for (const probe of probes) {
      expect(set.contains(probe)).toBe(naiveContains(probe));
    }
  });

  it("should agree with a linear scan on every range boundary", () => {
    for (const range of ranges) {
      const start = `${(range.start >> 24n) & 0xffn}.${(range.start >> 16n) & 0xffn}.${(range.start >> 8n) & 0xffn}.${range.start & 0xffn}`;
      const end = `${(range.end >> 24n) & 0xffn}.${(range.end >> 16n) & 0xffn}.${(range.end >> 8n) & 0xffn}.${range.end & 0xffn}`;

      expect(set.contains(start)).toBe(naiveContains(start));
      expect(set.contains(end)).toBe(naiveContains(end));
    }
  });
});

describe("createIpSet performance", () => {
  it("should answer a lookup over a large set in well under a millisecond", () => {
    const entries = Array.from(
      { length: 100_000 },
      (_unused, index) =>
        `${10 + (index % 200)}.${(index >> 8) % 256}.${index % 256}.0/24`,
    );

    const set = createIpSet(entries);
    const probes = Array.from({ length: 10_000 }, () => faker.internet.ipv4());

    const started = process.hrtime.bigint();

    for (const probe of probes) {
      set.contains(probe);
    }

    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;

    expect(elapsedMs / probes.length).toBeLessThan(0.05);
  });
});
