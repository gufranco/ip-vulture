# Security Policy

## Reporting a vulnerability

Report security issues through [GitHub's private vulnerability reporting](https://github.com/gufranco/ip-vulture/security/advisories/new). Please do not open a public issue for a security problem.

Include what you can: the affected version or commit, reproduction steps, and what an attacker gains. A proof of concept helps but is not required.

Expect an acknowledgement within a few days. This is a personal project, so there is no formal response-time commitment.

## Supported versions

The `main` branch is the only supported version. Fixes land there and reach users through a new release.

## Scope

This project simulates HTTP server error responses and records access metadata in memory. The security surface worth reporting:

| Area | What matters |
|:-----|:-------------|
| Admin panel | Authentication bypass, timing attacks on credential comparison, stored XSS through recorded fields |
| Access log | Any path that causes a field outside the declared set to be stored, or that writes history to disk |
| Simulation renderer | Reflected XSS through the request path, method, or host |
| Reputation feeds | Parser behavior on a hostile or malformed feed response |
| SMTP transport | Header injection through the digest, or credential exposure in logs |
| Configuration | A default that is unsafe when the process is publicly exposed |

## Out of scope

The project's purpose is to return responses that resemble other servers, so the following are working as designed rather than vulnerabilities:

- The server misrepresents its identity through the status line, header order, header casing, `Server` header, and response body. That is the feature, and since `SIMULATION_DISCLOSURE` defaults to `off`, responses carry no marker identifying them as simulated. Setting it to `both` restores the marker.
- The admin path is not registered when disabled, so probing it returns the ordinary simulated page. That indistinguishability is intended.
- Reports that the tool can be pointed at infrastructure the operator does not own. That is a misuse question, not a defect. See the intended-use section of the [README](README.md).

## Operating it safely

- Set `TRUST_PROXY` to match your real topology. Leaving it at `true` on a public deployment lets any caller choose the address you record for them.
- Serve the admin panel over TLS. HTTP Basic sends the password base64-encoded on every request.
- Keep credentials in a secret store, never in a committed `.env`.
- Leave `GEO_ENABLED` off unless you have a reason. It is the only feature that sends caller addresses to a third party.

Data handling is documented in [docs/DATA-HANDLING.md](docs/DATA-HANDLING.md).
