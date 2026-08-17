import { describe, expect, it, vi } from "vitest";
import { createAlerter } from "../digest.js";

function record(overrides: Record<string, unknown> = {}) {
  return {
    timestamp: "2026-08-16T10:00:00.000Z",
    method: "GET",
    path: "/some/page",
    statusCode: 404,
    ip: "203.0.113.7",
    userAgent: "curl/8.7.1",
    referer: "",
    host: "localhost",
    protocol: "http",
    durationMs: 2,
    simulationId: "apache",
    classification: "human",
    ...overrides,
  };
}

function setup(overrides: Record<string, unknown> = {}) {
  const send = vi.fn().mockResolvedValue(undefined);
  let clock = 0;

  const alerter = createAlerter({
    enabled: true,
    windowSeconds: 60,
    maxPerHour: 20,
    send,
    now: () => clock,
    schedule: () => undefined,
    ...overrides,
  });

  return { alerter, send, advance: (ms: number) => (clock += ms) };
}

describe("createAlerter coalescing", () => {
  it("should not send immediately inside the window", () => {
    const { alerter, send } = setup();

    alerter.enqueue(record());

    expect(send).not.toHaveBeenCalled();
  });

  it("should send one digest covering every queued record", async () => {
    const { alerter, send } = setup();

    for (let index = 0; index < 500; index += 1) {
      alerter.enqueue(record({ path: `/page-${index}` }));
    }

    await alerter.flush();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0].count).toBe(500);
  });

  it("should not send when nothing is queued", async () => {
    const { alerter, send } = setup();

    await alerter.flush();

    expect(send).not.toHaveBeenCalled();
  });

  it("should clear the queue after a flush", async () => {
    const { alerter, send } = setup();

    alerter.enqueue(record());
    await alerter.flush();
    await alerter.flush();

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("should send immediately when the window is zero", async () => {
    const { alerter, send } = setup({ windowSeconds: 0 });

    alerter.enqueue(record());
    await alerter.settled();

    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("createAlerter hourly cap", () => {
  it("should stop sending past the cap", async () => {
    const { alerter, send } = setup({ maxPerHour: 3 });

    for (let index = 0; index < 6; index += 1) {
      alerter.enqueue(record());
      await alerter.flush();
    }

    expect(send).toHaveBeenCalledTimes(3);
  });

  it("should count the digests it dropped", async () => {
    const { alerter } = setup({ maxPerHour: 2 });

    for (let index = 0; index < 5; index += 1) {
      alerter.enqueue(record());
      await alerter.flush();
    }

    expect(alerter.stats().dropped).toBe(3);
  });

  it("should resume after the hour rolls over", async () => {
    const { alerter, send, advance } = setup({ maxPerHour: 1 });

    alerter.enqueue(record());
    await alerter.flush();

    alerter.enqueue(record());
    await alerter.flush();

    advance(3_600_001);

    alerter.enqueue(record());
    await alerter.flush();

    expect(send).toHaveBeenCalledTimes(2);
  });
});

describe("createAlerter queue bound", () => {
  it("should never grow the queue past the cap", () => {
    const { alerter } = setup({ maxQueued: 100 });

    for (let index = 0; index < 50_000; index += 1) {
      alerter.enqueue(record());
    }

    expect(alerter.stats().queued).toBe(100);
  });

  it("should keep the most recent records when the cap is exceeded", async () => {
    const { alerter, send } = setup({ maxQueued: 3 });

    for (let index = 0; index < 10; index += 1) {
      alerter.enqueue(record({ path: `/page-${index}` }));
    }

    await alerter.flush();

    const paths = send.mock.calls[0]?.[0].records.map(
      (entry: { path: string }) => entry.path,
    );

    expect(paths).toEqual(["/page-7", "/page-8", "/page-9"]);
  });

  it("should report the total observed count and how many were omitted", async () => {
    const { alerter, send } = setup({ maxQueued: 3 });

    for (let index = 0; index < 10; index += 1) {
      alerter.enqueue(record());
    }

    await alerter.flush();

    expect(send.mock.calls[0]?.[0].count).toBe(10);
    expect(send.mock.calls[0]?.[0].omitted).toBe(7);
  });

  it("should reset the omitted counter after a flush", async () => {
    const { alerter } = setup({ maxQueued: 2 });

    for (let index = 0; index < 10; index += 1) {
      alerter.enqueue(record());
    }

    await alerter.flush();

    expect(alerter.stats().omitted).toBe(0);
  });
});

describe("createAlerter failure isolation", () => {
  it("should not reject when the transport fails", async () => {
    const send = vi.fn().mockRejectedValue(new Error("smtp down"));
    const { alerter } = setup({ send });

    alerter.enqueue(record());

    await expect(alerter.flush()).resolves.toBeUndefined();
  });

  it("should count transport failures", async () => {
    const send = vi.fn().mockRejectedValue(new Error("smtp down"));
    const { alerter } = setup({ send });

    alerter.enqueue(record());
    await alerter.flush();

    expect(alerter.stats().failed).toBe(1);
  });

  it("should open the breaker after repeated failures", async () => {
    const send = vi.fn().mockRejectedValue(new Error("smtp down"));
    const { alerter } = setup({ send, breakerThreshold: 3 });

    for (let index = 0; index < 5; index += 1) {
      alerter.enqueue(record());
      await alerter.flush();
    }

    expect(send).toHaveBeenCalledTimes(3);
    expect(alerter.stats().breakerOpen).toBe(true);
  });

  it("should close the breaker after the cooldown", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error("smtp down"))
      .mockResolvedValue(undefined);
    const { alerter, advance } = setup({
      send,
      breakerThreshold: 1,
      breakerCooldownMs: 1000,
    });

    alerter.enqueue(record());
    await alerter.flush();

    expect(alerter.stats().breakerOpen).toBe(true);

    advance(1001);
    alerter.enqueue(record());
    await alerter.flush();

    expect(send).toHaveBeenCalledTimes(2);
    expect(alerter.stats().breakerOpen).toBe(false);
  });
});

describe("createAlerter digest content", () => {
  it("should carry only the declared metadata fields", async () => {
    const { alerter, send } = setup();

    alerter.enqueue(record());
    await alerter.flush();

    const entry = send.mock.calls[0]?.[0].records[0];
    const keys = Object.keys(entry).toSorted();

    expect(keys).toEqual(
      [
        "classification",
        "durationMs",
        "host",
        "ip",
        "method",
        "path",
        "protocol",
        "referer",
        "simulationId",
        "statusCode",
        "timestamp",
        "userAgent",
      ].toSorted(),
    );
  });

  it("should report the window the digest covers", async () => {
    const { alerter, send } = setup();

    alerter.enqueue(record({ timestamp: "2026-08-16T10:00:00.000Z" }));
    alerter.enqueue(record({ timestamp: "2026-08-16T10:00:30.000Z" }));
    await alerter.flush();

    expect(send.mock.calls[0]?.[0].firstAt).toBe("2026-08-16T10:00:00.000Z");
    expect(send.mock.calls[0]?.[0].lastAt).toBe("2026-08-16T10:00:30.000Z");
  });
});

describe("createAlerter when disabled", () => {
  it("should never send", async () => {
    const { alerter, send } = setup({ enabled: false });

    alerter.enqueue(record());
    await alerter.flush();

    expect(send).not.toHaveBeenCalled();
  });
});
