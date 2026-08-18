import { Badge } from "@/components/ui/badge";
import type { InvestorClass, KycStatus } from "@/lib/api/types";

export function KycBadge({
  onchainVerified,
  connected = true,
  kycValid,
  status,
  investorClass,
}: {
  onchainVerified?: boolean;
  connected?: boolean;
  kycValid?: boolean;
  status?: KycStatus;
  investorClass?: InvestorClass | null;
}) {
  if (!connected) {
    return (
      <Badge variant="outline" className="normal-case tracking-normal">
        Connect wallet
      </Badge>
    );
  }

  if (onchainVerified === undefined && kycValid === undefined) {
    return (
      <Badge variant="outline" className="normal-case tracking-normal">
        Checking on-chain KYC…
      </Badge>
    );
  }

  if (onchainVerified === true) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="success" className="normal-case tracking-normal">
          KYC Verified (OnchainID)
        </Badge>
        {investorClass ? <Badge variant="gold">{investorClass}</Badge> : null}
      </div>
    );
  }

  if (onchainVerified === false) {
    return (
      <Badge variant="warning" className="normal-case tracking-normal">
        KYC Required / Unverified
      </Badge>
    );
  }

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
