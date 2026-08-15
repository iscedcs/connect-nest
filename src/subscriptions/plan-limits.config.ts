export interface PlanLimits {
  id: string;
  name: string;
  priceMonthly: number;
  profiles: number;
  tapsPerDay: number;
  socialLinks: number;
  videos: number;
  files: number;
  storageBytes: number;
  meetingLinks: number;
  customForms: number;
  analyticsHistoryDays: number;
  contactExport: boolean;
  removeIsceBranding: boolean;
  themeCustomization: 'none' | 'basic' | 'full';
  moduleReordering: boolean;
  spotifyItems: number;
  cryptoWallets: number;
  serviceCategories: number;
  artisanDirectoryEligible: boolean;
  publiclySearchable: boolean;
  verifiedBadge: boolean;
  prioritySupport: boolean;
  priorityRanking: boolean;
}

export const PLAN_LIMITS: Record<'FREE' | 'PRO_LITE' | 'PRO_PLUS', PlanLimits> = {
  FREE: {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    profiles: 1,
    tapsPerDay: 20,
    socialLinks: 3,
    videos: 1,
    files: 2,
    storageBytes: 10 * 1024 * 1024, // 10MB
    meetingLinks: 1,
    customForms: 0,
    analyticsHistoryDays: 3,
    contactExport: false,
    removeIsceBranding: false,
    themeCustomization: 'none',
    moduleReordering: false,
    spotifyItems: 0,
    cryptoWallets: 0,
    serviceCategories: 0,
    artisanDirectoryEligible: false,
    publiclySearchable: false,
    verifiedBadge: false,
    prioritySupport: false,
    priorityRanking: false,
  },

  PRO_LITE: {
    id: 'pro_lite',
    name: 'Pro Lite',
    priceMonthly: 1000,
    profiles: 2,
    tapsPerDay: Infinity,
    socialLinks: 5,
    videos: 5,
    files: 10,
    storageBytes: 50 * 1024 * 1024, // 50MB
    meetingLinks: Infinity,
    customForms: 1,
    analyticsHistoryDays: 15,
    contactExport: true,
    removeIsceBranding: true,
    themeCustomization: 'basic',
    moduleReordering: false,
    spotifyItems: 3,
    cryptoWallets: 1,
    serviceCategories: 3,
    artisanDirectoryEligible: true,
    publiclySearchable: true,
    verifiedBadge: false,
    prioritySupport: false,
    priorityRanking: false,
  },

  PRO_PLUS: {
    id: 'pro_plus',
    name: 'Pro Plus',
    priceMonthly: 1500,
    profiles: 5,
    tapsPerDay: Infinity,
    socialLinks: Infinity,
    videos: Infinity,
    files: Infinity,
    storageBytes: Infinity,
    meetingLinks: Infinity,
    customForms: Infinity,
    analyticsHistoryDays: Infinity,
    contactExport: true,
    removeIsceBranding: true,
    themeCustomization: 'full',
    moduleReordering: true,
    spotifyItems: Infinity,
    cryptoWallets: Infinity,
    serviceCategories: 5,
    artisanDirectoryEligible: true,
    publiclySearchable: true,
    verifiedBadge: true,
    prioritySupport: true,
    priorityRanking: true,
  },
};

export type PlanKey = keyof typeof PLAN_LIMITS;

export const UNLIMITED_PLAN_LIMITS: PlanLimits = {
  id: 'unlimited',
  name: 'Unlimited Preview',
  priceMonthly: 0,
  profiles: Infinity,
  tapsPerDay: Infinity,
  socialLinks: Infinity,
  videos: Infinity,
  files: Infinity,
  storageBytes: Infinity,
  meetingLinks: Infinity,
  customForms: Infinity,
  analyticsHistoryDays: Infinity,
  contactExport: true,
  removeIsceBranding: true,
  themeCustomization: 'full',
  moduleReordering: true,
  spotifyItems: Infinity,
  cryptoWallets: Infinity,
  serviceCategories: Infinity,
  artisanDirectoryEligible: true,
  publiclySearchable: true,
  verifiedBadge: true,
  prioritySupport: true,
  priorityRanking: true,
};

