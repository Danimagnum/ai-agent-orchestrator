# Pending platform-infra additions

This document is a handoff; platform-infra has not been edited. Core integration is blocked until Daniel supplies the Core v0.2.0 tag and compatible published contracts. No Core endpoints or event payloads are assumed.

## Full profile

- Add API, worker (same API image, worker command), and web under `full`, pinned to a verified commit image. Image paths are `ghcr.io/danimagnum/ai-agent-orchestrator/api:<commit>` and `/web:<commit>`. GHCR package visibility must be checked after first publication.
- Supply a separate PostgreSQL database/role and Redis configuration. Run migrations once before API/worker startup. Preserve named volumes and existing standalone deployment.
- Keep standalone mode while Core v0.2.0 is pending. `PLATFORM_MODE` is not implemented yet; setting it does not enable integration. No Kafka dependency is introduced by this milestone.
- Set the web build argument `NEXT_PUBLIC_API_URL` and runtime `WEB_ORIGIN` to the intended browser URLs. Published web images default to localhost:4000; rebuild for a different browser endpoint.

## Synology network and resources

- Use a shared network namespace (`network_mode: service:<network-owner>`) for the stack and configure database/Redis URLs with 127.0.0.1. Publish only API/web ingress on the network owner. Never publish PostgreSQL, Redis or Kafka ports.
- Assign nonconflicting ports if shared infrastructure already occupies localhost ports. Supply secrets outside Git. Do not reuse development passwords.
- Set `WORKER_CONCURRENCY=1` initially. Measure memory before increasing it; the NAS has approximately 1 GB free and the full ecosystem may exceed this. No claim of full-stack capacity has been verified.
- Use `/health/live` for API liveness and `/health/ready` for readiness. Allow at least 120 seconds start period and 30 retries at 10-second intervals for cold starts; tune from measured NAS startup. Worker readiness/heartbeat is not implemented by these API endpoints.
- Docker Compose 1.28 does not accept the root `name` key in this repository's development compose file. Build a separate infra definition using compatible syntax and `docker-compose -p ...`; do not deploy the development Compose file unchanged.

## Metrics

Scrape API `/metrics` every 30 seconds. Six gauges describe retained runs by bounded `mode` and `status`: tasks, input/output tokens, calculated USD cost, summed durations in seconds, and count of tasks with a duration. Mock usage is simulated. These are database snapshots, not process counters; retention can decrease values. Do not use `rate()` on them. Divide summed duration by timed-task count for a retained-history average. Scraping multiple replicas duplicates the same database totals; select one target or deduplicate using max, not sum.

Readiness checks PostgreSQL and Redis only. API liveness does not prove worker progress. `system.health.reported.v1`, Kafka, Core auth/wallet, contract tests and Trackflow acceptance remain pending confirmed contracts.

## NAS image transfer

After successful CI on a pushed commit, the image workflow publishes amd64 API/web commit tags and separate artifacts with a Docker archive (`manifest.json`), plain gzip compression, and SHA-256 sidecar. Download both files together, run `sha256sum -c image.tar.gz.sha256` on the NAS, then `gzip -dc image.tar.gz | docker load`. Do not load on checksum failure. Deployment, NAS transfer and Docker 20.10 compatibility require a real NAS check; no existing data needs removal.
