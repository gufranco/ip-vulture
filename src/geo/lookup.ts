import type { GeoConfig } from "../config/config.js";
import { isReservedAddress } from "../net/reserved.js";
import { createBudget } from "./budget.js";
import { createLookupCache } from "./cache.js";

const UPSTREAM_ORIGIN = "http://ip-api.com";

interface Geolocation {
  readonly country: string;
  readonly countryCode: string;
  readonly regionName: string;
  readonly city: string;
  readonly timezone: string;
  readonly isp: string;
  readonly latitude: number;
  readonly longitude: number;
}

type Fetcher = (
  url: string,
  init: { readonly signal: AbortSignal },
) => Promise<Response>;

interface GeoLookupOptions {
  readonly config: GeoConfig;
  readonly fetcher?: Fetcher;
  readonly onFailure?: (reason: string, error?: unknown) => void;
}

interface GeoLookup {
  locate(address: string): Promise<Geolocation | undefined>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toGeolocation(payload: unknown): Geolocation | undefined {
  if (!isRecord(payload) || payload.status !== "success") {
    return undefined;
  }

  const { country, countryCode, regionName, city, timezone, isp, lat, lon } =
    payload;

  if (
    typeof country !== "string" ||
    typeof countryCode !== "string" ||
    typeof regionName !== "string" ||
    typeof city !== "string" ||
    typeof timezone !== "string" ||
    typeof isp !== "string" ||
    typeof lat !== "number" ||
    typeof lon !== "number"
  ) {
    return undefined;
  }

  return Object.freeze({
    country,
    countryCode,
    regionName,
    city,
    timezone,
    isp,
    latitude: lat,
    longitude: lon,
  });
}

function createGeoLookup(options: GeoLookupOptions): GeoLookup {
  const { config } = options;
  const fetcher = options.fetcher ?? ((url, init) => fetch(url, init));
  const report = options.onFailure ?? (() => undefined);

  const budget = createBudget({ perMinute: config.budgetPerMinute });
  const cache = createLookupCache<Geolocation | undefined>({
    ttlSeconds: config.cacheTtlSeconds,
    max: config.cacheMax,
  });

  async function load(address: string): Promise<Geolocation | undefined> {
    const response = await fetcher(`${UPSTREAM_ORIGIN}/json/${address}`, {
      signal: AbortSignal.timeout(config.timeoutMs),
    });

    if (!response.ok) {
      report(`upstream returned status ${response.status}`);

      return undefined;
    }

    const payload = await response.json();
    const geolocation = toGeolocation(payload);

    if (geolocation === undefined) {
      report("upstream payload was not a successful geolocation");
    }

    return geolocation;
  }

  return Object.freeze({
    async locate(address: string): Promise<Geolocation | undefined> {
      if (!config.enabled) {
        return undefined;
      }

      if (isReservedAddress(address)) {
        return undefined;
      }

      try {
        if (!budget.tryConsume()) {
          report("upstream budget exhausted");

          return undefined;
        }

        return await cache.resolve(address, () => load(address));
      } catch (error) {
        report("upstream lookup failed", error);

        return undefined;
      }
    },
  });
}

export {
  createGeoLookup,
  type Fetcher,
  type GeoLookup,
  type GeoLookupOptions,
  type Geolocation,
};
