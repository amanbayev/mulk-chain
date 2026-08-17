import { Badge } from "@/components/ui/badge";
import type { InvestorClass, KycStatus } from "@/lib/api/types";

export function KycBadge({
  kycValid,
  status,
  investorClass,
}: {
  kycValid: boolean;
  status: KycStatus;
  investorClass: InvestorClass | null;
}) {
  if (kycValid && status === "VERIFIED") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="success">KYC Green</Badge>
        {investorClass ? <Badge variant="gold">{investorClass}</Badge> : null}
      </div>
    );
  }
  if (status === "PENDING_KYC") {
    return <Badge variant="outline">Pending KYC</Badge>;
  }
  return <Badge variant="destructive">{status === "REJECTED" ? "KYC rejected" : "Unverified"}</Badge>;
}
