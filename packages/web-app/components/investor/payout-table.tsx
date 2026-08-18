"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DividendRegister } from "@/lib/api/types";
import { formatKzt } from "@/lib/money";

export function PayoutTable({ distributions, investorId = "" }: { distributions: DividendRegister[]; investorId?: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Period</TableHead>
          <TableHead className="text-right">Gross NOI</TableHead>
          <TableHead className="text-right">SPV reserve 5%</TableHead>
          <TableHead className="text-right">Distributable</TableHead>
          <TableHead className="text-right">WHT 10%</TableHead>
          <TableHead className="text-right">Net payout</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {distributions.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
              No distributions yet
            </TableCell>
          </TableRow>
        ) : (
          distributions.map((register) => {
            const line = register.lines.find((row) => row.investorId === investorId);
            return (
              <TableRow key={register.distributionId}>
                <TableCell>
                  <div className="font-medium">{register.distributionId}</div>
                  <div className="text-xs text-muted-foreground">
                    Record {new Date(register.recordDate).toLocaleDateString("en-GB")}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular">{formatKzt(register.noiTiyn)}</TableCell>
                <TableCell className="text-right tabular">{formatKzt(register.spvReserveTiyn)}</TableCell>
                <TableCell className="text-right tabular">{formatKzt(register.distributablePoolTiyn)}</TableCell>
                <TableCell className="text-right tabular">{formatKzt(line?.withholdingTaxTiyn ?? "0")}</TableCell>
                <TableCell className="text-right tabular font-medium">{formatKzt(line?.netPayableTiyn ?? "0")}</TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}

export function WaterfallLegend() {
  return (
    <ol className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
      <li>
        <span className="label-caps text-foreground">1. Gross NOI</span>
        <p className="mt-1">Rental income − operating expenses</p>
      </li>
      <li>
        <span className="label-caps text-foreground">2. SPV reserve</span>
        <p className="mt-1">5% withheld at the SPV</p>
      </li>
      <li>
        <span className="label-caps text-foreground">3. WHT</span>
        <p className="mt-1">10% withholding on the investor line</p>
      </li>
      <li>
        <span className="label-caps text-foreground">4. Net payout</span>
        <p className="mt-1">Credited to IBAN / wallet</p>
      </li>
    </ol>
  );
}
