"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { PayoutTable, WaterfallLegend } from "@/components/investor/payout-table";
import { DividendClaimCard } from "@/components/investor/yield-waterfall";
import { MetricCard } from "@/components/investor/metric-card";
import { formatKzt, toBigInt } from "@/lib/money";
import { useYieldHistory } from "@/hooks/use-platform";

export default function PayoutsPage() {
  const { data, isLoading } = useYieldHistory();
  const distributions = data?.distributions ?? [];
  const net = distributions.reduce((acc, register) => {
    const line = register.lines.find((row) => row.investorId === data?.investorId);
    return acc + toBigInt(line?.netPayableTiyn ?? "0");
  }, 0n);

  return (
    <div>
      <PageHeader
        kicker="Rental yield"
        title="Payout history"
        description="Each line is Gross NOI → 5% SPV reserve → 10% WHT → net credit. Amounts in KZT (tiyn on the wire)."
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <MetricCard label="Net received" value={isLoading ? "—" : formatKzt(net)} hint={`${distributions.length} periods`} />
        <MetricCard label="SPV reserve" value="5.00%" hint="Withheld at the issuing SPV" />
        <MetricCard label="Withholding tax" value="10.00%" hint="Applied to the investor line" />
      </div>
      <div className="mb-6">
        <DividendClaimCard />
      </div>
      <Card>
        <CardContent className="space-y-6 p-5">
          <WaterfallLegend />
          <PayoutTable distributions={distributions} investorId={data?.investorId} />
        </CardContent>
      </Card>
    </div>
  );
}
