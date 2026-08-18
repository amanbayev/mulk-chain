"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ApplicationTable } from "@/components/admin/application-table";
import { useAdminApplications } from "@/hooks/use-admin";
import type { ApplicationReviewStatus } from "@/lib/api/types";

const FILTERS: Array<ApplicationReviewStatus | undefined> = [undefined, "SUBMITTED", "APPROVED", "REJECTED"];

export default function AdminApplicationsPage() {
  const t = useTranslations("admin");
  const [status, setStatus] = useState<ApplicationReviewStatus | undefined>("SUBMITTED");
  const queue = useAdminApplications(status);

  return (
    <div>
      <PageHeader kicker={t("gateTitle")} title={t("queueTitle")} description={t("queueHint")} />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((value) => (
          <Button key={value ?? "all"} type="button" size="sm" variant={status === value ? "secondary" : "outline"} onClick={() => setStatus(value)}>
            {value ?? t("filterAll")}
          </Button>
        ))}
      </div>
      <ApplicationTable rows={queue.data ?? []} isLoading={queue.isLoading} />
    </div>
  );
}
