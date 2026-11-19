# STRICT — Connect Plus guards (`CpContextGuard`, `CpRolesGuard`)

**STRICT**: do not change public interfaces, security behaviour or data handling without stating the change and the reason in the plan / PR description.

These guards are the tenant-isolation boundary for all of Connect Plus.

- `CpContextGuard` must always derive `organizationId`, `workspaceId`, `role`, `memberId` **from the database** using the authenticated user id (`req.isce_auth.id`) — never trust a client-supplied role or org id. `x-workspace-id` is only a *selector*; membership must be verified.
- The CREATOR fallback (no header → oldest workspace of the creator's org) and the "POST /organizations before an org exists" exception are deliberate. Do not widen them to other paths/methods.
- Suspended/removed members (`CpMemberStatus`) and archived/suspended workspaces must be rejected. Don't weaken.
- `CpRolesGuard` is deny-by-default for routes with `@CpRoles`. The only implicit rule: **CREATOR satisfies any route that allows WORKSPACE_ADMIN** (the owner is a workspace admin by default). Do not add other implicit grants; CREATOR still needs to be listed for STAFF/CLIENT routes, and WORKSPACE_ADMIN never satisfies a CREATOR-only route.
- Any change needs: updated `test/cross-workspace.e2e-spec.ts` coverage, and a note in the spec on who gains/loses access.
