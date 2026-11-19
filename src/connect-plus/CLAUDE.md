# Connect Plus (`/api/cp/**`) — module rules

Business layer of LYNCON. Hierarchy: `CpOrganization` (1 per creator) → `CpWorkspace` → members (`CpWorkspaceMember`: STAFF / WORKSPACE_ADMIN / CLIENT) → leads, clients, appointments, invoices, attendance, chat, connect cards. Plus jobs/talent (artisan marketplace bridge).

## Request pipeline
`AuthGuard` (global) → `CpContextGuard` (builds `req.cp: CpRequestContext` from `x-workspace-id`; `/api/cp/organizations*` resolves CREATOR org) → `CpRolesGuard` (`@CpRoles`). Services receive `CpRequestContext`, never raw headers.

## Rules
- New controller ⇒ `@UseGuards(CpContextGuard, CpRolesGuard)` at class level and an explicit `@CpRoles(...)` on **every** route. A route with no `@CpRoles` is a review blocker. Consult `docs/connect_plus/CONNECT PLUS – ROLE-BASED ACCESS CONTROL (RBAC) MATRIX.md`.
- Routes are **flat** (`/cp/staff`, `/cp/invoices`) — workspace comes from the header, not the path.
- HTTP verbs are part of the contract with `connect-web`. Current convention: state transitions are **PATCH** (`leads/:id/assign|validate|reject`, `clients/:id/assign`, `invoices/:id/send|mark-paid|cancel`, `appointments/:id/status`), company profile upsert is **PUT**, creates are POST. Do not change a verb without updating the frontend (`connect-web/lib/const.tsx` + callers).
- Every mutating operation writes an audit entry via `CpAuditLogService.write()` (see `audit-logs/CLAUDE.md`) and, where users are affected, a `CpNotification`.
- Plan limits: check `CpSubscriptionsService.checkLimit()` before creating workspaces / staff / clients.
- Soft-delete leads (never hard delete); archive organizations/workspaces via status, not `delete`.
- Pagination via `utils/paginate.ts`; slugs via `utils/slug.ts`.
- Public (unauthenticated) routes live only in `public/` and `connect-cards` (`POST /cp/public/cards/:cardCode/tap`). They need `@PublicRoute()`, throttling, DTO validation, and must resolve the workspace from the slug server-side.
- Chat gateway (`chat/chat.gateway.ts`, namespace `/cp`) authenticates with `handshake.auth.token` (access JWT) — not cookies.

## STRICT children
`guards/`, `audit-logs/`, `webhooks/`, `invoices/` carry their own `CLAUDE.md` marked STRICT.
