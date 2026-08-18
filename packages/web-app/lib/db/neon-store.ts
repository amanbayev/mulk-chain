import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { fail } from "@/lib/api/errors";
import { buildInvestorProfile, newApplication } from "@/lib/api/identity";
import type {
  AdminStats,
  ApplicationReviewStatus,
  CreateSubscriptionBody,
  DecideApplicationBody,
  InvestorKind,
  InvestorProfile,
  InvestorClass,
  KycApplication,
  KycStatus,
  KybStatus,
  RegisterInvestorBody,
  ReviewEvent,
  SubscriptionRequest,
} from "@/lib/api/types";
import { kycApplications, portalInvestors, portalSubscriptions, reviewEvents } from "@/lib/db/schema";
import { PORTAL_SCHEMA_SQL } from "@/lib/db/sql";

type Db = NeonHttpDatabase;

let schemaReady = false;

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export async function getDb(): Promise<Db> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) fail(500, "NO_DATABASE", "DATABASE_URL is not set");
  const client = neon(url);
  const db = drizzle(client);
  if (!schemaReady) {
    for (const statement of PORTAL_SCHEMA_SQL.split(";").map((part) => part.trim()).filter(Boolean)) {
      await db.execute(sql.raw(statement));
    }
    schemaReady = true;
  }
  return db;
}

function iso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

function rowToProfile(row: typeof portalInvestors.$inferSelect): InvestorProfile {
  return {
    investorId: row.investorId,
    wallet: row.wallet,
    onchainId: row.onchainId,
    iban: row.iban,
    whtBps: row.whtBps,
    email: row.email ?? undefined,
    country: row.country,
    provider: row.provider,
    applicantId: row.applicantId,
    onboardingUrl: row.onboardingUrl,
    status: row.status as KycStatus,
    displayName: row.displayName ?? undefined,
    investorKind: row.investorKind as InvestorKind,
    investorClass: row.investorClass as InvestorClass,
    kybStatus: row.kybStatus as KybStatus,
    bin: row.bin ?? undefined,
    legalName: row.legalName ?? undefined,
    submittedAt: iso(row.submittedAt),
    reviewStatus: row.reviewStatus as ApplicationReviewStatus,
    applicationId: row.applicationId ?? undefined,
    reviewNotes: row.reviewNotes ?? undefined,
    reviewedAt: iso(row.reviewedAt),
    reviewerWallet: row.reviewerWallet ?? undefined,
    onchainConfirmed: row.onchainConfirmed === "true",
  };
}

async function eventsFor(db: Db, applicationId: string): Promise<ReviewEvent[]> {
  const rows = await db.select().from(reviewEvents).where(eq(reviewEvents.applicationId, applicationId)).orderBy(desc(reviewEvents.createdAt));
  return rows.map((row) => ({
    id: row.id,
    applicationId: row.applicationId,
    action: row.action as ReviewEvent["action"],
    reviewerWallet: row.reviewerWallet ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
  }));
}

async function toApplication(db: Db, row: typeof kycApplications.$inferSelect, profile?: InvestorProfile | null): Promise<KycApplication> {
  return {
    id: row.id,
    wallet: row.wallet,
    reviewStatus: row.reviewStatus as ApplicationReviewStatus,
    notes: row.notes ?? undefined,
    reviewerWallet: row.reviewerWallet ?? undefined,
    reviewedAt: iso(row.reviewedAt),
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
    profile: profile ?? (await findProfile(row.wallet)) ?? ({ wallet: row.wallet, investorId: row.wallet.toLowerCase() } as InvestorProfile),
    events: await eventsFor(db, row.id),
  };
}

export async function findProfile(wallet: string): Promise<InvestorProfile | null> {
  const db = await getDb();
  const key = wallet.toLowerCase();
  const rows = await db.select().from(portalInvestors).where(eq(portalInvestors.investorId, key)).limit(1);
  return rows[0] ? rowToProfile(rows[0]) : null;
}

