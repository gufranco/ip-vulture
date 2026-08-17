const WINDOW_MS = 60_000;

interface BudgetOptions {
  readonly perMinute: number;
  readonly now?: () => number;
}

interface Budget {
  tryConsume(): boolean;
  remaining(): number;
}

function createBudget(options: BudgetOptions): Budget {
  const clock = options.now ?? Date.now;
  const capacity = options.perMinute;
  const refillPerMs = capacity / WINDOW_MS;

  let tokens = capacity;
  let lastRefillAt = clock();

  function refill(): void {
    const now = clock();
    const elapsed = now - lastRefillAt;

    if (elapsed <= 0) {
      return;
    }

    const replenished = tokens + elapsed * refillPerMs;

    tokens = replenished > capacity ? capacity : replenished;
    lastRefillAt = now;
  }

  return Object.freeze({
    tryConsume(): boolean {
      refill();

      if (tokens < 1) {
        return false;
      }

      tokens -= 1;

      return true;
    },

    remaining(): number {
      refill();

      return Math.floor(tokens);
    },
  });
}

export { type Budget, type BudgetOptions, createBudget };
