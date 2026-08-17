"use client";

import { ChevronDown, Info, Landmark, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InfoTip } from "@/components/ui/info-tip";
import { YIELD_WATERFALL_DEMO } from "@/lib/institutional-demo";
import { formatKzt } from "@/lib/money";
import { cn, formatUsd } from "@/lib/utils";

const W = YIELD_WATERFALL_DEMO;

function usdToTiyn(usd: number): bigint {
  return BigInt(Math.round(usd * W.kztPerUsd * 100));
}

const TOOLTIPS = {
  gross: "Contracted rent collected by the SPV for the record period, before statutory deductions.",
  opex: "Property management and operating expenses under the SPV operating agreement — 15% of gross rent. Deducted before NOI is struck.",
  reserve:
    "Corporate / sinking-fund contribution (5% of gross rent) retained at Baiterek BC SPV Ltd. for capex and covenant headroom.",
  noi: "Net Operating Income distributed to token holders after OPEX and the reserve. This is the ERC-3643 dividend pool.",
  share: "Your pro-rata of the NOI pool based on the token snapshot at record date. Shown in USD reporting terms and KZT on the wire.",
  tax: "AIFC exempt-fund treatment: the SPV is not subject to Kazakhstan CIT on this rental stream. Investor-level WHT (if any) is applied per OnchainID tax status after this split.",
} as const;

interface WaterfallLine {
  id: keyof typeof TOOLTIPS;
  label: string;
  amountUsd: number;
  kind: "inflow" | "deduction" | "net" | "share";
}

const LINES: WaterfallLine[] = [
  { id: "gross", label: "Gross Rent Collected", amountUsd: W.grossRentUsd, kind: "inflow" },
  { id: "opex", label: "OPEX & Property Management (15%)", amountUsd: -W.opexUsd, kind: "deduction" },
  { id: "reserve", label: "Corporate / Reserve Fund (5%)", amountUsd: -W.reserveUsd, kind: "deduction" },
  { id: "noi", label: "Net Operating Income (NOI Distributed)", amountUsd: W.noiUsd, kind: "net" },
  { id: "share", label: "Your Pro-Rata Share (based on token balance)", amountUsd: W.proRataUsd, kind: "share" },
];

function amountClass(kind: WaterfallLine["kind"]): string {
  if (kind === "inflow") return "text-emerald-400";
  if (kind === "deduction") return "text-destructive";
  if (kind === "share") return "text-cyan-400";
  return "text-foreground";
}

function prefix(kind: WaterfallLine["kind"], amount: number): string {
  if (kind === "net") return "= ";
  if (amount > 0) return "+ ";
  if (amount < 0) return "− ";
  return "";
}

export function YieldWaterfall({ compact = false }: { compact?: boolean }) {
  return (
    <ol className="space-y-0">
      {LINES.map((line) => {
        const abs = Math.abs(line.amountUsd);
        const width = Math.max(8, (abs / W.grossRentUsd) * 100);
        return (
          <li
            key={line.id}
            className={cn(
              "flex flex-col gap-2 border-b border-border/70 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between",
              line.kind === "share" && "border-t border-cyan-500/20",
            )}
          >
            <div className="min-w-0 sm:max-w-[60%]">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{line.label}</span>
                <InfoTip content={TOOLTIPS[line.id]}>
                  <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={`About ${line.label}`}>
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </InfoTip>
              </div>
              {!compact ? (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      line.kind === "deduction" ? "bg-destructive/70" : line.kind === "share" ? "bg-cyan-400" : "bg-emerald-400/80",
                    )}
                    style={{ width: `${width}%` }}
                  />
                </div>
              ) : null}
            </div>
            <div className="text-right">
              <p className={cn("font-mono text-sm tabular", amountClass(line.kind))}>
                {line.kind === "share"
                  ? `${W.proRataUsd.toFixed(2)} USDT / KZT`
                  : `${prefix(line.kind, line.amountUsd)}${formatUsd(abs)}`}
              </p>
              <p className="font-mono text-[11px] tabular text-muted-foreground">{formatKzt(usdToTiyn(line.amountUsd))}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const CLAIM_STORAGE_KEY = "mulk-demo-q3-claimed";

export function DividendClaimCard() {
  const [open, setOpen] = useState(true);
  const [claimOpen, setClaimOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    setClaimed(sessionStorage.getItem(CLAIM_STORAGE_KEY) === "1");
  }, []);

  async function claim(): Promise<void> {
    setClaiming(true);
    await new Promise((resolve) => window.setTimeout(resolve, 1400));
    setClaiming(false);
    setClaimed(true);
    sessionStorage.setItem(CLAIM_STORAGE_KEY, "1");
    setClaimOpen(false);
    toast.success("Dividends claimed", {
      description: `${formatUsd(W.proRataUsd)} / ${formatKzt(usdToTiyn(W.proRataUsd))} · ERC-3643 verified`,
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <p className="label-caps">Rental dividend claim</p>
          <CardTitle className="mt-1 text-base">NOI yield · {W.periodLabel}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Snapshot {W.tokenBalance.toLocaleString("en-GB")} / {W.tokenSupply.toLocaleString("en-GB")} tokens · {W.distributionId}
          </p>
        </div>
        <Badge variant={claimed ? "success" : "gold"}>{claimed ? "Claimed" : "Accrued"}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          <span>Yield Waterfall (Водопад распределения)</span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
        </button>
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-out",
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            <YieldWaterfall />
            <p className="pt-2 text-[11px] text-muted-foreground">
              Pro-rata line: {W.proRataUsd.toFixed(2)} USDT / KZT.{" "}
              <InfoTip content={TOOLTIPS.tax}>
                <button type="button" className="text-cyan-400 hover:underline">
                  AIFC exempt-fund tax treatment
                </button>
              </InfoTip>
            </p>
          </div>
        </div>

        <Button type="button" className="w-full" disabled={claimed} onClick={() => setClaimOpen(true)}>
          {claimed ? "Dividends claimed this period" : `Claim ${formatUsd(W.proRataUsd)}`}
        </Button>
      </CardContent>

      <Dialog open={claimOpen} onOpenChange={setClaimOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Claim rental dividends</DialogTitle>
            <DialogDescription>
              Confirm the gross-to-net split before the ERC-3643 transfer. IdentityRegistry.isVerified must remain true.
            </DialogDescription>
          </DialogHeader>
          <YieldWaterfall compact />
          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              Credit {formatUsd(W.proRataUsd)} ({formatKzt(usdToTiyn(W.proRataUsd))}) to the linked IBAN / wallet. WHT, if
              applicable to your OnchainID class, is withheld after this split.
            </p>
          </div>
          <Button type="button" className="w-full" disabled={claiming || claimed} onClick={() => void claim()}>
            {claiming ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />}
            {claiming ? "Settling…" : "Claim Dividends (ERC-3643 Verified)"}
          </Button>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
