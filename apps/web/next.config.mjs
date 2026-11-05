import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
export default {
  // Windows without Developer Mode cannot create standalone symlinks. Docker/CI use Linux.
  output: process.platform === 'win32' ? undefined : 'standalone',
  outputFileTracingRoot: path.join(root, '../..'), transpilePackages: ['@orchestrator/shared'],
  serverExternalPackages: ['@sentry/nextjs'], poweredByHeader: false,
};
