"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { DividendClaimCard } from "@/components/investor/yield-waterfall";
import { KycBadge } from "@/components/investor/kyc-badge";
import { MetricCard } from "@/components/investor/metric-card";
import { PageHeader } from "@/components/layout/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOnchainInvestor } from "@/hooks/use-onchain-investor";
import { BAITEREK } from "@/lib/constants";
import { CHAIN_ADDRESSES, explorerAddressUrl } from "@/lib/chain/addresses";
import { formatKzt, formatTokenUnits, toBigInt } from "@/lib/money";
import { shortAddress } from "@/lib/utils";

export default function InvestorDashboardPage() {
  const { address, isConnected } = useAccount();
  const { balance, isVerified, decimals, isLoading } = useOnchainInvestor();
  const nav = toBigInt(BAITEREK.nav);
  const scale = 10n ** BigInt(decimals);
  const aum = (balance * nav) / scale;

  return (
    <div>
      <PageHeader
        kicker="Investor"
        title="Portfolio"
        description="Live MulkToken balance and IdentityRegistry.isVerified from Arbitrum Sepolia."
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Wallet {isConnected && address ? shortAddress(address) : "not connected"}
          </p>
          <a
            href={explorerAddressUrl(CHAIN_ADDRESSES.MulkToken)}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            MulkToken {shortAddress(CHAIN_ADDRESSES.MulkToken)}
          </a>
        </div>
        <KycBadge onchainVerified={isConnected && !isLoading ? isVerified : undefined} connected={isConnected} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Gross asset value"
          value={!isConnected || isLoading ? "—" : formatKzt(aum)}
          hint={`${isConnected ? formatTokenUnits(balance, decimals) : "—"} tokens · ${BAITEREK.name}`}
        />
        <MetricCard
          label="Token balance"
          value={!isConnected || isLoading ? "—" : formatTokenUnits(balance, decimals)}
          hint="MulkToken.balanceOf(connectedAddress)"
        />
        <MetricCard
          label="OnchainID"
          value={!isConnected ? "—" : isVerified ? "Verified" : "Unverified"}
          hint={isVerified ? "IdentityRegistry.isVerified = true" : "IdentityRegistry.isVerified = false"}
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
              <TableRow>
                <TableCell>
                  <Link href={`/investor/assets/${BAITEREK.assetId}`} className="font-medium hover:underline">
                    {BAITEREK.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">{BAITEREK.assetId}</div>
                </TableCell>
                <TableCell className="text-right tabular">
                  {!isConnected || isLoading ? "—" : formatTokenUnits(balance, decimals)}
                </TableCell>
                <TableCell className="text-right tabular">{formatKzt(BAITEREK.nav)}</TableCell>
                <TableCell className="text-right tabular">
                  {!isConnected || isLoading ? "—" : formatKzt(aum)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
