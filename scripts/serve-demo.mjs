import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { URL } from 'node:url';
const root = resolve(import.meta.dirname, '../apps/demo/dist');
const base = process.env.DEMO_BASE_PATH ?? '/demos/orchestrator/';
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self' https://danielgil.eu https://www.danielgil.eu";
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path === '/embed-test') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      const frame = req.url.includes('cross=1') ? `http://localhost:${process.env.DEMO_PORT ?? 4173}${base}` : base;
      res.end(`<iframe title="Orchestrator" src="${frame}" style="width:100%;height:1100px;border:0"></iframe>`); return;
    }
    if (!path.startsWith(base)) { res.writeHead(404); res.end(); return; }
    const file = resolve(root, path.slice(base.length) || 'index.html');
    if (!file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    const content = await readFile(file);
    const gzip = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
    const body = gzip ? gzipSync(content) : content;
    res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Content-Length': body.length,
      'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', Vary: 'Accept-Encoding', ...(gzip ? { 'Content-Encoding': 'gzip' } : {}) });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(Number(process.env.DEMO_PORT ?? 4173), '0.0.0.0');