async function upsertProfile(profile: InvestorProfile): Promise<void> {
  const db = await getDb();
  const values = {
    wallet: profile.wallet.toLowerCase(),
    investorId: profile.investorId,
    onchainId: profile.onchainId,
    iban: profile.iban,
    whtBps: profile.whtBps,
    email: profile.email,
    country: profile.country,
    provider: profile.provider,
    applicantId: profile.applicantId,
    onboardingUrl: profile.onboardingUrl,
    status: profile.status,
    displayName: profile.displayName,
    investorKind: profile.investorKind ?? "INDIVIDUAL",
    investorClass: profile.investorClass ?? "RETAIL",
    kybStatus: profile.kybStatus ?? "NOT_REQUIRED",
    bin: profile.bin,
    legalName: profile.legalName,
    submittedAt: profile.submittedAt ? new Date(profile.submittedAt) : new Date(),
    reviewStatus: profile.reviewStatus ?? "SUBMITTED",
    applicationId: profile.applicationId,
    reviewNotes: profile.reviewNotes,
    reviewedAt: profile.reviewedAt ? new Date(profile.reviewedAt) : null,
    reviewerWallet: profile.reviewerWallet,
    onchainConfirmed: profile.onchainConfirmed ? "true" : "false",
  };
  await db.insert(portalInvestors).values(values).onConflictDoUpdate({
    target: portalInvestors.wallet,
    set: values,
  });
}

export async function registerInvestor(body: RegisterInvestorBody): Promise<InvestorProfile> {
  const existing = await findProfile(body.wallet);
  const profile = buildInvestorProfile(body, existing);
  const application = newApplication(profile);
  profile.applicationId = application.id;
  await upsertProfile(profile);
  const db = await getDb();
  await db.insert(kycApplications).values({
    id: application.id,
    wallet: profile.wallet.toLowerCase(),
    reviewStatus: application.reviewStatus,
    createdAt: new Date(application.createdAt),
  });
  const event = application.events[0];
  if (event) {
    await db.insert(reviewEvents).values({
      id: event.id,
      applicationId: application.id,
      action: event.action,
      createdAt: new Date(event.createdAt),
    });
  }
  return profile;
}

export async function pendingKycApplications(): Promise<InvestorProfile[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(portalInvestors)
    .where(and(eq(portalInvestors.reviewStatus, "APPROVED"), eq(portalInvestors.status, "PENDING_KYC")));
  return rows.map(rowToProfile);
}

export async function confirmKyc(wallet: string): Promise<InvestorProfile> {
  const profile = await findProfile(wallet);
  if (!profile) fail(404, "INVESTOR_NOT_FOUND", `unknown wallet ${wallet}`);
  if (profile.reviewStatus !== "APPROVED" && profile.status !== "VERIFIED") {
    fail(409, "NOT_APPROVED", "admin must approve the KYC/KYB package before on-chain confirm");
  }
  profile.status = "VERIFIED";
  profile.reviewStatus = "APPROVED";
  profile.onchainConfirmed = true;
  await upsertProfile(profile);
  return profile;
}

export async function listApplications(status?: ApplicationReviewStatus): Promise<KycApplication[]> {
  const db = await getDb();
  const rows = status
    ? await db.select().from(kycApplications).where(eq(kycApplications.reviewStatus, status)).orderBy(desc(kycApplications.createdAt))
    : await db.select().from(kycApplications).orderBy(desc(kycApplications.createdAt));
  const result: KycApplication[] = [];
  for (const row of rows) {
    result.push(await toApplication(db, row, await findProfile(row.wallet)));
  }
  return result;
}

export async function getApplication(id: string): Promise<KycApplication> {
  const db = await getDb();
  const rows = await db.select().from(kycApplications).where(eq(kycApplications.id, id)).limit(1);
  const row = rows[0];
  if (!row) fail(404, "APPLICATION_NOT_FOUND", `unknown application ${id}`);
  return toApplication(db, row, await findProfile(row.wallet));
}

export async function listInvestors(): Promise<InvestorProfile[]> {
  const db = await getDb();
  const rows = await db.select().from(portalInvestors).orderBy(desc(portalInvestors.submittedAt));
  return rows.map(rowToProfile);
}

