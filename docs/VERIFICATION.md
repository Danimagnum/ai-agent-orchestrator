# Verification record

## Browser-only static demo — 12 November 2026

The project remains independent of Core. [Static demo deployment and exact iframe](STATIC-DEMO.md).

Verified locally on Windows with Node.js 24, pnpm 10.28.2, production Vite/Next.js builds and isolated real PostgreSQL 17/Apache 2.4 Docker containers:

- Shared portable engine/provider extraction: all 17 existing orchestration/provider tests, lint, typecheck and original API/Next production build passed.
- Three event-parity tests against the real worker PostgreSQL adapter passed: coffee, broker comparison with correction, generic onboarding. Under a controlled clock and adapter schedule, full numbered event streams/token chunks and accounting agree after normalizing UUIDs, timestamps and terminal step ordering.
- Deliberately changed browser accounting by one prompt token: parity rejected the change. CI repeats this mutation check.
- Four Playwright tests passed against the static production folder: same-origin iframe with network disconnected before a nine-step task; three specialists active concurrently; graph, result, tokens/cost, reviewer correction and history; mobile free text/budget guard/reload state; rejected cross-origin iframe; cold 4G timing.
- Actual delivered `.htaccess` verified by Apache Docker: 200 HTML/query routes, the requested `frame-ancestors 'self' https://danielgil.eu https://www.danielgil.eu` header and gzipped JavaScript assets.
- Final upload files: **568,928 raw bytes**, **172,442 gzip bytes**, **148,118 Brotli bytes** (compression sums per file). Measurement report is outside the upload folder. Threshold: 2,000,000 gzip bytes.
- Cold 4G samples: **2.1346 / 2.0155 / 2.0928 s**, median **2.0928 s** to UI/graph ready; median FCP **1.868 s**. Chromium, 1.6 Mbps down, 750 Kbps up, 150 ms latency, CPU ×4, cache disabled. Details and limits are in STATIC-DEMO.md.

Not verified: live FTP upload/Raiola configuration, real danielgil.eu iframe, real-device 4G field performance, non-Chromium browser coverage, offline reload/PWA behavior (not provided), live model calls in this browser target (intentionally absent). No public hosting configuration, production data or platform-infra repository was changed. CI additionally repeats the original real-service full-stack checks and image publication gates.

## Platform foundations — 11 November 2026

Core integration is deliberately pending Daniel's Core v0.2.0 tag and confirmed platform-contracts. No platform-infra files were changed; see [infrastructure handoff](platform-infra-additions.md).

Verified against an isolated five-container Docker Desktop stack (`orchestrator-foundations`) with real PostgreSQL 17 and Redis 7.4, Node 22 inside Linux images, simulated providers and empty provider credentials:

- API/worker TypeScript build and production Next.js build passed.
- `pnpm lint`, `pnpm typecheck`, and all 17 existing unit tests passed inside Node 22 Docker. Those unit tests still mock providers; the new endpoint acceptance uses real services.
- Compose smoke passed: run `84eca416-5cc3-42a6-b0ba-17b62d4b3992`, six steps, 67 ordered events, $0.004898 **simulated** cost, persisted result and production UI.
- `/health/live`, `/health/ready` and `/metrics` passed. All six metric families were compared with persisted REST history by state and mode.
- Stopped the isolated Redis container: readiness returned 503 with Redis down; liveness and PostgreSQL-backed metrics remained available. Restarted Redis.
- Stopped the isolated PostgreSQL container: readiness and metrics returned 503; liveness remained available. Restarted PostgreSQL and verified recovery.
- Changed the running test container's token aggregation to zero: acceptance rejected it with `Incorrect input_tokens: expected 1093`. Restored the compiled controller. This modifies only a disposable test container; no source or data was deleted.
- Gitleaks v8.24.3 scanned all 10 pre-change commits without findings. An injected synthetic credential was rejected (exit 1); output was redacted. CI repeats both checks including subsequent commits.
- `git diff --check` passed.

Not yet verified: GHCR publication/archive workflow, Docker 20.10 loading and SHA-256 transfer on the Synology, NAS memory capacity, Kafka/contract tests, health events, worker heartbeat, Core authentication/wallet/quotas, Trackflow postmortem acceptance and its live Claude video. Current endpoints report API health and PostgreSQL/Redis dependencies only. The previous Claude run below is not evidence of the new integration.

