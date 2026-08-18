"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/investor/metric-card";
import { ApplicationTable } from "@/components/admin/application-table";
import { useAdminApplications, useAdminStats } from "@/hooks/use-admin";

export default function AdminOverviewPage() {
  const t = useTranslations("admin");
  const stats = useAdminStats();
  const queue = useAdminApplications("SUBMITTED");

  return (
    <div>
      <PageHeader kicker={t("gateTitle")} title={t("queueTitle")} description={t("queueHint")} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label={t("statsSubmitted")} value={String(stats.data?.submitted ?? "—")} />
        <MetricCard label={t("statsApproved")} value={String(stats.data?.approved ?? "—")} />
        <MetricCard label={t("statsRejected")} value={String(stats.data?.rejected ?? "—")} />
        <MetricCard label={t("statsInvestors")} value={String(stats.data?.investors ?? "—")} />
      </div>
      <ApplicationTable rows={queue.data ?? []} isLoading={queue.isLoading} />
    </div>
  );
}
