"use client";

import { MintConsole } from "@/components/issuer/mint-console";
import { PageHeader } from "@/components/layout/page-header";
import { BAITEREK } from "@/lib/constants";

export default function MintPage() {
  return (
    <div>
      <PageHeader
        kicker="Issuance"
        title="Mint console"
        description={`${BAITEREK.name} is bound to cadastral ${BAITEREK.cadastralNumber}. Verified mint requests an isolated Gov-Oracle signature.`}
      />
      <MintConsole />
    </div>
  );
}
