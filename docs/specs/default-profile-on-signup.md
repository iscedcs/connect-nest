# Spec: Default Connect Profile on Sign-Up (`default-profile-on-signup`)

Status: **Approved (2026-11-20)** — implementing `connect-nest` changes.
Decisions confirmed:
1. `BUSINESS_USER` sign-ups stay lazy (no personal profile created at sign-up; `POST /api/profile/ensure-default` covers on-demand access).
2. Auto-generate a unique `slug` on default profile creation.
3. Measure prod gap post-deploy before deciding on a one-off backfill.
Issue: Issue 1 — *Create a default Connect profile when a LYNCON account is created (backend)*
Repos: `connect-nest` (this repo), `isce-auth` (caller on sign-up)

---

## 1. Problem

New individual LYNCON accounts (`USER` in `isce-auth`) are created only in `isce-auth`; `connect-nest` is never notified. Until the user manually navigates to Settings → "Create profile", they have:
- No `Profile`
- No public card link (`slug`)
- No `FREE` `Subscription` (because `ProfileService.createProfile` only bootstraps `PlanTier.FREE` when the user's first profile is created)

Business sign-ups (`BUSINESS_USER`) already trigger a best-effort call from `isce-auth` to `POST /api/internal/cp/provision-business` to create a `CpOrganization` + `CpWorkspace`. Individual sign-ups need the equivalent for their personal Connect profile.

---

## 2. Scope & Design

### 2.1 `connect-nest` — New Endpoints

#### A. Internal Endpoint (for `isce-auth` sign-up)
* **Route:** `POST /api/internal/profile/ensure-default`
* **Auth:** `@PublicRoute()` + `@UseGuards(InternalGuard)` (requires `X-Internal-Secret` / `X-Internal-Api-Key` matching `INTERNAL_API_KEY`, same as `POST /api/internal/cp/provision-business`).
* **Controller:** `InternalController` (`src/internal/internal.controller.ts`)
* **Request Body (`EnsureDefaultProfileDto`):**
  ```ts
  {
    authUserId: string;       // required, @IsString() @IsNotEmpty()
    name: string;             // required, @IsString() @IsNotEmpty()
    profilePhoto?: string;    // optional, @IsOptional() @IsString()
  }
  ```
* **Response (`200` or `201`):**
  ```ts
  {
    success: true,
    created: boolean,         // true if newly created, false if already existed
    data: {
      profile: Profile,
    }
  }
  ```

#### B. Authenticated User Endpoint (for `connect-web` / existing users / fallback)
* **Route:** `POST /api/profile/ensure-default`
* **Auth:** Protected by global `AuthGuard` (JWT from `isce-auth`). Reads `req.isce_auth` (`id`, `name` / `firstName` + `lastName`, `photo` / `avatar` if present, with optional body overrides).
* **Controller:** `ProfileController` (`src/profile/profile.controller.ts`)
* **Request Body (`EnsureMyDefaultProfileDto` — all optional):**
  ```ts
  {
    name?: string;            // fallback to req.isce_auth name or "LYNCON User"
    profilePhoto?: string;    // fallback to req.isce_auth photo
  }
  ```
* **Purpose:** Allows `connect-web` to ensure a signed-in user has a default profile on first visit—covering both existing accounts with no profile and new accounts where the best-effort `isce-auth` sign-up call failed.

---

### 2.2 Core Idempotent Logic (`ProfileService.ensureDefaultProfile`)

Both endpoints delegate to a single shared method:
`ProfileService.ensureDefaultProfile(userId: string, input: { name: string; profilePhoto?: string })`

1. **Concurrency & Idempotency Guard (Transaction + Advisory Lock + Partial Unique Index):**
   * Run inside `this.databaseService.$transaction(async (tx) => { ... })`.
   * Acquire a transaction-scoped Postgres advisory lock keyed on `userId` (`SELECT pg_advisory_xact_lock(hashtext($1))`) so two concurrent requests (e.g. `isce-auth` sign-up call + user's first frontend visit) serialize cleanly.
   * Check for any existing non-deleted profile for `userId` (`where: { userId, deletedAt: null }`, preferring `is_default: true`).
   * **If one exists:** Return `{ success: true, created: false, data: { profile: existing } }` without modifying anything.
   * **If none exists:**
     1. Ensure `FREE` subscription exists via `SubscriptionsService.createSubscription(userId, PlanTier.FREE, true)` (`skipConflictCheck = true`).
     2. Generate a unique `slug` from `input.name` (using `slugify` + numeric suffix collision check, matching `scripts/generate-profile-slugs.ts`) so the user immediately has a working public card link.
     3. Create the `Profile` with `is_default: true`, `name`, `profilePhoto`, and `slug`.
     4. Return `{ success: true, created: true, data: { profile } }`.

2. **Database Schema / Migration Guard:**
   * Add a PostgreSQL partial unique index via a Prisma migration (`prisma/migrations/<timestamp>_unique_default_profile_per_user/migration.sql`):
     ```sql
     CREATE UNIQUE INDEX "Profile_userId_default_active_key"
     ON "Profile" ("userId")
     WHERE "is_default" = true AND "deletedAt" IS NULL;
     ```
   * This enforces at the DB level that a user can never have more than one active default profile, even if called outside the advisory lock.
   * *(No data-migration risk unless existing prod data already has duplicate active `is_default = true` rows for the same `userId` — we should run a quick `SELECT "userId", COUNT(*) FROM "Profile" WHERE "is_default" = true AND "deletedAt" IS NULL GROUP BY "userId" HAVING COUNT(*) > 1` check on prod before applying.)*

3. **Module Wiring:**
   * `InternalModule` (`src/internal/internal.module.ts`) imports `ProfileModule` (which exports `ProfileService`) and delegates `InternalService.ensureDefaultProfile(...)` to `ProfileService.ensureDefaultProfile(...)`.

---

### 2.3 `isce-auth` Changes (Sibling Repo)

* In `src/auth/auth.service.ts` (`createUserByType`, around line 846):
  * For `USER` sign-ups, add a best-effort helper `provisionDefaultConnectProfile(user)` modeled directly on `provisionBusinessWorkspace` (line 931).
  * Calls `POST ${CONNECT_NEST_URL}/api/internal/profile/ensure-default` with `X-Internal-Secret` header, `{ authUserId, name, profilePhoto }`, and a short timeout.
  * Wrapped in `try/catch` — logs a warning on failure and **never fails or blocks sign-up** if `connect-nest` is unreachable.

---

## 3. Open Decisions for Review

1. **`BUSINESS_USER` sign-ups:**
   * `BUSINESS_USER` already gets a `CpOrganization` + `CpWorkspace` via `provisionBusinessWorkspace`.
   * **Recommendation:** Do **not** auto-create a personal Connect `Profile` during `BUSINESS_USER` sign-up in `isce-auth`. If a business user ever switches to personal Connect, `connect-web` calling `POST /api/profile/ensure-default` creates it lazily. *(Confirm if you prefer creating both at sign-up instead.)*
2. **Auto-generating `slug` on default profile creation:**
   * `ProfileService.createProfile` currently leaves `slug` `null`. Generating a unique `slug` in `ensureDefaultProfile` gives new users an immediate public card link (`/<slug>`). *(Confirm this is desired.)*
3. **Existing prod accounts backfill:**
   * Once deployed, we should query prod (`isce-auth` users vs `connect-nest` `Profile` table) to report how many active `USER` accounts have no profile, and decide whether to run a one-off backfill script calling `ensureDefaultProfile`.

---

## 4. Testing & Verification Plan

* **Unit tests:**
  * `src/profile/profile.service.spec.ts`:
    * Creates default profile + `FREE` subscription + unique `slug` when user has 0 profiles (`created: true`).
    * Returns existing profile unchanged when user already has a profile (`created: false`, `createSubscription` not called, no second profile created).
  * `src/internal/internal.service.spec.ts`: delegates `ensureDefaultProfile` to `ProfileService`.
* **E2E tests (`test/internal-profile.e2e-spec.ts`):**
  * `POST /api/internal/profile/ensure-default` without/with wrong `X-Internal-Secret` → `403`.
  * `POST /api/internal/profile/ensure-default` twice (and concurrently via `Promise.all`) → exactly 1 `Profile` (`is_default: true`) and 1 `FREE` `Subscription`.
  * `POST /api/profile/ensure-default` as authenticated user → creates if missing, no-ops if present.
* **Checks before completion:** `npx tsc --noEmit`, `yarn lint`, `yarn test`, `yarn test:e2e`.
