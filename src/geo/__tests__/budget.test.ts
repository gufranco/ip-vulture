import { describe, expect, it } from "vitest";
import { createBudget } from "../budget.js";

describe("createBudget", () => {
  it("should allow up to the configured number of calls", () => {
    const budget = createBudget({ perMinute: 3, now: () => 0 });

    expect(budget.tryConsume()).toBe(true);
    expect(budget.tryConsume()).toBe(true);
    expect(budget.tryConsume()).toBe(true);
  });

  it("should refuse the call past the limit", () => {
    const budget = createBudget({ perMinute: 2, now: () => 0 });

    budget.tryConsume();
    budget.tryConsume();

    expect(budget.tryConsume()).toBe(false);
  });

  it("should not refill inside the window", () => {
    let clock = 0;
    const budget = createBudget({ perMinute: 1, now: () => clock });

    budget.tryConsume();
    clock = 59_999;

    expect(budget.tryConsume()).toBe(false);
  });

  it("should refill fully once the window elapses", () => {
    let clock = 0;
    const budget = createBudget({ perMinute: 2, now: () => clock });

    budget.tryConsume();
    budget.tryConsume();
    clock = 60_000;

    expect(budget.tryConsume()).toBe(true);
    expect(budget.tryConsume()).toBe(true);
    expect(budget.tryConsume()).toBe(false);
  });

  it("should refill proportionally as time passes", () => {
    let clock = 0;
    const budget = createBudget({ perMinute: 60, now: () => clock });

    for (let call = 0; call < 60; call += 1) {
      budget.tryConsume();
    }

    expect(budget.tryConsume()).toBe(false);

    clock = 10_000;

    expect(budget.tryConsume()).toBe(true);
  });

  it("should never accumulate more than the configured maximum", () => {
    let clock = 0;
    const budget = createBudget({ perMinute: 2, now: () => clock });

    clock = 600_000;

    expect(budget.tryConsume()).toBe(true);
    expect(budget.tryConsume()).toBe(true);
    expect(budget.tryConsume()).toBe(false);
  });

  it("should report the remaining allowance", () => {
    const budget = createBudget({ perMinute: 5, now: () => 0 });

    budget.tryConsume();
    budget.tryConsume();

    expect(budget.remaining()).toBe(3);
  });

  it("should cap total calls regardless of how many distinct callers arrive", () => {
    const budget = createBudget({ perMinute: 10, now: () => 0 });

    const allowed = Array.from({ length: 100 }, () =>
      budget.tryConsume(),
    ).filter(Boolean);

    expect(allowed).toHaveLength(10);
  });
});
