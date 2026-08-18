"use client";

import { AuctionEpochCard } from "@/components/investor/auction-epoch";
import { OrderTicket } from "@/components/investor/order-ticket";
import { TokenTicket } from "@/components/investor/token-ticket";
import { MetricCard } from "@/components/investor/metric-card";
import { PageHeader } from "@/components/layout/page-header";
import { BAITEREK } from "@/lib/constants";
import { formatKzt, formatQty, toBigInt } from "@/lib/money";
import { useAuction } from "@/hooks/use-platform";

export default function TradePage() {
  const { data: auction } = useAuction(BAITEREK.assetId);
  const nav = auction ? toBigInt(auction.nav) : toBigInt(BAITEREK.nav);

  return (
    <div>
      <PageHeader
        kicker="Secondary market"
        title="Order terminal"
        description="Executable settlement is MulkToken.transfer or issuer verifiedMint. The NAV ±10% book below is indicative only."
      />
      <div className="mb-6">
        <AuctionEpochCard />
      </div>
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard label="NAV" value={formatKzt(nav)} hint={auction?.intervalId ?? "—"} />
        <MetricCard label="Buy interest" value={formatQty(auction?.buyQuantity ?? "0")} hint="Tokens in book" />
        <MetricCard label="Sell interest" value={formatQty(auction?.sellQuantity ?? "0")} hint="Tokens in book" />
        <MetricCard
          label="Indicative at NAV"
          value={`${formatQty(auction?.indicativeDemandAtNav ?? "0")} / ${formatQty(auction?.indicativeSupplyAtNav ?? "0")}`}
          hint="Demand / supply"
        />
      </div>
      <div className="mb-6">
        <TokenTicket />
      </div>
      <OrderTicket assetId={BAITEREK.assetId} auction={auction} />
    </div>
  );
}
