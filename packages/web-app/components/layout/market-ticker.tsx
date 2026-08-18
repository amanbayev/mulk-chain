"use client";

import { useTranslations } from "next-intl";
import { BAITEREK } from "@/lib/constants";
import { formatKzt } from "@/lib/money";
import { useAuction } from "@/hooks/use-platform";

export function MarketTicker() {
  const t = useTranslations("ticker");
  const { data: auction } = useAuction(BAITEREK.assetId);
  const nav = formatKzt(auction?.nav ?? BAITEREK.nav);
  const collar = auction?.priceCollar ?? "NAV ±10%";

  return (
    <div className="hidden items-center gap-4 text-[11px] tabular text-muted-foreground lg:flex">
      <span className="text-foreground">{t("lot")}</span>
      <span>
        {t("nav")} {nav}
      </span>
      <span>
        {t("collar")} {collar}
      </span>
      <span className="rounded-sm border border-border px-1.5 py-0.5 uppercase tracking-[0.12em]">{t("chain")}</span>
    </div>
  );
}
