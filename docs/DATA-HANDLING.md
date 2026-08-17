# Data Handling

## TL;DR

ip-vulture keeps a bounded access history in memory and writes nothing to disk. The history dies with the process. Two optional features send data off the machine, and both are disabled by default: geolocation lookup and e-mail alerting. Everything below states exactly what is captured, how long it survives, and when it leaves.

## What is captured

One record per request, holding technical request metadata only. The full field list is fixed in [`src/monitoring/accessLog.ts`](../src/monitoring/accessLog.ts) and enforced by a test that fails if any field outside the list is stored.

| Field | Source | Bound |
|:------|:-------|:------|
| `timestamp` | Server clock, ISO 8601 UTC | 32 characters |
| `method` | Request line | 16 characters |
| `path` | Request target, query string removed | 2048 characters |
| `statusCode` | Response | numeric |
| `ip` | Socket address, or the forwarded header only when `TRUST_PROXY` says a proxy is trusted | 64 characters |
| `userAgent` | `User-Agent` header | 512 characters |
| `referer` | `Referer` header | 512 characters |
| `host` | `Host` header | 253 characters |
| `protocol` | Connection scheme | 16 characters |
| `durationMs` | Server-measured handling time | numeric |
| `simulationId` | Which catalogue entry answered | 64 characters |
| `classification` | Local classifier verdict | 32 characters |

The query string is stripped before the path is stored, so a token or session identifier passed as a query parameter is never recorded.

## What is not captured

Request bodies. Request headers other than the four named above. Cookies. Authorization headers. Response bodies. Anything the caller sends that is not in the table.

## How long it survives

The history is a fixed-capacity ring buffer, `ACCESS_LOG_CAPACITY`, default 1000. Record 1001 evicts record 1. There is no time-based retention, because there is no storage to expire: the bound is the buffer, and the buffer is memory.

The process holds it. A restart, a crash, a container replacement, or a `docker stop` empties it. Nothing is flushed to disk on the way out.

## Suppressed requests

When a request's classification falls outside `RECORD_POLICY`, no record is created. A counter increments instead, so the admin panel can tell "nothing arrived" apart from "everything was filtered". The counter holds a number and nothing else: no address, no path, no timing.

## When data leaves the machine

Two paths, both off by default.

### Geolocation lookup

`GEO_ENABLED`, default `false`. When on, the caller's address is sent to `ip-api.com` over plaintext HTTP, because the free tier offers no TLS. Nothing else about the request is sent. Reserved, private, loopback, and documentation addresses are never sent. A per-address cache and a process-wide budget bound how many lookups occur.

When off, no outbound request is made and no geolocation field is stored.

### E-mail alerting

`ALERT_ENABLED`, default `false`. When on, records matching `ALERT_POLICY` are batched over `ALERT_WINDOW_SECONDS` and sent as one digest to `ALERT_TO` through the configured SMTP server. The digest carries the same fields as the table above and nothing else.

Two bounds apply: `ALERT_MAX_PER_HOUR` caps volume, and consecutive SMTP failures open a circuit breaker. The default `ALERT_POLICY` is `human`, so bot and blocked traffic generate no mail.

## Reputation feeds

When `FEEDS_ENABLED` is true, the process downloads public reputation and crawler-verification lists at startup and on `FEEDS_REFRESH_MINUTES`. This is an outbound request to each feed host carrying no information about your callers: it is a plain GET for a public file.

The lists are parsed into memory and never written to disk, which is why they are re-downloaded on every restart.

| Feed | Purpose | Licence |
|:-----|:--------|:--------|
| Spamhaus DROP | Hijacked and non-routable networks | Spamhaus DROP terms, free for non-commercial use with attribution |
| FireHOL level 1 | Aggregate of high-confidence sources | Aggregate, per-source licences apply |
| Tor bulk exit list | Tor exit nodes | Public data published by the Tor Project |
| blocklist.de | Addresses reported attacking public services | Free for personal and commercial use per blocklist.de |
| CINS army list | Reputation scoring | CINS Score public list |
| Googlebot ranges | Verify a self-declared Googlebot | Published by Google |
| Bingbot ranges | Verify a self-declared Bingbot | Published by Microsoft |
| GPTBot ranges | Verify a self-declared GPTBot | Published by OpenAI |
| Cloudflare ranges | Recognize a known proxy front | Published by Cloudflare |

Confirm each licence against its current terms before relying on it commercially. The summaries above were recorded when the feed list was assembled and are not a substitute for reading the source.

## Response marking

`SIMULATION_DISCLOSURE` defaults to `off`, so responses carry no header or comment identifying them as simulated. This is a fidelity choice, not a data-handling one: it changes what the caller sees, never what is recorded. Set it to `both` to mark every response.

## The one place persistence can leak back in

The application writes nothing to disk, but its stdout is a different question. Under a container runtime's default logging driver, everything the process prints is written to a file on the host. The compose file therefore sets `logging.driver` to `none` by default, and [DEPLOYMENT.md](DEPLOYMENT.md) repeats the point.

If you change the logging driver, you have reintroduced disk persistence for whatever the process prints, and the access history itself still stays in memory.

## Verifying the claims

| Claim | How to check |
|:------|:-------------|
| Only the listed fields are stored | `pnpm vitest run src/monitoring` |
| Nothing is written to disk during a request sweep | Run the container with `--read-only` and no tmpfs mount beyond `/tmp`, then sweep paths |
| The history dies with the process | Populate the panel, restart, reload the panel |
| Geolocation makes no call when disabled | `pnpm vitest run src/geo` |
| The query string never reaches a record | `pnpm vitest run src/__tests__/app.test.ts` |
