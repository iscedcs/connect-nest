# STRICT — Audit logs

**STRICT**: do not change public interfaces, security behaviour or data handling without stating the change and the reason in the plan / PR description. Spec: `docs/connect_plus/CONNECT PLUS – AUDIT & LOGGING RULES.md`.

- Logs are **append-only and hash-chained**: `hash = SHA-256(previousHash | createdAt | actorId | eventType | targetEntity | targetEntityId | action)`, chained per workspace (or per organization when there is no workspace). No update/delete code paths, no migrations that rewrite rows.
- Changing the hash input, field order, or chain scope breaks `GET /cp/audit-logs/verify` for all history — requires an explicit versioning/migration plan.
- `write()` is fire-and-forget and must never throw into the caller. Do not `await` it in request paths; do not add side effects that can fail the request.
- Never put secrets, tokens, passwords, or full payment payloads in `before`/`after`/`metadata`.
- Visibility is role-scoped (`/me` own actions, workspace admin → workspace, creator → `/org`). Keep exports (`/export`) subject to the same scoping.
- Every new mutating endpoint must call `write()` with a stable `eventType` string; add it to the audit rules doc.
