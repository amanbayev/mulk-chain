"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { keccak256, stringToHex } from "viem";
import { useAccount } from "wagmi";
import { OracleLiveStatus } from "@/components/issuer/oracle-live-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, MulkApiError } from "@/lib/api/client";
import type { MintAuthorization, PledgeInspection } from "@/lib/api/types";
import { BAITEREK } from "@/lib/constants";
import { isValidEthereumAddress } from "@/lib/cadastre";
import { shortHash } from "@/lib/utils";

export function MintConsole({
  assetId = BAITEREK.assetId,
  cadastralNumber = BAITEREK.cadastralNumber,
  inspection = BAITEREK.inspection,
}: {
  assetId?: string;
  cadastralNumber?: string;
  inspection?: PledgeInspection;
}) {
  const { address } = useAccount();
  const [to, setTo] = useState(address ?? "");
  const [amount, setAmount] = useState("1250");
  const [auth, setAuth] = useState<MintAuthorization | null>(null);
  const onchainHash = keccak256(stringToHex(cadastralNumber));
  const clear = inspection.status === "CLEAR" && !inspection.pledge && !inspection.arrest && !inspection.revocation;

  const mutation = useMutation({
    mutationFn: () => {
      if (!isValidEthereumAddress(to)) throw new Error("Recipient must be a 20-byte hex address");
      if (BigInt(amount) <= 0n) throw new Error("Amount must be positive");
      return api.requestMint({ assetId, to: to as `0x${string}`, amount });
    },
    onSuccess: (result) => {
      setAuth(result);
      toast.success("Gov-Oracle proof issued", { description: result.status });
    },
    onError: (error) => {
      toast.error(error instanceof MulkApiError || error instanceof Error ? error.message : "Mint request failed");
    },
  });

  return (
    <div className="space-y-6">
      <OracleLiveStatus />
      <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader>
          <p className="label-caps">EGKN pledge inspection</p>
          <CardTitle className="text-base">{cadastralNumber}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={clear ? "success" : "destructive"}>{inspection.status}</Badge>
          </div>
          <Row label="Pledge / encumbrance" value={inspection.pledge ? "Yes" : "None"} ok={!inspection.pledge} />
          <Row label="Arrest" value={inspection.arrest ? "Yes" : "None"} ok={!inspection.arrest} />
          <Row label="Revocation" value={inspection.revocation ? "Yes" : "None"} ok={!inspection.revocation} />
          <Row label="Inspected" value={new Date(inspection.inspectedAt).toLocaleString("en-GB")} ok />
          <div className="space-y-1 border-t border-border pt-3">
            <p className="label-caps">Onchain cadastre hash</p>
            <p className="break-all font-mono text-xs tabular text-muted-foreground">{onchainHash}</p>
            <p className="text-[11px] text-muted-foreground">keccak256 of the canonical EGKN identifier</p>
          </div>
        </CardContent>
      </Card>
      <Card className="lg:col-span-3">
        <CardHeader>
          <p className="label-caps">Mint console</p>
          <CardTitle className="text-base">Verified mint · Gov-Oracle EIP-712</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="mint-to">Recipient</Label>
              <Input id="mint-to" className="tabular" value={to} onChange={(event) => setTo(event.target.value)} placeholder="0x…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mint-amount">Amount (tokens)</Label>
              <Input id="mint-amount" className="tabular" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Asset</Label>
              <Input readOnly value={assetId} className="tabular" />
            </div>
          </div>
          <Button type="button" disabled={!clear || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Requesting proof…" : "Verified mint"}
          </Button>
          {!clear ? <p className="text-xs text-destructive">Mint blocked while EGKN reports an encumbrance.</p> : null}
          {auth ? (
            <div className="space-y-2 rounded-md border border-border bg-muted/30 p-4">
              <p className="label-caps">Gov-Oracle signature</p>
              <SigRow label="Status" value={auth.status} />
              <SigRow label="Proof" value={auth.proof} />
              <SigRow label="Cadastre hash" value={auth.cadastreHash} />
              <SigRow label="Nonce" value={auth.nonce} />
              <SigRow label="Deadline" value={auth.deadline} />
              <p className="pt-1 text-[11px] text-muted-foreground">
                Isolated oracle key. Agent / owner / enforcement signatures are rejected by `verifiedMint`.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={ok ? "text-foreground" : "text-destructive"}>{value}</span>
    </div>
  );
}

function SigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="break-all text-xs tabular" title={value}>
        {value.length > 42 ? shortHash(value, 10) : value}
      </span>
    </div>
  );
}