The new CI container checks inject dependency failures and corrupt token aggregation, require the expected failures, restore the implementation, and verify recovery. Image publication is gated by successful push CI. Review: [PR #1](https://github.com/Danimagnum/ai-agent-orchestrator/pull/1). Latest execution evidence is available under [branch CI runs](https://github.com/Danimagnum/ai-agent-orchestrator/actions/workflows/ci.yml?query=branch%3Acodex%2Fplatform-foundations); check the run's commit before treating it as evidence for a revision. At documentation time, remote checks are still running; local verification above is complete.

Verified locally on **5 November 2026**, using Node.js 24, pnpm 10.28.2, PostgreSQL 17.11 and Redis 7.4.6. CI targets Node.js 22 on Linux.

| Check | Result |
| --- | --- |
| `pnpm lint` | Passed |
| `pnpm typecheck` | Passed, including test files and generated Next route types |
| `pnpm test` | 17 tests passed |
| `pnpm build` | Shared package, API and production Next app built successfully |
| Playwright happy path against the production UI | Passed; desktop 1440px and mobile 390px |
| Initial TypeORM migration against real PostgreSQL | Applied successfully |
| Two API instances with Redis fan-out | Passed: submission on port 4000, events received on port 4001 |
| Explicit socket disconnect and replay | Passed: all 96 events recovered with contiguous sequence numbers |
| One corrective review cycle | Passed: nine steps, two review calls, terminal completed status |
| Budget guard | Passed: $0.001 run stopped with `budget_exceeded` |
| Invalid task/UUID validation | HTTP 400 as expected |
| Status/model filters and cursor pagination | Passed; consecutive pages contain distinct run IDs |
| `docker compose config --quiet` | Passed with the official portable Compose CLI |
| Git diff whitespace check | Passed |
| `pnpm demo:check --web-url http://localhost:3107` | Passed: 118 contiguous events recovered, nine-step correction, generic task, budget guard, validation and pagination |
| `pnpm smoke:compose` against the local native services | Passed: six steps, 68 persisted events; this does not claim container execution |
| Browser walkthrough recording | Passed: completed task, reviewed result, trace and history; GIF included |

The browser flow checks persisted streamed events, numeric event costs, the reviewed result, graph visibility, trace steps, history filtering and mobile horizontal overflow. Screenshots in this folder were captured from the running production app.

## Verification limits

- This Windows environment has no Docker engine or WSL installation. Full Linux container build/startup was **not executed locally**. The committed GitHub Actions workflow includes a separate five-service Compose startup and smoke-test job, but no remote CI run has been initiated.
- The initial acceptance used mock providers. On **6 November 2026**, Anthropic live execution was additionally verified: all five roles, nine steps with one correction, 7,104 input tokens, 2,749 output tokens and $0.020849 calculated cost. See [CLAUDE-LIVE.md](CLAUDE-LIVE.md). OpenAI live calls remain unverified.
- Sentry is optional and was exercised with no DSN. Delivery to a configured Sentry project remains unverified.
- This is a functional MVP check, not a load test or a claim of production readiness.

## Captured screens

- [Playground](playground.png)
- [Live execution](live-run.png)
- [Reviewed result and trace](completed-run.png)
- [History and model comparison](history.png)
- [Mobile execution](mobile-run.png)
- [Recorded browser walkthrough](demo.gif)

## Final demo closure

The initial acceptance mode was **mock, without API keys**. The production web app is available locally at `http://localhost:3107`; the API is at `http://localhost:4000`. Following the user's credential setup, this local installation was switched to **live Anthropic mode** and verified on 6 November 2026. The private `.env` is excluded from Git and source archives. PostgreSQL and Redis are isolated local services. The portable Docker Compose CLI accepts the configuration, including web readiness.

Acceptance scripts wait for service readiness, so a check started immediately after launch tolerates startup time. The generic mock scenario was corrected and regression-tested so unrelated tasks no longer receive the broker-comparison response. No new project dependencies were added during this closure.

Follow [PROBAR-DEMO.md](PROBAR-DEMO.md) for the original mock acceptance route; its automated mock checks intentionally refuse to generate paid calls. Follow [CLAUDE-LIVE.md](CLAUDE-LIVE.md) for the current live setup and recorded verification. Delivery to Sentry remains unverified.
