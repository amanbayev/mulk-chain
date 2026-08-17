"use client";

import { formatKzt, formatQty, toBigInt } from "@/lib/money";
import { cn } from "@/lib/utils";

export function PriceCollar({
  nav,
  min,
  max,
  price,
}: {
  nav: bigint;
  min: bigint;
  max: bigint;
  price?: bigint | null;
}) {
  const span = max - min;
  const navPct = span === 0n ? 50 : Number(((nav - min) * 1000n) / span) / 10;
  const pricePct =
    price == null || span === 0n ? null : Math.min(100, Math.max(0, Number(((price - min) * 1000n) / span) / 10));
  const outside = price != null && (price < min || price > max);

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="label-caps">Price collar</p>
          <p className="mt-1 text-sm">NAV ±10%</p>
        </div>
        <p className={cn("text-xs tabular", outside ? "text-destructive" : "text-muted-foreground")}>
          {outside ? "Outside corridor — order will be rejected" : "Eligible for batch clearing"}
        </p>
      </div>
      <div className="relative h-2 rounded-full bg-secondary">
        <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-accent/25" />
        <span
          className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-foreground"
          style={{ left: `${navPct}%` }}
        />
        {pricePct != null ? (
          <span
            className={cn(
              "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background",
              outside ? "bg-destructive" : "bg-accent",
            )}
            style={{ left: `${pricePct}%` }}
          />
        ) : null}
      </div>
      <div className="flex justify-between text-[11px] tabular text-muted-foreground">
        <span>{formatKzt(min)}</span>
        <span>NAV {formatKzt(nav)}</span>
        <span>{formatKzt(max)}</span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Limit prices must sit in [{formatQty(toBigInt(min))}, {formatQty(toBigInt(max))}] tiyn. Out-of-collar bids do not
        participate in Periodic Batch Auction clearing.
      </p>
    </div>
  );
}
