import { classifyInvestor } from "./classify.js";
import type { ClaimIssuerService, IssuedClaim } from "./claim-issuer.service.js";
import { WebhookSignatureError, verifyHmacSha256 } from "./hmac.js";
import type { IdentityRegistrySyncer } from "./identity-registry-syncer.service.js";
import { CanonicalKycWebhookSchema, KycProviderSchema, type InvestorClass, type KycProvider } from "./schemas.js";

export interface InvestorComplianceRecord {
  investorId: string;
  wallet: string;
  onchainId: string;
  provider: KycProvider;
  applicantId: string;
  kycValid: boolean;
  sanctionsClear: boolean;
  pep: boolean;
  investorClass: InvestorClass;
  classificationReason: string;
  claims: IssuedClaim[];
  updatedAt: string;
}

export interface KycWebhookResult {
  accepted: boolean;
  investorId: string;
  kycValid: boolean;
  investorClass: InvestorClass;
  sanctionsClear: boolean;
  claimsIssued: number;
  jobsEnqueued: number;
}

export class KycWebhookController {
  readonly investors = new Map<string, InvestorComplianceRecord>();

  constructor(
    private readonly secret: string,
    private readonly claims: ClaimIssuerService,
    private readonly syncer: IdentityRegistrySyncer,
  ) {}

  async handle(provider: string, headers: Record<string, string | undefined>, rawBody: string): Promise<KycWebhookResult> {
    const signature =
      headers["x-payload-digest"] ??
      headers["x-sumsub-payload-digest"] ??
      headers["x-signature-sha256"] ??
      headers["x-hub-signature-256"];
    verifyHmacSha256(rawBody, this.secret, signature);

    const parsedProvider = KycProviderSchema.safeParse(provider.toUpperCase());
    if (!parsedProvider.success) {
      throw new WebhookSignatureError(`unsupported KYC provider ${provider}`);
    }

    let json: unknown;
    try {
      json = JSON.parse(rawBody) as unknown;
    } catch {
      throw new SyntaxError("webhook body is not valid JSON");
    }
    const event = CanonicalKycWebhookSchema.parse(normalizeProviderPayload(parsedProvider.data, json));
    const classification = classifyInvestor(event);
    const now = new Date();
    const claims: IssuedClaim[] = [];

    if (classification.kycValid) {
      claims.push(
        await this.claims.issueKycValid(event.onchainId, event.wallet, event.provider, event.applicantId, now),
      );
      claims.push(
        await this.claims.issueInvestorClass(event.onchainId, event.wallet, classification.investorClass, now),
      );
      if (classification.sanctionsClear) {
        claims.push(await this.claims.issueSanctionsClear(event.onchainId, event.wallet, event.pep, now));
      }
      this.syncer.enqueueRegister(event.wallet, event.onchainId);
      for (const claim of claims) {
        this.syncer.enqueueClaim(event.wallet, claim);
      }
    }

    const record: InvestorComplianceRecord = {
      investorId: event.investorId,
      wallet: event.wallet,
      onchainId: event.onchainId,
      provider: event.provider,
      applicantId: event.applicantId,
      kycValid: classification.kycValid,
      sanctionsClear: classification.sanctionsClear,
      pep: event.pep,
      investorClass: classification.investorClass,
      classificationReason: classification.reason,
      claims,
      updatedAt: now.toISOString(),
    };
    this.investors.set(event.investorId, record);

    return {
      accepted: true,
      investorId: event.investorId,
      kycValid: classification.kycValid,
      investorClass: classification.investorClass,
      sanctionsClear: classification.sanctionsClear,
      claimsIssued: claims.length,
      jobsEnqueued: classification.kycValid ? 1 + claims.length : 0,
    };
  }
}

export function normalizeProviderPayload(provider: KycProvider, json: unknown): unknown {
  if (typeof json !== "object" || json === null) return json;
  const body = json as Record<string, unknown>;
  if ("provider" in body && "wallet" in body) {
    return { ...body, provider };
  }

  const review = asRecord(body.reviewResult);
  const info = asRecord(body.info);
  return {
    provider,
    applicantId: String(body.applicantId ?? body.id ?? ""),
    investorId: String(body.externalUserId ?? body.investorId ?? ""),
    wallet: String(body.wallet ?? info.wallet ?? ""),
    onchainId: String(body.onchainId ?? info.onchainId ?? ""),
    reviewStatus: String(body.reviewStatus ?? "pending"),
    reviewAnswer: String(review.reviewAnswer ?? body.reviewAnswer ?? "YELLOW"),
    applicantType: body.applicantType === "company" || body.type === "company" ? "company" : "individual",
    pep: Boolean(body.pep ?? info.pep),
    sanctionsHit: Boolean(body.sanctionsHit ?? info.sanctionsHit),
    professional: Boolean(body.professional ?? info.professional),
    accredited: Boolean(body.accredited ?? info.accredited),
    aifcLicense: Boolean(body.aifcLicense ?? info.aifcLicense),
    country: String(info.country ?? body.country ?? "KZ"),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null) return value as Record<string, unknown>;
  return {};
}
