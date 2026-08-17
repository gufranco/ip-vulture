import { describe, expect, it } from "vitest";
import { parseAddress, parseCidr } from "../address.js";

describe("parseAddress IPv4", () => {
  it("should parse the lowest address", () => {
    expect(parseAddress("0.0.0.0")).toEqual({ version: 4, value: 0n });
  });

  it("should parse the highest address", () => {
    expect(parseAddress("255.255.255.255")).toEqual({
      version: 4,
      value: 4294967295n,
    });
  });

  it("should parse a routable address", () => {
    expect(parseAddress("192.168.1.1")).toEqual({
      version: 4,
      value: 3232235777n,
    });
  });

  it("should reject an octet above 255", () => {
    expect(parseAddress("256.0.0.1")).toBeUndefined();
  });

  it("should reject a negative octet", () => {
    expect(parseAddress("-1.0.0.1")).toBeUndefined();
  });

  it("should reject too few octets", () => {
    expect(parseAddress("1.2.3")).toBeUndefined();
  });

  it("should reject too many octets", () => {
    expect(parseAddress("1.2.3.4.5")).toBeUndefined();
  });

  it("should reject a leading zero, which is ambiguous octal", () => {
    expect(parseAddress("01.2.3.4")).toBeUndefined();
  });

  it("should reject a non-numeric octet", () => {
    expect(parseAddress("a.b.c.d")).toBeUndefined();
  });

  it("should reject an empty string", () => {
    expect(parseAddress("")).toBeUndefined();
  });
});

describe("parseAddress IPv6", () => {
  it("should parse the loopback address", () => {
    expect(parseAddress("::1")).toEqual({ version: 6, value: 1n });
  });

  it("should parse the unspecified address", () => {
    expect(parseAddress("::")).toEqual({ version: 6, value: 0n });
  });

  it("should parse a full address", () => {
    expect(parseAddress("2001:0db8:0000:0000:0000:0000:0000:0001")).toEqual({
      version: 6,
      value: 0x20010db8000000000000000000000001n,
    });
  });

  it("should parse a compressed address", () => {
    expect(parseAddress("2001:db8::1")).toEqual({
      version: 6,
      value: 0x20010db8000000000000000000000001n,
    });
  });

  it("should parse an IPv4-mapped address as IPv4", () => {
    expect(parseAddress("::ffff:192.168.1.1")).toEqual({
      version: 4,
      value: 3232235777n,
    });
  });

  it("should strip a zone identifier", () => {
    expect(parseAddress("fe80::1%eth0")).toEqual({
      version: 6,
      value: 0xfe800000000000000000000000000001n,
    });
  });

  it("should reject two compression markers", () => {
    expect(parseAddress("2001::db8::1")).toBeUndefined();
  });

  it("should reject a group above four hex digits", () => {
    expect(parseAddress("2001:db8:00000::1")).toBeUndefined();
  });

  it("should reject a non-hex group", () => {
    expect(parseAddress("2001:zzzz::1")).toBeUndefined();
  });

  it("should reject too many groups", () => {
    expect(parseAddress("1:2:3:4:5:6:7:8:9")).toBeUndefined();
  });
});

describe("parseCidr", () => {
  it("should parse an IPv4 network", () => {
    expect(parseCidr("10.0.0.0/8")).toEqual({
      version: 4,
      start: 167772160n,
      end: 184549375n,
    });
  });

  it("should parse a single-host IPv4 network", () => {
    expect(parseCidr("192.168.1.1/32")).toEqual({
      version: 4,
      start: 3232235777n,
      end: 3232235777n,
    });
  });

  it("should parse the whole IPv4 space", () => {
    expect(parseCidr("0.0.0.0/0")).toEqual({
      version: 4,
      start: 0n,
      end: 4294967295n,
    });
  });

  it("should mask host bits rather than rejecting them", () => {
    expect(parseCidr("10.1.2.3/8")).toEqual({
      version: 4,
      start: 167772160n,
      end: 184549375n,
    });
  });

  it("should treat a bare address as a single host", () => {
    expect(parseCidr("8.8.8.8")).toEqual({
      version: 4,
      start: 134744072n,
      end: 134744072n,
    });
  });

  it("should parse an IPv6 network", () => {
    const range = parseCidr("2001:db8::/32");

    expect(range?.version).toBe(6);
    expect(range?.start).toBe(0x20010db8000000000000000000000000n);
    expect(range?.end).toBe(0x20010db8ffffffffffffffffffffffffn);
  });

  it("should reject an IPv4 prefix above 32", () => {
    expect(parseCidr("10.0.0.0/33")).toBeUndefined();
  });

  it("should reject an IPv6 prefix above 128", () => {
    expect(parseCidr("2001:db8::/129")).toBeUndefined();
  });

  it("should reject a negative prefix", () => {
    expect(parseCidr("10.0.0.0/-1")).toBeUndefined();
  });

  it("should reject a non-numeric prefix", () => {
    expect(parseCidr("10.0.0.0/abc")).toBeUndefined();
  });

  it("should reject an invalid address", () => {
    expect(parseCidr("999.0.0.0/8")).toBeUndefined();
  });

  it("should tolerate surrounding whitespace", () => {
    expect(parseCidr("  10.0.0.0/8  ")?.start).toBe(167772160n);
  });
});
