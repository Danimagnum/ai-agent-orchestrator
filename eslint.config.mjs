import js from '@eslint/js';
import ts from 'typescript-eslint';
import { createRequire } from 'node:module';
import { URL, fileURLToPath } from 'node:url';
const webRequire = createRequire(createRequire(new URL('./apps/web/package.json', import.meta.url)).resolve('eslint-config-next'));
const nextPlugin = webRequire('@next/eslint-plugin-next');
export default ts.config(
  { ignores: ['.artifacts/**', '**/dist/**', '**/.next/**', '**/node_modules/**', '**/next-env.d.ts', '**/playwright-report/**', '**/test-results/**'] },
  js.configs.recommended, ...ts.configs.recommended,
  { files: ['**/*.{ts,tsx}'], rules: { '@typescript-eslint/no-explicit-any': 'off', '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] } },
  { plugins: { '@next/next': nextPlugin }, settings: { next: { rootDir: fileURLToPath(new URL('./apps/web', import.meta.url)) } }, rules: { ...nextPlugin.configs.recommended.rules, ...nextPlugin.configs['core-web-vitals'].rules } },
  { files: ['**/*.mjs'], languageOptions: { globals: { process: 'readonly' } } }
);
