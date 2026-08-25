-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CARD_INTERACTION', 'CONTACT_SHARED', 'WALLET_UPDATE', 'WALLET_FUNDED', 'WALLET_TRANSFER', 'CONTACT_SAVED', 'MEETING_REQUEST', 'APPOINTMENT_BOOKED', 'ARTISAN_ACTIVATED', 'ARTISAN_SUSPENDED', 'BOOKING_RECEIVED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_COMPLETED', 'REVIEW_RECEIVED', 'PROMOTION_STARTED', 'PROMOTION_EXPIRED', 'THREAD_NEW_INQUIRY', 'THREAD_NEW_MESSAGE', 'THREAD_PROPOSAL_RECEIVED', 'THREAD_PROPOSAL_ACCEPTED', 'THREAD_PROPOSAL_DECLINED', 'PAYMENT_SENT_CONFIRMED', 'PAYMENT_RECEIVED_CONFIRMED', 'PAYMENT_DISPUTED', 'SUBSCRIPTION_TRIAL_EXPIRED', 'SUBSCRIPTION_ACTIVATED', 'SUBSCRIPTION_CANCELLED', 'SUBSCRIPTION_PAST_DUE', 'SUBSCRIPTION_LAUNCH_ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ScanType" AS ENUM ('TAP', 'SCAN');

