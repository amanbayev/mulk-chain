"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { isAddress, parseUnits, type Address, type Hex } from "viem";
import { useAccount, useSignTypedData, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { OracleLiveStatus } from "@/components/issuer/oracle-live-status";
import { TxStatus } from "@/components/chain/tx-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIsContractAgent, useOnchainInvestor } from "@/hooks/use-onchain-investor";
import { BAITEREK } from "@/lib/constants";
import type { PledgeInspection } from "@/lib/api/types";
import { CHAIN_ADDRESSES } from "@/lib/chain/addresses";
import { walletErrorMessage } from "@/lib/chain/errors";
import {
  EGKN_CADASTRE_HASH,
  EGKN_CADASTRE_NUMBER,
  MINT_AUTHORIZATION_TYPES,
  TOKEN_DECIMALS,
  encodeCadastreProof,
  mintAuthorizationMessage,
  mintTypedDataDomain,
} from "@/lib/chain/mint-proof";
import { mulkTokenAbi } from "@/lib/contracts/abis";
import { formatTokenUnits } from "@/lib/money";

export function MintConsole({
  assetId = BAITEREK.assetId,
  cadastralNumber = EGKN_CADASTRE_NUMBER,
  inspection = BAITEREK.inspection,
}: {
  assetId?: string;
  cadastralNumber?: string;
  inspection?: PledgeInspection;
}) {
  const { address, isConnected } = useAccount();
  const { isAgent } = useIsContractAgent("token");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("1250");
  const [signing, setSigning] = useState(false);
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync, data: hash, isPending, reset } = useWriteContract();
  const wait = useWaitForTransactionReceipt({ hash });
  const target = isAddress(to) ? (to as Address) : undefined;
  const recipient = useOnchainInvestor(target);
  const refetchRecipient = recipient.refetch;
  const clear = inspection.status === "CLEAR" && !inspection.pledge && !inspection.arrest && !inspection.revocation;

  useEffect(() => {
    if (address) setTo((current) => current || address);
  }, [address]);

  useEffect(() => {
    if (!wait.isSuccess || !wait.data) return;
    toast.success("Verified mint confirmed", {
      description: `Block #${wait.data.blockNumber.toString()}`,
    });
    void refetchRecipient();
  }, [wait.isSuccess, wait.data, refetchRecipient]);

  async function mint(): Promise<void> {
    if (!isConnected || !address) {
      toast.error("Connect MetaMask on Arbitrum Sepolia first");
      return;
    }
    if (!isAddress(to)) {
      toast.error("Recipient must be a 20-byte hex address");
      return;
    }
    let parsed: bigint;
    try {
      parsed = parseUnits(amount.trim(), TOKEN_DECIMALS);
    } catch {
      toast.error("Amount must be a decimal token quantity");
      return;
    }
    if (parsed <= 0n) {
      toast.error("Amount must be positive");
      return;
    }
    if (!recipient.isVerified) {
      toast.error("Recipient is not IdentityRegistry.isVerified. Register KYC first.");
      return;
    }

    reset();
    setSigning(true);
    try {
      const message = mintAuthorizationMessage({ to: to as Address, amount: parsed });
      const signature = await signTypedDataAsync({
        domain: mintTypedDataDomain(),
        types: MINT_AUTHORIZATION_TYPES,
        primaryType: "MintAuthorization",
        message,
      });
      const proof = encodeCadastreProof(message.cadastreHash, message.nonce, message.deadline, signature as Hex);
      setSigning(false);
      await writeContractAsync({
        address: CHAIN_ADDRESSES.MulkToken,
        abi: mulkTokenAbi,
        functionName: "verifiedMint",
        args: [to as Address, parsed, proof],
      });
    } catch (error) {
      setSigning(false);
      toast.error(walletErrorMessage(error));
    }
  }

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
            <p className="break-all font-mono text-xs tabular text-muted-foreground">{EGKN_CADASTRE_HASH}</p>
            <p className="text-[11px] text-muted-foreground">keccak256 of {EGKN_CADASTRE_NUMBER}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="lg:col-span-3">
        <CardHeader>
          <p className="label-caps">Mint console</p>
          <CardTitle className="text-base">Issue tokens · verifiedMint + EIP-712</CardTitle>
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
          {isAddress(to) ? (
            <p className="text-xs text-muted-foreground">
              Recipient KYC: {recipient.isVerified ? "Verified" : "Unverified"} · balance{" "}
              {formatTokenUnits(recipient.balance, recipient.decimals)} MULK
            </p>
          ) : null}
          {isConnected && !isAgent ? (
            <p className="text-xs text-amber-400">
              This wallet is not a MulkToken agent. The connected key must be the token owner/agent, and the EIP-712
              signer must be the isolated oracle key.
            </p>
          ) : null}
          <Button
            type="button"
            disabled={!clear || !isConnected || signing || isPending || wait.isLoading}
            onClick={() => void mint()}
          >
            {signing || isPending || wait.isLoading ? "Waiting for wallet…" : "Issue tokens (Mint)"}
          </Button>
          {!clear ? <p className="text-xs text-destructive">Mint blocked while EGKN reports an encumbrance.</p> : null}
          <p className="text-[11px] text-muted-foreground">
            Ordinary `mint` is disabled. This button signs MintAuthorization in MetaMask, then calls
            `MulkToken.verifiedMint(to, parseUnits(amount, 18), proof)`.
          </p>
          <TxStatus
            isSigning={signing}
            isPending={isPending}
            isConfirming={wait.isLoading}
            isSuccess={wait.isSuccess}
            hash={hash}
            blockNumber={wait.data?.blockNumber}
          />
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
