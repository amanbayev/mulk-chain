"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MetricCard } from "@/components/investor/metric-card";
import { PageHeader } from "@/components/layout/page-header";
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
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="grid gap-6 p-5 sm:grid-cols-2">
            <Fact label="Address" value={asset.address} />
            <Fact label="Cadastral number" value={asset.cadastralNumber} mono />
            <Fact label="SPV" value={`${asset.spvName} · BIN ${asset.spvBin}`} />
            <Fact label="SPV reserve" value="5.00%" />
            <div className="sm:col-span-2">
              <p className="label-caps">Onchain cadastre hash</p>
              <p className="mt-1 break-all text-xs tabular text-muted-foreground">{onchainHash}</p>
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
    </div>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="label-caps">{label}</p>
      <p className={`mt-1 text-sm ${mono ? "tabular" : ""}`}>{value}</p>
    </div>
  );
}
