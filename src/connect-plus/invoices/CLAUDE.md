# STRICT — Invoices

**STRICT**: do not change public interfaces, security behaviour or data handling without stating the change and the reason in the plan / PR description.

- Money uses `Prisma.Decimal` via `toDecimal`/`roundMoney` (4 dp) in `invoices.service.ts`. Never use JS `number` arithmetic for totals, tax, discounts.
- Totals are **recomputed server-side** from line items; never trust client-sent totals.
- Lifecycle: `DRAFT → SENT → PAID | OVERDUE | CANCELLED`. Transitions go through `send`, `mark-paid`, `cancel` (all PATCH). Enforce legal transitions in the service; a paid invoice is immutable except for notes agreed in the spec.
- Role matrix: create/send/update = STAFF + WORKSPACE_ADMIN; list-all/export/mark-paid/cancel = WORKSPACE_ADMIN; `assigned` = STAFF; `me` = CLIENT (own invoices only). A CLIENT must never be able to read another client's invoice.
- `invoices.scheduler.ts` flips overdue invoices — keep it idempotent and workspace-agnostic-safe (batch, no N+1 per workspace).
- Export (`/export`, `/:id/download`) returns CSV/PDF binary: any frontend consumer must bypass JSON-only proxies (see `../../../../connect-web/app/api/cp/CLAUDE.md`).
- Each state change writes an audit entry and notifies the client where applicable.
