type IpVersion = 4 | 6;

interface Address {
  readonly version: IpVersion;
  readonly value: bigint;
}

interface AddressRange {
  readonly version: IpVersion;
  readonly start: bigint;
  readonly end: bigint;
}

const IPV4_BITS = 32;
const IPV6_BITS = 128;
const IPV4_MAPPED_PREFIX = 0xffffn;

function parseOctet(part: string): number | undefined {
  if (!/^\d{1,3}$/.test(part)) {
    return undefined;
  }

  if (part.length > 1 && part.startsWith("0")) {
    return undefined;
  }

  const value = Number(part);

  return value <= 255 ? value : undefined;
}

function parseIpv4(input: string): bigint | undefined {
  const parts = input.split(".");

  if (parts.length !== 4) {
    return undefined;
  }

  const octets = parts.map(parseOctet);

  if (octets.some((octet) => octet === undefined)) {
    return undefined;
  }

  return octets.reduce<bigint>(
    (accumulator, octet) => (accumulator << 8n) | BigInt(octet ?? 0),
    0n,
  );
}

function expandGroups(input: string): readonly string[] | undefined {
  const halves = input.split("::");

  if (halves.length > 2) {
    return undefined;
  }

  const splitGroups = (segment: string): readonly string[] =>
    segment.length === 0 ? [] : segment.split(":");

  if (halves.length === 1) {
    const groups = splitGroups(halves[0] ?? "");

    return groups.length === 8 ? groups : undefined;
  }

  const head = splitGroups(halves[0] ?? "");
  const tail = splitGroups(halves[1] ?? "");
  const missing = 8 - head.length - tail.length;

  if (missing < 1) {
    return undefined;
  }

  return [...head, ...Array.from({ length: missing }, () => "0"), ...tail];
}

function parseIpv6(input: string): Address | undefined {
  const withoutZone = input.split("%")[0] ?? "";
  const lastColon = withoutZone.lastIndexOf(":");
  const tail = withoutZone.slice(lastColon + 1);

  const normalized = tail.includes(".")
    ? (() => {
        const embedded = parseIpv4(tail);

        if (embedded === undefined) {
          return undefined;
        }

        const high = (embedded >> 16n).toString(16);
        const low = (embedded & 0xffffn).toString(16);

        return `${withoutZone.slice(0, lastColon + 1)}${high}:${low}`;
      })()
    : withoutZone;

  if (normalized === undefined) {
    return undefined;
  }

  const groups = expandGroups(normalized);

  if (groups === undefined) {
    return undefined;
  }

  const values = groups.map((group) =>
    /^[0-9a-fA-F]{1,4}$/.test(group) ? BigInt(`0x${group}`) : undefined,
  );

  if (values.some((value) => value === undefined)) {
    return undefined;
  }

  const value = values.reduce<bigint>(
    (accumulator, group) => (accumulator << 16n) | (group ?? 0n),
    0n,
  );

  if (value >> 32n === IPV4_MAPPED_PREFIX) {
    return { version: 4, value: value & 0xffffffffn };
  }

  return { version: 6, value };
}

function parseAddress(input: string): Address | undefined {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  if (trimmed.includes(":")) {
    return parseIpv6(trimmed);
  }

  const ipv4 = parseIpv4(trimmed);

  return ipv4 === undefined ? undefined : { version: 4, value: ipv4 };
}

function parseCidr(input: string): AddressRange | undefined {
  const trimmed = input.trim();
  const slash = trimmed.lastIndexOf("/");

  if (slash === -1) {
    const address = parseAddress(trimmed);

    return address === undefined
      ? undefined
      : { version: address.version, start: address.value, end: address.value };
  }

  const address = parseAddress(trimmed.slice(0, slash));
  const prefixPart = trimmed.slice(slash + 1);

  if (address === undefined || !/^\d{1,3}$/.test(prefixPart)) {
    return undefined;
  }

  const prefix = Number(prefixPart);
  const width = address.version === 4 ? IPV4_BITS : IPV6_BITS;

  if (prefix > width) {
    return undefined;
  }

  const hostBits = BigInt(width - prefix);
  const mask = ((1n << BigInt(width)) - 1n) ^ ((1n << hostBits) - 1n);
  const start = address.value & mask;
  const end = start | ((1n << hostBits) - 1n);

  return { version: address.version, start, end };
}

export {
  type Address,
  type AddressRange,
  type IpVersion,
  parseAddress,
  parseCidr,
};
