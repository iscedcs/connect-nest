# ISCE Connect API — Project Summary

## What This Project Is

**connect-nest** is the backend REST API for **ISCE Connect** — a digital business card and professional networking platform. Users get a shareable profile page (their digital "card") that others can tap via NFC, scan via QR code, or visit via link. The API powers everything behind those cards.

**Stack:** NestJS 11 · TypeScript · PostgreSQL (Neon) via Prisma ORM · JWT Auth · WebSockets (Socket.IO)

**Base URL:** `http://localhost:3000/api`  
**Swagger docs:** `http://localhost:3000/docs` (non-production)

---

## Core Concept

Every user can have one or more **Profiles**. A profile is the digital card — it holds all the content a person wants to share: their socials, links, videos, contact info, files, and more. A physical NFC device can be bound to a profile so tapping the card opens it.

---

## What the API Does — Module by Module

### Identity & Auth
- **Auth** — Validates JWTs issued by the companion `isce-auth` service using a shared `JWT_SECRET`. Every route is protected by default; `@PublicRoute()` opts a route out.

### Profile Management
- **Profile** — Core CRUD for user profiles. Handles slug generation (unique public URL handle), default profile selection, and profile photo/cover. Users can have multiple profiles (limit enforced by subscription plan).

### Profile Content
Everything below is attached to a profile and appears on the digital card:

| Module | What it stores |
|--------|---------------|
| **Social** | Links to social platforms (LinkedIn, Twitter, Instagram, etc.) with visibility and ordering |
| **Links** | Custom URLs with title, image, and ordering |
| **Videos** | Embedded videos from any platform (YouTube, Vimeo, etc.) |
| **Meetings** | Meeting platform links (Calendly, Google Meet, Zoom, etc.) |
| **Appointments** | Appointment booking links (Cal.com, etc.) |
| **Spotify** | Spotify embeds — tracks, playlists, albums |
| **Files** | File attachments stored in DigitalOcean Spaces with size and count tracked |
| **Forms** | Custom embeddable forms with JSON field definitions; collects Submissions |
| **Wallets** | Crypto wallet addresses (network + address + optional ENS) |
| **Contact** | The profile owner's own contact card fields (name, email, phone, note) |

### Networking
- **Profile Contact** — Saves another user's contact card (like adding a contact in a phone). Stores phone numbers for the card owner.
- **Card Interactions** — Records every time a profile card is tapped (NFC) or scanned (QR). Tracks device ID, scan method, device type, and referrer. Powers analytics for profile owners.

### Configuration & Personalisation
- **Connect Config** — Per-profile configuration: module ordering, theme settings, and branding options.
- **Device Profile** — Binds a physical NFC device (card/tag) to a specific profile. Supports relinking devices between profiles. Also stores FCM tokens for push notifications tied to the device.

### Artisan Directory
A full service marketplace embedded within the platform:

- **Artisan** — Users can register as service providers. Artisan profiles have a bio, working hours, status (PENDING_REVIEW → ACTIVE / SUSPENDED), and aggregate stats (rating, bookings, earnings).
- **Categories** — Artisans select 1–3 categories from a seeded directory (e.g. Beauty, Plumbing, Photography).
- **Services** — Each artisan lists the services they offer with pricing and duration.
- **Portfolio** — Image/video/link portfolio items.
- **Bookings** — Clients book artisan services. Bookings track status from PENDING through CONFIRMED → IN_PROGRESS → COMPLETED.
- **Booking Threads** — Real-time conversation between client and artisan for each inquiry. Artisans can send structured **Proposals** (price, date, time) which the client accepts to create a booking.
- **Reviews** — Clients leave reviews after completed bookings; ratings are aggregated on the artisan profile.
- **Promotions** — Sponsored/boost promotions for artisans in the directory.

### Communication & Notifications
- **Notification** — In-app notifications with 25+ typed events (card taps, booking updates, payments, artisan status changes, thread messages, subscription events, etc.).
- **Push** — Firebase Cloud Messaging (FCM) push notifications.
- **Mail** — Transactional email via a mail client module.
- **WebSockets** — Real-time events for booking threads via Socket.IO gateway.

### Subscriptions & Plans
- **Subscriptions** — Tiered subscription system (FREE / PRO_LITE / PRO_PLUS) that enforces feature limits across all modules:
  - FREE: 1 profile, 3 social links, 1 video, 2 files, 10 MB storage, 20 taps/day, 3-day analytics history, no artisan directory
  - PRO_LITE: 2 profiles, 5 social links, 5 videos, 10 files, 50 MB storage, unlimited taps, 15-day history, artisan eligible
  - PRO_PLUS: 5 profiles, higher limits across everything, 5 artisan service categories, module reordering

### Internal & Support
- **Support Request** — Users submit support tickets.
- **Internal** — Internal admin endpoints protected by a separate internal guard (not JWT-based).

---

## Security

| Layer | Implementation |
|-------|---------------|
| Auth | Global `AuthGuard` — every route requires a valid JWT unless `@PublicRoute()` |
| Headers | `helmet` applied globally |
| Input validation | Global `ValidationPipe` with `whitelist: true` — unknown fields stripped |
| Rate limiting | `ThrottlerGuard` globally — 30 requests per 60 seconds |
| CORS | Origins from `ALLOWED_ORIGINS` env var — never wildcard |
| Data isolation | All queries scoped to authenticated `userId` |
| Plan enforcement | `PlanLimitGuard` + service-level `checkLimit()` calls |

---

## Data Model Overview

```
Profile (core entity)
├── Social[]            social platform links
├── Link[]              custom URLs
├── Video[]             video embeds
├── MeetingLink[]       meeting platform links
├── AppointmentLink[]   appointment booking links
├── SpotifyItem[]       Spotify embeds
├── FileItem[]          uploaded files
├── Form[]              custom forms → Submission[]
├── Wallet[]            crypto wallet addresses
├── Contact[]           saved contact cards
├── ProfileContact[]    phone numbers on the card
├── ConnectConfig       page layout + theme
├── DeviceProfile[]     bound NFC devices
├── Notification[]      in-app alerts
├── SupportRequest[]    support tickets
├── CardInteraction[]   tap/scan analytics
└── Artisan             service provider profile
    ├── ArtisanCategoryMap[]  → ArtisanCategory
    ├── ArtisanService[]      services offered
    ├── PortfolioItem[]       work samples
    ├── Booking[]             client bookings
    ├── BookingThread[]       client conversations
    ├── Review[]              client reviews
    └── Promotion[]           directory promotions

Subscription            per-user plan (FREE/PRO_LITE/PRO_PLUS)
Plan                    plan catalogue (seeded)
PaymentRecord           payment history
```

---

## Key Commands

```bash
pnpm install              # Install dependencies
pnpm run start:dev        # Start in watch mode (port 3000)
pnpm run build            # Compile to dist/
npx prisma db push        # Push schema changes to DB (no migration files)
npx prisma generate       # Regenerate Prisma client after schema changes
npx prisma studio         # Open Prisma Studio GUI
npx ts-node scripts/seed-plans.ts   # Seed subscription plan records
```

---

## Environment Variables (key ones)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | Shared secret with isce-auth for validating tokens |
| `PORT` | Server port (default 3000) |
| `NODE_ENV` | `development` / `production` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `AUTH_API_URL` | Base URL of the isce-auth service |
| `PAYDESTAL_SECRET_KEY` | Payment gateway (Paydestal) — integration pending |
