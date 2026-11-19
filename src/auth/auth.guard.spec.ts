import { generateKeyPairSync } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { Reflector } from '@nestjs/core';
import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { resetJwksStateForTests } from './jwks-keys';

const SECRET = 'legacy-secret-for-test';

const signingPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const otherPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = {
  ...signingPair.publicKey.export({ format: 'jwk' }),
  kid: 'k1',
  alg: 'RS256',
  use: 'sig',
};

const pem = (key: typeof signingPair.privateKey) =>
  key.export({ type: 'pkcs8', format: 'pem' }) as string;

const rs = (
  key = signingPair.privateKey,
  kid = 'k1',
  claims: Record<string, unknown> = {},
  options: jwt.SignOptions = {},
) =>
  jwt.sign({ id: 'user-1', email: 'u@example.com', ...claims }, pem(key), {
    algorithm: 'RS256',
    keyid: kid,
    expiresIn: '5m',
    ...options,
  });

const hs = (secret = SECRET, claims: Record<string, unknown> = {}) =>
  jwt.sign({ id: 'user-1', email: 'u@example.com', ...claims }, secret, {
    algorithm: 'HS256',
    expiresIn: '5m',
  });

describe('AuthGuard', () => {
  let fetchMock: jest.SpyInstance;
  const guard = new AuthGuard({
    getAllAndOverride: jest.fn().mockReturnValue(false),
  } as unknown as Reflector);

  const run = (token: string) => {
    const request: any = { headers: { authorization: `Bearer ${token}` } };
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    };
    return guard.canActivate(context as never).then((ok) => ({ ok, request }));
  };

  beforeEach(() => {
    resetJwksStateForTests();
    process.env.JWT_SECRET = SECRET;
    process.env.AUTH_API_URL = 'http://auth.test';
    delete process.env.JWKS_URI;
    delete process.env.JWT_ISSUER;
    delete process.env.JWT_AUDIENCE;
    delete process.env.JWT_CLAIM_VALIDATION_MODE;
    fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ keys: [publicJwk] }),
    } as Response);
  });

  afterEach(() => jest.restoreAllMocks());

  it('accepts a valid legacy HS256 token', async () => {
    const { ok, request } = await run(hs());
    expect(ok).toBe(true);
    expect(request.isce_auth.id).toBe('user-1');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an HS256 token signed with the wrong secret', async () => {
    await expect(run(hs('wrong-secret'))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('accepts a valid RS256 token verified through JWKS', async () => {
    const { ok } = await run(rs());
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://auth.test/.well-known/jwks.json',
      expect.anything(),
    );
  });

  it('rejects an RS256 token signed by a different key', async () => {
    await expect(run(rs(otherPair.privateKey))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects HS256 forged with the public key material as the secret', async () => {
    await expect(run(hs(String(publicJwk.n)))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects alg=none', async () => {
    const b64 = (o: object) =>
      Buffer.from(JSON.stringify(o)).toString('base64url');
    const none = `${b64({ alg: 'none' })}.${b64({ id: 'user-1' })}.`;
    await expect(run(none)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an expired RS256 token with a distinct message', async () => {
    const expired = rs(signingPair.privateKey, 'k1', {}, { expiresIn: -10 });
    await expect(run(expired)).rejects.toThrow('Token has expired');
  });

  it('does not flood JWKS when many forged kids arrive', async () => {
    await run(rs());
    const before = fetchMock.mock.calls.length;
    for (let i = 0; i < 25; i++) {
      await expect(
        run(rs(signingPair.privateKey, `forged-${i}`)),
      ).rejects.toThrow(UnauthorizedException);
    }
    expect(fetchMock.mock.calls.length - before).toBeLessThanOrEqual(1);
  });

  describe('issuer / audience', () => {
    beforeEach(() => {
      process.env.JWT_ISSUER = 'https://auth.example';
      process.env.JWT_AUDIENCE = 'connect-nest';
    });

    it('enforce: rejects a wrong issuer', async () => {
      process.env.JWT_CLAIM_VALIDATION_MODE = 'enforce';
      const token = rs(
        signingPair.privateKey,
        'k1',
        { aud: ['connect-nest'] },
        { issuer: 'https://evil' },
      );
      await expect(run(token)).rejects.toThrow('Invalid token claims');
    });

    it('enforce: rejects a token not meant for connect-nest', async () => {
      process.env.JWT_CLAIM_VALIDATION_MODE = 'enforce';
      const token = rs(
        signingPair.privateKey,
        'k1',
        { aud: ['store-api'] },
        { issuer: 'https://auth.example' },
      );
      await expect(run(token)).rejects.toThrow('Invalid token claims');
    });

    it('enforce: accepts the right issuer and audience', async () => {
      process.env.JWT_CLAIM_VALIDATION_MODE = 'enforce';
      const token = rs(
        signingPair.privateKey,
        'k1',
        { aud: ['wallet-nest', 'connect-nest'] },
        { issuer: 'https://auth.example' },
      );
      expect((await run(token)).ok).toBe(true);
    });

    it('log: lets a mismatching token through', async () => {
      process.env.JWT_CLAIM_VALIDATION_MODE = 'log';
      expect((await run(hs())).ok).toBe(true);
    });

    it('off (default): ignores issuer and audience', async () => {
      expect((await run(hs())).ok).toBe(true);
    });
  });
});
