# Verification record

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
