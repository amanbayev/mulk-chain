import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const portalInvestors = pgTable("portal_investors", {
  wallet: text("wallet").primaryKey(),
  investorId: text("investor_id").notNull(),
  onchainId: text("onchain_id").notNull(),
  iban: text("iban").notNull(),
  whtBps: text("wht_bps").notNull().default("0"),
  email: text("email"),
  country: text("country").notNull().default("KZ"),
  provider: text("provider").notNull().default("SUMSUB"),
  applicantId: text("applicant_id").notNull(),
  onboardingUrl: text("onboarding_url").notNull(),
  status: text("status").notNull().default("PENDING_KYC"),
  displayName: text("display_name"),
  investorKind: text("investor_kind").notNull().default("INDIVIDUAL"),
  investorClass: text("investor_class").notNull().default("RETAIL"),
  kybStatus: text("kyb_status").notNull().default("NOT_REQUIRED"),
  bin: text("bin"),
  legalName: text("legal_name"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  reviewStatus: text("review_status").notNull().default("SUBMITTED"),
  applicationId: text("application_id"),
  reviewNotes: text("review_notes"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewerWallet: text("reviewer_wallet"),
  onchainConfirmed: text("onchain_confirmed").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const kycApplications = pgTable("kyc_applications", {
  id: text("id").primaryKey(),
  wallet: text("wallet").notNull(),
  reviewStatus: text("review_status").notNull().default("SUBMITTED"),
  notes: text("notes"),
  reviewerWallet: text("reviewer_wallet"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reviewEvents = pgTable("review_events", {
  id: text("id").primaryKey(),
  applicationId: text("application_id").notNull(),
  action: text("action").notNull(),
  reviewerWallet: text("reviewer_wallet"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const portalSubscriptions = pgTable("portal_subscriptions", {
  id: text("id").primaryKey(),
  wallet: text("wallet").notNull(),
  assetId: text("asset_id").notNull(),
  amount: text("amount").notNull(),
  status: text("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
