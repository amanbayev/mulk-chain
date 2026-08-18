"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePendingSubscriptions } from "@/hooks/use-investor-profile";
import { api, MulkApiError } from "@/lib/api/client";
import { toast } from "sonner";
import { shortAddress } from "@/lib/utils";

export function SubscriptionQueue() {
  const { data, isLoading } = usePendingSubscriptions();
  const queryClient = useQueryClient();
  const rows = data ?? [];
  const fill = useMutation({
    mutationFn: (id: string) => api.fillSubscription(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    },
    onError: (error) => {
      toast.error(error instanceof MulkApiError || error instanceof Error ? error.message : "Could not mark filled");
    },
  });

  return (
    <Card>
      <CardHeader>
        <p className="label-caps">Primary subscription queue</p>
        <CardTitle className="text-base">Fill via verifiedMint — not a public mint</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {!isLoading && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending allocation requests.</p>
        ) : null}
        {rows.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
            <div>
              <p className="text-sm font-medium tabular">
                {row.amount} MULK · {shortAddress(row.wallet)}
              </p>
              <p className="text-[11px] text-muted-foreground">{row.assetId}</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" asChild>
                <Link href={`/issuer/mint?to=${row.wallet}&amount=${encodeURIComponent(row.amount)}`}>Fill mint</Link>
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={fill.isPending} onClick={() => fill.mutate(row.id)}>
                Mark filled
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
