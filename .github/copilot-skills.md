# Skill: ISCE Connect API — Security & Architecture Practices

## Description

This skill defines the mandatory security patterns, architectural rules, and coding practices for the **connect-nest** NestJS backend — the API for ISCE Connect digital business cards.

---

## Security Rules

### Authentication & Authorisation

- JWT tokens are issued by the centralised `isce-auth` service and validated here using a shared `JWT_SECRET`.
- `AuthGuard` is applied globally in `AppModule`. All routes require a valid Bearer token unless explicitly marked with `@Public()`.
- **Data isolation is critical**: every database query must be scoped to the authenticated user's `userId`. Never allow cross-user data access.
- When implementing admin endpoints, use dedicated guards (e.g., `SuperAdminGuard`).

### Input Validation

- A global `ValidationPipe` is registered with `whitelist: true` and `transform: true`.
- **Every endpoint** must accept a DTO class decorated with `class-validator` validators.
- Never access `req.body` directly — always use typed DTOs.
- Validate slugs, URLs, and user input fields with appropriate decorators (`@IsUrl()`, `@Matches()`, `@MaxLength()`, etc.).

### Rate Limiting

- `ThrottlerGuard` is applied globally: 30 requests / 60 seconds per IP.
- Use `@Throttle()` for tighter limits on sensitive endpoints.

### Helmet & HTTP Headers

- Helmet is applied globally in `main.ts`.
- Never weaken or remove security headers.

### CORS

- Origins are loaded from `ALLOWED_ORIGINS` environment variable (comma-separated).
- **Never use `origin: '*'`** or `origin: true`.
- `credentials: true` is required for cookie-based auth flows.
- When deploying a new frontend, add its domain to the `ALLOWED_ORIGINS` env var.

### File Uploads

- Validate file types and sizes before accepting uploads.
- Never serve user-uploaded files from the same domain without proper Content-Type headers.
- Sanitise filenames to prevent path traversal attacks.

---

## Architecture Rules

### Module Structure

Every feature must follow the NestJS module pattern:

```
src/<feature>/
├── <feature>.module.ts      # Module declaration
├── <feature>.controller.ts  # Route handlers
├── <feature>.service.ts     # Business logic
├── dto/                     # Request/response DTOs
└── guards/                  # Feature-specific guards (if any)
```

### Database Access

- Use `PrismaService` (injected via `DatabaseModule`) for all DB access.
- **Scope all queries to the authenticated user** — always filter by `userId` from the JWT payload.
- Use Prisma transactions (`prisma.$transaction()`) for multi-step writes.
- Never expose raw Prisma errors to clients — catch and rethrow as `HttpException`.
- Profile slugs must be validated for uniqueness before assignment.

### Error Handling

- Use NestJS's built-in exception classes: `BadRequestException`, `UnauthorizedException`, `ForbiddenException`, `NotFoundException`, `ConflictException`.
- Never return `500` with raw error details.
- Log errors server-side; return safe messages client-side.

### Global API Prefix

- All routes are served under `/api` (set via `app.setGlobalPrefix('api')` in `main.ts`).
- When referencing endpoints in documentation or client code, always include the `/api` prefix.

---

## Coding Standards

1. **TypeScript strict mode** — no `any` types; use Prisma-generated types and custom DTOs.
2. **Async/await** — all async operations must use `async/await`.
3. **Environment variables** — access via `process.env`; never hardcode secrets or URLs.
4. **Swagger documentation** — every controller method must have `@ApiOperation()`, `@ApiResponse()`, and `@ApiTags()`.
5. **No console.log in production** — use NestJS Logger.
6. **WebSocket security** — WebSocket gateways (Socket.IO) must validate JWT tokens on connection. Never allow unauthenticated socket connections.

---

## Testing Checklist

Before merging any PR:

- [ ] All DTOs have class-validator decorators
- [ ] All queries are scoped to the authenticated user's `userId`
- [ ] New endpoints have Swagger annotations
- [ ] Slugs and user input are properly validated
- [ ] File uploads validate type and size
- [ ] CORS origins are updated if a new frontend domain is added
- [ ] Prisma schema changes include a migration
