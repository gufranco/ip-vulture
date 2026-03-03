# ip-vulture

Captures the IP of incoming HTTP requests, resolves geolocation via [ip-api.com](http://ip-api.com), and logs the result. The caller only sees a random number. Designed to run locally behind [ngrok](https://ngrok.com) so you can share a public URL and see where requests come from.

## How it works

1. Someone hits `https://<ngrok-url>/<any-id>`
2. The server extracts the caller's real IP from `X-Forwarded-For`
3. It calls ip-api.com to resolve country, city, ISP, coordinates
4. The geolocation data is logged to the terminal via pino
5. The caller receives a random integer from 0 to 100

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | >= 22 | [nodejs.org](https://nodejs.org) |
| pnpm | >= 9 | `npm install -g pnpm` |
| ngrok | any | [ngrok.com](https://ngrok.com/download) |

## Getting started

```bash
pnpm install
cp .env.example .env
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm run local` | Start server + ngrok, print public URL, stream logs |
| `pnpm dev` | Start server with auto-reload (no ngrok) |
| `pnpm start` | Start server (production) |
| `pnpm test` | Run tests |
| `pnpm run lint` | Check formatting and lint rules |
| `pnpm run lint:fix` | Auto-fix formatting and lint issues |
| `pnpm run typecheck` | Run TypeScript type checker |

## Environment variables

Defined in `.env.example`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Bind address (use `0.0.0.0` for ngrok) |

## Tech stack

| Category | Technology |
|----------|-----------|
| Runtime | Node.js 22+ |
| Framework | Fastify 5 |
| Language | TypeScript (strict mode) |
| Logger | pino (bundled with Fastify) |
| Linter/formatter | Biome |
| Tests | vitest |
