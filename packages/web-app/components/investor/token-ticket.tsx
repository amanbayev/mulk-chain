"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { parseUnits, type Address } from "viem";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { TxStatus } from "@/components/chain/tx-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WalletButton } from "@/components/layout/wallet-button";
import { useOnchainInvestor } from "@/hooks/use-onchain-investor";
import { useTransferPreflight } from "@/hooks/use-transfer-preflight";
import { api, MulkApiError } from "@/lib/api/client";
import { CHAIN_ADDRESSES } from "@/lib/chain/addresses";
import { walletErrorMessage } from "@/lib/chain/errors";
import { TOKEN_DECIMALS } from "@/lib/chain/mint-proof";
import { mulkTokenAbi } from "@/lib/contracts/abis";
import { BAITEREK } from "@/lib/constants";
import { formatTokenUnits } from "@/lib/money";

type TicketMode = "sell" | "subscribe";

export function TokenTicket() {
  const { address, isConnected } = useAccount();
  const investor = useOnchainInvestor();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<TicketMode>("sell");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("10");
  const preflight = useTransferPreflight(to, amount);
  const { writeContractAsync, data: hash, isPending, reset } = useWriteContract();
  const wait = useWaitForTransactionReceipt({ hash });
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (!wait.isSuccess || !wait.data) return;
    toast.success("Transfer confirmed", { description: `Block #${wait.data.blockNumber.toString()}` });
    void investor.refetch();
  }, [wait.isSuccess, wait.data, investor.refetch]);

  async function sell(): Promise<void> {
    if (!isConnected || !address) {
      toast.error("Connect MetaMask on Arbitrum Sepolia first");
      return;
    }
    if (!preflight.ready) {
      toast.error(preflight.reasons[0] ?? "KYT blocked this transfer");
      return;
    }
    reset();
    try {
      await writeContractAsync({
        address: CHAIN_ADDRESSES.MulkToken,
        abi: mulkTokenAbi,
        functionName: "transfer",
        args: [preflight.to as Address, preflight.amount],
      });
    } catch (error) {
      toast.error(walletErrorMessage(error));
    }
  }

  async function subscribe(): Promise<void> {
    if (!isConnected || !address) {
      toast.error("Connect MetaMask on Arbitrum Sepolia first");
      return;
    }
    if (!investor.isVerified) {
      toast.error("Complete on-chain KYC before requesting an allocation");
      return;
    }
    try {
      parseUnits(amount.trim(), TOKEN_DECIMALS);
    } catch {
      toast.error("Amount must be a decimal token quantity");
      return;
    }
    setSubscribing(true);
    try {
      const row = await api.subscribe({ wallet: address, assetId: BAITEREK.assetId, amount: amount.trim() });
      toast.success("Primary subscription filed", {
        description: `${row.amount} MULK · issuer fills via verifiedMint`,
      });
      await queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    } catch (error) {
      toast.error(error instanceof MulkApiError || error instanceof Error ? error.message : "Subscription failed");
    } finally {
      setSubscribing(false);
    }
  }

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <p className="label-caps">MULK ticket</p>
          <CardTitle className="text-base">Connect wallet to trade</CardTitle>
        </CardHeader>
        <CardContent>
          <WalletButton />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <p className="label-caps">MULK ticket · ERC-3643</p>
        <CardTitle className="mt-1 text-base">Sell on-chain or request primary allocation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Available {formatTokenUnits(investor.balance, investor.decimals)} MULK · settlement is{" "}
          <span className="text-foreground">MulkToken.transfer</span> or issuer <span className="text-foreground">verifiedMint</span>
          . KYT is the on-chain validateTransfer gate, not Chainalysis.
        </p>
        {!investor.isVerified ? (
          <p className="text-xs text-amber-400">
            Trade locked until IdentityRegistry.isVerified.{" "}
            <Link href="/investor/onboarding" className="underline">
              File KYC
            </Link>
          </p>
        ) : null}
        <Tabs value={mode} onValueChange={(value) => setMode(value as TicketMode)}>
          <TabsList>
            <TabsTrigger value="sell">Sell (transfer)</TabsTrigger>
            <TabsTrigger value="subscribe">Buy (primary)</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="grid gap-4 sm:grid-cols-2">
          {mode === "sell" ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sell-to">Counterparty (must be verified)</Label>
              <Input id="sell-to" className="tabular" value={to} onChange={(event) => setTo(event.target.value)} placeholder="0x…" />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="sell-amt">Amount (tokens)</Label>
            <Input id="sell-amt" className="tabular" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </div>
        </div>
        {mode === "sell" && preflight.reasons.length > 0 ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <p className="font-medium">KYT blocked</p>
            <ul className="mt-1 list-disc pl-4">
              {preflight.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {mode === "sell" ? (
          <Button
            type="button"
            className="w-full"
            disabled={!investor.isVerified || !preflight.ready || isPending || wait.isLoading}
            onClick={() => void sell()}
          >
            {isPending || wait.isLoading ? "Sending to Arbitrum Sepolia…" : "Sell MULK (transfer)"}
          </Button>
        ) : (
          <Button type="button" className="w-full" disabled={!investor.isVerified || subscribing} onClick={() => void subscribe()}>
            {subscribing ? "Filing…" : "Request primary allocation"}
          </Button>
        )}
        {mode === "sell" ? (
          <TxStatus
            isPending={isPending}
            isConfirming={wait.isLoading}
            isSuccess={wait.isSuccess}
            hash={hash}
            blockNumber={wait.data?.blockNumber}
          />
        ) : (
          <p className="text-[11px] text-muted-foreground">
            The issuer fills this request from the mint console with verifiedMint. Secondary buy is a transfer from a
            verified seller to this wallet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
