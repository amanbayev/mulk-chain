"use client";

import { Gavel, Loader2, Shield } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { useLoopingCountdown } from "@/hooks/use-countdown";
import { readEpochState, settleAuctionEpoch } from "@/lib/chain/actions";
import { AUCTION_DEMO } from "@/lib/institutional-demo";
import { formatKzt } from "@/lib/money";
import { formatClock, formatUsd } from "@/lib/utils";

function usdToTiyn(usd: number): bigint {
  return BigInt(Math.round(usd * AUCTION_DEMO.kztPerUsd * 100));
}

const SETTLED_KEY = "mulk-demo-epoch-settled";

export function AuctionEpochCard() {
  const { remainingSeconds, ready } = useLoopingCountdown(AUCTION_DEMO.periodSeconds, AUCTION_DEMO.epochOffsetSeconds);
  const [settled, setSettled] = useState(false);
  const [settling, setSettling] = useState(false);
  const [aliceBalance, setAliceBalance] = useState(AUCTION_DEMO.aliceStartBalance);
  const prevRemaining = useRef<number | null>(null);
  const settleLock = useRef(false);

  const displayRemaining = settled ? 0 : remainingSeconds;
  const progress = settled ? 100 : ready ? Math.max(4, 100 - (remainingSeconds / AUCTION_DEMO.periodSeconds) * 100) : 0;
  const eqPct =
    ((AUCTION_DEMO.equilibriumUsd - AUCTION_DEMO.collarMinUsd) / (AUCTION_DEMO.collarMaxUsd - AUCTION_DEMO.collarMinUsd)) *
    100;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (sessionStorage.getItem(SETTLED_KEY) === "1") {
        if (!cancelled) {
          setSettled(true);
          setAliceBalance(AUCTION_DEMO.aliceStartBalance + AUCTION_DEMO.aliceFillQty);
        }
      }
      const onchain = await readEpochState(AUCTION_DEMO.epochNumber);
      if (cancelled || !onchain) return;
      if (onchain.settled) {
        setSettled(true);
        setAliceBalance(onchain.aliceBalance);
        sessionStorage.setItem(SETTLED_KEY, "1");
      } else {
        setAliceBalance(onchain.aliceBalance);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function settle(): Promise<void> {
    if (settled || settleLock.current) return;
    settleLock.current = true;
    setSettling(true);
    try {
      const result = await settleAuctionEpoch(AUCTION_DEMO.epochNumber, AUCTION_DEMO.equilibriumUsd);
      setSettled(true);
      setAliceBalance(result.aliceBalance);
      sessionStorage.setItem(SETTLED_KEY, "1");
      toast.success("Epoch settled at uniform clearing price", {
        description:
          result.mode === "anvil"
            ? `$${AUCTION_DEMO.equilibriumUsd.toFixed(2)} · Alice ${result.aliceBalance.toLocaleString("en-GB")} MULK`
            : `$${AUCTION_DEMO.equilibriumUsd.toFixed(2)} · simulated (Anvil offline)`,
      });
    } catch {
      toast.error("Epoch settlement failed");
      settleLock.current = false;
    } finally {
      setSettling(false);
    }
  }

  useEffect(() => {
    if (!ready || settled || settling) return;
    const prev = prevRemaining.current;
    prevRemaining.current = remainingSeconds;
    if (remainingSeconds === 0) {
      void settle();
      return;
    }
    if (prev != null && prev <= 2 && remainingSeconds > AUCTION_DEMO.periodSeconds - 5) {
      void settle();
    }
  }, [remainingSeconds, ready, settled, settling]);

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="label-caps">Periodic Batch Auction</p>
            <p className="mt-1 font-mono text-lg tabular tracking-tight sm:text-xl">
              Clearing Epoch #{AUCTION_DEMO.epochNumber} Closes In: {ready || settled ? formatClock(displayRemaining) : "—:—:—"}
            </p>
          </div>
          <Badge variant={settled ? "gold" : "success"} className="gap-1.5 normal-case tracking-normal">
            {settled ? (
              "Settled"
            ) : (
              <>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                Order Book Open (Collateralized Orders Only)
              </>
            )}
          </Badge>
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-cyan-400/80 transition-[width] duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Constraint
            label="NAV Price Anchor"
            value={`${formatUsd(AUCTION_DEMO.navUsd)} / token`}
            hint={formatKzt(usdToTiyn(AUCTION_DEMO.navUsd))}
          />
          <Constraint
            label="Circuit Breaker Band"
            value={`±${AUCTION_DEMO.collarPct}% Allowed Corridor`}
            hint={`${formatUsd(AUCTION_DEMO.collarMinUsd)} – ${formatUsd(AUCTION_DEMO.collarMaxUsd)}`}
          />
          <Constraint
            label={settled ? "Uniform Clearing Price" : "Current Equilibrium Price"}
            value={formatUsd(AUCTION_DEMO.equilibriumUsd)}
            hint={settled ? "All in-corridor fills" : "Uniform Clearing Price"}
            accent
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0 rounded-md border border-border/80 bg-muted/20 px-3 py-2.5">
            <p className="label-caps">Alice token balance</p>
            <p className="mt-1 font-mono text-sm tabular">{aliceBalance.toLocaleString("en-GB")} MULK</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {settled
                ? `+${AUCTION_DEMO.aliceFillQty} filled at ${formatUsd(AUCTION_DEMO.equilibriumUsd)}`
                : "Pre-settlement holdings"}
            </p>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={settled || settling}
              onClick={() => void settle()}
            >
              {settling ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Gavel className="mr-1.5 h-3.5 w-3.5" />}
              {settled ? "Epoch settled" : settling ? "Settling epoch…" : "Force Epoch Settlement (Demo)"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-[11px] tabular text-muted-foreground">
            <span>{formatUsd(AUCTION_DEMO.collarMinUsd)}</span>
            <span>NAV {formatUsd(AUCTION_DEMO.navUsd)}</span>
            <span>{formatUsd(AUCTION_DEMO.collarMaxUsd)}</span>
          </div>
          <div className="relative h-2 rounded-full bg-secondary">
            <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-emerald-500/20" />
            <span className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-foreground" style={{ left: "50%" }} />
            <InfoTip content="Indicative uniform clearing price from the current collateralized book. All in-corridor orders fill at this price, pro-rata.">
              <span
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-help rounded-full border-2 border-background bg-cyan-400"
                style={{ left: `${eqPct}%` }}
              />
            </InfoTip>
          </div>
        </div>

        <div className="flex gap-2.5 rounded-md border border-cyan-500/20 bg-cyan-500/5 px-3 py-2.5">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            All orders within the corridor execute at the uniform clearing price via pro-rata allocation at epoch end.
            <span className="ml-1 font-medium text-foreground">MEV-resistant / Zero Front-Running.</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Constraint({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-md border border-border/80 bg-muted/20 px-3 py-2.5">
      <p className="label-caps">{label}</p>
      <p className={`mt-1 truncate text-sm font-medium tabular ${accent ? "text-cyan-400" : ""}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