export async function adminStats(): Promise<AdminStats> {
  const applications = await listApplications();
  const investors = await listInvestors();
  return {
    submitted: applications.filter((row) => row.reviewStatus === "SUBMITTED").length,
    approved: applications.filter((row) => row.reviewStatus === "APPROVED").length,
    rejected: applications.filter((row) => row.reviewStatus === "REJECTED").length,
    investors: investors.length,
  };
}

export async function decideApplication(body: DecideApplicationBody): Promise<KycApplication> {
  if (body.action === "REJECTED" && !body.notes?.trim()) {
    fail(400, "NOTES_REQUIRED", "reject requires notes");
  }
  const db = await getDb();
  const rows = await db.select().from(kycApplications).where(eq(kycApplications.id, body.id)).limit(1);
  const row = rows[0];
  if (!row) fail(404, "APPLICATION_NOT_FOUND", `unknown application ${body.id}`);
  const now = new Date();
  await db
    .update(kycApplications)
    .set({
      reviewStatus: body.action,
      notes: body.notes?.trim(),
      reviewerWallet: body.reviewerWallet,
      reviewedAt: now,
    })
    .where(eq(kycApplications.id, body.id));
  await db.insert(reviewEvents).values({
    id: randomUUID(),
    applicationId: body.id,
    action: body.action,
    reviewerWallet: body.reviewerWallet,
    notes: body.notes?.trim(),
    createdAt: now,
  });
  const profile = await findProfile(row.wallet);
  if (profile) {
    profile.reviewStatus = body.action;
    profile.reviewNotes = body.notes?.trim();
    profile.reviewedAt = now.toISOString();
    profile.reviewerWallet = body.reviewerWallet;
    profile.applicationId = body.id;
    profile.status = body.action === "REJECTED" ? "REJECTED" : "PENDING_KYC";
    await upsertProfile(profile);
  }
  return getApplication(body.id);
}

export async function createSubscription(body: CreateSubscriptionBody): Promise<SubscriptionRequest> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(body.wallet)) fail(400, "INVALID_WALLET", "wallet must be a 20-byte hex address");
  const amount = body.amount.trim();
  if (!amount || Number(amount) <= 0) fail(400, "INVALID_AMOUNT", "amount must be positive");
  const db = await getDb();
  const request: SubscriptionRequest = {
    id: randomUUID(),
    wallet: body.wallet,
    assetId: body.assetId,
    amount,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
  await db.insert(portalSubscriptions).values({
    id: request.id,
    wallet: request.wallet,
    assetId: request.assetId,
    amount: request.amount,
    status: request.status,
    createdAt: new Date(request.createdAt),
  });
  return request;
}

export async function listSubscriptions(status?: SubscriptionRequest["status"]): Promise<SubscriptionRequest[]> {
  const db = await getDb();
  const rows = status
    ? await db.select().from(portalSubscriptions).where(eq(portalSubscriptions.status, status)).orderBy(desc(portalSubscriptions.createdAt))
    : await db.select().from(portalSubscriptions).orderBy(desc(portalSubscriptions.createdAt));
  return rows.map((row) => ({
    id: row.id,
    wallet: row.wallet as `0x${string}`,
    assetId: row.assetId,
    amount: row.amount,
    status: row.status as SubscriptionRequest["status"],
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
  }));
}

export async function fillSubscription(id: string): Promise<SubscriptionRequest> {
  const db = await getDb();
  const rows = await db.select().from(portalSubscriptions).where(eq(portalSubscriptions.id, id)).limit(1);
  const row = rows[0];
  if (!row) fail(404, "SUBSCRIPTION_NOT_FOUND", `unknown subscription ${id}`);
  await db.update(portalSubscriptions).set({ status: "FILLED" }).where(eq(portalSubscriptions.id, id));
  return {
    id: row.id,
    wallet: row.wallet as `0x${string}`,
    assetId: row.assetId,
    amount: row.amount,
    status: "FILLED",
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
  };
}
