# STRICT — Connect Plus webhooks

**STRICT**: do not change public interfaces, security behaviour or data handling without stating the change and the reason in the plan / PR description.

Endpoints: `POST /cp/webhooks/invite-accepted` (from `isce-auth`, HMAC-SHA256 in `x-webhook-signature`, secret `AUTH_INVITE_WEBHOOK_SECRET`) and `POST /cp/webhooks/paystack` (`x-paystack-signature`, `PAYSTACK_SECRET_KEY`).

- Signatures are verified against the **raw body** (`rawBody` Buffer), with constant-time comparison (`timingSafeEqual`). Never parse-then-restringify for verification; never skip verification "in dev".
- Handlers must be **idempotent** (providers retry). Dedupe on event/reference id before mutating state.
- Respond 2xx quickly for events that are valid-but-ignored; 401 only for bad signatures. Don't leak which check failed.
- Don't log raw bodies. Money amounts from Paystack are in kobo — convert deliberately.
- Changes to payload DTOs must be coordinated with `../isce-auth` (invite webhook) — note it in the spec.
