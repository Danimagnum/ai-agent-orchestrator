import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
const root = resolve(import.meta.dirname, '../apps/demo/dist');
const name = `orchestrator-apache-check-${process.pid}`;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
const base = process.env.DEMO_BASE_PATH ?? '/demos/orchestrator/';
// Only a disposable container's own httpd.conf is modified. Build is read-only.
docker('run', '--rm', '-d', '--name', name, '-p', '127.0.0.1::80', '-v', `${root}:/usr/local/apache2/htdocs${base.slice(0, -1)}:ro`, 'httpd:2.4-alpine', 'sh', '-c',
  "sed -i 's/^#LoadModule headers_module/LoadModule headers_module/;s/^#LoadModule deflate_module/LoadModule deflate_module/;s/AllowOverride None/AllowOverride All/g' conf/httpd.conf && httpd-foreground");
try {
  const port = docker('port', name, '80/tcp').split(':').at(-1);
  const origin = `http://127.0.0.1:${port}`;
  let response;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { response = await globalThis.fetch(`${origin}${base}`, { signal: globalThis.AbortSignal.timeout(2000) }); if (response.ok) break; } catch { /* startup */ }
    await delay(300);
  }
  assert.equal(response?.status, 200);
  assert.ok(response.headers.get('content-security-policy')?.includes("frame-ancestors 'self' https://danielgil.eu https://www.danielgil.eu"));
  assert.equal(response.headers.get('x-frame-options'), null);
  const html = await response.text();
  const script = /src="([^"]+\.js)"/.exec(html)?.[1];
  assert.ok(script?.startsWith(base));
  const asset = await globalThis.fetch(origin + script);
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get('content-encoding'), 'gzip');
  assert.match(asset.headers.get('content-type'), /javascript/);
  assert.equal((await globalThis.fetch(`${origin}${base}?view=history`)).status, 200);
  process.stdout.write('Apache .htaccess, framing policy, gzip assets and query routes verified.\n');
} finally { docker('stop', name); }
