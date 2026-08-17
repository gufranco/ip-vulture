import { describe, expect, it } from "vitest";
import { isReservedAddress } from "../reserved.js";

describe("isReservedAddress IPv4", () => {
  it.each([
    ["0.0.0.0", "this network"],
    ["10.0.0.1", "private class A"],
    ["10.255.255.255", "private class A upper bound"],
    ["127.0.0.1", "loopback"],
    ["127.255.255.254", "loopback upper bound"],
    ["169.254.1.1", "link local"],
    ["169.254.169.254", "cloud metadata"],
    ["172.16.0.1", "private class B lower bound"],
    ["172.31.255.255", "private class B upper bound"],
    ["192.0.2.1", "documentation TEST-NET-1"],
    ["192.168.1.1", "private class C"],
    ["198.51.100.1", "documentation TEST-NET-2"],
    ["203.0.113.1", "documentation TEST-NET-3"],
    ["224.0.0.1", "multicast"],
    ["255.255.255.255", "broadcast"],
    ["100.64.0.1", "carrier grade NAT"],
  ])("should treat %s as reserved, %s", (address) => {
    expect(isReservedAddress(address)).toBe(true);
  });

  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "9.255.255.255",
    "11.0.0.1",
    "172.15.255.255",
    "172.32.0.1",
    "192.167.255.255",
    "192.169.0.1",
    "203.0.114.1",
  ])("should treat %s as routable", (address) => {
    expect(isReservedAddress(address)).toBe(false);
  });
});

describe("isReservedAddress IPv6", () => {
  it.each([
    ["::", "unspecified"],
    ["::1", "loopback"],
    ["fe80::1", "link local"],
    ["fc00::1", "unique local"],
    ["fd12:3456::1", "unique local"],
    ["ff02::1", "multicast"],
    ["2001:db8::1", "documentation"],
  ])("should treat %s as reserved, %s", (address) => {
    expect(isReservedAddress(address)).toBe(true);
  });

  it.each(["2606:4700:4700::1111", "2001:4860:4860::8888"])(
    "should treat %s as routable",
    (address) => {
      expect(isReservedAddress(address)).toBe(false);
    },
  );

  it("should treat an IPv4-mapped private address as reserved", () => {
    expect(isReservedAddress("::ffff:192.168.1.1")).toBe(true);
  });

  it("should treat an IPv4-mapped public address as routable", () => {
    expect(isReservedAddress("::ffff:8.8.8.8")).toBe(false);
  });
});

describe("isReservedAddress invalid input", () => {
  it.each(["", "not-an-address", "999.999.999.999", "   "])(
    "should treat %s as reserved rather than risk an upstream call",
    (address) => {
      expect(isReservedAddress(address)).toBe(true);
    },
  );
});
