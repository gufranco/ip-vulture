# Changelog

# 1.0.0 (2026-08-17)


### Bug Fixes

* **alerts:** clear the deprecation warnings the pipeline surfaced ([49c851e](https://github.com/gufranco/ip-vulture/commit/49c851ec792e31d6781bceb5286fa2009255502c))
* **ci:** add packageManager field for pnpm/action-setup ([325f6a6](https://github.com/gufranco/ip-vulture/commit/325f6a62c7ff377e5950d0973ae3ed7061ef496a))
* correct rate-limit allowList and update stale README references ([3b7c126](https://github.com/gufranco/ip-vulture/commit/3b7c12663a72e528ce08707a1f7367328cac26f3))
* **gitignore:** stop a global vendor rule from hiding source ([dd73586](https://github.com/gufranco/ip-vulture/commit/dd73586638520dde6aba0749f33e618eee298c21))
* **routes:** always return fake 404 page regardless of geolocation result ([8e8ae10](https://github.com/gufranco/ip-vulture/commit/8e8ae10f4c59449bde43c571cece476f1a582e18))
* **scripts:** make a fresh clone runnable without a .env file ([83bff7e](https://github.com/gufranco/ip-vulture/commit/83bff7eaf02b2f4237df49b30f21b6ea0af1f974))
* **templates:** escape HTML in Apache template to prevent reflected XSS ([3e97ace](https://github.com/gufranco/ip-vulture/commit/3e97ace2330a22e7b0a1d75c184a192deec957d8))


### Features

* add ip geolocation route with ngrok support ([1290cb3](https://github.com/gufranco/ip-vulture/commit/1290cb379dd12c047c915a8af542329dca2d846b))
* **monitoring:** add bounded in-memory access log ([e00d9d5](https://github.com/gufranco/ip-vulture/commit/e00d9d541551567b8b756e065c0827e27fa20f03))
* **net:** add address parsing and CIDR range matching ([afd7883](https://github.com/gufranco/ip-vulture/commit/afd7883c8a2e99f9feeb0a5f41829a995098a363))
* **resilience:** add rate limiting to protect upstream API ([1dbfc2b](https://github.com/gufranco/ip-vulture/commit/1dbfc2bccffdec87288f85b48d26f159d88366e8))
* **routes:** add health check endpoint ([f24fefe](https://github.com/gufranco/ip-vulture/commit/f24fefe5ca823e63454673798fa25b26982dd1c4))
* **routes:** replace random number with fake Apache 404 page ([2ff5266](https://github.com/gufranco/ip-vulture/commit/2ff52661c222ae8ce6f2d58ce664398dd88af008))
* **simulator:** replace 404 templates with an era simulation engine ([c0175cf](https://github.com/gufranco/ip-vulture/commit/c0175cfbdce593d5912f60669f8c9e9858031673))
* **templates:** add multi-server 404 template support ([5981f1f](https://github.com/gufranco/ip-vulture/commit/5981f1f836a0c157b5d9f9888b9c9a74ade3d37e))


### BREAKING CHANGES

* **simulator:** SERVER_TEMPLATE values changed and buildApp now takes a
config object. TRUST_PROXY defaults to false, so a deployment behind a
proxy must set it explicitly or every recorded address will be the
proxy's own.
* **templates:** buildApp() now requires a ServerTemplate argument
