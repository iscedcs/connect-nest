# ISCE Connect API — Project Instructions

## Overview

**connect-nest** is the backend API for ISCE Connect — a digital business card and networking platform. It manages user profiles, social links, contacts, meetings, appointments, files, wallets, forms, Spotify integrations, and card interactions.

- **Framework:** NestJS 11 (TypeScript)
- **Database:** PostgreSQL via Prisma ORM
- **Auth model:** JWT (tokens issued by `isce-auth`, validated locally)
- **Default branch:** `main` | **Working branch:** `dev`
- **Port:** 3000 (dev), configurable via `PORT` env
- **API prefix:** `/api`
- **Swagger:** `/docs` (non-production only)

---

## Architecture

```
src/
├── auth/              # AuthGuard, JWT strategy — validates tokens issued by isce-auth
├── profile/           # Profile CRUD — the core entity
├── social/            # Social platform links
├── contact/           # Contact card management
├── profile-contact/   # Saved contacts between profiles
├── links/             # Custom links
├── videos/            # Video embeds
├── meetings/          # Meeting link management
├── appointments/      # Appointment scheduling
├── spotify/           # Spotify integration
├── files/             # File attachments
├── forms/             # Custom forms
├── wallets/           # Wallet management
├── connect-config/    # App configuration per profile
├── notification/      # Push notifications
├── support-request/   # Support ticket system
├── card-interactions/ # Analytics for card views/taps
├── database/          # PrismaService (singleton)
├── config/            # App configuration helpers
└── main.ts
prisma/
├── schema.prisma      # Profile + 15 related models
└── migrations/
```

### Key modules (19 total)

| Module | Purpose |
|--------|---------|
| `AuthModule` | JWT validation, guards |
| `ProfileModule` | Core profile CRUD, slug generation |
| `SocialModule` | Social platform links (LinkedIn, Twitter, etc.) |
| `ContactModule` | Contact card fields |
| `ProfileContactModule` | Saved contacts between users |
| `LinksModule` | Custom URL links on profile |
| `VideosModule` | Video embeds |
| `MeetingsModule` | Meeting platform links |
| `AppointmentsModule` | Appointment scheduling |
| `SpotifyModule` | Spotify widget integration |
| `FilesModule` | File attachment management |
| `FormsModule` | Custom form builder |
| `WalletsModule` | Payment/wallet links |
| `ConnectConfigModule` | Per-profile configuration |
| `NotificationModule` | Push notification handling |
| `SupportRequestModule` | Support ticket system |
| `CardInteractionsModule` | Profile view/tap analytics |

---

## Security Practices (MANDATORY)

### 1. Authentication

- JWT tokens are issued by `isce-auth` and validated here using a shared `JWT_SECRET`.
- `AuthGuard` is applied **globally** — all routes require a valid JWT unless explicitly marked otherwise.
- Token payload: `{ id, email, phone, firstName, lastName, displayPicture, userType }`

### 2. Helmet

Applied globally in `main.ts`. Uses default settings.

### 3. ValidationPipe

Global pipe with `whitelist: true`, `transform: true`. All incoming DTOs must use `class-validator` decorators.

### 4. Rate Limiting

`ThrottlerGuard` applied globally (30 requests / 60 seconds).

### 5. CORS

Origins loaded from `ALLOWED_ORIGINS` env var (comma-separated). **Never use `origin: '*'`**. `credentials: true` is set for cookie support.

### 6. Data Isolation

- All data operations must be scoped to the authenticated user's `userId`.
- Never allow a user to access or modify another user's profile data without explicit authorisation.
- Profile slugs must be unique and validated before assignment.

---

## Coding Conventions

1. **One module per feature** — controller, service, DTOs in its own folder
2. **DTOs are mandatory** — every endpoint receives a DTO validated by `class-validator`
3. **Prisma usage** — inject `PrismaService`; scope all queries to the authenticated user's ID
4. **Error handling** — throw NestJS `HttpException` subclasses; never return raw Prisma errors
5. **Environment variables** — access via `process.env`; never hardcode secrets or URLs
6. **No `any`** — use typed DTOs and Prisma-generated types
7. **Swagger decorators** — every endpoint must have `@ApiOperation`, `@ApiResponse`, `@ApiTags`
8. **Global prefix** — all routes are served under `/api` (set in `main.ts`)

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Prisma PostgreSQL connection string |
| `JWT_SECRET` | Shared secret for validating JWTs (same as isce-auth) |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
| `ACCESS_EXPIRES_IN` | Access token expiry duration |
| `REFRESH_EXPIRES_IN` | Refresh token expiry duration |
| `PORT` | Server port (default 3000) |
| `NODE_ENV` | `development` / `production` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `AUTH_API_URL` | Base URL of the isce-auth backend |
| `TERMII_BASE_URL` | Termii SMS API base URL |
| `TERMII_API_KEY` | Termii API key |
| `TERMII_SENDER_ID` | Termii sender ID |
| `PAYDESTAL_BASE_URL` | Paydestal payment API base URL |
| `PAYDESTAL_SECRET_KEY` | Paydestal secret key |
| `PAYDESTAL_PUBLIC_KEY` | Paydestal public key |
| `WEBHOOK_REPUSH` | Webhook repush URL |
| `CREATE_DEDICATED_ACCOUNT` | Dedicated account creation flag/URL |

---

## Commands

```bash
pnpm install             # Install dependencies
pnpm run start:dev       # Start in watch mode
pnpm run build           # Compile to dist/
npx prisma migrate dev   # Run migrations
npx prisma generate      # Regenerate Prisma client
npx prisma studio        # Open Prisma Studio GUI
```
