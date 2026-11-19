// Fails (exit 1) when the live database is missing anything schema.prisma
// needs: tables, columns, enum values, indexes, type changes.
//
// `prisma migrate deploy` only runs migration files not yet recorded in
// _prisma_migrations; it never checks the real schema. A baselined DB can
// therefore be missing columns forever while `migrate status` says clean
// (2026-11-19: Artisan.canReceiveWalletPayments missing on prod and test
// → every artisan endpoint returned 500).
//
// DB-only extras (statements that are pure DROPs) are reported but allowed:
// prod is migrated before code reaches `release`, so the DB is often ahead of
// the deployed schema, and extra columns don't break running code.
import { spawnSync } from 'node:child_process';

const schema = process.argv[2] ?? 'prisma/schema.prisma';
const result = spawnSync(
  `npx prisma migrate diff --from-config-datasource --to-schema "${schema}" --script`,
  { encoding: 'utf8', shell: true },
);

if (result.status !== 0) {
  console.error('[schema-drift] prisma migrate diff failed:');
  console.error(result.stderr || result.stdout);
  process.exit(1);
}

const statements = result.stdout
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

const isDropOnly = (sql) =>
  /^(DROP\s|ALTER\s+TABLE\s+\S+\s+DROP\s)/i.test(sql) &&
  !/\b(ADD|CREATE|ALTER\s+COLUMN|RENAME|SET\s+DATA\s+TYPE)\b/i.test(sql);

const missing = statements.filter((s) => !isDropOnly(s));
const extras = statements.filter(isDropOnly);

if (extras.length) {
  console.warn(
    `[schema-drift] DB has ${extras.length} object(s) not in schema.prisma (allowed):\n` +
      extras.map((s) => `  ${s};`).join('\n'),
  );
}

if (missing.length) {
  console.error(
    `[schema-drift] DB is missing what schema.prisma needs. Apply this before deploying:\n` +
      missing.map((s) => `${s};`).join('\n'),
  );
  process.exit(1);
}

console.log('[schema-drift] OK: database has everything schema.prisma needs.');
