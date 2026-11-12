import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { gzipSync, brotliCompressSync } from 'node:zlib';
const root = resolve(import.meta.dirname, '../apps/demo/dist');
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? walk(resolve(dir, e.name)) : resolve(dir, e.name)))).flat();
}
const files = [];
for (const file of await walk(root)) {
  const content = await readFile(file);
  files.push({ file: relative(root, file).replaceAll('\\', '/'), bytes: content.length, gzip: gzipSync(content, { level: 6 }).length, brotli: brotliCompressSync(content).length });
}
const report = { generatedAt: new Date().toISOString(), basePath: process.env.DEMO_BASE_PATH ?? '/demos/orchestrator/',
  bytes: files.reduce((n, f) => n + f.bytes, 0), gzipBytes: files.reduce((n, f) => n + f.gzip, 0), brotliBytes: files.reduce((n, f) => n + f.brotli, 0), files };
await writeFile(resolve(root, '../build-size.json'), JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
if (report.gzipBytes > 2_000_000) throw new Error('Demo exceeds 2 MB gzip; reduce assets before opening a PR.');
