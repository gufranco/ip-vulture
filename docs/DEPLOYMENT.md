# Deployment

## TL;DR

Three ways to run: directly with `pnpm start`, behind a temporary tunnel with `pnpm run local`, or as a container with `docker compose up`. The container is the one to use for anything long-lived, because it enforces the no-disk-persistence property that the application alone cannot guarantee. Set `TRUST_PROXY` to match your actual topology or every recorded address will be wrong.

## Local

```bash
pnpm install
pnpm start
```

No `.env` file is required. The process reads real environment variables and falls back to the documented defaults, so a fresh clone starts with no setup. Copy [`.env.example`](../.env.example) to `.env` when you want to pin settings.

At startup the process downloads the reputation feeds before it accepts the first request. On a machine with no network, set `FEEDS_ENABLED=false` to skip that and boot immediately.

## Temporary tunnel

```bash
pnpm run local
```

Starts the server, opens an ngrok tunnel, waits for the tunnel to publish, and prints the public URL. It preflights both `node` and `ngrok` and names the install command if either is missing. It honours `PORT`.

Set `TRUST_PROXY` to the tunnel's address or CIDR when running behind a tunnel. Without it the recorded address is the tunnel's local socket, which is the same value for every caller.

## Container

```bash
docker compose up --build
```

The compose file runs the image with a read-only root filesystem, a tmpfs at `/tmp`, all capabilities dropped, and `no-new-privileges`. It maps `PORT` from your environment and defaults the logging driver to `none`.

To run the image directly:

```bash
docker build -t ip-vulture .
docker run --rm \
  --read-only --tmpfs /tmp \
  --cap-drop ALL --security-opt no-new-privileges:true \
  --log-driver none \
  -p 3000:3000 \
  -e TRUST_PROXY=127.0.0.1 \
  ip-vulture
```

The image runs as the `node` user, never root. Verify with `docker exec <container> id -u`, which must not print `0`. The CI pipeline asserts this on every build.

### The logging driver matters

The application writes nothing to disk. Its stdout is separate: under the default `json-file` driver, the runtime writes every line to a file on the host, which reintroduces the persistence the project exists to avoid. `--log-driver none` is the default in the compose file for that reason. Changing it is a deliberate decision with a disk consequence, covered in [DATA-HANDLING.md](DATA-HANDLING.md).

## Behind a reverse proxy

`TRUST_PROXY` accepts two forms, and picking the wrong one corrupts the access log, the alerts, the rate limit, and the blocklist at once, because all four key on the resolved address.

| Value | Meaning | Use when |
|:------|:--------|:---------|
| `false`, the default | Ignore forwarded headers entirely | The process is directly exposed |
| A CIDR list | Trust forwarded headers only from these sources | You know your proxy addresses |

Never set `true` on a public deployment. It trusts the header from every caller equally, which means any caller can choose the address you record for them.

An integer hop count is refused at startup. A hop count cannot validate the immediate peer, so a caller who reaches the origin directly can send enough forwarded entries to place any address at the position the count selects. Name the proxy addresses instead.

## Enabling the admin panel

```bash
ADMIN_ENABLED=true
ADMIN_USER=ops
ADMIN_PASSWORD=<from your secret store>
```

The panel is not registered at all when disabled, so its path renders the ordinary simulated page and its existence is not observable. Credentials come from the environment. Never commit them.

Serve the panel over TLS. HTTP Basic sends the password base64-encoded on every request, which is encoding rather than encryption.

## Health checks

`HEALTH_PATH`, default `/__health`, answers `{"status":"ok"}` and is exempt from rate limiting and from the access log. Set `HEALTH_ENABLED=false` to remove it, in which case the path renders the simulated page like any other. Point your orchestrator's probe at the configured path, and remember the container healthcheck reads the same variable.

## Operational checklist

| Before exposing | Check |
|:----------------|:------|
| Trust boundary | `TRUST_PROXY` matches the real topology |
| Admin | Disabled, or enabled with credentials from a secret store and TLS in front |
| Alerting | SMTP credentials from a secret store, `ALERT_POLICY` set to what you actually want mail about |
| Geolocation | Left off unless you have a reason, since it sends caller addresses to a third party |
| Disclosure | `SIMULATION_DISCLOSURE` is `off` by default, so responses carry no simulation marker. Set it to `both` if the deployment should announce itself |
| Logging | Driver set to `none`, or the disk consequence accepted deliberately |
| Feeds | Reachable from the deployment, or `FEEDS_ENABLED=false` |
