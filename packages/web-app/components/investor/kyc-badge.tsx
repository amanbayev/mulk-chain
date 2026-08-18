"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { InvestorClass, KycStatus } from "@/lib/api/types";

export function KycBadge({
  onchainVerified,
  connected = true,
  kycValid,
  status,
  investorClass,
  compact = false,
}: {
  onchainVerified?: boolean;
  connected?: boolean;
  kycValid?: boolean;
  status?: KycStatus;
  investorClass?: InvestorClass | null;
  compact?: boolean;
}) {
  const t = useTranslations("kyc");
  if (!connected) {
    return (
      <Badge variant="outline" className="normal-case tracking-normal">
        {t("connect")}
      </Badge>
    );
  }

  if (onchainVerified === undefined && kycValid === undefined) {
    return (
      <Badge variant="outline" className="normal-case tracking-normal">
        {t("checking")}
      </Badge>
    );
  }

  if (onchainVerified === true) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="success" className="normal-case tracking-normal">
          {t("verified")}
        </Badge>
        {!compact && investorClass ? <Badge variant="gold">{investorClass}</Badge> : null}
      </div>
    );
  }

  if (onchainVerified === false) {
    return (
      <Badge variant="warning" className="normal-case tracking-normal">
        {t("required")}
      </Badge>
    );
  }

  if (kycValid && status === "VERIFIED") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="success">{t("green")}</Badge>
        {!compact && investorClass ? <Badge variant="gold">{investorClass}</Badge> : null}
      </div>
    );
  }
  if (status === "PENDING_KYC") {
    return <Badge variant="outline">{t("pending")}</Badge>;
  }
  return <Badge variant="destructive">{status === "REJECTED" ? t("rejected") : t("required")}</Badge>;
}
