"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MintConsole } from "@/components/issuer/mint-console";
import { SubscriptionQueue } from "@/components/issuer/subscription-queue";
import { PageHeader } from "@/components/layout/page-header";
import { BAITEREK } from "@/lib/constants";

export default function MintPage() {
  return (
    <div>
      <PageHeader
        kicker="Issuance"
        title="Mint console"
        description={`${BAITEREK.name} is bound to cadastral ${BAITEREK.cadastralNumber}. The mint button signs EIP-712 in MetaMask, then calls verifiedMint on Arbitrum Sepolia.`}
      />
      <div className="mb-6">
        <SubscriptionQueue />
      </div>
      <Suspense fallback={null}>
        <MintConsoleFromQuery />
      </Suspense>
    </div>
  );
}

function MintConsoleFromQuery() {
  const params = useSearchParams();
  return (
    <MintConsole
      initialTo={params.get("to") ?? ""}
      initialAmount={params.get("amount") ?? undefined}
    />
  );
}
