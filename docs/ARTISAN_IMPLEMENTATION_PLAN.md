# Artisan Feature — Implementation Plan

> **Tracking Document** — Updated as implementation progresses
> **Source:** `docs/ARTISAN_FEATURE_DOCUMENTATION.md`
> **Scope:** connect-nest (backend) → wallet-nest (commission) → connect-web (frontend, later)

---

## Phase 1 — Prisma Schema & Migration

| #    | Task                                                                                     | Status | Files                                |
| ---- | ---------------------------------------------------------------------------------------- | ------ | ------------------------------------ |
| 1.1  | Add artisan enums (`ArtisanStatus`, `BookingStatus`, `PromotionType`, `PromotionStatus`) | ✅     | `prisma/schema.prisma`               |
| 1.2  | Add new `NotificationType` values (8 artisan-related)                                    | ✅     | `prisma/schema.prisma`               |
| 1.3  | Add `Artisan` model with indexes                                                         | ✅     | `prisma/schema.prisma`               |
| 1.4  | Add `ArtisanCategory` model                                                              | ✅     | `prisma/schema.prisma`               |
| 1.5  | Add `ArtisanCategoryMap` model (M2M)                                                     | ✅     | `prisma/schema.prisma`               |
| 1.6  | Add `ArtisanService` model                                                               | ✅     | `prisma/schema.prisma`               |
| 1.7  | Add `PortfolioItem` model                                                                | ✅     | `prisma/schema.prisma`               |
| 1.8  | Add `Booking` model with indexes                                                         | ✅     | `prisma/schema.prisma`               |
| 1.9  | Add `Review` model with indexes                                                          | ✅     | `prisma/schema.prisma`               |
| 1.10 | Add `Promotion` model with indexes                                                       | ✅     | `prisma/schema.prisma`               |
| 1.11 | Add `PlatformSetting` singleton model                                                    | ✅     | `prisma/schema.prisma`               |
| 1.12 | Add `artisan Artisan?` relation to `Profile` model                                       | ✅     | `prisma/schema.prisma`               |
| 1.13 | Run `npx prisma generate`                                                                | ✅     | `src/generated/prisma/`              |
| 1.14 | Seed 13 artisan categories                                                               | ✅     | `scripts/seed-artisan-categories.ts` |

## Phase 2 — Backend Modules (connect-nest)

| #    | Task                                                                                                                                 | Status | Files                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ | ------ | ----------------------------------- |
| 2.1  | **ArtisanModule** — module, controller, service, DTOs (consolidated: includes directory, reviews, promotions, admin, settings)       | ✅     | `src/artisan/` (4 files)            |
| 2.1a | ↳ DTOs: 17 DTO classes (Register, Update, Services, Portfolio, Bookings, Reviews, Promotions, Directory, Admin, Settings)            | ✅     | `src/artisan/dto/artisan.dto.ts`    |
| 2.1b | ↳ Controllers: `ArtisanController` + `DirectoryController` (public) + `ArtisanAdminController` — ~50 endpoints total                 | ✅     | `src/artisan/artisan.controller.ts` |
| 2.1c | ↳ Service: all business logic — registration, requirements, CRUD, bookings, reviews, ratings, promotions, directory, admin, settings | ✅     | `src/artisan/artisan.service.ts`    |
| 2.2  | ~~DirectoryModule~~ — merged into ArtisanModule (`DirectoryController`)                                                              | ✅     | `src/artisan/artisan.controller.ts` |
| 2.3  | ~~ReviewModule~~ — merged into ArtisanModule (review methods in service + endpoints in controller)                                   | ✅     | `src/artisan/artisan.service.ts`    |
| 2.4  | ~~PromotionModule~~ — merged into ArtisanModule (promotion methods in service + endpoints in controller)                             | ✅     | `src/artisan/artisan.service.ts`    |
| 2.5  | ~~AdminModule~~ — merged into ArtisanModule (`ArtisanAdminController`)                                                               | ✅     | `src/artisan/artisan.controller.ts` |
| 2.6  | ~~PlatformSettingModule~~ — merged into ArtisanModule (settings endpoints in admin controller)                                       | ✅     | `src/artisan/artisan.service.ts`    |
| 2.7  | Extend `WalletClientService` — artisan payment proxy methods                                                                         | ✅     | `src/auth/wallet-client.service.ts` |
| 2.8  | Wire ArtisanModule into `AppModule`                                                                                                  | ✅     | `src/app.module.ts`                 |
| 2.9  | Build & verify (`yarn build`)                                                                                                        | ✅     | — (clean build, 0 errors)           |

## Phase 3 — wallet-nest Commission (later)

| #   | Task                                              | Status | Files                                          |
| --- | ------------------------------------------------- | ------ | ---------------------------------------------- |
| 3.1 | Add commission check in PaymentIntent `execute()` | ✅     | `src/payment-intent/payment-intent.service.ts` |
| 3.2 | Add `PLATFORM_WALLET_USER_ID` env var             | ✅     | `utils/constants.ts`                           |
| 3.3 | Log commission as FEE transaction                 | ✅     | `src/payment-intent/payment-intent.service.ts` |

## Phase 4 — Frontend (connect-web) — deferred

Not tracked here. Will be its own plan after backend is complete.

---

## Progress Log

| Date       | Completed                             | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-20 | 1.1–1.14, 2.1–2.1c, 2.2–2.6, 2.8, 2.9 | Schema complete (9 models, 4 enums). ArtisanModule built as single consolidated module with 3 controllers, ~50 endpoints, 17 DTOs. Directory, Review, Promotion, Admin, PlatformSetting merged into ArtisanModule. Wired into AppModule. Clean build.                                                                                                                                                                                                                                                    |
| 2026-02-21 | Build fixes, 2.7                      | Fixed 15 TS errors (Profile field name mismatches, Booking schema additions). Regenerated Prisma client. Extended WalletClientService with 7 artisan proxy methods (KYC check, create/execute/cancel/get PaymentIntent, NFC resolve, payment verification). Clean build verified.                                                                                                                                                                                                                        |
| 2026-02-21 | 3.1–3.3                               | **Phase 3 complete.** Added `PLATFORM_WALLET_USER_ID` + `DEFAULT_ARTISAN_COMMISSION_RATE` constants. Modified `executeTransfer()` to detect artisan payments (`sourceModule=CONNECT` + `metadata.isArtisanPayment=true`), calculate commission (default 2.5%, overridable via metadata), split payment between artisan (net) and platform wallet (commission), and log a FEE transaction with full audit metadata. All 4 call sites updated to pass `sourceModule` and `metadata`. Clean build verified. |
