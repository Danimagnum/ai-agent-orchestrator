# Browser-only demo · Raiola upload

The browser demo runs the **same Orchestrator and deterministic MockProvider as the worker** from `packages/engine`. It reuses the graph, trace, output, history and composer components from `apps/web` through explicit browser data/navigation adapters. Vite builds an additional static target; the existing Next.js application, Nest API, worker and Docker stack remain available.

No AI requests, API keys, queue, PostgreSQL, Redis, Socket.IO, telemetry, external fonts, cookies or browser storage are used by this target. Task text stays in the tab. GitHub links make external requests only if the visitor chooses to open them. Responses are scenario-based, not model-generated answers to arbitrary prompts. Tokens and USD costs are simulated using the same versioned pricing file as the worker.

## Generate the upload folder

Use Node.js 22+ and pnpm 10.28.2 from the repository root:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm build:demo
```

Upload **the contents of `apps/demo/dist/`**, including `.htaccess`, into the document root of **danielgil.eu**, under `demos/orchestrator/`. If that domain's document root is `public_html`, the destination is `public_html/demos/orchestrator/`. For an addon domain, select its actual document root in Raiola's panel; do not assume the account's primary `public_html` is the correct domain. Do not upload `node_modules`, source code or `.env`.

Expected tree:

```text
<document-root-for-danielgil.eu>/demos/orchestrator/
  .htaccess
  index.html
  assets/
    index-<hash>.js
    index-<hash>.css
```

Open `https://danielgil.eu/demos/orchestrator/` using HTTPS. No Node process, backend, installation on the server, rewrite rule or database is required. Navigation uses `?run=<id>` and `?view=history` against the same HTML file. Ensure WordPress or another parent configuration does not intercept this existing directory. Keep the `.htaccess` confined to this demo directory; do not replace the main website's file. Transfer the assets before replacing `index.html` on later releases, so old HTML never points at missing new assets.

The default build path is `/demos/orchestrator/`. To change it, set `DEMO_BASE_PATH` at build time, with both leading and trailing `/`:

```sh
DEMO_BASE_PATH=/another/demo/ corepack pnpm build:demo
```

PowerShell equivalent: `$env:DEMO_BASE_PATH='/another/demo/'; corepack pnpm build:demo`. Rebuild for the new directory; moving an existing build without rebuilding breaks its asset paths. Keep the default path when using the iframe below.

## Exact iframe HTML for danielgil.eu

Paste this in an HTML block of the existing site:

```html
<iframe
  src="/demos/orchestrator/"
  title="Orchestrator: demo simulada de agentes en el navegador"
  loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin"
  style="display:block;width:100%;height:1100px;border:0;border-radius:16px"
></iframe>
```

The relative URL keeps the iframe on the exact parent origin (including `www` if that is the canonical host). The inner UI is responsive; long traces can scroll inside the fixed-height frame. No third-party cookies or iframe permissions are required. Opening the demo directly is supported too.

