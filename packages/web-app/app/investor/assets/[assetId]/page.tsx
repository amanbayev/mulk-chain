"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { DataRoomPanel } from "@/components/investor/data-room";
import { MetricCard } from "@/components/investor/metric-card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BAITEREK, BAITEREK_ASSET_ID } from "@/lib/constants";
import { formatBps, formatKzt, formatQty, toBigInt } from "@/lib/money";
import { useAuction } from "@/hooks/use-platform";
import { keccak256, stringToHex } from "viem";

export default function AssetPage() {
  const params = useParams<{ assetId: string }>();
  const assetId = params.assetId ?? BAITEREK_ASSET_ID;
  const asset = assetId === BAITEREK.assetId ? BAITEREK : { ...BAITEREK, assetId, name: assetId };
  const { data: auction } = useAuction(asset.assetId);
  const nav = toBigInt(auction?.nav ?? asset.nav);
  const gav = toBigInt(asset.tokenSupply) * nav;
  const onchainHash = keccak256(stringToHex(asset.cadastralNumber));
  const inspection = asset.inspection;
  const clear = inspection.status === "CLEAR";

  return (
    <div>
      <PageHeader kicker="Asset" title={asset.name} description={`${asset.address} · ${asset.city}`} />
      <div className="mb-6 flex flex-wrap gap-2">
        <Badge variant="outline">{asset.assetId}</Badge>
        <Badge variant={clear ? "success" : "destructive"}>EGKN {inspection.status}</Badge>
        <Badge variant="gold">Stabilized NOI {formatBps(asset.stabilizedNoiYieldBps)}</Badge>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="NAV / token" value={formatKzt(nav)} hint={auction?.priceCollar ?? "NAV ±10%"} />
        <MetricCard label="Stabilized NOI yield" value="11.2%" hint="In-place, after opex" />
        <MetricCard label="GLA" value={`${formatQty(asset.glaSqm)} m²`} hint={`Occupancy ${formatBps(asset.occupancyBps)}`} />
        <MetricCard label="Gross asset value" value={formatKzt(gav)} hint={`${formatQty(asset.tokenSupply)} tokens outstanding`} />
      </div>

      <Tabs defaultValue="overview" className="mt-8">
        <TabsList className="flex h-auto min-h-9 w-full flex-wrap justify-start gap-0.5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="dataroom">Data Room & Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardContent className="grid gap-6 p-5 sm:grid-cols-2">
                <Fact label="Address" value={asset.address} />
                <Fact label="Cadastral number" value={asset.cadastralNumber} mono />
                <Fact label="SPV" value={`${asset.spvName} · BIN ${asset.spvBin}`} />
                <Fact label="SPV reserve" value="5.00%" />
                <div className="min-w-0 sm:col-span-2">
                  <p className="label-caps">Onchain cadastre hash</p>
                  <p className="mt-1 break-all font-mono text-xs tabular text-muted-foreground">{onchainHash}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-3 p-5">
                <p className="label-caps">Pledge inspection · EGKN</p>
                <Fact label="Inspected" value={new Date(inspection.inspectedAt).toLocaleString("en-GB")} />
                <Fact label="Pledge" value={inspection.pledge ? "Encumbered" : "None"} />
                <Fact label="Arrest" value={inspection.arrest ? "Yes" : "None"} />
                <Fact label="Revocation" value={inspection.revocation ? "Yes" : "None"} />
                <Link href="/investor/trade" className="inline-block pt-2 text-xs text-accent hover:underline">
                  Open order terminal →
                </Link>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="financials">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="space-y-4 p-5">
                <p className="label-caps">Income statement (stabilized)</p>
                <FinRow label="Contracted rent (GPA)" value={formatKzt(4_720_000_000n)} hint="Q2 2026 run-rate" />
                <FinRow label="Operating expenses" value={formatKzt(810_000_000n)} hint="17.2% of gross" negative />
                <FinRow label="NOI" value={formatKzt(3_910_000_000n)} hint="Before SPV reserve" />
                <FinRow label="SPV reserve 5%" value={formatKzt(195_500_000n)} hint="Withheld at issuer" negative />
                <FinRow label="Distributable pool" value={formatKzt(3_714_500_000n)} hint="ERC-3643 dividend" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-4 p-5">
                <p className="label-caps">Capital stack</p>
                <FinRow label="Tokens outstanding" value={formatQty(asset.tokenSupply)} />
                <FinRow label="NAV / token" value={formatKzt(nav)} />
                <FinRow label="Gross asset value" value={formatKzt(gav)} />
                <FinRow label="Occupancy" value={formatBps(asset.occupancyBps)} />
                <FinRow label="Price collar" value={auction?.priceCollar ?? "NAV ±10%"} hint="Periodic Batch Auction" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="dataroom">
          <DataRoomPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="label-caps">{label}</p>
      <p className={`mt-1 break-words text-sm ${mono ? "font-mono tabular" : ""}`}>{value}</p>
    </div>
  );
}

function FinRow({
  label,
  value,
  hint,
  negative,
}: {
  label: string;
  value: string;
  hint?: string;
  negative?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/70 pb-3 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
      <p className={`shrink-0 font-mono text-sm tabular ${negative ? "text-muted-foreground" : ""}`}>{value}</p>
    </div>
  );
}
