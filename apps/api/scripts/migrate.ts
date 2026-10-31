/* Runs pending SQL migrations from ./migrations. Used by Docker entrypoints and `pnpm migrate:run`. */
import path from 'node:path';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  // node-pg-migrate v8 is ESM-only; this file is compiled as CommonJS.
  const { runner } = await import('node-pg-migrate');
  await runner({
    databaseUrl,
    dir: path.resolve(__dirname, '..', 'migrations'),
    direction: 'up',
    migrationsTable: 'pgmigrations',
    count: Infinity,
    verbose: true,
  });
  console.log('migrations: up to date');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
