"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { isAddress, type Address } from "viem";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { TxStatus } from "@/components/chain/tx-status";
import { markKycConfirmed } from "@/components/issuer/kyc-application-queue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CHAIN_ADDRESSES } from "@/lib/chain/addresses";
import { walletErrorMessage } from "@/lib/chain/errors";
import { KZ_COUNTRY_CODE } from "@/lib/chain/mint-proof";
import { identityRegistryAbi } from "@/lib/contracts/abis";
import { useIsContractAgent, useOnchainInvestor } from "@/hooks/use-onchain-investor";
import { useQueryClient } from "@tanstack/react-query";

export function KycRegistryForm({ initialWallet = "" }: { initialWallet?: string }) {
  const { address, isConnected } = useAccount();
  const { isAgent } = useIsContractAgent("registry");
  const [target, setTarget] = useState(initialWallet);
  const [onchainId, setOnchainId] = useState("");
  const { writeContractAsync, data: hash, isPending, reset } = useWriteContract();
  const wait = useWaitForTransactionReceipt({ hash });
  const preview = useOnchainInvestor(isAddress(target) ? (target as Address) : undefined);
  const refetchPreview = preview.refetch;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (initialWallet) setTarget(initialWallet);
  }, [initialWallet]);

  useEffect(() => {
    if (address) setTarget((current) => current || address);
  }, [address]);

  useEffect(() => {
    if (!wait.isSuccess || !wait.data) return;
    toast.success("Identity registered on-chain", {
      description: `Block #${wait.data.blockNumber.toString()}`,
    });
    void refetchPreview();
    if (isAddress(target)) {
      void markKycConfirmed(target).then(async () => {
        await queryClient.invalidateQueries({ queryKey: ["kyc-applications"] });
        await queryClient.invalidateQueries({ queryKey: ["investor-profile"] });
      });
    }
  }, [wait.isSuccess, wait.data, refetchPreview, target, queryClient]);

  async function submit(): Promise<void> {
    if (!isConnected) {
      toast.error("Connect MetaMask on Arbitrum Sepolia first");
      return;
    }
    if (!isAddress(target)) {
      toast.error("Investor address must be a 20-byte hex address");
      return;
    }
    const identity = onchainId.trim() ? onchainId.trim() : target;
    if (!isAddress(identity)) {
      toast.error("OnchainID must be a 20-byte hex address");
      return;
    }
    reset();
    try {
      await writeContractAsync({
        address: CHAIN_ADDRESSES.IdentityRegistry,
        abi: identityRegistryAbi,
        functionName: "registerIdentity",
        args: [target as Address, identity as Address],
      });
    } catch (error) {
      toast.error(walletErrorMessage(error));
    }
  }

  return (
    <Card>
      <CardHeader>
        <p className="label-caps">OnchainID registry</p>
        <CardTitle className="text-base">Verify address / Add to registry</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="kyc-target">Investor wallet</Label>
            <Input
              id="kyc-target"
              className="tabular"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="0x…"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="kyc-oid">OnchainID</Label>
            <Input
              id="kyc-oid"
              className="tabular"
              value={onchainId}
              onChange={(event) => setOnchainId(event.target.value)}
              placeholder="Defaults to the investor wallet"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kyc-country">Country code (ISO 3166-1)</Label>
            <Input id="kyc-country" className="tabular" value={String(KZ_COUNTRY_CODE)} readOnly />
            <p className="text-[11px] text-muted-foreground">
              398 = Kazakhstan. Recorded off-chain; IdentityRegistry.registerIdentity binds wallet → OnchainID.
            </p>
          </div>
        </div>
        {isConnected && !isAgent ? (
          <p className="text-xs text-amber-400">
            This wallet is not an IdentityRegistry agent. MetaMask will still open; the transaction will revert unless
            the signer is the registry owner or an authorized agent.
          </p>
        ) : null}
        {isAddress(target) ? (
          <p className="text-xs text-muted-foreground">
            Current on-chain status: {preview.isVerified ? "KYC Verified (OnchainID)" : "KYC Required / Unverified"}
          </p>
        ) : null}
        <Button type="button" disabled={!isConnected || isPending || wait.isLoading} onClick={() => void submit()}>
          {isPending || wait.isLoading ? "Waiting for wallet…" : "Verify address / Add to registry"}
        </Button>
        <TxStatus
          isPending={isPending}
          isConfirming={wait.isLoading}
          isSuccess={wait.isSuccess}
          hash={hash}
          blockNumber={wait.data?.blockNumber}
        />
      </CardContent>
    </Card>
  );
}
