"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, MulkApiError } from "@/lib/api/client";
import { validateCadastralNumber } from "@/lib/cadastre";
import { parseKztToTiyn } from "@/lib/money";

export function AssetRegistrationForm() {
  const [assetId, setAssetId] = useState("");
  const [name, setName] = useState("");
  const [cadastralNumber, setCadastralNumber] = useState("");
  const [navKzt, setNavKzt] = useState("");
  const [spvName, setSpvName] = useState("");
  const [spvBin, setSpvBin] = useState("");
  const cadastre = cadastralNumber ? validateCadastralNumber(cadastralNumber) : null;

  const mutation = useMutation({
    mutationFn: () => {
      const check = validateCadastralNumber(cadastralNumber);
      if (!check.ok) throw new Error(check.error);
      const nav = parseKztToTiyn(navKzt);
      if (nav <= 0n) throw new Error("NAV must be positive");
      if (!assetId.trim() || !name.trim() || !spvName.trim() || !spvBin.trim()) {
        throw new Error("All fields are required");
      }
      return api.registerAsset({
        assetId: assetId.trim(),
        name: name.trim(),
        cadastralNumber: check.canonical,
        nav: nav.toString(),
        spvName: spvName.trim(),
        spvBin: spvBin.trim(),
        spvReserveBps: 500,
      });
    },
    onSuccess: (asset) => {
      toast.success("Asset registered", { description: `${asset.name} · ${asset.cadastreHash.slice(0, 18)}…` });
    },
    onError: (error) => {
      toast.error(error instanceof MulkApiError || error instanceof Error ? error.message : "Registration failed");
    },
  });

  return (
    <Card>
      <CardHeader>
        <p className="label-caps">Asset registration</p>
        <CardTitle className="text-base">New tokenized property</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Asset ID" value={assetId} onChange={setAssetId} placeholder="BAITEREK-BC" />
          <Field label="Name" value={name} onChange={setName} placeholder="Baiterek Business Center" />
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cadastre">Cadastral number (EGKN)</Label>
            <Input
              id="cadastre"
              className="tabular"
              value={cadastralNumber}
              onChange={(event) => setCadastralNumber(event.target.value)}
              placeholder="01:001:0012345:15"
            />
            {cadastre && !cadastre.ok ? <p className="text-xs text-destructive">{cadastre.error}</p> : null}
            {cadastre?.ok ? <p className="text-xs text-success">Canonical {cadastre.canonical}</p> : null}
          </div>
          <Field label="NAV (KZT / token)" value={navKzt} onChange={setNavKzt} placeholder="100000.00" mono />
          <Field label="SPV name" value={spvName} onChange={setSpvName} placeholder="Baiterek BC SPV Ltd." />
          <Field label="SPV BIN" value={spvBin} onChange={setSpvBin} placeholder="240140012345" mono />
        </div>
        <p className="text-xs text-muted-foreground">SPV reserve is fixed at 5% (500 bps) for NOI distributions.</p>
        <Button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? "Submitting…" : "Register asset"}
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} className={mono ? "tabular" : undefined} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
