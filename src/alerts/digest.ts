import type { AccessRecord } from "../monitoring/accessLog.js";

const HOUR_MS = 3_600_000;
const DEFAULT_BREAKER_THRESHOLD = 5;
const DEFAULT_BREAKER_COOLDOWN_MS = 300_000;
const DEFAULT_MAX_QUEUED = 500;

interface Digest {
  readonly count: number;
  readonly omitted: number;
  readonly firstAt: string;
  readonly lastAt: string;
  readonly records: readonly AccessRecord[];
}

interface AlerterOptions {
  readonly enabled: boolean;
  readonly windowSeconds: number;
  readonly maxPerHour: number;
  readonly send: (digest: Digest) => Promise<void>;
  readonly now?: () => number;
  readonly schedule?: (callback: () => void, delayMs: number) => void;
  readonly breakerThreshold?: number;
  readonly breakerCooldownMs?: number;
  readonly maxQueued?: number;
  readonly onFailure?: (error: unknown) => void;
}

interface AlerterStats {
  readonly sent: number;
  readonly omitted: number;
  readonly dropped: number;
  readonly failed: number;
  readonly queued: number;
  readonly breakerOpen: boolean;
}

interface Alerter {
  enqueue(record: AccessRecord): void;
  flush(): Promise<void>;
  settled(): Promise<void>;
  stats(): AlerterStats;
}

function createAlerter(options: AlerterOptions): Alerter {
  const clock = options.now ?? Date.now;
  const schedule =
    options.schedule ??
    ((callback, delayMs) => {
      setTimeout(callback, delayMs).unref?.();
    });
  const breakerThreshold =
    options.breakerThreshold ?? DEFAULT_BREAKER_THRESHOLD;
  const breakerCooldownMs =
    options.breakerCooldownMs ?? DEFAULT_BREAKER_COOLDOWN_MS;
  const maxQueued = options.maxQueued ?? DEFAULT_MAX_QUEUED;

  let queue: readonly AccessRecord[] = [];
  let omittedThisWindow = 0;
  let timerArmed = false;
  let sent = 0;
  let dropped = 0;
  let failed = 0;
  let consecutiveFailures = 0;
  let breakerOpenedAt: number | undefined;
  let pending: Promise<void> = Promise.resolve();
  let hourStartedAt = clock();
  let sentThisHour = 0;

  function breakerOpen(): boolean {
    if (breakerOpenedAt === undefined) {
      return false;
    }

    if (clock() - breakerOpenedAt >= breakerCooldownMs) {
      breakerOpenedAt = undefined;
      consecutiveFailures = 0;

      return false;
    }

    return true;
  }

  function withinHourlyCap(): boolean {
    if (clock() - hourStartedAt >= HOUR_MS) {
      hourStartedAt = clock();
      sentThisHour = 0;
    }

    return sentThisHour < options.maxPerHour;
  }

  async function deliver(
    batch: readonly AccessRecord[],
    omitted: number,
  ): Promise<void> {
    const first = batch[0];
    const last = batch.at(-1);

    if (first === undefined || last === undefined) {
      return;
    }

    const digest: Digest = Object.freeze({
      count: batch.length + omitted,
      omitted,
      firstAt: first.timestamp,
      lastAt: last.timestamp,
      records: batch,
    });

    try {
      await options.send(digest);
      sent += 1;
      sentThisHour += 1;
      consecutiveFailures = 0;
    } catch (error) {
      failed += 1;
      consecutiveFailures += 1;
      options.onFailure?.(error);

      if (consecutiveFailures >= breakerThreshold) {
        breakerOpenedAt = clock();
      }
    }
  }

  async function flush(): Promise<void> {
    timerArmed = false;

    const batch = queue;
    const omitted = omittedThisWindow;

    queue = [];
    omittedThisWindow = 0;

    if (!options.enabled || batch.length === 0) {
      return;
    }

    if (breakerOpen()) {
      dropped += 1;

      return;
    }

    if (!withinHourlyCap()) {
      dropped += 1;

      return;
    }

    await deliver(batch, omitted);
  }

  return Object.freeze({
    enqueue(record: AccessRecord): void {
      if (!options.enabled) {
        return;
      }

      const atCapacity = queue.length >= maxQueued;

      queue = atCapacity ? [...queue.slice(1), record] : [...queue, record];

      if (atCapacity) {
        omittedThisWindow += 1;
      }

      if (options.windowSeconds === 0) {
        pending = pending.then(() => flush());

        return;
      }

      if (!timerArmed) {
        timerArmed = true;
        schedule(() => {
          pending = pending.then(() => flush());
        }, options.windowSeconds * 1000);
      }
    },

    flush,

    async settled(): Promise<void> {
      await pending;
    },

    stats(): AlerterStats {
      return Object.freeze({
        sent,
        omitted: omittedThisWindow,
        dropped,
        failed,
        queued: queue.length,
        breakerOpen: breakerOpenedAt !== undefined,
      });
    },
  });
}

export {
  type Alerter,
  type AlerterOptions,
  type AlerterStats,
  createAlerter,
  type Digest,
};
