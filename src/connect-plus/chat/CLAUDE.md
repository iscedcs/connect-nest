# Connect Plus chat (REST + Socket.IO `/cp`)

- REST: `GET /cp/conversations`, `POST /cp/conversations/direct`, `POST|GET /cp/conversations/:convId/messages`, `PATCH …/messages/read`.
- Gateway (`chat.gateway.ts`): namespace `/cp`; client sends the access JWT as `auth: { token }` in the handshake (HttpOnly cookies are **not** readable by the browser, so the web client must obtain a short-lived token explicitly — see connect-web spec for chat sockets). Events: `cp:message`, `cp:message-received`, `cp:typing`, `cp:error`.
- Conversation visibility is by membership + role (clients only see their staff/own threads; staff never see other staff↔client threads they aren't in). Every send/read must re-check membership server-side — never trust the room a socket claims.
- Persist first, then emit. Emission failure must not fail the REST send.
- Attachments (voice note/image) have **no upload endpoint yet** — design via `src/files` presigned upload in a spec before adding; messages should reference file keys, not embed binary.
- Keep `chat.gateway.spec.ts` / `chat.service.spec.ts` green.