The delivered `.htaccess` emits:

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self' https://danielgil.eu https://www.danielgil.eu
```

`'self'` permits same-origin framing; the two explicit HTTPS origins also cover the canonical/noncanonical domain pair. React Flow uses inline positioning styles, hence the style allowance. Script and connection restrictions remain strict.

If Raiola returns HTTP 500 because `Header` is forbidden in `.htaccess`, follow the **commented alternative in the delivered file**: disable that header block and ask Raiola to set the exact headers at domain/vhost level or through its header configuration panel. An inherited conflicting `X-Frame-Options` must be removed there too. There is no equivalent HTML-meta fallback for `frame-ancestors`; without the response header the framing restriction is not enforced. Apache requires an appropriate override permission for these directives. [Apache Header documentation](https://httpd.apache.org/docs/2.4/mod/mod_headers.html#header), [AllowOverride documentation](https://httpd.apache.org/docs/2.4/mod/core.html#allowoverride).

After upload, check the document response headers in DevTools. Confirm the CSP is present, assets return 200 with the right content types, and gzip/Brotli is enabled. A parent hosting/CDN policy can override local configuration. Deployment to the real Raiola account has not been performed.

## Session behavior and offline operation

- Four examples cover a coffee landing page, Kafka/RabbitMQ, a generic onboarding flow, and one review correction. Free text follows deterministic scenarios; it is never sent to a model.
- One task runs at a time. At most 20 runs remain in tab memory; the oldest completed run is evicted when necessary. Navigation between views preserves work. Reloading or closing the tab clears it, and an old run link explains that a new task is needed.
- Once HTML/CSS/JS have loaded, new tasks, streaming, graph, traces, budget guard and history work with the network disconnected. This is **not an offline reload/PWA guarantee**: there is no service worker. Return online to reload the page or open external documentation.

## Verification and performance

```sh
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm build:demo
node scripts/serve-demo.mjs
# In another terminal:
corepack pnpm test:demo
```

Playwright normally starts its own server, so stop a manual `serve-demo` instance before running `test:demo`. It tests the production export at the real subdirectory, not a development server. It covers same-origin iframe execution with the network disabled, simultaneous specialists, nine-step correction, cost, history, mobile overflow, budget exhaustion, reload behavior and framing rejection from an unlisted origin.

With Docker available, `node scripts/check-apache-demo.mjs` checks the **actual `.htaccess`** in Apache 2.4: HTTP 200, policy header, gzip JavaScript and query routes. It uses a temporary container and a read-only mount of the upload folder.

Real PostgreSQL parity tests are separate from the existing provider unit tests:

```sh
# Point DATABASE_URL at an isolated PostgreSQL test database, then:
corepack pnpm --filter @orchestrator/api exec vitest run --config vitest.parity.config.ts
```

They compare every numbered event and token chunk for three scenarios under a controlled clock and adapter schedule. IDs, wall timestamps and terminal step ordering are normalized; costs are compared at PostgreSQL's eight-decimal precision. Natural interleaving and token batching can vary with real wall-clock/DB latency. CI additionally introduces a one-token accounting error and requires the parity test to reject it.

Local production build measured on **12 November 2026**:

| Measurement | Result |
| --- | --- |
| Complete upload files, raw | 568,928 bytes |
| Sum of gzip sizes, level 6 | 172,442 bytes (~168 KiB / 0.17 MB) |
| Sum of Brotli sizes (estimate; not required by the hosting) | 148,118 bytes |
| Browser resource transfer reported in 4G test | 171,997 bytes (JS/CSS plus resource headers; excludes document and `.htaccess`) |
| UI and graph ready, 3 cold 4G loads | 2.13 / 2.02 / 2.09 seconds |
| Median UI and graph ready | **2.09 seconds** |
| Median first contentful paint | 1.87 seconds |

Profile: Chromium, 1.6 Mbps download, 750 Kbps upload, 150 ms latency, CPU slowdown ×4, empty cache. UI-ready timing includes Playwright observation overhead and is not a Lighthouse TTI metric. Real visitors, devices, TLS, geographic latency and Raiola load can differ. Compression is measured per delivered file; `.htaccess` is part of the folder but is not downloaded by browsers.

`apps/demo/build-size.json` records the exact current sizes outside the upload folder; each build fails if aggregate gzip exceeds 2,000,000 bytes. Playwright saves `4g-load.json` under its test results and CI uploads both reports. The bundle is intentionally eager so all views remain usable offline after the initial load. If it grows materially, first remove unused dependency/code paths and large assets; lazy-loading a view would require preloading it before the offline guarantee applies.

Verified locally: original unit suite and builds, new four browser tests, real-PostgreSQL event parity and its accounting mutation, actual Apache `.htaccess`. CI repeats these plus original full-stack checks and secret scanning. Unverified: FTP transfer, inherited Raiola policies, real-site iframe, public 4G field measurements and older/mobile browser coverage beyond Chromium emulation.
