import { describe, expect, it } from "vitest";
import {
  ACCESS_RECORD_FIELDS,
  createAccessLog,
  MAX_HOST_LENGTH,
  MAX_PATH_LENGTH,
  MAX_TEXT_LENGTH,
} from "../accessLog.js";

function sampleInput(overrides: Record<string, unknown> = {}) {
  return {
    timestamp: "2026-08-16T12:00:00.000Z",
    method: "GET",
    path: "/some/page",
    statusCode: 404,
    ip: "203.0.113.10",
    userAgent: "curl/8.7.1",
    referer: "",
    host: "localhost",
    protocol: "http",
    durationMs: 3,
    simulationId: "apache",
    classification: "human",
    ...overrides,
  };
}

describe("createAccessLog capacity", () => {
  it("should start empty", () => {
    const log = createAccessLog({ capacity: 10 });

    expect(log.size()).toBe(0);
    expect(log.records()).toEqual([]);
  });

  it("should retain records up to the capacity", () => {
    const log = createAccessLog({ capacity: 5 });

    for (let index = 0; index < 5; index += 1) {
      log.record(sampleInput({ path: `/page-${index}` }));
    }

    expect(log.size()).toBe(5);
  });

  it("should never exceed the capacity", () => {
    const log = createAccessLog({ capacity: 5 });

    for (let index = 0; index < 55; index += 1) {
      log.record(sampleInput({ path: `/page-${index}` }));
    }

    expect(log.size()).toBe(5);
  });

  it("should drop the oldest records first", () => {
    const log = createAccessLog({ capacity: 3 });

    for (let index = 0; index < 5; index += 1) {
      log.record(sampleInput({ path: `/page-${index}` }));
    }

    const paths = log.records().map((entry) => entry.path);

    expect(paths).toEqual(["/page-4", "/page-3", "/page-2"]);
  });

  it("should return the newest record first", () => {
    const log = createAccessLog({ capacity: 10 });

    log.record(sampleInput({ path: "/first" }));
    log.record(sampleInput({ path: "/second" }));

    expect(log.records()[0]?.path).toBe("/second");
  });

  it("should honour a limit when reading", () => {
    const log = createAccessLog({ capacity: 10 });

    for (let index = 0; index < 8; index += 1) {
      log.record(sampleInput({ path: `/page-${index}` }));
    }

    expect(log.records({ limit: 3 })).toHaveLength(3);
  });
});

describe("createAccessLog truncation", () => {
  it("should truncate an over-long path", () => {
    const log = createAccessLog({ capacity: 5 });

    log.record(sampleInput({ path: `/${"a".repeat(5000)}` }));

    expect(log.records()[0]?.path.length).toBe(MAX_PATH_LENGTH);
  });

  it("should truncate an over-long user agent", () => {
    const log = createAccessLog({ capacity: 5 });

    log.record(sampleInput({ userAgent: "u".repeat(5000) }));

    expect(log.records()[0]?.userAgent.length).toBe(MAX_TEXT_LENGTH);
  });

  it("should truncate an over-long referer", () => {
    const log = createAccessLog({ capacity: 5 });

    log.record(sampleInput({ referer: "r".repeat(5000) }));

    expect(log.records()[0]?.referer.length).toBe(MAX_TEXT_LENGTH);
  });

  it("should truncate an over-long host", () => {
    const log = createAccessLog({ capacity: 5 });

    log.record(sampleInput({ host: "h".repeat(5000) }));

    expect(log.records()[0]?.host.length).toBe(MAX_HOST_LENGTH);
  });

  it("should leave short values untouched", () => {
    const log = createAccessLog({ capacity: 5 });

    log.record(sampleInput({ userAgent: "curl/8.7.1" }));

    expect(log.records()[0]?.userAgent).toBe("curl/8.7.1");
  });
});

describe("createAccessLog field discipline", () => {
  it("should capture only the declared fields", () => {
    const log = createAccessLog({ capacity: 5 });

    log.record(sampleInput());

    const keys = Object.keys(log.records()[0] ?? {}).toSorted();

    expect(keys).toEqual([...ACCESS_RECORD_FIELDS].toSorted());
  });

  it("should discard any field the caller adds beyond the declared set", () => {
    const log = createAccessLog({ capacity: 5 });

    log.record(
      sampleInput({
        cookie: "session=secret",
        authorization: "Bearer token",
        body: "password=hunter2",
      }),
    );

    const record = log.records()[0] as unknown as Record<string, unknown>;

    expect(record.cookie).toBeUndefined();
    expect(record.authorization).toBeUndefined();
    expect(record.body).toBeUndefined();
  });

  it("should return frozen records", () => {
    const log = createAccessLog({ capacity: 5 });

    log.record(sampleInput());

    expect(Object.isFrozen(log.records()[0])).toBe(true);
  });
});

describe("createAccessLog suppression counter", () => {
  it("should start at zero", () => {
    const log = createAccessLog({ capacity: 5 });

    expect(log.stats().suppressed).toBe(0);
  });

  it("should count a suppressed request without storing it", () => {
    const log = createAccessLog({ capacity: 5 });

    log.suppress();
    log.suppress();

    expect(log.stats().suppressed).toBe(2);
    expect(log.size()).toBe(0);
  });

  it("should distinguish no traffic from fully filtered traffic", () => {
    const quiet = createAccessLog({ capacity: 5 });
    const filtered = createAccessLog({ capacity: 5 });

    filtered.suppress();

    expect(quiet.stats().suppressed).toBe(0);
    expect(filtered.stats().suppressed).toBe(1);
    expect(quiet.size()).toBe(filtered.size());
  });

  it("should report counts by classification", () => {
    const log = createAccessLog({ capacity: 10 });

    log.record(sampleInput({ classification: "human" }));
    log.record(sampleInput({ classification: "bot" }));
    log.record(sampleInput({ classification: "bot" }));

    expect(log.stats().byClassification).toEqual({ human: 1, bot: 2 });
  });

  it("should report the total recorded count separately from the retained size", () => {
    const log = createAccessLog({ capacity: 2 });

    for (let index = 0; index < 7; index += 1) {
      log.record(sampleInput());
    }

    expect(log.stats().recorded).toBe(7);
    expect(log.size()).toBe(2);
  });
});

describe("createAccessLog memory bound", () => {
  it("should stay bounded across a large burst", () => {
    const log = createAccessLog({ capacity: 1000 });

    for (let index = 0; index < 25_000; index += 1) {
      log.record(
        sampleInput({
          path: `/${"p".repeat(3000)}-${index}`,
          userAgent: "u".repeat(3000),
        }),
      );
    }

    expect(log.size()).toBe(1000);

    const serialized = JSON.stringify(log.records());

    expect(serialized.length).toBeLessThan(4_000_000);
  });
});
