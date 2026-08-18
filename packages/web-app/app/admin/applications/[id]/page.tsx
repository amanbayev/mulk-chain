"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminApplication } from "@/hooks/use-admin";
import { useOnchainInvestor } from "@/hooks/use-onchain-investor";
import { api, MulkApiError } from "@/lib/api/client";
import { shortAddress } from "@/lib/utils";
import type { Address } from "viem";

export default function AdminApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const t = useTranslations("admin");
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { data, isLoading } = useAdminApplication(params.id);
  const [notes, setNotes] = useState("");
  const wallet = data?.wallet as Address | undefined;
  const onchain = useOnchainInvestor(wallet);

  const decide = useMutation({
    mutationFn: (action: "APPROVED" | "REJECTED") => {
      if (!address) throw new Error("Connect wallet");
      if (action === "REJECTED" && !notes.trim()) throw new Error(t("notesRequired"));
      return api.decideApplication({ id: params.id, action, notes, reviewerWallet: address });
    },
    onSuccess: async () => {
      toast.success("Decision recorded");
      await queryClient.invalidateQueries({ queryKey: ["admin-application"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["kyc-applications"] });
    },
    onError: (error) => {
      toast.error(error instanceof MulkApiError || error instanceof Error ? error.message : "Decision failed");
    },
  });

  if (isLoading || !data) {
    return <Skeleton className="h-64 w-full" />;
  }

  const profile = data.profile;

  return (
    <div>
      <PageHeader kicker={t("dossier")} title={profile.displayName ?? shortAddress(data.wallet)} description={shortAddress(data.wallet)} />
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">{t("dossier")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <Fact label="Email" value={profile.email ?? "—"} />
            <Fact label="Country" value={profile.country} />
            <Fact label="Type" value={profile.investorKind === "LEGAL_ENTITY" ? t("kindKyb") : t("kindKyc")} />
            <Fact label="Class" value={profile.investorClass ?? "—"} />
            {profile.investorKind === "LEGAL_ENTITY" ? (
              <>
                <Fact label="BIN" value={profile.bin ?? "—"} />
                <Fact label="Legal name" value={profile.legalName ?? "—"} />
              </>
            ) : null}
            <div className="sm:col-span-2">
              <p className="label-caps">{t("onchain")}</p>
              <p className="mt-1">{onchain.isVerified ? "true" : "false"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{data.reviewStatus}</CardTitle>
              <Badge variant={data.reviewStatus === "APPROVED" ? "success" : data.reviewStatus === "REJECTED" ? "destructive" : "warning"}>
                {data.reviewStatus}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="notes">{t("notes")}</Label>
              <Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
            </div>
            <div className="flex gap-2">
              <Button type="button" disabled={decide.isPending} onClick={() => decide.mutate("APPROVED")}>
                {t("approve")}
              </Button>
              <Button type="button" variant="destructive" disabled={decide.isPending} onClick={() => decide.mutate("REJECTED")}>
                {t("reject")}
              </Button>
            </div>
            <div>
              <p className="label-caps">{t("audit")}</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {data.events.map((event) => (
                  <li key={event.id}>
                    {event.action} · {new Date(event.createdAt).toLocaleString()} {event.notes ? `· ${event.notes}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-caps">{label}</p>
      <p className="mt-1 break-all">{value}</p>
    </div>
  );
}
