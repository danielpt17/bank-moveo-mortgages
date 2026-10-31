/* Runs pending SQL migrations from ./migrations. Used by Docker entrypoints and `pnpm migrate:run`. */
import path from 'node:path';

/**
 * Resolved from the working directory (apps/api locally, /app in the container), not from
 * __dirname: the compiled file lives in dist/scripts and nest build does not copy .sql files.
 */
const MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations');

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  // node-pg-migrate v8 is ESM-only; this file is compiled as CommonJS.
  const { runner } = await import('node-pg-migrate');
  await runner({
    databaseUrl,
    dir: MIGRATIONS_DIR,
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
