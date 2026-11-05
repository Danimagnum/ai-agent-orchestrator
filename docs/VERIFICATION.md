# Verification record

Verified locally on **5 November 2026**, using Node.js 24, pnpm 10.28.2, PostgreSQL 17.11 and Redis 7.4.6. CI targets Node.js 22 on Linux.

| Check | Result |
| --- | --- |
| `pnpm lint` | Passed |
| `pnpm typecheck` | Passed, including test files and generated Next route types |
| `pnpm test` | 16 tests passed |
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

The browser flow checks persisted streamed events, numeric event costs, the reviewed result, graph visibility, trace steps, history filtering and mobile horizontal overflow. Screenshots in this folder were captured from the running production app.

## Verification limits

- This Windows environment has no Docker engine or WSL installation. Full Linux container build/startup was **not executed locally**. The committed GitHub Actions workflow includes a container-build check, but no remote CI run has been initiated.
- Live paid OpenAI/Anthropic calls were **not executed**. Provider protocols are verified with mocked SSE responses; the full queue/database/browser flow uses `MOCK_LLM=true`.
- Sentry is optional and was exercised with no DSN. Delivery to a configured Sentry project remains unverified.
- This is a functional MVP check, not a load test or a claim of production readiness.

## Captured screens

- [Playground](playground.png)
- [Live execution](live-run.png)
- [Reviewed result and trace](completed-run.png)
- [History and model comparison](history.png)
- [Mobile execution](mobile-run.png)
