import { randomUUID } from "node:crypto";
import { fail } from "@/lib/api/errors";
import type {
  ApplicationReviewStatus,
  InvestorProfile,
  KycApplication,
  RegisterInvestorBody,
  ReviewEvent,
} from "@/lib/api/types";

export function buildInvestorProfile(body: RegisterInvestorBody, existing?: InvestorProfile | null): InvestorProfile {
  if (!/^0x[0-9a-fA-F]{40}$/.test(body.wallet)) fail(400, "INVALID_WALLET", "wallet must be a 20-byte hex address");
  const displayName = body.displayName.trim();
  const email = body.email.trim();
  if (!displayName || !email) fail(400, "INVALID_PROFILE", "displayName and email are required");
  if (body.investorKind === "LEGAL_ENTITY") {
    if (!body.bin?.trim() || !body.legalName?.trim()) {
      fail(400, "KYB_REQUIRED", "Legal entity KYB requires BIN and legal name");
    }
  }
  const wallet = body.wallet;
  const investorId = wallet.toLowerCase();
  const verified = existing?.status === "VERIFIED" || Boolean(body.onchainVerified);
  const reviewStatus: ApplicationReviewStatus = verified ? "APPROVED" : "SUBMITTED";
  return {
    investorId,
    wallet,
    onchainId: body.onchainId ?? wallet,
    iban: existing?.iban ?? `KZ-IBAN-${wallet.slice(2, 10)}`,
    whtBps: existing?.whtBps ?? "0",
    email,
    country: body.country ?? "KZ",
    provider: "SUMSUB",
    applicantId: `app-${investorId}`,
    onboardingUrl: `https://kyc.mulk.chain/session/app-${investorId}?provider=SUMSUB`,
    status: verified ? "VERIFIED" : "PENDING_KYC",
    displayName,
    investorKind: body.investorKind,
    investorClass: body.investorClass ?? "RETAIL",
    kybStatus: body.investorKind === "LEGAL_ENTITY" ? "KYB_SUBMITTED" : "NOT_REQUIRED",
    bin: body.bin?.trim(),
    legalName: body.legalName?.trim(),
    submittedAt: new Date().toISOString(),
    reviewStatus,
    applicationId: existing?.applicationId,
    onchainConfirmed: verified,
  };
}

export function newApplication(profile: InvestorProfile): KycApplication {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const event: ReviewEvent = {
    id: randomUUID(),
    applicationId: id,
    action: "SUBMITTED",
    createdAt,
  };
  return {
    id,
    wallet: profile.wallet,
    reviewStatus: profile.reviewStatus ?? "SUBMITTED",
    createdAt,
    profile: { ...profile, applicationId: id },
    events: [event],
  };
}

export function uniqueProfiles(profiles: Iterable<InvestorProfile>): InvestorProfile[] {
  const seen = new Set<string>();
  const rows: InvestorProfile[] = [];
  for (const profile of profiles) {
    const key = profile.wallet.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(profile);
  }
  return rows.sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
}
