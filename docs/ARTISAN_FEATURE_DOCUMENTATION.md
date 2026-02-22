# ISCE Connect — Artisan Feature Documentation

> **Status:** Draft — Approved for Implementation
> **Date:** 2026-02-21
> **Scope:** connect-nest (backend), connect-web (frontend), wallet-nest (payment hooks)
> **Launch Region:** Nigeria (built with global categories in mind)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Definitions](#2-definitions)
3. [Artisan Categories](#3-artisan-categories)
4. [Requirements to Become an Artisan](#4-requirements-to-become-an-artisan)
5. [Registration Flow](#5-registration-flow)
6. [Data Models (Prisma)](#6-data-models-prisma)
7. [API Endpoints — connect-nest](#7-api-endpoints--connect-nest)
8. [Artisan Dashboard (connect-web)](#8-artisan-dashboard-connect-web)
9. [Public Artisan Directory](#9-public-artisan-directory)
10. [Artisan Payment Flow](#10-artisan-payment-flow)
11. [Reviews & Ratings](#11-reviews--ratings)
12. [Revenue Model](#12-revenue-model)
13. [Admin & Platform Settings](#13-admin--platform-settings)
14. [Frontend Pages & Routes](#14-frontend-pages--routes)
15. [Cross-Service Integration](#15-cross-service-integration)
16. [Implementation Plan](#16-implementation-plan)
17. [Open Questions](#17-open-questions)

---

## 1. Overview

The **Artisan** feature allows any ISCE Connect user to upgrade a profile into a publicly discoverable, bookable, and payable professional listing. Artisans are skilled professionals or service providers — barbers, tailors, photographers, makeup artists, plumbers, caterers, DJs, tutors, developers, etc.

### Key Principles

- **Any Connect user can become an artisan** — it is not a separate account type; it is a flag attached to a specific profile.
- **Artisans must meet requirements** before being listed (profile completeness, wallet KYC, portfolio, category).
- **Listing is automated by default** — when all requirements are met, the artisan is activated. A superadmin setting can switch to manual approval mode.
- **Normal users can still accept payments** if they have a wallet enabled — the artisan feature adds discoverability, structured services, reviews, and promotion tools on top of that.
- **Revenue generation** through commissions on artisan transactions, temporary boosts, and sponsored directory placement.

---

## 2. Definitions

| Term                | Definition                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Artisan**         | A Connect profile upgraded with professional service capabilities, listed in the public directory                     |
| **Artisan Profile** | The Profile record with an attached Artisan record — retains all normal profile features plus artisan-specific fields |
| **Service**         | A defined offering by an artisan with name, description, price, and optional duration                                 |
| **Portfolio Item**  | An image or link showcasing the artisan's work (minimum 2 required)                                                   |
| **Booking**         | A customer-initiated request for a specific service on a specific date/time                                           |
| **Review**          | A rating + comment left by a customer who has completed a payment or booking with the artisan                         |
| **Promotion**       | A paid placement in the directory — sponsored listing, featured badge, or search boost                                |
| **Directory**       | The public artisan listing at `isce.app/artisans` — searchable, filterable, location-aware                            |

---

## 3. Artisan Categories

Categories are predefined and managed in the database. New categories can be added by admins. Each artisan selects 1–3 categories.

### Initial Category List (Nigeria-first, globally extensible)

| ID  | Category                  | Icon | Example Artisans                                          |
| --- | ------------------------- | ---- | --------------------------------------------------------- |
| 1   | Beauty & Grooming         | ✂️   | Barbers, hairstylists, makeup artists, nail technicians   |
| 2   | Fashion & Tailoring       | 👗   | Tailors, fashion designers, shoe makers                   |
| 3   | Photography & Videography | 📷   | Photographers, videographers, editors                     |
| 4   | Food & Catering           | 🍽️   | Caterers, bakers, chefs, meal prep                        |
| 5   | Home Services             | 🏠   | Plumbers, electricians, painters, cleaners                |
| 6   | Technology & Digital      | 💻   | Web developers, graphic designers, IT support             |
| 7   | Events & Entertainment    | 🎵   | DJs, MCs, event planners, decorators                      |
| 8   | Health & Wellness         | 💆   | Fitness trainers, masseuses, nutritionists                |
| 9   | Education & Tutoring      | 📚   | Tutors, music teachers, language instructors              |
| 10  | Automotive                | 🚗   | Mechanics, auto detailers, panel beaters                  |
| 11  | Crafts & Artworks         | 🎨   | Woodworkers, ceramics, painters, sculptors                |
| 12  | Logistics & Delivery      | 🚚   | Dispatch riders, movers, courier services                 |
| 13  | Others                    | 📋   | Catch-all — requires a custom `customCategory` text field |

### "Others" Category Behaviour

When an artisan selects "Others", an additional **free-text field** (`customCategory`) is required. Over time, popular custom categories can be promoted to first-class categories by an admin. The `customCategory` field is indexed and searchable in the directory.

---

## 4. Requirements to Become an Artisan

All requirements must be met before the artisan is activated (auto or manual approval depending on platform settings).

| #   | Requirement                         | Field / Check                                                         | Notes                                      |
| --- | ----------------------------------- | --------------------------------------------------------------------- | ------------------------------------------ |
| 1   | **Profile name set**                | `profile.name` is non-empty                                           | Basic identity                             |
| 2   | **Profile photo set**               | `profile.profilePhoto` is non-null                                    | Public-facing image                        |
| 3   | **Profile description set**         | `profile.description` is non-null and ≥ 20 chars                      | Tell customers what you do                 |
| 4   | **Profile location set**            | `profile.location` is non-null                                        | Directory filtering by location            |
| 5   | **Profile slug set**                | `profile.slug` is non-null                                            | SEO URL: `/p/{slug}` and directory linking |
| 6   | **Wallet connected & KYC verified** | wallet-nest API: user has wallet with `kycLevel ≥ ONE` (BVN verified) | Must be able to receive payments           |
| 7   | **At least 1 category selected**    | Part of artisan registration form                                     | Directory placement                        |
| 8   | **At least 2 portfolio items**      | Uploaded during or after registration                                 | Showcases work quality                     |
| 9   | **Artisan terms accepted**          | `artisan.termsAcceptedAt` is non-null                                 | Legal                                      |

### Requirements Check API

`GET /api/artisan/requirements` — returns the checklist with pass/fail for each requirement, plus an `allMet: boolean` flag. The frontend uses this to render the requirements screen with actionable CTAs for unmet items.

---

## 5. Registration Flow

### 5.1 User-Facing Flow

```
Dashboard
│
├── "Become an Artisan" button (shown if user has no artisan profile)
│   ├── Visible as a PromoBanner card or a new ArtisanCTACard
│   └── If user has multiple profiles → prompt to select which profile to upgrade
│
▼
Artisan Onboarding Screen (/connect/artisan/setup)
│
├── Step 1: Requirements Checklist
│   ├── Each requirement shows ✅ or ❌ with action button
│   ├── "Connect Wallet" → redirects to /wallet setup
│   ├── "Add Photo" → opens profile edit
│   ├── "Set Slug" → opens slug dialog
│   └── All met → "Continue" button enabled
│
├── Step 2: Category Selection
│   ├── Pick 1–3 categories from grid
│   ├── If "Others" selected → show customCategory text input
│   └── "Continue"
│
├── Step 3: Service Setup (at least 1 required)
│   ├── Add services: name, description, price (₦), duration (optional)
│   └── "Continue"
│
├── Step 4: Portfolio Upload (minimum 2 images)
│   ├── Drag/drop or file picker
│   ├── Each image uploaded to DO Spaces
│   └── "Continue"
│
├── Step 5: Bio & Working Hours (optional but recommended)
│   ├── Artisan bio (separate from profile description — artisan-specific pitch)
│   ├── Working hours: Mon–Sun toggles with start/end time
│   └── "Continue"
│
├── Step 6: Accept Terms
│   ├── Artisan ToS displayed
│   └── "I Accept" → termsAcceptedAt = now()
│
▼
Backend: POST /api/artisan/register
│
├── If platform setting autoApproval = true:
│   └── artisan.status = ACTIVE → listed in directory immediately
│
├── If platform setting autoApproval = false:
│   └── artisan.status = PENDING_REVIEW → admin reviews and approves/rejects
│
▼
Dashboard now shows "Artisan Dashboard" menu item
Profile public page now shows artisan sections (services, portfolio, reviews, "Book"/"Pay" buttons)
```

### 5.2 Multi-Profile Handling

- A user can have multiple profiles. The artisan flag is attached to a **specific profile** via the `Artisan` model's `profileId`.
- A user may have artisan enabled on more than one profile (e.g., one for photography, one for tutoring).
- The registration flow asks "Which profile do you want to make an artisan?" if the user has multiple profiles.
- Alternatively, the user can create a **new profile** specifically for their artisan work during onboarding.

---

## 6. Data Models (Prisma)

### 6.1 New Models for connect-nest

```prisma
// ─── Artisan Enums ────────────────────────────────────────

enum ArtisanStatus {
  PENDING_REVIEW   // Awaiting admin approval (when manual review enabled)
  ACTIVE           // Listed in directory, can receive bookings & payments
  SUSPENDED        // Temporarily disabled by admin
  DEACTIVATED      // Self-deactivated by user
}

enum BookingStatus {
  PENDING          // Customer submitted, artisan hasn't responded
  CONFIRMED        // Artisan accepted
  IN_PROGRESS      // Service is being delivered
  COMPLETED        // Service finished, payment settled
  CANCELLED        // Cancelled by either party
  NO_SHOW          // Customer didn't show up
}

enum PromotionType {
  SPONSORED        // Top carousel placement in directory
  BOOST            // Temporary search ranking boost (24-48 hrs)
}

enum PromotionStatus {
  ACTIVE
  EXPIRED
  CANCELLED
}

// ─── Artisan Core ─────────────────────────────────────────

model Artisan {
  id               String            @id @default(uuid())
  profile          Profile           @relation(fields: [profileId], references: [id], onDelete: Cascade)
  profileId        String            @unique
  userId           String            // Denormalized from profile for fast queries

  // Artisan-specific fields
  bio              String?           // Artisan pitch (separate from profile.description)
  status           ArtisanStatus     @default(PENDING_REVIEW)
  customCategory   String?           // Free-text when "Others" category is selected

  // Verification
  termsAcceptedAt  DateTime?
  activatedAt      DateTime?         // When status changed to ACTIVE
  suspendedReason  String?           // Admin reason for suspension

  // Stats (denormalized for directory performance)
  averageRating    Decimal           @default(0) @db.Decimal(3, 2) // 0.00 - 5.00
  totalReviews     Int               @default(0)
  totalBookings    Int               @default(0)
  totalEarnings    Decimal           @default(0) @db.Decimal(18, 4) // Lifetime earnings via platform

  // Working hours: JSON array of { day: 0-6, open: "09:00", close: "17:00", isOpen: boolean }
  workingHours     Json?

  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  deletedAt        DateTime?

  // Relations
  categories       ArtisanCategoryMap[]
  services         ArtisanService[]
  portfolio        PortfolioItem[]
  bookings         Booking[]
  reviews          Review[]
  promotions       Promotion[]

  @@index([userId])
  @@index([status])
  @@index([averageRating])
  @@index([createdAt])
}

// ─── Categories ───────────────────────────────────────────

model ArtisanCategory {
  id          String               @id @default(uuid())
  name        String               @unique
  slug        String               @unique  // URL-safe: "beauty-grooming"
  icon        String?              // Emoji or icon identifier
  description String?
  order       Int                  @default(0) // Display order in UI
  isActive    Boolean              @default(true)
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  artisans    ArtisanCategoryMap[]

  @@index([slug])
  @@index([isActive, order])
}

// Many-to-many: an artisan can have 1–3 categories
model ArtisanCategoryMap {
  id         String          @id @default(uuid())
  artisan    Artisan         @relation(fields: [artisanId], references: [id], onDelete: Cascade)
  artisanId  String
  category   ArtisanCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  categoryId String
  isPrimary  Boolean         @default(false) // First selected category

  @@unique([artisanId, categoryId])
  @@index([categoryId])
}

// ─── Services ─────────────────────────────────────────────

model ArtisanService {
  id          String    @id @default(uuid())
  artisan     Artisan   @relation(fields: [artisanId], references: [id], onDelete: Cascade)
  artisanId   String
  name        String
  description String?
  price       Decimal   @db.Decimal(18, 4)
  currency    String    @default("NGN")
  duration    Int?      // Duration in minutes (optional)
  isActive    Boolean   @default(true)
  order       Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  bookings    Booking[]

  @@index([artisanId])
  @@index([isActive])
}

// ─── Portfolio ────────────────────────────────────────────

model PortfolioItem {
  id          String    @id @default(uuid())
  artisan     Artisan   @relation(fields: [artisanId], references: [id], onDelete: Cascade)
  artisanId   String
  type        String    @default("image") // "image" | "video" | "link"
  url         String    // DO Spaces URL or external link
  thumbnail   String?   // For videos — auto-generated or uploaded
  caption     String?
  order       Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  @@index([artisanId])
}

// ─── Bookings ─────────────────────────────────────────────

model Booking {
  id               String        @id @default(uuid())
  artisan          Artisan       @relation(fields: [artisanId], references: [id], onDelete: Cascade)
  artisanId        String
  service          ArtisanService? @relation(fields: [serviceId], references: [id], onDelete: SetNull)
  serviceId        String?
  customerUserId   String        // The user who booked (from JWT)
  customerName     String?       // Snapshot at booking time
  customerPhone    String?

  // Scheduling
  scheduledDate    DateTime
  scheduledTime    String?       // "14:00" — separate from date for flexibility
  duration         Int?          // Minutes, copied from service or custom

  // Pricing
  agreedPrice      Decimal?      @db.Decimal(18, 4)
  currency         String        @default("NGN")

  // Payment tracking
  paymentReference String?       // wallet-nest PaymentIntent reference
  isPaid           Boolean       @default(false)
  paidAt           DateTime?

  status           BookingStatus @default(PENDING)
  note             String?       // Customer note to artisan
  cancellationReason String?

  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  deletedAt        DateTime?

  review           Review?

  @@index([artisanId])
  @@index([customerUserId])
  @@index([status])
  @@index([scheduledDate])
}

// ─── Reviews ──────────────────────────────────────────────

model Review {
  id             String    @id @default(uuid())
  artisan        Artisan   @relation(fields: [artisanId], references: [id], onDelete: Cascade)
  artisanId      String
  booking        Booking?  @relation(fields: [bookingId], references: [id], onDelete: SetNull)
  bookingId      String?   @unique // One review per booking
  reviewerUserId String    // The customer who left the review
  reviewerName   String?   // Snapshot

  rating         Int       // 1–5 stars
  comment        String?

  // Payment verification: review is only allowed if the reviewer
  // has a completed booking OR a completed payment to the artisan
  paymentReference String? // wallet-nest transaction reference that validates eligibility

  isVisible      Boolean   @default(true) // Admin can hide inappropriate reviews
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime?

  @@index([artisanId])
  @@index([reviewerUserId])
  @@index([rating])
}

// ─── Promotions ───────────────────────────────────────────

model Promotion {
  id             String          @id @default(uuid())
  artisan        Artisan         @relation(fields: [artisanId], references: [id], onDelete: Cascade)
  artisanId      String
  type           PromotionType
  status         PromotionStatus @default(ACTIVE)

  // Payment
  amount         Decimal         @db.Decimal(18, 4)
  currency       String          @default("NGN")
  paymentReference String?       // wallet-nest transaction reference

  startsAt       DateTime        @default(now())
  endsAt         DateTime        // When the promotion expires
  metadata       Json?           // Extra config (e.g., boost intensity)

  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  @@index([artisanId])
  @@index([status])
  @@index([type, status])
  @@index([endsAt])
}

// ─── Platform Settings (singleton) ────────────────────────

model PlatformSetting {
  id                    String   @id @default("default")
  artisanAutoApproval   Boolean  @default(true)  // true = auto-list, false = manual review
  artisanCommissionRate Decimal  @default(0.025) @db.Decimal(5, 4) // 2.5% default
  sponsoredPriceDaily   Decimal  @default(500)   @db.Decimal(18, 4) // ₦500/day
  boostPriceDaily       Decimal  @default(200)   @db.Decimal(18, 4) // ₦200/day
  minPortfolioItems     Int      @default(2)
  maxCategories         Int      @default(3)
  updatedAt             DateTime @updatedAt
}
```

### 6.2 Profile Model Changes

Add the `artisan` relation to the existing `Profile` model:

```prisma
model Profile {
  // ... existing fields ...

  // New relation
  artisan          Artisan?
}
```

### 6.3 NotificationType Enum Additions

```prisma
enum NotificationType {
  // ... existing values ...
  ARTISAN_ACTIVATED
  ARTISAN_SUSPENDED
  BOOKING_RECEIVED
  BOOKING_CONFIRMED
  BOOKING_CANCELLED
  BOOKING_COMPLETED
  REVIEW_RECEIVED
  PROMOTION_STARTED
  PROMOTION_EXPIRED
}
```

---

## 7. API Endpoints — connect-nest

### 7.1 Artisan Module

All endpoints under `/api/artisan`. Authenticated via global `AuthGuard` unless noted.

#### Registration & Management

| Method  | Path                     | Description                                                       | Auth |
| ------- | ------------------------ | ----------------------------------------------------------------- | ---- |
| `GET`   | `/artisan/requirements`  | Check requirements status for current user's profile              | JWT  |
| `POST`  | `/artisan/register`      | Register as artisan (categories, services, portfolio, bio, terms) | JWT  |
| `GET`   | `/artisan/me`            | Get current user's artisan profile (by profileId query param)     | JWT  |
| `PATCH` | `/artisan/me`            | Update artisan profile (bio, working hours)                       | JWT  |
| `PATCH` | `/artisan/me/deactivate` | Self-deactivate artisan listing                                   | JWT  |
| `PATCH` | `/artisan/me/reactivate` | Re-activate after self-deactivation                               | JWT  |

#### Services CRUD

| Method   | Path                    | Description             | Auth |
| -------- | ----------------------- | ----------------------- | ---- |
| `GET`    | `/artisan/services`     | List artisan's services | JWT  |
| `POST`   | `/artisan/services`     | Create a new service    | JWT  |
| `PATCH`  | `/artisan/services/:id` | Update a service        | JWT  |
| `DELETE` | `/artisan/services/:id` | Soft delete a service   | JWT  |

#### Portfolio CRUD

| Method   | Path                     | Description           | Auth |
| -------- | ------------------------ | --------------------- | ---- |
| `GET`    | `/artisan/portfolio`     | List portfolio items  | JWT  |
| `POST`   | `/artisan/portfolio`     | Add portfolio item(s) | JWT  |
| `PATCH`  | `/artisan/portfolio/:id` | Update caption/order  | JWT  |
| `DELETE` | `/artisan/portfolio/:id` | Remove portfolio item | JWT  |

#### Categories

| Method  | Path                     | Description                                | Auth             |
| ------- | ------------------------ | ------------------------------------------ | ---------------- |
| `GET`   | `/artisan/categories`    | List all active categories                 | Public (no auth) |
| `PATCH` | `/artisan/me/categories` | Update artisan's category selections (1–3) | JWT              |

#### Bookings

| Method  | Path                             | Description                                    | Auth |
| ------- | -------------------------------- | ---------------------------------------------- | ---- |
| `GET`   | `/artisan/bookings`              | List artisan's bookings (filterable by status) | JWT  |
| `GET`   | `/artisan/bookings/:id`          | Get booking detail                             | JWT  |
| `PATCH` | `/artisan/bookings/:id/confirm`  | Confirm a pending booking                      | JWT  |
| `PATCH` | `/artisan/bookings/:id/start`    | Mark as in-progress                            | JWT  |
| `PATCH` | `/artisan/bookings/:id/complete` | Mark as completed                              | JWT  |
| `PATCH` | `/artisan/bookings/:id/cancel`   | Cancel a booking                               | JWT  |

#### Customer-Facing Booking

| Method  | Path                              | Description                        | Auth |
| ------- | --------------------------------- | ---------------------------------- | ---- |
| `POST`  | `/artisan/:artisanId/book`        | Create a booking as a customer     | JWT  |
| `GET`   | `/artisan/my-bookings`            | List bookings I made as a customer | JWT  |
| `PATCH` | `/artisan/my-bookings/:id/cancel` | Cancel my booking                  | JWT  |

#### Reviews

| Method | Path                          | Description                                             | Auth   |
| ------ | ----------------------------- | ------------------------------------------------------- | ------ |
| `POST` | `/artisan/:artisanId/reviews` | Submit a review (requires completed payment or booking) | JWT    |
| `GET`  | `/artisan/:artisanId/reviews` | List reviews for an artisan                             | Public |

#### Promotions

| Method   | Path                      | Description                               | Auth |
| -------- | ------------------------- | ----------------------------------------- | ---- |
| `GET`    | `/artisan/promotions`     | List my active/past promotions            | JWT  |
| `POST`   | `/artisan/promotions`     | Purchase a promotion (sponsored or boost) | JWT  |
| `DELETE` | `/artisan/promotions/:id` | Cancel an active promotion                | JWT  |

#### Earnings / Analytics

| Method | Path                 | Description                                              | Auth |
| ------ | -------------------- | -------------------------------------------------------- | ---- |
| `GET`  | `/artisan/earnings`  | Earnings summary (total, this month, pending)            | JWT  |
| `GET`  | `/artisan/analytics` | Profile views, directory impressions, booking conversion | JWT  |

### 7.2 Directory Module (Public)

Public endpoints for the artisan directory. No auth required.

| Method | Path                            | Description                            | Auth   |
| ------ | ------------------------------- | -------------------------------------- | ------ |
| `GET`  | `/directory/artisans`           | Paginated artisan listing with filters | Public |
| `GET`  | `/directory/artisans/:slug`     | Single artisan by profile slug         | Public |
| `GET`  | `/directory/artisans/featured`  | Featured/top-rated artisans            | Public |
| `GET`  | `/directory/artisans/sponsored` | Sponsored artisans (active promotions) | Public |
| `GET`  | `/directory/categories`         | List categories with artisan counts    | Public |
| `GET`  | `/directory/categories/:slug`   | Artisans in a specific category        | Public |

#### Directory Filters & Sorting

`GET /directory/artisans` accepts:

| Query Param | Type   | Description                                             |
| ----------- | ------ | ------------------------------------------------------- |
| `page`      | int    | Page number (default 1)                                 |
| `limit`     | int    | Items per page (default 20, max 50)                     |
| `category`  | string | Category slug filter                                    |
| `location`  | string | Location text search                                    |
| `search`    | string | Full-text search on name, bio, services, customCategory |
| `minRating` | number | Minimum average rating (1–5)                            |
| `sortBy`    | enum   | `rating`, `newest`, `bookings`, `name`                  |
| `sortOrder` | enum   | `asc`, `desc`                                           |

### 7.3 Admin Endpoints

| Method   | Path                            | Description                          | Auth  |
| -------- | ------------------------------- | ------------------------------------ | ----- |
| `GET`    | `/admin/artisans`               | List all artisans with status filter | Admin |
| `PATCH`  | `/admin/artisans/:id/approve`   | Approve a pending artisan            | Admin |
| `PATCH`  | `/admin/artisans/:id/suspend`   | Suspend an artisan (with reason)     | Admin |
| `PATCH`  | `/admin/artisans/:id/unsuspend` | Remove suspension                    | Admin |
| `GET`    | `/admin/platform-settings`      | Get platform settings                | Admin |
| `PATCH`  | `/admin/platform-settings`      | Update platform settings             | Admin |
| `POST`   | `/admin/categories`             | Create a new category                | Admin |
| `PATCH`  | `/admin/categories/:id`         | Update a category                    | Admin |
| `DELETE` | `/admin/categories/:id`         | Deactivate a category                | Admin |

---

## 8. Artisan Dashboard (connect-web)

### 8.1 New Routes

| Route                           | Page                   | Description                                   |
| ------------------------------- | ---------------------- | --------------------------------------------- |
| `/connect/artisan/setup`        | Artisan onboarding     | Multi-step registration wizard                |
| `/connect/artisan`              | Artisan dashboard home | Overview: earnings, bookings, reviews summary |
| `/connect/artisan/services`     | Services manager       | CRUD for services                             |
| `/connect/artisan/portfolio`    | Portfolio manager      | Upload/manage portfolio items                 |
| `/connect/artisan/bookings`     | Bookings list          | View/manage incoming bookings                 |
| `/connect/artisan/bookings/:id` | Booking detail         | Single booking with actions                   |
| `/connect/artisan/earnings`     | Earnings dashboard     | Revenue breakdown, history                    |
| `/connect/artisan/reviews`      | Reviews list           | View all customer reviews                     |
| `/connect/artisan/promote`      | Promotion purchase     | Buy sponsored listing or boost                |
| `/connect/artisan/settings`     | Artisan settings       | Categories, working hours, bio, deactivate    |

### 8.2 Dashboard Home Overview Card

A new `ArtisanCard` component on the main dashboard (`/dashboard`):

- **If not an artisan:** Shows a CTA card — "Become an Artisan — Get discovered, get booked, get paid" with a "Get Started" button → `/connect/artisan/setup`
- **If artisan (active):** Shows a summary card — today's bookings, this month's earnings, average rating, "Manage" button → `/connect/artisan`
- **If artisan (pending):** Shows "Your artisan profile is under review" with status indicator

### 8.3 Dashboard Components

```
components/
├── cardholder/
│   └── artisan/
│       ├── artisan-cta-card.tsx          # "Become an Artisan" CTA for dashboard
│       ├── artisan-summary-card.tsx       # Active artisan stats for dashboard
│       ├── artisan-setup-wizard.tsx       # Multi-step registration
│       ├── requirements-checklist.tsx     # Step 1: requirement checks
│       ├── category-selector.tsx         # Step 2: category picker
│       ├── service-form.tsx              # Step 3: add services
│       ├── portfolio-uploader.tsx        # Step 4: upload portfolio
│       ├── working-hours-form.tsx        # Step 5: set hours
│       ├── artisan-terms.tsx             # Step 6: accept terms
│       ├── services-manager.tsx          # Services CRUD page
│       ├── portfolio-manager.tsx         # Portfolio management page
│       ├── bookings-list.tsx             # Bookings list with filters
│       ├── booking-detail.tsx            # Single booking view
│       ├── earnings-dashboard.tsx        # Revenue charts/stats
│       ├── reviews-list.tsx              # Reviews list
│       ├── promotion-purchase.tsx        # Buy promotions
│       └── artisan-settings.tsx          # Artisan-specific settings
```

---

## 9. Public Artisan Directory

### 9.1 URL Structure

| URL                                              | Page                                                                    |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| `isce.app/artisans`                              | Directory home — search, categories, featured, sponsored                |
| `isce.app/artisans?category=beauty-grooming`     | Category-filtered listing                                               |
| `isce.app/artisans?search=barber&location=Lagos` | Search + location filter                                                |
| `isce.app/p/{slug}`                              | Artisan's full profile (existing route, enhanced with artisan sections) |

### 9.2 Directory Page Layout

```
┌──────────────────────────────────────────────────────────────┐
│  NAVBAR (shared with main site)                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  HERO: "Find Skilled Artisans Near You"                      │
│  [ Search artisans... ] [ Location ▼ ] [ Category ▼ ] [🔍]  │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  SPONSORED ARTISANS (if any active promotions)               │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐               │
│  │Sponsor │ │Sponsor │ │Sponsor │ │Sponsor │  ← Carousel    │
│  │Card    │ │Card    │ │Card    │ │Card    │               │
│  └────────┘ └────────┘ └────────┘ └────────┘               │
│  "Sponsored" badge on each card                              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  CATEGORIES (horizontal scrollable chips or grid)            │
│  [All] [Beauty] [Fashion] [Photography] [Food] [Home] ...   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  TOP RATED (featured section — top 6 by rating)              │
│  ┌────────┐ ┌────────┐ ┌────────┐                           │
│  │ Photo  │ │ Photo  │ │ Photo  │  ← Horizontal scroll     │
│  │ Name   │ │ Name   │ │ Name   │                           │
│  │ ★ 4.9  │ │ ★ 4.8  │ │ ★ 4.8  │                           │
│  │ Barber │ │ Tailor │ │ Photo  │                           │
│  │ Lagos  │ │ Abuja  │ │ Lagos  │                           │
│  └────────┘ └────────┘ └────────┘                           │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ALL ARTISANS (grid, paginated)                              │
│  Sort: [Top Rated ▼] [Newest] [Most Booked] [Name]          │
│                                                              │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐               │
│  │ Photo  │ │ Photo  │ │ Photo  │ │ Photo  │               │
│  │ Name ✓ │ │ Name   │ │ Name ✓ │ │ Name   │               │
│  │ ★ 4.7  │ │ ★ 4.5  │ │ ★ 4.9  │ │ ★ 4.2  │               │
│  │ Cat    │ │ Cat    │ │ Cat    │ │ Cat    │               │
│  │ City   │ │ City   │ │ City   │ │ City   │               │
│  │ [View] │ │ [View] │ │ [View] │ │ [View] │               │
│  └────────┘ └────────┘ └────────┘ └────────┘               │
│                                                              │
│  [Load More] or infinite scroll                              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  FOOTER (shared with main site)                              │
└──────────────────────────────────────────────────────────────┘
```

### 9.3 Artisan Directory Card (Component)

Each card in the directory grid shows:

| Element                | Source                                                             |
| ---------------------- | ------------------------------------------------------------------ |
| Profile photo          | `profile.profilePhoto`                                             |
| Name                   | `profile.name`                                                     |
| Verified badge ✓       | Shown if artisan is active (has met all requirements + wallet KYC) |
| Primary category       | `artisanCategoryMap` where `isPrimary = true`                      |
| Average rating & count | `artisan.averageRating` (★ 4.8) + `artisan.totalReviews`           |
| Location               | `profile.location`                                                 |
| "Sponsored" badge      | Shown if artisan has active `SPONSORED` promotion                  |
| Starting price         | Lowest `artisanService.price` — "From ₦5,000"                      |
| "View Profile" button  | Links to `/p/{slug}`                                               |

### 9.4 Enhanced Public Profile (Artisan Sections)

When a profile has an active artisan record, the existing public profile page (`/p/{slug}`) gains additional sections:

| Section           | Content                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| **Artisan Badge** | "Verified Artisan" badge near the name, with category chips             |
| **Services**      | Card list of available services with prices — "Book Now" button on each |
| **Portfolio**     | Image/video gallery with lightbox                                       |
| **Reviews**       | Recent reviews with rating stars, reviewer name (anonymizable), comment |
| **Working Hours** | "Available: Mon–Fri, 9am–5pm" indicator                                 |
| **Book / Pay**    | Primary CTA buttons: "Book a Service" and "Pay" (wallet-based)          |

---

## 10. Artisan Payment Flow

### 10.1 Key Principle

Normal users can still accept payments via their wallet (if enabled). The artisan payment flow adds **structured, trackable payments** tied to services and bookings, with **platform commission**.

### 10.2 Payment Flows

#### Flow A — Direct Payment (from artisan's public profile)

1. Customer visits `/p/{slug}` → clicks "Pay for Service"
2. Selects a service or enters a custom amount
3. connect-web calls connect-nest proxy → wallet-nest `POST /api/payment-intents`
   - `type: INSTANT`
   - `receiverUserId: artisan's userId`
   - `amount: service price`
   - `sourceModule: CONNECT`
   - `sourceReference: artisan:{artisanId}:service:{serviceId}`
   - `metadata: { artisanId, serviceId, serviceName, isArtisanPayment: true }`
4. Customer enters wallet PIN → `POST /api/payment-intents/:id/execute`
5. wallet-nest transfers funds, deducts platform commission
6. connect-nest receives webhook/callback → updates artisan earnings stats

#### Flow B — NFC Tap-to-Pay (Mode C — artisan's phone as reader)

1. Customer is at the artisan's physical location
2. Artisan opens their profile on phone → "Receive Payment" → enters amount
3. Initiates Web NFC reader on their phone
4. Customer taps their ISCE card on the artisan's phone
5. NFC resolves card via `GET /api/nfc/resolve?productId={productId}`
6. Creates PaymentIntent with `metadata.isArtisanPayment: true`
7. Customer confirms PIN → payment completes with commission deducted

#### Flow C — Payment Link (share via WhatsApp/SMS)

1. Artisan goes to dashboard → "Generate Payment Link"
2. Creates a PaymentIntent with `status: ACTIVE`, `type: PRE_REGISTERED`
3. Gets a shareable URL: `isce.app/pay/{intentReference}`
4. Customer opens link → sees amount + artisan info → authenticates → pays via wallet
5. Commission deducted automatically

#### Flow D — Booking + Payment

1. Customer books a service via `/p/{slug}` → "Book" button
2. Selects date/time, confirms service + price
3. connect-nest creates `Booking` record with `status: PENDING`
4. Artisan confirms booking → `status: CONFIRMED`
5. Payment can happen at two points:
   - **Upfront (optional):** Customer pays via PaymentIntent, funds held or transferred immediately
   - **After service:** Artisan marks `status: COMPLETED` → customer receives prompt to pay
6. Commission applied on payment execution

### 10.3 Commission Handling

The platform commission is deducted at the wallet-nest level when executing artisan-related PaymentIntents.

**Detection mechanism:** PaymentIntents created with `sourceModule: CONNECT` and `metadata.isArtisanPayment: true` trigger commission deduction.

**Commission flow:**

1. connect-nest creates PaymentIntent with artisan metadata
2. On execution, wallet-nest checks for `isArtisanPayment` flag in metadata
3. If true, deduct `artisanCommissionRate` (from PlatformSetting, default 2.5%)
4. Commission amount goes to a platform wallet (userId configured via env var)
5. Net amount credited to artisan's wallet
6. Both transactions (commission + net) logged in transaction ledger

**wallet-nest changes required:**

- Add commission check in `payment-intent.service.ts` `execute()` method
- Add `PLATFORM_WALLET_USER_ID` env var for commission destination
- Add `COMMISSION` to `TransactionType` enum (or use `FEE`)
- Log commission as a separate `Transaction` with `type: FEE`, `sourceModule: CONNECT`

---

## 11. Reviews & Ratings

### 11.1 Eligibility Rules

A user can leave a review for an artisan **only if**:

1. **They have a completed booking** with `status: COMPLETED` for that artisan, OR
2. **They have a completed payment** (PaymentIntent with `status: EXECUTED` and `metadata.isArtisanPayment: true`) to that artisan

The review endpoint validates this by:

1. Checking for a `Booking` where `customerUserId = reviewerUserId` AND `artisanId = targetArtisanId` AND `status = COMPLETED`
2. OR calling wallet-nest to verify a completed PaymentIntent from the reviewer to the artisan with artisan metadata

### 11.2 Review Constraints

- **One review per booking** (`bookingId` is unique on Review)
- **One review per payment** (checked via `paymentReference` uniqueness)
- **Rating: 1–5 stars** (integer)
- **Comment: optional** but encouraged (minimum 10 chars if provided)
- **Editable within 48 hours** of creation
- **Not deletable by the reviewer** — admin can hide inappropriate reviews

### 11.3 Rating Aggregation

When a review is created or updated:

1. Recalculate `artisan.averageRating` = average of all `review.rating` where `isVisible = true`
2. Update `artisan.totalReviews` = count of visible reviews
3. This is done in-service (not a cron job) for real-time accuracy

---

## 12. Revenue Model

### 12.1 Revenue Streams (V1)

| Stream                | Type            | Default Rate | Mechanic                                                           |
| --------------------- | --------------- | ------------ | ------------------------------------------------------------------ |
| **Commission**        | Per-transaction | 2.5%         | Deducted automatically from artisan PaymentIntents                 |
| **Sponsored Listing** | Time-based      | ₦500/day     | Artisan pays to appear in "Sponsored" carousel at top of directory |
| **Boost**             | Time-based      | ₦200/day     | Temporary increase in search ranking (24-48 hour duration)         |

### 12.2 Commission Details

- Applied only to payments routed through the platform (PaymentIntents with `isArtisanPayment: true`)
- Direct wallet transfers between users (existing feature) are **not** subject to commission
- This incentivises artisans to use the structured payment flow (which also provides bookings, reviews, and analytics)
- Commission rate is configurable via `PlatformSetting.artisanCommissionRate`
- Commission is deducted from the payment amount before crediting the artisan
- Example: Customer pays ₦10,000 → Platform takes ₦250 (2.5%) → Artisan receives ₦9,750

### 12.3 Sponsored Listing

- Artisan purchases a sponsored slot from their dashboard (`/connect/artisan/promote`)
- Creates a `Promotion` record with `type: SPONSORED`
- Payment via wallet-nest PaymentIntent to platform wallet
- Active sponsored artisans appear in the "Sponsored" carousel at the top of the directory
- Multiple artisans can be sponsored simultaneously — shown in random order
- Expired promotions are cleaned up by a cron job

### 12.4 Boost

- Artisan purchases a boost from their dashboard
- Creates a `Promotion` record with `type: BOOST`
- Duration: 24 or 48 hours (selectable)
- Effect: Artisan's profile is prioritized in search results (sorted before non-boosted artisans of similar rating)
- Boost does not affect the sponsored carousel — it only affects the "All Artisans" grid sorting

### 12.5 Revenue Collection

All revenue (commission, sponsored, boost) is collected into a **platform wallet**:

- A wallet-nest wallet owned by a platform system user (configured via `PLATFORM_WALLET_USER_ID` env var)
- All PaymentIntents for promotions use `receiverUserId: PLATFORM_WALLET_USER_ID`
- Commission transfers also target this wallet
- Revenue reporting can be built on top of wallet-nest's transaction ledger filtered by this userId

---

## 13. Admin & Platform Settings

### 13.1 Platform Settings

Managed via `PlatformSetting` singleton. Superadmin changes these.

| Setting                 | Type    | Default | Description                                                            |
| ----------------------- | ------- | ------- | ---------------------------------------------------------------------- |
| `artisanAutoApproval`   | boolean | `true`  | Auto-activate artisans when requirements met, or require manual review |
| `artisanCommissionRate` | decimal | `0.025` | Commission rate on artisan payments (2.5%)                             |
| `sponsoredPriceDaily`   | decimal | `500`   | Cost of sponsored listing per day (₦)                                  |
| `boostPriceDaily`       | decimal | `200`   | Cost of search boost per day (₦)                                       |
| `minPortfolioItems`     | int     | `2`     | Minimum portfolio images required                                      |
| `maxCategories`         | int     | `3`     | Maximum categories per artisan                                         |

### 13.2 Admin Actions

| Action                  | Endpoint                              | Effect                                                             |
| ----------------------- | ------------------------------------- | ------------------------------------------------------------------ |
| **Approve artisan**     | `PATCH /admin/artisans/:id/approve`   | Set status to ACTIVE, triggers notification                        |
| **Suspend artisan**     | `PATCH /admin/artisans/:id/suspend`   | Set status to SUSPENDED, removed from directory, reason stored     |
| **Unsuspend**           | `PATCH /admin/artisans/:id/unsuspend` | Restore to ACTIVE                                                  |
| **Hide review**         | via direct DB or future admin panel   | Set `review.isVisible = false`, recalculate rating                 |
| **Create category**     | `POST /admin/categories`              | Add new artisan category                                           |
| **Update category**     | `PATCH /admin/categories/:id`         | Edit name, icon, order                                             |
| **Deactivate category** | `DELETE /admin/categories/:id`        | Soft-deactivate (existing artisans keep it, new ones can't select) |

---

## 14. Frontend Pages & Routes

### 14.1 New Routes in connect-web

```
// Public (no auth)
/artisans                         → Artisan directory home
/artisans?category={slug}         → Filtered by category
/artisans?search={query}          → Search results

// Protected (auth required)
/connect/artisan/setup            → Artisan onboarding wizard
/connect/artisan                  → Artisan dashboard home
/connect/artisan/services         → Service management
/connect/artisan/portfolio        → Portfolio management
/connect/artisan/bookings         → Booking management
/connect/artisan/bookings/:id     → Booking detail
/connect/artisan/earnings         → Earnings dashboard
/connect/artisan/reviews          → Reviews list
/connect/artisan/promote          → Purchase promotions
/connect/artisan/settings         → Artisan-specific settings

// Existing routes enhanced:
/p/{slug}                         → Enhanced with artisan sections (services, portfolio, reviews, book/pay)
/dashboard                        → New ArtisanCard component (CTA or summary)
```

### 14.2 Updated routes.ts

```typescript
// Add to public routes:
'/artisans',

// Add to protected (cardholder) routes:
'/connect/artisan',
'/connect/artisan/setup',
'/connect/artisan/services',
'/connect/artisan/portfolio',
'/connect/artisan/bookings',
'/connect/artisan/earnings',
'/connect/artisan/reviews',
'/connect/artisan/promote',
'/connect/artisan/settings',
```

### 14.3 Service Layer (lib/services/artisan.ts)

New service file for connect-web API calls:

```typescript
// Key functions:
getRequirements(profileId: string)           // GET /api/artisan/requirements
register(data: ArtisanRegistrationDto)       // POST /api/artisan/register
getArtisanProfile(profileId: string)         // GET /api/artisan/me?profileId=
updateArtisanProfile(data: UpdateArtisanDto) // PATCH /api/artisan/me

// Services
getServices(artisanId: string)               // GET /api/artisan/services
createService(data: CreateServiceDto)        // POST /api/artisan/services
updateService(id: string, data: Object)      // PATCH /api/artisan/services/:id
deleteService(id: string)                    // DELETE /api/artisan/services/:id

// Portfolio
getPortfolio(artisanId: string)              // GET /api/artisan/portfolio
addPortfolioItem(data: FormData)             // POST /api/artisan/portfolio
updatePortfolioItem(id: string, data: Object) // PATCH /api/artisan/portfolio/:id
deletePortfolioItem(id: string)              // DELETE /api/artisan/portfolio/:id

// Bookings
getBookings(filters: BookingFilters)         // GET /api/artisan/bookings
getBookingDetail(id: string)                 // GET /api/artisan/bookings/:id
confirmBooking(id: string)                   // PATCH /api/artisan/bookings/:id/confirm
startBooking(id: string)                     // PATCH /api/artisan/bookings/:id/start
completeBooking(id: string)                  // PATCH /api/artisan/bookings/:id/complete
cancelBooking(id: string, reason: string)    // PATCH /api/artisan/bookings/:id/cancel

// Customer bookings
bookArtisan(artisanId: string, data: Object) // POST /api/artisan/:artisanId/book
getMyBookings(filters: BookingFilters)       // GET /api/artisan/my-bookings

// Reviews
submitReview(artisanId: string, data: Object) // POST /api/artisan/:artisanId/reviews
getReviews(artisanId: string, page: number)   // GET /api/artisan/:artisanId/reviews

// Promotions
getPromotions()                              // GET /api/artisan/promotions
purchasePromotion(data: PromotionDto)        // POST /api/artisan/promotions
cancelPromotion(id: string)                  // DELETE /api/artisan/promotions/:id

// Earnings & Analytics
getEarnings(period: string)                  // GET /api/artisan/earnings
getAnalytics(period: string)                 // GET /api/artisan/analytics

// Directory (public)
getDirectoryArtisans(filters: DirectoryFilters) // GET /api/directory/artisans
getDirectoryCategories()                        // GET /api/directory/categories
getFeaturedArtisans()                           // GET /api/directory/artisans/featured
getSponsoredArtisans()                          // GET /api/directory/artisans/sponsored
```

---

## 15. Cross-Service Integration

### 15.1 connect-nest → wallet-nest

connect-nest already has a `WalletClientService` that makes HTTP calls to wallet-nest. Extend it for artisan flows:

| Call                                    | Purpose                                                  |
| --------------------------------------- | -------------------------------------------------------- |
| `POST /api/payment-intents`             | Create artisan PaymentIntent (proxied from connect-web)  |
| `POST /api/payment-intents/:id/execute` | Execute payment with PIN                                 |
| `GET /api/wallets/user/:userId`         | Check wallet exists + KYC level (for requirements check) |
| `GET /api/nfc/resolve`                  | Resolve NFC device for tap-to-pay                        |

### 15.2 wallet-nest Changes

| Change                  | Description                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Commission logic**    | Add commission deduction in `payment-intent.service.ts` `execute()` when `metadata.isArtisanPayment === true` |
| **Platform wallet env** | Add `PLATFORM_WALLET_USER_ID` to config                                                                       |
| **FEE transaction**     | Commission logged as `TransactionType.FEE` with `sourceModule: CONNECT`                                       |

### 15.3 connect-web → connect-nest Proxy

All wallet-related calls from connect-web go through connect-nest (not directly to wallet-nest). This preserves the existing proxy pattern and keeps wallet-nest's CORS surface minimal.

### 15.4 isce-auth — No Changes

No changes needed to isce-auth for the artisan feature. Device/NFC resolution is already handled by the existing wallet-nest NFC module.

---

## 16. Implementation Plan

### Phase 1 — Backend Core (connect-nest)

| Step              | Task                                                         | Files                                 | Estimated    |
| ----------------- | ------------------------------------------------------------ | ------------------------------------- | ------------ |
| 1.1               | Prisma schema: add all new models + enums + Profile relation | `prisma/schema.prisma`                | 1            |
| 1.2               | Run migration                                                | `prisma/migrations/`                  | 0.5          |
| 1.3               | Seed artisan categories                                      | `prisma/seeds/`                       | 0.5          |
| 1.4               | ArtisanModule: controller, service, DTOs, module             | `src/artisan/` (4 files)              | 3            |
| 1.5               | DirectoryModule: controller, service, DTOs, module           | `src/directory/` (4 files)            | 2            |
| 1.6               | BookingModule: controller, service, DTOs, module             | `src/booking/` (4 files)              | 2            |
| 1.7               | ReviewModule: controller, service, DTOs, module              | `src/review/` (4 files)               | 1.5          |
| 1.8               | PromotionModule: controller, service, DTOs, module           | `src/promotion/` (4 files)            | 1.5          |
| 1.9               | AdminModule: admin endpoints for artisan management          | `src/admin/` (4 files)                | 1            |
| 1.10              | PlatformSettingModule: settings CRUD                         | `src/platform-setting/` (4 files)     | 0.5          |
| 1.11              | Wire all modules into AppModule                              | `src/app.module.ts`                   | 0.5          |
| 1.12              | Extend WalletClientService for artisan payment proxying      | `src/wallet/wallet-client.service.ts` | 1            |
| 1.13              | Cron job: expire promotions                                  | `src/promotion/promotion.service.ts`  | 0.5          |
| **Total Phase 1** |                                                              | **~32 files**                         | **~15 days** |

### Phase 2 — wallet-nest Commission

| Step              | Task                                          | Files                                          | Estimated     |
| ----------------- | --------------------------------------------- | ---------------------------------------------- | ------------- |
| 2.1               | Add commission check in PaymentIntent execute | `src/payment-intent/payment-intent.service.ts` | 0.5           |
| 2.2               | Add `PLATFORM_WALLET_USER_ID` env var         | `utils/constants.ts`, `.env`                   | 0.5           |
| 2.3               | Log commission as FEE transaction             | `src/payment-intent/payment-intent.service.ts` | 0.5           |
| **Total Phase 2** |                                               | **~2 files**                                   | **~1.5 days** |

### Phase 3 — Frontend (connect-web)

| Step              | Task                                       | Files         | Estimated      |
| ----------------- | ------------------------------------------ | ------------- | -------------- |
| 3.1               | Service layer: `lib/services/artisan.ts`   | 1             | 1              |
| 3.2               | Artisan CTA card on dashboard              | 1             | 0.5            |
| 3.3               | Artisan onboarding wizard (6 steps)        | 8             | 3              |
| 3.4               | Artisan dashboard home                     | 2             | 1              |
| 3.5               | Services manager page                      | 2             | 1              |
| 3.6               | Portfolio manager page                     | 2             | 1              |
| 3.7               | Bookings list + detail pages               | 3             | 1.5            |
| 3.8               | Earnings dashboard                         | 2             | 1              |
| 3.9               | Reviews page                               | 2             | 0.5            |
| 3.10              | Promotion purchase page                    | 2             | 1              |
| 3.11              | Artisan settings page                      | 2             | 0.5            |
| 3.12              | Public directory page (`/artisans`)        | 4             | 2              |
| 3.13              | Enhanced public profile (artisan sections) | 3             | 1.5            |
| 3.14              | Customer booking flow on public profile    | 2             | 1              |
| 3.15              | Customer review submission                 | 1             | 0.5            |
| 3.16              | Update `routes.ts` with new routes         | 1             | 0.5            |
| **Total Phase 3** |                                            | **~37 files** | **~16.5 days** |

### Phase 4 — Integration & Testing

| Step              | Task                                                      | Estimated   |
| ----------------- | --------------------------------------------------------- | ----------- |
| 4.1               | End-to-end artisan registration flow                      | 1           |
| 4.2               | Payment flow testing (direct, NFC, payment link, booking) | 1           |
| 4.3               | Directory search/filter testing                           | 0.5         |
| 4.4               | Commission verification                                   | 0.5         |
| 4.5               | Review eligibility testing                                | 0.5         |
| 4.6               | Promotion lifecycle testing                               | 0.5         |
| **Total Phase 4** |                                                           | **~4 days** |

### Total Estimated Timeline: ~37 days

---

## 17. Open Questions

| #   | Question                                                                                                 | Default / Proposed Answer                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | Should there be a maximum number of services an artisan can list?                                        | No limit in V1                                                                                                    |
| 2   | Should portfolio items support videos from external platforms (YouTube, TikTok)?                         | Yes — `type: "video"` with external URL + thumbnail                                                               |
| 3   | Should customers be able to request a custom quote (beyond listed services)?                             | V2 — add "Request Quote" flow later                                                                               |
| 4   | Should the directory support geolocation-based "Near Me" sorting?                                        | V2 — requires `address` field migration to store lat/lng on Profile                                               |
| 5   | Refund policy for bookings cancelled after payment?                                                      | Full refund if cancelled 24+ hours before scheduled time; 50% within 24 hours; no refund for no-shows by customer |
| 6   | Should artisans be able to set their own commission rate (e.g., absorb it vs pass to customer)?          | V1: platform rate only. V2: artisan can choose to absorb or add to price                                          |
| 7   | Should there be a "verified" vs "premium verified" tier visible in the directory?                        | V1: single verified badge (met all requirements). V2: premium badge for paid subscribers                          |
| 8   | How should duplicate/similar artisan profiles be handled?                                                | Admin review — flag system in V2                                                                                  |
| 9   | Should the payment link feature (`isce.app/pay/{ref}`) be artisan-only or available to all wallet users? | Available to all wallet users — artisans just get it surfaced more prominently in their dashboard                 |
| 10  | Mobile app considerations — will there be a native app for artisans?                                     | Out of scope for V1. Progressive web app (PWA) optimizations for mobile web                                       |

---

## Appendix A — Artisan Card Component Spec

```typescript
interface ArtisanDirectoryCard {
  id: string;
  profileSlug: string;
  profilePhoto: string | null;
  name: string;
  location: string | null;
  primaryCategory: {
    name: string;
    slug: string;
    icon: string | null;
  };
  averageRating: number; // 0.00 - 5.00
  totalReviews: number;
  startingPrice: number | null; // Lowest service price
  currency: string;
  isSponsored: boolean; // Has active SPONSORED promotion
  isBoosted: boolean; // Has active BOOST promotion
}
```

## Appendix B — Directory API Response Shape

```typescript
interface DirectoryResponse {
  artisans: ArtisanDirectoryCard[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    category: string | null;
    location: string | null;
    search: string | null;
    minRating: number | null;
  };
}
```

## Appendix C — Artisan Registration DTO

```typescript
class RegisterArtisanDto {
  @IsUUID()
  profileId: string; // Which profile to upgrade

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsUUID('4', { each: true })
  categoryIds: string[]; // 1-3 category IDs

  @IsOptional()
  @IsString()
  customCategory?: string; // Required if "Others" category selected

  @IsOptional()
  @IsString()
  @MinLength(20)
  bio?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  services: CreateServiceDto[]; // At least 1 service

  // Portfolio items uploaded separately via /artisan/portfolio

  @IsOptional()
  workingHours?: WorkingHoursDto[];

  @IsBoolean()
  termsAccepted: boolean; // Must be true
}
```
