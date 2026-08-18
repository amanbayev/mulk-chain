"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminInvestors } from "@/hooks/use-admin";
import { shortAddress } from "@/lib/utils";

export default function AdminInvestorsPage() {
  const t = useTranslations("admin");
  const { data, isLoading } = useAdminInvestors();
  const rows = data ?? [];

  return (
    <div>
      <PageHeader kicker={t("gateTitle")} title={t("investorsTitle")} />
      {isLoading ? <Skeleton className="h-48 w-full" /> : (
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Review</TableHead>
                <TableHead>KYC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.wallet}>
                  <TableCell>{row.displayName ?? row.email ?? "—"}</TableCell>
                  <TableCell className="tabular">{shortAddress(row.wallet)}</TableCell>
                  <TableCell>{row.investorKind === "LEGAL_ENTITY" ? t("kindKyb") : t("kindKyc")}</TableCell>
                  <TableCell>
                    <Badge variant={row.reviewStatus === "APPROVED" ? "success" : row.reviewStatus === "REJECTED" ? "destructive" : "outline"}>
                      {row.reviewStatus ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
