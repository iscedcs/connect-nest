/**
 * Mints a test JWT signed with the local JWT_SECRET.
 * Usage:  node scripts/mint-test-token.mjs
 * Output: Bearer token printed to stdout — copy it and export as TOKEN=...
 */
import { readFileSync } from 'fs';
import { createHmac } from 'crypto';

// ── Load JWT_SECRET from .env ────────────────────────────────────────────────
function loadEnv() {
  const env = {};
  try {
    const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) {
        let val = m[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        env[m[1].trim()] = val;
      }
    }
  } catch (e) {
    console.error('Could not read .env:', e.message);
  }
  return env;
}

// ── Minimal HS256 JWT implementation (no dependency needed) ──────────────────
function base64url(data) {
  const b64 = (typeof data === 'string'
    ? Buffer.from(data)
    : Buffer.from(JSON.stringify(data))
  ).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function signJwt(payload, secret) {
  const header  = base64url({ alg: 'HS256', typ: 'JWT' });
  const body    = base64url(payload);
  const sig     = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${header}.${body}.${sig}`;
}

// ── Main ────────────────────────────────────────────────────────────────────
const env    = loadEnv();
const secret = env.JWT_SECRET;

if (!secret) {
  console.error('JWT_SECRET not found in .env');
  process.exit(1);
}

// You MUST put your real auth-user ID here so the CP guard can find your org/workspace
const TEST_USER_ID = process.env.USER_ID ?? 'REPLACE_WITH_REAL_AUTH_USER_ID';

const payload = {
  id:          TEST_USER_ID,
  email:       'test@example.com',
  firstName:   'Test',
  lastName:    'Runner',
  userType:    'user',
  iscePermissions: { connect: true, connect_plus: true, store: false, wallet: false, event: false, access: false },
  iat:  Math.floor(Date.now() / 1000),
  exp:  Math.floor(Date.now() / 1000) + 3600, // 1 hour
};

const token = signJwt(payload, secret);

console.log('\n✅  Test JWT (valid for 1 hour):\n');
console.log(token);
console.log('\n── Run tests with: ──────────────────────────────────────────────');
console.log(`$env:TOKEN = "${token}"`);
console.log(`node scripts/test-cp-endpoints.mjs`);
console.log('─────────────────────────────────────────────────────────────────\n');

if (TEST_USER_ID === 'REPLACE_WITH_REAL_AUTH_USER_ID') {
  console.warn('⚠  WARNING: USER_ID not set — token uses a placeholder ID.\n' +
               '   Run with:  USER_ID=<your-auth-user-id>  node scripts/mint-test-token.mjs\n');
}
