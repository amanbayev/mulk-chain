"use client";

import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, MulkApiError } from "@/lib/api/client";
import { BAITEREK } from "@/lib/constants";
import { formatBps, formatKzt, parseKztToTiyn } from "@/lib/money";
import { DEMO_HOLDERS, previewYield } from "@/lib/yield-preview";

export function YieldTriggerForm({ assetId = BAITEREK.assetId }: { assetId?: string }) {
  const [distributionId, setDistributionId] = useState("DIV-2026-Q3");
  const [recordDate, setRecordDate] = useState("2026-09-30");
  const [grossKzt, setGrossKzt] = useState("45000000.00");
  const [opexKzt, setOpexKzt] = useState("8000000.00");

  const preview = useMemo(() => {
    try {
      return previewYield({
        grossRentalIncomeTiyn: parseKztToTiyn(grossKzt),
        operatingExpensesTiyn: parseKztToTiyn(opexKzt),
        holders: DEMO_HOLDERS,
      });
    } catch {
      return null;
    }
  }, [grossKzt, opexKzt]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!preview) throw new Error("Invalid NOI inputs");
      return api.triggerYield({
        distributionId,
        assetId,
        recordDate,
        grossRentalIncomeTiyn: preview.grossRentalIncomeTiyn.toString(),
        operatingExpensesTiyn: preview.operatingExpensesTiyn.toString(),
        holders: DEMO_HOLDERS.map((holder) => ({
          investorId: holder.investorId,
          wallet: holder.wallet,
          iban: holder.iban,
          balance: holder.balance.toString(),
          whtBps: holder.whtBps.toString(),
        })),
      });
    },
    onSuccess: (register) => {
      toast.success("Distribution posted", { description: `${register.distributionId} · net ${formatKzt(register.totalNetPayableTiyn)}` });
    },
    onError: (error) => {
      toast.error(error instanceof MulkApiError || error instanceof Error ? error.message : "Yield trigger failed");
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader>
          <p className="label-caps">Yield trigger</p>
          <CardTitle className="text-base">NOI for the reporting period</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dist-id">Distribution ID</Label>
            <Input id="dist-id" className="tabular" value={distributionId} onChange={(event) => setDistributionId(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="record-date">Record date</Label>
            <Input id="record-date" type="date" value={recordDate} onChange={(event) => setRecordDate(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gross">Gross rental income (KZT)</Label>
            <Input id="gross" className="tabular" value={grossKzt} onChange={(event) => setGrossKzt(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="opex">Operating expenses (KZT)</Label>
            <Input id="opex" className="tabular" value={opexKzt} onChange={(event) => setOpexKzt(event.target.value)} />
          </div>
          {preview ? (
            <dl className="space-y-2 border-t border-border pt-3 text-sm">
              <PreviewRow label="NOI" value={formatKzt(preview.noiTiyn)} />
              <PreviewRow label="SPV reserve 5%" value={formatKzt(preview.spvReserveTiyn)} />
              <PreviewRow label="Distributable pool" value={formatKzt(preview.distributablePoolTiyn)} />
              <PreviewRow label="WHT 10%" value={formatKzt(preview.totalWhtTiyn)} />
              <PreviewRow label="Net payout" value={formatKzt(preview.totalNetPayableTiyn)} strong />
            </dl>
          ) : (
            <p className="text-xs text-destructive">Enter valid KZT amounts. Opex cannot exceed gross rent.</p>
          )}
          <Button type="button" disabled={!preview || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Posting…" : "Trigger distribution"}
          </Button>
        </CardContent>
      </Card>
      <Card className="lg:col-span-3">
        <CardHeader>
          <p className="label-caps">Allocation preview</p>
          <CardTitle className="text-base">Holders at record date</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Holder</TableHead>
                <TableHead className="text-right">Ownership</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">WHT</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(preview?.lines ?? []).map((line) => (
                <TableRow key={line.investorId}>
                  <TableCell>
                    <div className="font-medium">{line.label}</div>
                    <div className="text-xs text-muted-foreground">{line.investorId}</div>
                  </TableCell>
                  <TableCell className="text-right tabular">{formatBps(line.ownershipBps)}</TableCell>
                  <TableCell className="text-right tabular">{formatKzt(line.grossDividendTiyn)}</TableCell>
                  <TableCell className="text-right tabular">{formatKzt(line.withholdingTaxTiyn)}</TableCell>
                  <TableCell className="text-right tabular font-medium">{formatKzt(line.netPayableTiyn)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PreviewRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={strong ? "font-medium tabular" : "tabular"}>{value}</dd>
    </div>
  );
}
