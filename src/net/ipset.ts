import {
  type AddressRange,
  type IpVersion,
  parseAddress,
  parseCidr,
} from "./address.js";

interface IpSet {
  readonly size: number;
  contains(candidate: string): boolean;
}

interface Bounds {
  readonly start: bigint;
  readonly end: bigint;
}

function compareRanges(left: AddressRange, right: AddressRange): number {
  if (left.start !== right.start) {
    return left.start < right.start ? -1 : 1;
  }

  if (left.end === right.end) {
    return 0;
  }

  return left.end < right.end ? -1 : 1;
}

function* mergeAscending(
  sorted: readonly AddressRange[],
): Generator<Bounds, void, undefined> {
  let open: Bounds | undefined;

  for (const range of sorted) {
    if (open === undefined) {
      open = { start: range.start, end: range.end };
      continue;
    }

    if (range.start <= open.end + 1n) {
      open = {
        start: open.start,
        end: range.end > open.end ? range.end : open.end,
      };
      continue;
    }

    yield open;
    open = { start: range.start, end: range.end };
  }

  if (open !== undefined) {
    yield open;
  }
}

function mergeSorted(ranges: readonly AddressRange[]): readonly Bounds[] {
  return Object.freeze(
    Array.from(mergeAscending(ranges.toSorted(compareRanges))),
  );
}

function containsIn(ranges: readonly Bounds[], value: bigint): boolean {
  let low = 0;
  let high = ranges.length - 1;

  while (low <= high) {
    const middle = (low + high) >> 1;
    const range = ranges[middle];

    if (range === undefined) {
      return false;
    }

    if (value < range.start) {
      high = middle - 1;
    } else if (value > range.end) {
      low = middle + 1;
    } else {
      return true;
    }
  }

  return false;
}

function createIpSet(entries: Iterable<string>): IpSet {
  const parsed = [...entries]
    .map((entry) => parseCidr(entry))
    .filter((range): range is AddressRange => range !== undefined);

  const byVersion = new Map<IpVersion, readonly Bounds[]>([
    [4, mergeSorted(parsed.filter((range) => range.version === 4))],
    [6, mergeSorted(parsed.filter((range) => range.version === 6))],
  ]);

  const size =
    (byVersion.get(4)?.length ?? 0) + (byVersion.get(6)?.length ?? 0);

  return Object.freeze({
    size,

    contains(candidate: string): boolean {
      const address = parseAddress(candidate);

      if (address === undefined) {
        return false;
      }

      return containsIn(byVersion.get(address.version) ?? [], address.value);
    },
  });
}

const EMPTY_IP_SET: IpSet = createIpSet([]);

export { createIpSet, EMPTY_IP_SET, type IpSet };
