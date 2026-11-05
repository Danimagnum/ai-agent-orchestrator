import { source } from './source';
async function main() {
  await source.initialize();
  await source.runMigrations({ transaction: 'all' });
  await source.destroy();
}
void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
