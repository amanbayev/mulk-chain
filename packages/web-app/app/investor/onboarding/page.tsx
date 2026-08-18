"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KycBadge } from "@/components/investor/kyc-badge";
import { WalletButton } from "@/components/layout/wallet-button";
import { useInvestorProfile } from "@/hooks/use-investor-profile";
import { useOnchainInvestor } from "@/hooks/use-onchain-investor";
import { api, MulkApiError } from "@/lib/api/client";
import type { InvestorClass, InvestorKind } from "@/lib/api/types";
import { KZ_COUNTRY_CODE } from "@/lib/chain/mint-proof";
import { shortAddress } from "@/lib/utils";

export default function InvestorOnboardingPage() {
  const { address, isConnected } = useAccount();
  const { isVerified, isLoading: kycLoading } = useOnchainInvestor();
  const profileQuery = useInvestorProfile(address);
  const queryClient = useQueryClient();
  const existing = profileQuery.data;

  const [displayName, setDisplayName] = useState(existing?.displayName ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [kind, setKind] = useState<InvestorKind>(existing?.investorKind ?? "INDIVIDUAL");
  const [investorClass, setInvestorClass] = useState<InvestorClass>(existing?.investorClass ?? "RETAIL");
  const [bin, setBin] = useState(existing?.bin ?? "");
  const [legalName, setLegalName] = useState(existing?.legalName ?? "");

  useEffect(() => {
    if (!existing) return;
    setDisplayName(existing.displayName ?? "");
    setEmail(existing.email ?? "");
    setKind(existing.investorKind ?? "INDIVIDUAL");
    setInvestorClass(existing.investorClass ?? "RETAIL");
    setBin(existing.bin ?? "");
    setLegalName(existing.legalName ?? "");
  }, [existing?.investorId, existing?.submittedAt]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!address) throw new Error("Connect MetaMask on Arbitrum Sepolia first");
      if (kind === "LEGAL_ENTITY" && (!bin.trim() || !legalName.trim())) {
        throw new Error("Legal entity KYB requires BIN and legal name");
      }
      return api.registerInvestor({
        wallet: address,
        displayName,
        email,
        country: "KZ",
        investorKind: kind,
        investorClass,
        bin: kind === "LEGAL_ENTITY" ? bin : undefined,
        legalName: kind === "LEGAL_ENTITY" ? legalName : undefined,
        onchainId: address,
        onchainVerified: isVerified,
      });
    },
    onSuccess: async (profile) => {
      toast.success("Wallet registered", {
        description: `${profile.displayName} · KYC package filed · country ${KZ_COUNTRY_CODE}`,
      });
      await queryClient.invalidateQueries({ queryKey: ["investor-profile"] });
      await queryClient.invalidateQueries({ queryKey: ["kyc-applications"] });
    },
    onError: (error) => {
      toast.error(error instanceof MulkApiError || error instanceof Error ? error.message : "Registration failed");
    },
  });

  return (
    <div>
      <PageHeader
        kicker="Onboarding"
        title="Register wallet"
        description="Connect MetaMask, file the KYC/KYB package, then wait for the issuer agent to call IdentityRegistry.registerIdentity."
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {isConnected && address ? `Wallet ${shortAddress(address)}` : "Wallet not connected"}
        </p>
        <KycBadge onchainVerified={isConnected && !kycLoading ? isVerified : undefined} connected={isConnected} />
      </div>
      <Card>
        <CardHeader>
          <p className="label-caps">Portal profile</p>
          <CardTitle className="text-base">KYC / KYB application</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConnected ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">Connect a wallet on Arbitrum Sepolia to continue.</p>
              <WalletButton />
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="legal-name-or-fio">Full name / legal name</Label>
                  <Input id="legal-name-or-fio" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Country</Label>
                  <Input readOnly className="tabular" value={`KZ · ${KZ_COUNTRY_CODE}`} />
                </div>
                <div className="space-y-1.5">
                  <Label>Investor type</Label>
                  <Select value={kind} onValueChange={(value) => setKind(value as InvestorKind)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INDIVIDUAL">Individual (KYC)</SelectItem>
                      <SelectItem value="LEGAL_ENTITY">Legal entity (KYB)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Investor class</Label>
                  <Select value={investorClass} onValueChange={(value) => setInvestorClass(value as InvestorClass)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RETAIL">Retail</SelectItem>
                      <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                      <SelectItem value="INSTITUTIONAL">Institutional</SelectItem>
                      <SelectItem value="ACCREDITED">Accredited</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {kind === "LEGAL_ENTITY" ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="bin">BIN</Label>
                      <Input id="bin" className="tabular" value={bin} onChange={(event) => setBin(event.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="entity">Registered name</Label>
                      <Input id="entity" value={legalName} onChange={(event) => setLegalName(event.target.value)} />
                    </div>
                  </>
                ) : null}
              </div>
              {existing ? (
                <p className="text-xs text-muted-foreground">
                  Package on file: {existing.status}
                  {existing.kybStatus === "KYB_SUBMITTED" ? " · KYB package filed" : ""} · On-chain:{" "}
                  {isVerified ? "OnchainID verified" : "awaiting issuer registerIdentity"}
                </p>
              ) : null}
              <Button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
                {mutation.isPending ? "Submitting…" : existing ? "Update application" : "Submit KYC / KYB package"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
