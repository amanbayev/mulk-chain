"use client";

import { YieldTriggerForm } from "@/components/issuer/yield-trigger-form";
import { PageHeader } from "@/components/layout/page-header";

export default function YieldPage() {
  return (
    <div>
      <PageHeader
        kicker="Rental yield"
        title="NOI distribution"
        description="Preview Gross NOI → 5% SPV reserve → 10% WHT → net payout, then post the register to holders at the record date."
      />
      <YieldTriggerForm />
    </div>
  );
}
