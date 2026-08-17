interface CacheOptions {
  readonly ttlSeconds: number;
  readonly max: number;
  readonly now?: () => number;
}

interface LookupCache<T> {
  resolve(key: string, loader: () => Promise<T>): Promise<T>;
  size(): number;
}

interface CacheEntry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

function withoutKey<V>(
  source: ReadonlyMap<string, V>,
  key: string,
): ReadonlyMap<string, V> {
  return new Map([...source].filter(([candidate]) => candidate !== key));
}

function withEntry<V>(
  source: ReadonlyMap<string, V>,
  key: string,
  value: V,
  max: number,
): ReadonlyMap<string, V> {
  const retained = [...source].filter(([candidate]) => candidate !== key);
  const trimmed =
    retained.length >= max
      ? retained.slice(retained.length - max + 1)
      : retained;

  return new Map([...trimmed, [key, value] as const]);
}

function createLookupCache<T>(options: CacheOptions): LookupCache<T> {
  const clock = options.now ?? Date.now;
  const ttlMs = options.ttlSeconds * 1000;

  let entries: ReadonlyMap<string, CacheEntry<T>> = new Map();
  let inFlight: ReadonlyMap<string, Promise<T>> = new Map();

  return Object.freeze({
    async resolve(key: string, loader: () => Promise<T>): Promise<T> {
      const cached = entries.get(key);

      if (cached !== undefined && cached.expiresAt > clock()) {
        return cached.value;
      }

      if (cached !== undefined) {
        entries = withoutKey(entries, key);
      }

      const pending = inFlight.get(key);

      if (pending !== undefined) {
        return pending;
      }

      const load = loader()
        .then((value) => {
          entries = withEntry(
            entries,
            key,
            { value, expiresAt: clock() + ttlMs },
            options.max,
          );

          return value;
        })
        .finally(() => {
          inFlight = withoutKey(inFlight, key);
        });

      inFlight = withEntry(inFlight, key, load, Number.MAX_SAFE_INTEGER);

      return load;
    },

    size(): number {
      return entries.size;
    },
  });
}

export { type CacheOptions, createLookupCache, type LookupCache };
