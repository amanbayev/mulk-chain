"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { KycApplication } from "@/lib/api/types";
import { shortAddress } from "@/lib/utils";

export function ApplicationTable({ rows, isLoading }: { rows: KycApplication[]; isLoading?: boolean }) {
  const t = useTranslations("admin");

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
          <div>
            <p className="text-sm font-medium">{row.profile.displayName ?? row.profile.email ?? shortAddress(row.wallet)}</p>
            <p className="text-[11px] tabular text-muted-foreground">
              {shortAddress(row.wallet)} · {row.profile.investorKind === "LEGAL_ENTITY" ? t("kindKyb") : t("kindKyc")} · {row.profile.country}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={row.reviewStatus === "APPROVED" ? "success" : row.reviewStatus === "REJECTED" ? "destructive" : "warning"}>
              {row.reviewStatus}
            </Badge>
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href={`/admin/applications/${row.id}`}>{t("open")}</Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
