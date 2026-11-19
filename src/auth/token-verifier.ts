import * as jwt from 'jsonwebtoken';
import { Logger } from '@nestjs/common';
import { getJwksKey } from './jwks-keys';

export type TokenMethod = 'hs256' | 'rs256';
export type ClaimValidationMode = 'off' | 'log' | 'enforce';

/** Thrown when the signature is valid but issuer/audience do not match. */
export class TokenClaimsError extends Error {
  constructor(public readonly errors: string[]) {
    super('Invalid token claims');
  }
}

const logger = new Logger('TokenVerifier');

/**
 * Verifies an access token. HS256 (legacy shared secret) and RS256 (JWKS)
 * are both accepted while the IdP migration is in flight; each algorithm is
 * pinned to its own key type so a token can never be verified with the wrong
 * kind of key. jsonwebtoken errors are rethrown as-is; a claim mismatch in
 * `enforce` mode throws TokenClaimsError so it can be told apart from a bad
 * signature.
 */
export async function verifyAccessToken<T extends jwt.JwtPayload>(
  token: string,
): Promise<{ payload: T; method: TokenMethod }> {
  const decoded = jwt.decode(token, { complete: true });
  const alg = decoded?.header?.alg;

  let payload: T;
  let method: TokenMethod;

  if (alg === 'HS256') {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is not set');
    }
    payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as T;
    method = 'hs256';
  } else if (alg === 'RS256') {
    const kid = decoded?.header?.kid;
    if (!kid) {
      throw new jwt.JsonWebTokenError('RS256 token has no kid header');
    }
    const key = await getJwksKey(kid);
    if (!key) {
      logger.warn(`[JWT_MIGRATION] no JWKS key for kid=${kid}`);
      throw new jwt.JsonWebTokenError('Unknown signing key');
    }
    payload = jwt.verify(token, key, { algorithms: ['RS256'] }) as T;
    method = 'rs256';
  } else {
    throw new jwt.JsonWebTokenError('Unsupported token algorithm');
  }

  const mode =
    (process.env.JWT_CLAIM_VALIDATION_MODE as ClaimValidationMode) || 'off';
  const errors = mode === 'off' ? [] : checkClaims(payload);

  if (errors.length > 0) {
    logger.warn(
      `[JWT_MIGRATION] claim validation failed | method=${method} ` +
        `userId=${String(payload.id ?? 'unknown')} ` +
        `errors=${errors.join(',')} mode=${mode}`,
    );
    if (mode === 'enforce') {
      throw new TokenClaimsError(errors);
    }
  }

  return { payload, method };
}

function checkClaims(payload: jwt.JwtPayload): string[] {
  const expectedIssuer = process.env.JWT_ISSUER;
  const expectedAudience = process.env.JWT_AUDIENCE;
  const errors: string[] = [];

  if (expectedIssuer && payload.iss !== expectedIssuer) {
    errors.push('issuer_mismatch');
  }

  if (expectedAudience) {
    const audiences = Array.isArray(payload.aud)
      ? payload.aud
      : payload.aud
        ? [payload.aud]
        : [];
    if (!audiences.includes(expectedAudience)) {
      errors.push('audience_mismatch');
    }
  }

  return errors;
}
