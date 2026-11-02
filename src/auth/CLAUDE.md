# STRICT — Auth (token verification, guards, service clients)

**STRICT**: do not change public interfaces, security behaviour or data handling without stating the change and the reason in the plan / PR description.

- This API **verifies** tokens issued by `isce-auth`; it does not mint user tokens. Verification accepts RS256 via JWKS and **pins allowed algorithms** on every check (ENG-383/384). Never accept `alg: none` or fall back to an unpinned algorithm.
- `AuthGuard` is global; `@PublicRoute()` is the only opt-out and each use needs a justification in the spec (public profile, NFC tap, webhooks, CP public).
- `SuperAdminGuard` protects admin routes (`admin/**`); don't loosen.
- Sockets authenticate with the same verifier (`verifyAccessToken`); keep behaviour identical between HTTP and WS.
- `auth-client.service.ts` / `wallet-client.service.ts` talk to sibling services using `INTERNAL_API_KEY` / `X-Internal-Secret`; keys come from validated env only.
- Never log tokens or secrets. Test additions go in `auth.guard.spec.ts`.