-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "ArtisanStatus" AS ENUM ('PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('SPONSORED', 'BOOST');

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ThreadStatus" AS ENUM ('OPEN', 'PROPOSAL_SENT', 'BOOKED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ThreadMessageType" AS ENUM ('TEXT', 'PROPOSAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SenderRole" AS ENUM ('CLIENT', 'ARTISAN');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('WALLET', 'OFFLINE', 'NONE');

-- CreateEnum
CREATE TYPE "PaymentTiming" AS ENUM ('UPFRONT', 'ON_COMPLETION');

-- CreateEnum
CREATE TYPE "PaymentDisputedBy" AS ENUM ('CLIENT', 'ARTISAN');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO_LITE', 'PRO_PLUS');

-- CreateEnum
CREATE TYPE "CpOrgStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CpWorkspaceStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CpMemberStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "CpRole" AS ENUM ('CREATOR', 'WORKSPACE_ADMIN', 'STAFF', 'CLIENT', 'VISITOR');

-- CreateEnum
CREATE TYPE "CpLeadSource" AS ENUM ('CARD_TAP', 'QR_SCAN', 'MANUAL', 'FORM_SUBMIT');

-- CreateEnum
CREATE TYPE "CpLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'VALIDATED', 'REJECTED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "CpAppointmentType" AS ENUM ('PUBLIC', 'CLIENT');

-- CreateEnum
CREATE TYPE "CpAppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "CpConversationType" AS ENUM ('WORKSPACE_GROUP', 'DIRECT', 'CLIENT_STAFF');

-- CreateEnum
CREATE TYPE "CpSenderRole" AS ENUM ('STAFF', 'CLIENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CpParticipantRole" AS ENUM ('MEMBER', 'ADMIN');

-- CreateEnum
CREATE TYPE "CpInvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CpCardStatus" AS ENUM ('UNASSIGNED', 'ACTIVE', 'SUSPENDED', 'LOST');

-- CreateEnum
CREATE TYPE "CpNotificationType" AS ENUM ('APPOINTMENT_BOOKED', 'APPOINTMENT_CONFIRMED', 'APPOINTMENT_REMINDER', 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_CANCELLED', 'LEAD_ASSIGNED', 'LEAD_VALIDATED', 'NEW_LEAD', 'CLIENT_INVITED', 'CLIENT_MESSAGE', 'INVOICE_ISSUED', 'INVOICE_OVERDUE', 'INVOICE_PAID', 'INVOICE_CANCELLED', 'ATTENDANCE_LATE', 'ATTENDANCE_OVERRIDE', 'WORKSPACE_INVITE_SENT', 'WORKSPACE_INVITE_ACCEPTED', 'STAFF_SUSPENDED', 'STAFF_REMOVED', 'WORKSPACE_CREATED', 'WORKSPACE_SUSPENDED', 'ORG_ALERT', 'NEW_MESSAGE', 'JOB_INVITATION');

-- CreateEnum
CREATE TYPE "CpAuditSource" AS ENUM ('WEB', 'MOBILE', 'API', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CpSubscriptionPlan" AS ENUM ('FREE', 'STARTER', 'GROWTH', 'BUSINESS');

-- CreateEnum
CREATE TYPE "CpSubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE', 'ONE_TIME_GIG', 'FIXED_TERM');

-- CreateEnum
CREATE TYPE "WorkModel" AS ENUM ('REMOTE', 'ON_SITE', 'HYBRID');

-- CreateEnum
CREATE TYPE "HealthIncidentStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "HealthDependency" AS ENUM ('POSTGRES');

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT,
    "profilePhoto" TEXT,
    "coverPhoto" TEXT,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "description" TEXT,
    "location" TEXT,
    "address" JSONB,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Social" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "label" TEXT,
    "value" TEXT NOT NULL,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Social_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "contactProfileId" TEXT,
    "status" "ContactStatus" NOT NULL DEFAULT 'PENDING',
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardInteraction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "method" "ScanType" NOT NULL,
    "deviceType" TEXT,
    "referrer" TEXT,
    "workspaceId" TEXT,
    "workspaceMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CardInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileContact" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "label" TEXT,
    "phone_number" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProfileContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Link" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "image" TEXT,
    "order" INTEGER,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail" TEXT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingLink" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MeetingLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentLink" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AppointmentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpotifyItem" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "external_url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SpotifyItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileItem" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "spaces_url" TEXT NOT NULL,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FileItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "form_type" TEXT NOT NULL,
    "template_id" TEXT,
    "status" "FormStatus" NOT NULL DEFAULT 'DRAFT',
    "fields" JSONB NOT NULL,
    "form_url" TEXT,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "preview_fields" JSONB NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "ens" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectConfig" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "modules" JSONB NOT NULL,
    "theme" JSONB,
    "branding" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceProfile" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "fcmToken" TEXT,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artisan" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "status" "ArtisanStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "customCategory" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "canReceiveWalletPayments" BOOLEAN NOT NULL DEFAULT false,
    "averageRating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "totalBookings" INTEGER NOT NULL DEFAULT 0,
    "totalEarnings" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "workingHours" JSONB,
    "openToWork" BOOLEAN NOT NULL DEFAULT true,
    "desiredJobTypes" "JobType"[],
    "desiredWorkModels" "WorkModel"[],
    "skills" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Artisan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtisanCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtisanCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtisanCategoryMap" (
    "id" TEXT NOT NULL,
    "artisanId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ArtisanCategoryMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtisanService" (
    "id" TEXT NOT NULL,
    "artisanId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(18,4),
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "duration" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ArtisanService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioItem" (
    "id" TEXT NOT NULL,
    "artisanId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'image',
    "url" TEXT NOT NULL,
    "thumbnail" TEXT,
    "caption" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PortfolioItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingThread" (
    "id" TEXT NOT NULL,
    "artisanId" TEXT NOT NULL,
    "serviceId" TEXT,
    "clientUserId" TEXT NOT NULL,
    "clientProfileId" TEXT,
    "clientName" TEXT,
    "clientPhone" TEXT,
    "status" "ThreadStatus" NOT NULL DEFAULT 'OPEN',
    "bookingId" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreadMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "senderRole" "SenderRole" NOT NULL,
    "type" "ThreadMessageType" NOT NULL DEFAULT 'TEXT',
    "content" TEXT NOT NULL,
    "proposalData" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThreadMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "artisanId" TEXT NOT NULL,
    "serviceId" TEXT,
    "customerUserId" TEXT NOT NULL,
    "customerProfileId" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "scheduledDate" TIMESTAMP(3),
    "scheduledTime" TEXT,
    "duration" INTEGER,
    "agreedPrice" DECIMAL(18,4),
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "commissionAmount" DECIMAL(18,4),
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'WALLET',
    "paymentTiming" "PaymentTiming" NOT NULL DEFAULT 'ON_COMPLETION',
    "paymentReference" TEXT,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "clientPaymentConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "clientPaymentConfirmedAt" TIMESTAMP(3),
    "artisanPaymentConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "artisanPaymentConfirmedAt" TIMESTAMP(3),
    "paymentDisputed" BOOLEAN NOT NULL DEFAULT false,
    "paymentDisputeReason" TEXT,
    "paymentDisputedAt" TIMESTAMP(3),
    "paymentDisputedBy" "PaymentDisputedBy",
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "cancelledBy" TEXT,
    "cancellationReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "artisanId" TEXT NOT NULL,
    "bookingId" TEXT,
    "reviewerUserId" TEXT NOT NULL,
    "reviewerName" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "paymentReference" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "artisanId" TEXT NOT NULL,
    "type" "PromotionType" NOT NULL,
    "status" "PromotionStatus" NOT NULL DEFAULT 'ACTIVE',
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "paymentReference" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "artisanAutoApproval" BOOLEAN NOT NULL DEFAULT true,
    "artisanCommissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.025,
    "sponsoredPriceDaily" DECIMAL(18,4) NOT NULL DEFAULT 500,
    "boostPriceDaily" DECIMAL(18,4) NOT NULL DEFAULT 200,
    "minPortfolioItems" INTEGER NOT NULL DEFAULT 2,
    "maxCategories" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "key" "PlanTier" NOT NULL,
    "name" TEXT NOT NULL,
    "priceMonthly" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "limits" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "trialStartDate" TIMESTAMP(3),
    "trialEndDate" TIMESTAMP(3),
    "trialUsed" BOOLEAN NOT NULL DEFAULT false,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "gatewayCustomerId" TEXT,
    "gatewaySubId" TEXT,
    "notifiedLaunch" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" TEXT NOT NULL,
    "gatewayRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpOrganization" (
    "id" TEXT NOT NULL,
    "creatorAuthId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "CpOrgStatus" NOT NULL DEFAULT 'ACTIVE',
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CpOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "plan" "CpSubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "status" "CpSubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "trialStartsAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "trialUsed" BOOLEAN NOT NULL DEFAULT false,
    "targetPlan" "CpSubscriptionPlan",
    "paystackSubCode" TEXT,
    "paystackCustomerCode" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CpSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpPlan" (
    "id" TEXT NOT NULL,
    "key" "CpSubscriptionPlan" NOT NULL,
    "name" TEXT NOT NULL,
    "priceMonthly" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "limits" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CpPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpWorkspace" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "CpWorkspaceStatus" NOT NULL DEFAULT 'ACTIVE',
    "suspendedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CpWorkspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpWorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "authUserId" TEXT,
    "role" "CpRole" NOT NULL,
    "status" "CpMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "invitedBy" TEXT,
    "joinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CpWorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpCompanyProfile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "coverImage" TEXT,
    "description" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address" JSONB,
    "businessHours" JSONB,
    "branding" JSONB,
    "appointmentDefaults" JSONB,
    "invoiceDefaults" JSONB,
    "notificationPrefs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CpCompanyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpWorkspaceInvite" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "CpRole" NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CpWorkspaceInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpStaffProfile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "photo" TEXT,
    "jobTitle" TEXT,
    "department" TEXT,
    "staffNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CpStaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpConnectCard" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "staffId" TEXT,
    "deviceId" TEXT,
    "cardCode" TEXT NOT NULL,
    "status" "CpCardStatus" NOT NULL DEFAULT 'UNASSIGNED',
    "tapConfig" JSONB,
    "pairedBy" TEXT,
    "pairedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CpConnectCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpLead" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "source" "CpLeadSource" NOT NULL DEFAULT 'MANUAL',
    "status" "CpLeadStatus" NOT NULL DEFAULT 'NEW',
    "assignedStaffId" TEXT,
    "notes" TEXT,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CpLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpClient" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "memberId" TEXT,
    "leadId" TEXT,
    "assignedStaffId" TEXT,
    "authUserId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CpClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpAppointment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "CpAppointmentType" NOT NULL DEFAULT 'PUBLIC',
    "leadId" TEXT,
    "clientId" TEXT,
    "staffId" TEXT,
    "title" TEXT NOT NULL,
    "reason" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "status" "CpAppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CpAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpAttendance" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3),
    "hoursWorked" DECIMAL(5,2),
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "isOvertime" BOOLEAN NOT NULL DEFAULT false,
    "locationData" JSONB,
    "notes" TEXT,
    "overriddenBy" TEXT,
    "overriddenAt" TIMESTAMP(3),
    "overrideReason" TEXT,
    "autoCheckedOut" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CpAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpConversation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "CpConversationType" NOT NULL,
    "name" TEXT,
    "clientId" TEXT,
    "isAutoCreated" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CpConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "role" "CpParticipantRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "CpConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderRole" "CpSenderRole" NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" JSONB,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CpMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpInvoice" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdByStaffId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "status" "CpInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "totalAmount" DECIMAL(18,4) NOT NULL,
    "taxAmount" DECIMAL(18,4),
    "discountAmount" DECIMAL(18,4),
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "sentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "overdueAt" TIMESTAMP(3),
    "paidVia" TEXT,
    "externalRef" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CpInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpInvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "total" DECIMAL(18,4) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CpInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpNotification" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "organizationId" TEXT,
    "recipientAuthId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "CpNotificationType" NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CpNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpAuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "workspaceId" TEXT,
    "actorId" TEXT,
    "actorRole" TEXT,
    "isSystemEvent" BOOLEAN NOT NULL DEFAULT false,
    "eventType" TEXT NOT NULL,
    "targetEntity" TEXT NOT NULL,
    "targetEntityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "source" "CpAuditSource" NOT NULL DEFAULT 'API',
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "hash" TEXT,
    "previousHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CpAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpJobPost" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "jobType" "JobType" NOT NULL,
    "workModel" "WorkModel" NOT NULL,
    "requiredSkills" TEXT[],
    "minBudget" DECIMAL(18,4),
    "maxBudget" DECIMAL(18,4),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CpJobPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpJobApplication" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "artisanId" TEXT NOT NULL,
    "coverLetter" TEXT,
    "resumeUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CpJobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpSavedTalent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "artisanId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CpSavedTalent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthIncident" (
    "id" TEXT NOT NULL,
    "dependency" "HealthDependency" NOT NULL,
    "status" "HealthIncidentStatus" NOT NULL DEFAULT 'OPEN',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "lastAlertAt" TIMESTAMP(3),
    "alertCount" INTEGER NOT NULL DEFAULT 0,
    "notifiedEmails" TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "personalSubscriptionsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "connectPlusSubscriptionsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "bypassMode" TEXT NOT NULL DEFAULT 'OPEN_ACCESS',
    "maintenanceReason" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_slug_key" ON "Profile"("slug");

-- CreateIndex
CREATE INDEX "Profile_userId_idx" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "Contact_ownerId_idx" ON "Contact"("ownerId");

-- CreateIndex
CREATE INDEX "Contact_contactProfileId_idx" ON "Contact"("contactProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectConfig_profileId_key" ON "ConnectConfig"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceProfile_deviceId_key" ON "DeviceProfile"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceProfile_profileId_idx" ON "DeviceProfile"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "Artisan_profileId_key" ON "Artisan"("profileId");

-- CreateIndex
CREATE INDEX "Artisan_userId_idx" ON "Artisan"("userId");

-- CreateIndex
CREATE INDEX "Artisan_status_idx" ON "Artisan"("status");

-- CreateIndex
CREATE INDEX "Artisan_averageRating_idx" ON "Artisan"("averageRating");

-- CreateIndex
CREATE INDEX "Artisan_createdAt_idx" ON "Artisan"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArtisanCategory_name_key" ON "ArtisanCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ArtisanCategory_slug_key" ON "ArtisanCategory"("slug");

-- CreateIndex
CREATE INDEX "ArtisanCategory_slug_idx" ON "ArtisanCategory"("slug");

-- CreateIndex
CREATE INDEX "ArtisanCategory_isActive_order_idx" ON "ArtisanCategory"("isActive", "order");

-- CreateIndex
CREATE INDEX "ArtisanCategoryMap_categoryId_idx" ON "ArtisanCategoryMap"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ArtisanCategoryMap_artisanId_categoryId_key" ON "ArtisanCategoryMap"("artisanId", "categoryId");

-- CreateIndex
CREATE INDEX "ArtisanService_artisanId_idx" ON "ArtisanService"("artisanId");

-- CreateIndex
CREATE INDEX "ArtisanService_isActive_idx" ON "ArtisanService"("isActive");

-- CreateIndex
CREATE INDEX "PortfolioItem_artisanId_idx" ON "PortfolioItem"("artisanId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingThread_bookingId_key" ON "BookingThread"("bookingId");

-- CreateIndex
CREATE INDEX "BookingThread_artisanId_idx" ON "BookingThread"("artisanId");

-- CreateIndex
CREATE INDEX "BookingThread_clientUserId_idx" ON "BookingThread"("clientUserId");

-- CreateIndex
CREATE INDEX "BookingThread_status_idx" ON "BookingThread"("status");

-- CreateIndex
CREATE INDEX "BookingThread_lastMessageAt_idx" ON "BookingThread"("lastMessageAt");

-- CreateIndex
CREATE INDEX "ThreadMessage_threadId_idx" ON "ThreadMessage"("threadId");

-- CreateIndex
CREATE INDEX "ThreadMessage_senderUserId_idx" ON "ThreadMessage"("senderUserId");

-- CreateIndex
CREATE INDEX "ThreadMessage_createdAt_idx" ON "ThreadMessage"("createdAt");

-- CreateIndex
CREATE INDEX "Booking_artisanId_idx" ON "Booking"("artisanId");

-- CreateIndex
CREATE INDEX "Booking_customerUserId_idx" ON "Booking"("customerUserId");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_scheduledDate_idx" ON "Booking"("scheduledDate");

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_key" ON "Review"("bookingId");

-- CreateIndex
CREATE INDEX "Review_artisanId_idx" ON "Review"("artisanId");

-- CreateIndex
CREATE INDEX "Review_reviewerUserId_idx" ON "Review"("reviewerUserId");

-- CreateIndex
CREATE INDEX "Review_rating_idx" ON "Review"("rating");

-- CreateIndex
CREATE INDEX "Promotion_artisanId_idx" ON "Promotion"("artisanId");

-- CreateIndex
CREATE INDEX "Promotion_status_idx" ON "Promotion"("status");

-- CreateIndex
CREATE INDEX "Promotion_type_status_idx" ON "Promotion"("type", "status");

-- CreateIndex
CREATE INDEX "Promotion_endsAt_idx" ON "Promotion"("endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_key_key" ON "Plan"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_trialEndDate_idx" ON "Subscription"("trialEndDate");

-- CreateIndex
CREATE INDEX "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");

-- CreateIndex
CREATE INDEX "PaymentRecord_subscriptionId_idx" ON "PaymentRecord"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "CpOrganization_slug_key" ON "CpOrganization"("slug");

-- CreateIndex
CREATE INDEX "CpOrganization_creatorAuthId_idx" ON "CpOrganization"("creatorAuthId");

-- CreateIndex
CREATE UNIQUE INDEX "CpSubscription_organizationId_key" ON "CpSubscription"("organizationId");

-- CreateIndex
CREATE INDEX "CpSubscription_organizationId_idx" ON "CpSubscription"("organizationId");

-- CreateIndex
CREATE INDEX "CpSubscription_status_idx" ON "CpSubscription"("status");

-- CreateIndex
CREATE INDEX "CpSubscription_trialEndsAt_idx" ON "CpSubscription"("trialEndsAt");

-- CreateIndex
CREATE UNIQUE INDEX "CpPlan_key_key" ON "CpPlan"("key");

-- CreateIndex
CREATE UNIQUE INDEX "CpWorkspace_slug_key" ON "CpWorkspace"("slug");

-- CreateIndex
CREATE INDEX "CpWorkspace_organizationId_idx" ON "CpWorkspace"("organizationId");

-- CreateIndex
CREATE INDEX "CpWorkspace_slug_idx" ON "CpWorkspace"("slug");

-- CreateIndex
CREATE INDEX "CpWorkspaceMember_authUserId_idx" ON "CpWorkspaceMember"("authUserId");

-- CreateIndex
CREATE INDEX "CpWorkspaceMember_workspaceId_role_idx" ON "CpWorkspaceMember"("workspaceId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "CpWorkspaceMember_workspaceId_authUserId_key" ON "CpWorkspaceMember"("workspaceId", "authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CpCompanyProfile_workspaceId_key" ON "CpCompanyProfile"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CpWorkspaceInvite_token_key" ON "CpWorkspaceInvite"("token");

-- CreateIndex
CREATE INDEX "CpWorkspaceInvite_workspaceId_idx" ON "CpWorkspaceInvite"("workspaceId");

-- CreateIndex
CREATE INDEX "CpWorkspaceInvite_email_idx" ON "CpWorkspaceInvite"("email");

-- CreateIndex
CREATE INDEX "CpWorkspaceInvite_token_idx" ON "CpWorkspaceInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "CpStaffProfile_memberId_key" ON "CpStaffProfile"("memberId");

-- CreateIndex
CREATE INDEX "CpStaffProfile_workspaceId_idx" ON "CpStaffProfile"("workspaceId");

-- CreateIndex
CREATE INDEX "CpStaffProfile_authUserId_idx" ON "CpStaffProfile"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CpConnectCard_staffId_key" ON "CpConnectCard"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "CpConnectCard_cardCode_key" ON "CpConnectCard"("cardCode");

-- CreateIndex
CREATE INDEX "CpConnectCard_workspaceId_idx" ON "CpConnectCard"("workspaceId");

-- CreateIndex
CREATE INDEX "CpLead_workspaceId_idx" ON "CpLead"("workspaceId");

-- CreateIndex
CREATE INDEX "CpLead_status_idx" ON "CpLead"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CpClient_memberId_key" ON "CpClient"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "CpClient_leadId_key" ON "CpClient"("leadId");

-- CreateIndex
CREATE INDEX "CpClient_workspaceId_idx" ON "CpClient"("workspaceId");

-- CreateIndex
CREATE INDEX "CpClient_assignedStaffId_idx" ON "CpClient"("assignedStaffId");

-- CreateIndex
CREATE INDEX "CpClient_authUserId_idx" ON "CpClient"("authUserId");

-- CreateIndex
CREATE INDEX "CpAppointment_workspaceId_idx" ON "CpAppointment"("workspaceId");

-- CreateIndex
CREATE INDEX "CpAppointment_staffId_idx" ON "CpAppointment"("staffId");

-- CreateIndex
CREATE INDEX "CpAppointment_scheduledAt_idx" ON "CpAppointment"("scheduledAt");

-- CreateIndex
CREATE INDEX "CpAttendance_workspaceId_idx" ON "CpAttendance"("workspaceId");

-- CreateIndex
CREATE INDEX "CpAttendance_staffId_idx" ON "CpAttendance"("staffId");

-- CreateIndex
CREATE INDEX "CpAttendance_checkIn_idx" ON "CpAttendance"("checkIn");

-- CreateIndex
CREATE UNIQUE INDEX "CpAttendance_staffId_date_key" ON "CpAttendance"("staffId", "date");

-- CreateIndex
CREATE INDEX "CpConversation_workspaceId_idx" ON "CpConversation"("workspaceId");

-- CreateIndex
CREATE INDEX "CpConversationParticipant_authUserId_idx" ON "CpConversationParticipant"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CpConversationParticipant_conversationId_authUserId_key" ON "CpConversationParticipant"("conversationId", "authUserId");

-- CreateIndex
CREATE INDEX "CpMessage_conversationId_idx" ON "CpMessage"("conversationId");

-- CreateIndex
CREATE INDEX "CpMessage_createdAt_idx" ON "CpMessage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CpInvoice_invoiceNumber_key" ON "CpInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "CpInvoice_workspaceId_idx" ON "CpInvoice"("workspaceId");

-- CreateIndex
CREATE INDEX "CpInvoice_clientId_idx" ON "CpInvoice"("clientId");

-- CreateIndex
CREATE INDEX "CpInvoice_status_idx" ON "CpInvoice"("status");

-- CreateIndex
CREATE INDEX "CpNotification_recipientAuthId_isRead_idx" ON "CpNotification"("recipientAuthId", "isRead");

-- CreateIndex
CREATE INDEX "CpAuditLog_workspaceId_idx" ON "CpAuditLog"("workspaceId");

-- CreateIndex
CREATE INDEX "CpAuditLog_actorId_idx" ON "CpAuditLog"("actorId");

-- CreateIndex
CREATE INDEX "CpAuditLog_eventType_idx" ON "CpAuditLog"("eventType");

-- CreateIndex
CREATE INDEX "CpAuditLog_createdAt_idx" ON "CpAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "CpJobPost_workspaceId_idx" ON "CpJobPost"("workspaceId");

-- CreateIndex
CREATE INDEX "CpJobApplication_jobId_idx" ON "CpJobApplication"("jobId");

-- CreateIndex
CREATE INDEX "CpJobApplication_artisanId_idx" ON "CpJobApplication"("artisanId");

-- CreateIndex
CREATE INDEX "CpSavedTalent_workspaceId_idx" ON "CpSavedTalent"("workspaceId");

-- CreateIndex
CREATE INDEX "CpSavedTalent_artisanId_idx" ON "CpSavedTalent"("artisanId");

-- CreateIndex
CREATE UNIQUE INDEX "CpSavedTalent_workspaceId_artisanId_key" ON "CpSavedTalent"("workspaceId", "artisanId");

-- CreateIndex
CREATE INDEX "HealthIncident_dependency_status_idx" ON "HealthIncident"("dependency", "status");

-- CreateIndex
CREATE INDEX "HealthIncident_status_idx" ON "HealthIncident"("status");

-- AddForeignKey
ALTER TABLE "Social" ADD CONSTRAINT "Social_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_contactProfileId_fkey" FOREIGN KEY ("contactProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardInteraction" ADD CONSTRAINT "CardInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileContact" ADD CONSTRAINT "ProfileContact_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingLink" ADD CONSTRAINT "MeetingLink_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentLink" ADD CONSTRAINT "AppointmentLink_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpotifyItem" ADD CONSTRAINT "SpotifyItem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileItem" ADD CONSTRAINT "FileItem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectConfig" ADD CONSTRAINT "ConnectConfig_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceProfile" ADD CONSTRAINT "DeviceProfile_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artisan" ADD CONSTRAINT "Artisan_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtisanCategoryMap" ADD CONSTRAINT "ArtisanCategoryMap_artisanId_fkey" FOREIGN KEY ("artisanId") REFERENCES "Artisan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtisanCategoryMap" ADD CONSTRAINT "ArtisanCategoryMap_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ArtisanCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtisanService" ADD CONSTRAINT "ArtisanService_artisanId_fkey" FOREIGN KEY ("artisanId") REFERENCES "Artisan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_artisanId_fkey" FOREIGN KEY ("artisanId") REFERENCES "Artisan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingThread" ADD CONSTRAINT "BookingThread_artisanId_fkey" FOREIGN KEY ("artisanId") REFERENCES "Artisan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingThread" ADD CONSTRAINT "BookingThread_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ArtisanService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingThread" ADD CONSTRAINT "BookingThread_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadMessage" ADD CONSTRAINT "ThreadMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "BookingThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_artisanId_fkey" FOREIGN KEY ("artisanId") REFERENCES "Artisan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ArtisanService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_artisanId_fkey" FOREIGN KEY ("artisanId") REFERENCES "Artisan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_artisanId_fkey" FOREIGN KEY ("artisanId") REFERENCES "Artisan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpSubscription" ADD CONSTRAINT "CpSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "CpOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpWorkspace" ADD CONSTRAINT "CpWorkspace_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "CpOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpWorkspaceMember" ADD CONSTRAINT "CpWorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "CpWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpCompanyProfile" ADD CONSTRAINT "CpCompanyProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "CpWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpWorkspaceInvite" ADD CONSTRAINT "CpWorkspaceInvite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "CpWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpWorkspaceInvite" ADD CONSTRAINT "CpWorkspaceInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "CpWorkspaceMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpStaffProfile" ADD CONSTRAINT "CpStaffProfile_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CpWorkspaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpConnectCard" ADD CONSTRAINT "CpConnectCard_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "CpWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpConnectCard" ADD CONSTRAINT "CpConnectCard_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "CpStaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpLead" ADD CONSTRAINT "CpLead_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "CpWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpClient" ADD CONSTRAINT "CpClient_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "CpWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpClient" ADD CONSTRAINT "CpClient_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CpWorkspaceMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpClient" ADD CONSTRAINT "CpClient_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CpLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpClient" ADD CONSTRAINT "CpClient_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "CpStaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpAppointment" ADD CONSTRAINT "CpAppointment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "CpWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpAppointment" ADD CONSTRAINT "CpAppointment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CpLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpAppointment" ADD CONSTRAINT "CpAppointment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CpClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpAppointment" ADD CONSTRAINT "CpAppointment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "CpStaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpAttendance" ADD CONSTRAINT "CpAttendance_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "CpWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpAttendance" ADD CONSTRAINT "CpAttendance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "CpStaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpConversation" ADD CONSTRAINT "CpConversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "CpWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpConversation" ADD CONSTRAINT "CpConversation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CpClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpConversationParticipant" ADD CONSTRAINT "CpConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CpConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpMessage" ADD CONSTRAINT "CpMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CpConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpInvoice" ADD CONSTRAINT "CpInvoice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "CpWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpInvoice" ADD CONSTRAINT "CpInvoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CpClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpInvoice" ADD CONSTRAINT "CpInvoice_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "CpStaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpInvoiceItem" ADD CONSTRAINT "CpInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CpInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpNotification" ADD CONSTRAINT "CpNotification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "CpWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpAuditLog" ADD CONSTRAINT "CpAuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "CpWorkspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpAuditLog" ADD CONSTRAINT "CpAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "CpOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpJobPost" ADD CONSTRAINT "CpJobPost_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "CpWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpJobApplication" ADD CONSTRAINT "CpJobApplication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CpJobPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpJobApplication" ADD CONSTRAINT "CpJobApplication_artisanId_fkey" FOREIGN KEY ("artisanId") REFERENCES "Artisan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpSavedTalent" ADD CONSTRAINT "CpSavedTalent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "CpWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpSavedTalent" ADD CONSTRAINT "CpSavedTalent_artisanId_fkey" FOREIGN KEY ("artisanId") REFERENCES "Artisan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
