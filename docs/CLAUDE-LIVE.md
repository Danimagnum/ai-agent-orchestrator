# Local Claude configuration

The initial live configuration uses **Claude Haiku 4.5** for all five agent roles. The default run budget is **$0.10**. Claude Sonnet 4.6 is available as an optional model; historical Sonnet 4 IDs remain readable in stored traces but are not offered for new runs.

The API rejects requests selecting a provider without a configured key before persisting or queueing the run. Missing credentials are not counted as billable provider calls.

## Private configuration

`ANTHROPIC_API_KEY` and `MOCK_LLM=false` belong in the root `.env`, which is ignored by Git. The key must not be added to a `NEXT_PUBLIC_*` variable or to the browser.

Docker Compose loads that root file automatically. For native local execution from the repository root, load it explicitly:

```sh
node --env-file=.env apps/api/dist/main.js
node --env-file=.env apps/api/dist/worker.js
```

Run these in separate terminals, after PostgreSQL and Redis are available. The native test environment uses its existing `.env` database/Redis ports and web origin. The web remains at `http://localhost:3107` in this environment.

After switching modes, refresh the browser and create a **new task**. Existing runs keep their original mock/live mode, configuration and pricing snapshot.

## Verified access

On 6 November 2026, the configured account authenticated successfully against the Models API. The returned catalog included `claude-haiku-4-5-20251001` and `claude-sonnet-4-6`. A minimal generation with Haiku 4.5 succeeded and reported 11 input tokens and 5 output tokens. No secret value is included in this record.

Configured rates match the published first-party standard rates checked on that date: Haiku 4.5 uses $1 input / $5 output per million tokens; Sonnet 4.6 uses $3 / $15. Billing adjustments and the limitations of the application budget guard are described in the README.

- [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Models API](https://platform.claude.com/docs/en/api/models)

## End-to-end live verification

Run `bfac18a5-899d-4684-9070-a033f0112abb` completed successfully with `mock=false`. All five roles used Claude Haiku 4.5 through the Anthropic adapter. The Reviewer requested a correction and the Director completed the single permitted revision: nine steps in total.

| Metric | Result |
| --- | --- |
| Provider | Anthropic |
| Input tokens | 7,104 |
| Output tokens | 2,749 |
| Calculated cost | $0.020849 |
| Run budget | $0.05 |
| End-to-end latency | 107.634 seconds |
| Terminal status | completed |

Open the saved execution locally at [the live run](http://localhost:3107/runs/bfac18a5-899d-4684-9070-a033f0112abb). Historical mock runs remain simulated; create a new task to use Claude. The cost is calculated from provider-reported usage and the pricing snapshot, rather than an invoice reconciliation.
