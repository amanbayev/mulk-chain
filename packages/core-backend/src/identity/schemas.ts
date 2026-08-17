import { z } from "zod";

export const AddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a 20-byte hex address");

export const KycProviderSchema = z.enum(["SUMSUB", "EGOV_MOBILE", "DID"]);
export const InvestorClassSchema = z.enum(["RETAIL", "PROFESSIONAL", "INSTITUTIONAL", "ACCREDITED"]);
export const KycReviewSchema = z.enum(["GREEN", "YELLOW", "RED"]);

export const ClaimTopic = {
  CLAIM_KYC_VALID: 1,
  CLAIM_INVESTOR_CLASS: 2,
  CLAIM_SANCTIONS_CLEAR: 3,
} as const;

export type ClaimTopicId = (typeof ClaimTopic)[keyof typeof ClaimTopic];

export const CanonicalKycWebhookSchema = z.object({
  provider: KycProviderSchema,
  applicantId: z.string().min(1),
  investorId: z.string().min(1),
  wallet: AddressSchema,
  onchainId: AddressSchema,
  reviewStatus: z.enum(["completed", "pending", "rejected"]),
  reviewAnswer: KycReviewSchema,
  applicantType: z.enum(["individual", "company"]).default("individual"),
  pep: z.boolean().default(false),
  sanctionsHit: z.boolean().default(false),
  professional: z.boolean().default(false),
  accredited: z.boolean().default(false),
  aifcLicense: z.boolean().default(false),
  country: z.string().min(2).max(2).default("KZ"),
});

export type CanonicalKycWebhook = z.output<typeof CanonicalKycWebhookSchema>;
export type KycProvider = z.infer<typeof KycProviderSchema>;
export type InvestorClass = z.infer<typeof InvestorClassSchema>;
