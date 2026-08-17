import type { CanonicalKycWebhook, InvestorClass } from "./schemas.js";

export interface ClassificationResult {
  investorClass: InvestorClass;
  kycValid: boolean;
  sanctionsClear: boolean;
  reason: string;
}

/**
 * AIFC-oriented investor classification from KYC provider attributes.
 * Institutional requires a legal entity with an AIFC licence; otherwise accredited /
 * professional flags map to those classes; default is Retail.
 */
export function classifyInvestor(event: CanonicalKycWebhook): ClassificationResult {
  const kycValid = event.reviewStatus === "completed" && event.reviewAnswer === "GREEN";
  const sanctionsClear = kycValid && !event.sanctionsHit;

  if (!kycValid) {
    return {
      investorClass: "RETAIL",
      kycValid: false,
      sanctionsClear: false,
      reason: `KYC not GREEN/completed (status=${event.reviewStatus}, answer=${event.reviewAnswer})`,
    };
  }

  if (event.applicantType === "company" && event.aifcLicense) {
    return {
      investorClass: "INSTITUTIONAL",
      kycValid: true,
      sanctionsClear,
      reason: "legal entity with AIFC licence",
    };
  }
  if (event.accredited) {
    return {
      investorClass: "ACCREDITED",
      kycValid: true,
      sanctionsClear,
      reason: "accredited investor attestation",
    };
  }
  if (event.professional) {
    return {
      investorClass: "PROFESSIONAL",
      kycValid: true,
      sanctionsClear,
      reason: "professional / qualified investor",
    };
  }
  return {
    investorClass: "RETAIL",
    kycValid: true,
    sanctionsClear,
    reason: "default retail natural person",
  };
}
