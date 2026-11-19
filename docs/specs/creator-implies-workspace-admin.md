# Spec: CREATOR satisfies WORKSPACE_ADMIN routes (STRICT: `src/connect-plus/guards`)

Status: approved by reviewer (2026-11-02), implemented.

## Problem
`CpContextGuard` sets the effective role to `CREATOR` for the organization owner. `CpRolesGuard` only checks list membership, so the 21 routes declared `@CpRoles(WORKSPACE_ADMIN)` only (invoices create/mark-paid/cancel, connect cards, attendance, analytics, audit logs, invites POST, …) return 403 "Insufficient role" to the owner. Observed: owner got 403 inviting staff.

## Change (security behaviour)
In `CpRolesGuard`: a request with role `CREATOR` is allowed if the route's `@CpRoles` includes `WORKSPACE_ADMIN`.

## Who gains access
The organization owner, on every route that previously listed only `WORKSPACE_ADMIN` (plus any that list ADMIN with others but omitted CREATOR). Workspace scoping is unchanged: `CpContextGuard` still verifies the workspace belongs to the owner's org.

## Unchanged
- CREATOR-only routes stay closed to WORKSPACE_ADMIN.
- STAFF-/CLIENT-only routes stay closed to CREATOR unless CREATOR is listed.
- Suspended/removed member checks, header handling, public routes.

## Risk / follow-up
- Owner can now mark invoices paid / cancel them and manage cards; every such action is audit-logged with `actorRole = CREATOR`.
- Existing explicit `CpRole.CREATOR` entries become redundant on routes that also list ADMIN; left in place (no behaviour impact).

## Tests
`cp-roles.guard.spec.ts` (unit, 7 cases).
