"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePendingKycApplications } from "@/hooks/use-investor-profile";
import { api, MulkApiError } from "@/lib/api/client";
import { shortAddress } from "@/lib/utils";

export function KycApplicationQueue({ onSelect }: { onSelect?: (wallet: string) => void }) {
  const { data, isLoading } = usePendingKycApplications();
  const queryClient = useQueryClient();
  const rows = data ?? [];

  return (
    <Card>
      <CardHeader>
        <p className="label-caps">Pending KYC applications</p>
        <CardTitle className="text-base">Off-chain packages awaiting registerIdentity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {!isLoading && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending investor packages.</p>
        ) : null}
        {rows.map((row) => (
          <div key={row.wallet} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
            <div>
              <p className="text-sm font-medium">{row.displayName ?? row.email ?? shortAddress(row.wallet)}</p>
              <p className="text-[11px] tabular text-muted-foreground">
                {shortAddress(row.wallet)} · {row.investorKind === "LEGAL_ENTITY" ? `KYB ${row.bin ?? "—"}` : "Individual KYC"} ·{" "}
                {row.country}
              </p>
            </div>
            <div className="flex gap-2">
              {onSelect ? (
                <Button type="button" size="sm" variant="outline" onClick={() => onSelect(row.wallet)}>
                  Fill form
                </Button>
              ) : (
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link href={`/issuer?wallet=${row.wallet}`}>Fill form</Link>
                </Button>
              )}
            </div>
          </div>
        ))}
        {rows.length > 0 ? (
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["kyc-applications"] })}
          >
            Refresh queue
          </button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export async function markKycConfirmed(wallet: string): Promise<void> {
  try {
    await api.confirmKyc(wallet);
  } catch (error) {
    if (error instanceof MulkApiError && error.status === 404) return;
    toast.error("On-chain verify succeeded but the portal queue could not be updated");
  }
}
