# connect-nest — LYNCON API (Connect + Connect Plus)

NestJS 11 · TypeScript · Prisma 7 (PostgreSQL/Neon, `@prisma/adapter-pg`) · Socket.IO · Bull/Redis · Sentry.
Backend for **LYNCON Connect** (personal digital cards) and **LYNCON Connect Plus / "for business"** (`src/connect-plus/**`, routes under `/api/cp/**`).
Package manager: **yarn** (`yarn.lock`, `.yarnrc.yml`). Base URL `http://localhost:3000/api`, Swagger at `/docs` (non-prod).

Sibling repos (same workspace): `../connect-web` (Next.js client for this API), `../isce-auth-mobile` (auth UI), `../isce-auth` (identity service, issues the JWTs), `../isce-store-api`/`../store` (wallet/store services).

## Working agreement (applies to every task)
1. **Read the nearest `CLAUDE.md`** before editing any file in a folder. Module files override this one.
2. **Spec first.** Every feature gets a written spec (`docs/specs/<feature>.md`) that the user reviews *before* implementation. Do not write feature code until the spec is approved.
3. **Never commit or push.** When work is done, give the user a proposed commit message (conventional commits: `feat(scope): …`, `fix(scope): …`) and stop. End messages with the attribution lines the harness specifies.
4. **STRICT modules** (marked `STRICT` at the top of their `CLAUDE.md`): state any change to a public interface, security behaviour or data handling — and the reason — in the spec/plan and in the commit/PR description.
5. Match surrounding code: comment density, naming, idiom. Don't refactor adjacent code.

## Commands
```
yarn start:dev            # watch mode
yarn build                # nest build  (also: npx tsc --noEmit)
yarn lint                 # eslint --fix
yarn test                 # unit (jest, *.spec.ts beside source)
yarn test:e2e             # jest --config test/jest-e2e.json (test/*.e2e-spec.ts)
yarn prisma:migrate:dev   # create+apply a migration   |  yarn prisma:migrate  # deploy
yarn prisma:generate      # regenerate client → src/generated/prisma
yarn seed                 # plan catalogue
```

## Architecture rules
- **Auth**: global `AuthGuard` (APP_GUARD) protects every route; opt out only with `@PublicRoute()`. Global `ThrottlerGuard` too. Tokens are issued by `isce-auth`; this API only *verifies* them (JWKS/RS256, see `src/auth`).
- **Connect Plus**: every controller uses `@UseGuards(CpContextGuard, CpRolesGuard)` + `@CpRoles(...)` per route + `@CpContext()` param. Workspace scope comes from the **`x-workspace-id` header** (never a path segment). Roles: `CREATOR | WORKSPACE_ADMIN | STAFF | CLIENT`.
- Controllers are thin; logic lives in `*.service.ts`. Validate input with DTO classes (`class-validator`; global `ValidationPipe` whitelist is on). Document with `@ApiTags/@ApiOperation`.
- DB access only through `DatabaseService` (Prisma). Prisma client is generated to `src/generated/prisma` — import from there, never from `@prisma/client`.
- **Every query is scoped** — Connect by authenticated `userId`, Connect Plus by `workspaceId`/`organizationId` from `CpRequestContext`. A query without scope is a bug (`test/cross-workspace.e2e-spec.ts` guards this).
- Money is `Prisma.Decimal` (never JS floats). Subscriptions/plans amounts are in the units documented in `src/subscriptions/CLAUDE.md`.
- Schema changes need a **migration file** in `prisma/migrations` (no `db push`). Call out data-migration risk in the spec.
- Side effects (email, push, notifications, audit) must never make the primary request fail unless the spec says so.
- Env vars: add to `src/config/env.validation.ts` **and** `.env.example`. Never read `process.env` ad hoc in new code when `ConfigService` is available.
- Never log tokens, secrets, webhook bodies with PII, or full card/payment payloads.

## Testing bar
- New endpoint ⇒ service unit spec + an e2e case for happy path, wrong-role (403), and cross-workspace (404/403).
- `npx tsc --noEmit` and `yarn lint` must be clean before reporting done. Report failures verbatim; never claim a pass you didn't run.

## Docs map
`docs/PROJECT_SUMMARY.md` (Connect overview) · `docs/connect_plus/` (PRD, RBAC matrix, audit rules, architecture) · `docs/REMAINING_IMPLEMENTATION_TASKS.md` · `docs/subscription-plan.md`.
Frontend contract lives in `../connect-web/connect-plus-docs/latest/connect_plus_frontend_prd_v2.md` — when an endpoint verb/path/shape changes here, update that doc and tell the user the frontend change needed.

## Known gaps (as of 2026-10-26)
No `/cp/products|orders` (Shop), no chat attachment upload, no `GET /cp/members/me` (role/member resolution), no compliance/KYC module (`/cp/compliance/*` is assumed by the frontend), no password-change/delete-account endpoints for CP, tier flags in `plan-limits.config.ts` (themeCustomization etc.) not yet enforced. See the status report in the latest session notes.
