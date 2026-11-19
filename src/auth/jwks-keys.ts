import { createPublicKey, JsonWebKey, KeyObject } from 'crypto';
import { Logger } from '@nestjs/common';

const KEY_CACHE_TTL_MS = 10 * 60 * 1000;
const REFETCH_COOLDOWN_MS = 30 * 1000;
const FETCH_TIMEOUT_MS = 5000;

const logger = new Logger('JwksKeys');

let keyCache = new Map<string, KeyObject>();
let keyCacheExpiresAt = 0;
let lastFetchAt = 0;
let inflightFetch: Promise<void> | null = null;

export function getJwksUri(): string | null {
  if (process.env.JWKS_URI) return process.env.JWKS_URI;
  const base = process.env.AUTH_API_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, '')}/.well-known/jwks.json`;
}

async function fetchJwks(): Promise<void> {
  const uri = getJwksUri();
  if (!uri) {
    logger.error('Cannot fetch JWKS: set JWKS_URI or AUTH_API_URL');
    return;
  }

  try {
    const res = await fetch(uri, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn(`JWKS fetch failed: HTTP ${res.status}`);
      return;
    }
    const data = (await res.json()) as {
      keys?: Array<JsonWebKey & { kid?: string }>;
    };
    if (!Array.isArray(data.keys)) {
      logger.warn('JWKS response has no keys array');
      return;
    }

    const fresh = new Map<string, KeyObject>();
    for (const jwk of data.keys) {
      if (!jwk.kid || jwk.kty !== 'RSA') continue;
      try {
        fresh.set(jwk.kid, createPublicKey({ key: jwk, format: 'jwk' }));
      } catch (err) {
        logger.warn(
          `Could not import JWK ${jwk.kid}: ${(err as Error).message}`,
        );
      }
    }

    // Replace wholesale so a rotated-out key stops being trusted.
    keyCache = fresh;
    keyCacheExpiresAt = Date.now() + KEY_CACHE_TTL_MS;
  } catch (err) {
    logger.error(`JWKS fetch error: ${(err as Error).message}`);
  }
}

/**
 * Returns the RSA public key for `kid`, or null. An unknown kid can trigger
 * at most one refetch per cooldown, so forged tokens cannot flood isce-auth.
 */
export async function getJwksKey(kid: string): Promise<KeyObject | null> {
  const now = Date.now();

  if (now < keyCacheExpiresAt) {
    const cached = keyCache.get(kid);
    if (cached) return cached;
  }

  if (now - lastFetchAt < REFETCH_COOLDOWN_MS) return null;

  lastFetchAt = now;
  if (!inflightFetch) {
    inflightFetch = fetchJwks().finally(() => {
      inflightFetch = null;
    });
  }
  await inflightFetch;

  return keyCache.get(kid) ?? null;
}

export function resetJwksStateForTests(): void {
  keyCache = new Map();
  keyCacheExpiresAt = 0;
  lastFetchAt = 0;
  inflightFetch = null;
}
