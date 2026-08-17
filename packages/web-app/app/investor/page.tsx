"use client";

import Link from "next/link";
import { DividendClaimCard } from "@/components/investor/yield-waterfall";
import { KycBadge } from "@/components/investor/kyc-badge";
import { MetricCard } from "@/components/investor/metric-card";
import { PageHeader } from "@/components/layout/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BAITEREK } from "@/lib/constants";
import { formatKzt, formatQty, toBigInt } from "@/lib/money";
import { usePortfolio } from "@/hooks/use-platform";
import { shortAddress } from "@/lib/utils";

export default function InvestorDashboardPage() {
  const { data, isLoading, error } = usePortfolio();
  const baiterekQty = data?.balances.find((row) => row.assetId === BAITEREK.assetId)?.quantity ?? "0";
  const nav = toBigInt(BAITEREK.nav);
  const aum = toBigInt(baiterekQty) * nav;

  return (
    <div>
      <PageHeader
        kicker="Investor"
        title="Portfolio"
        description="Token balances marked at last NAV, accrued rental income in KZT, and OnchainID verification."
      />
      {error ? <p className="mb-6 text-sm text-destructive">{error.message}</p> : null}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Wallet {data ? shortAddress(data.wallet) : "—"}</p>
        </div>
        {data ? <KycBadge kycValid={data.kycValid} status={data.status} investorClass={data.investorClass} /> : null}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Gross asset value"
          value={isLoading ? "—" : formatKzt(aum)}
          hint={`${formatQty(baiterekQty)} tokens · ${BAITEREK.name}`}
        />
        <MetricCard
          label="Accrued rental income"
          value={isLoading ? "—" : formatKzt(data?.accruedDividendsTiyn ?? "0")}
          hint="Net of SPV reserve and WHT"
        />
        <MetricCard
          label="Investor class"
          value={data?.investorClass ?? "—"}
          hint={data?.kycValid ? "IdentityRegistry.isVerified = true" : "KYC incomplete"}
        />
      </div>
      <div className="mt-8">
        <DividendClaimCard />
      </div>
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Holdings</h2>
          <Link href={`/investor/assets/${BAITEREK.assetId}`} className="text-xs text-muted-foreground hover:text-foreground">
            Open asset
          </Link>
        </div>
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">NAV</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.balances ?? [{ assetId: BAITEREK.assetId, quantity: baiterekQty }]).map((row) => (
                <TableRow key={row.assetId}>
                  <TableCell>
                    <Link href={`/investor/assets/${row.assetId}`} className="font-medium hover:underline">
                      {row.assetId === BAITEREK.assetId ? BAITEREK.name : row.assetId}
                    </Link>
                    <div className="text-xs text-muted-foreground">{row.assetId}</div>
                  </TableCell>
                  <TableCell className="text-right tabular">{formatQty(row.quantity)}</TableCell>
                  <TableCell className="text-right tabular">{formatKzt(BAITEREK.nav)}</TableCell>
                  <TableCell className="text-right tabular">{formatKzt(toBigInt(row.quantity) * nav)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
