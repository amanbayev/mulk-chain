"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PriceCollar } from "@/components/investor/price-collar";
import { WalletButton } from "@/components/layout/wallet-button";
import { useInvestorProfile } from "@/hooks/use-investor-profile";
import { useOnchainInvestor } from "@/hooks/use-onchain-investor";
import { api, MulkApiError } from "@/lib/api/client";
import type { AuctionSide, AuctionStatus } from "@/lib/api/types";
import { formatKzt, parseKztToTiyn, toBigInt } from "@/lib/money";

export function OrderTicket({ assetId, auction }: { assetId: string; auction?: AuctionStatus }) {
  const queryClient = useQueryClient();
  const { address, isConnected } = useAccount();
  const { isVerified } = useOnchainInvestor();
  const profileQuery = useInvestorProfile(address);
  const [side, setSide] = useState<AuctionSide>("BUY");
  const [priceKzt, setPriceKzt] = useState(auction ? formatKzt(auction.nav, { withSymbol: false }) : "100000.00");
  const [quantity, setQuantity] = useState("50");

  const nav = auction ? toBigInt(auction.nav) : 10_000_000n;
  const min = auction ? toBigInt(auction.collar.min) : 9_000_000n;
  const max = auction ? toBigInt(auction.collar.max) : 11_000_000n;

  let priceTiyn: bigint | null = null;
  try {
    priceTiyn = parseKztToTiyn(priceKzt);
  } catch {
    priceTiyn = null;
  }

  const gated = !isConnected || !isVerified || !profileQuery.data;

  const mutation = useMutation({
    mutationFn: () => {
      if (!address) throw new Error("Connect MetaMask on Arbitrum Sepolia first");
      if (!profileQuery.data) throw new Error("File a portal profile before placing an indicative order");
      if (!isVerified) throw new Error("IdentityRegistry.isVerified must be true before trading");
      if (priceTiyn == null || priceTiyn <= 0n) throw new Error("Enter a valid limit price in KZT");
      const qty = BigInt(quantity);
      if (qty <= 0n) throw new Error("Quantity must be greater than zero");
      return api.placeOrder({
        investorId: address,
        assetId,
        side,
        price: priceTiyn.toString(),
        quantity: qty.toString(),
      });
    },
    onSuccess: (result) => {
      toast.success(`Limit ${side.toLowerCase()} accepted`, { description: `Order ${result.orderId.slice(0, 8)} · ${result.intervalId}` });
      void queryClient.invalidateQueries({ queryKey: ["auction", assetId] });
      void queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
    onError: (error) => {
      const message = error instanceof MulkApiError ? error.message : error instanceof Error ? error.message : "Order rejected";
      toast.error(message);
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <p className="label-caps">Off-chain book · settlement via ERC-3643 transfer</p>
          <CardTitle className="mt-1 text-base">Indicative limit ticket · current batch</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">{auction?.open ? "Window open" : "Window closed"}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {!isConnected ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">Connect a wallet to post an indicative order.</p>
            <WalletButton />
          </div>
        ) : null}
        {isConnected && !isVerified ? (
          <p className="text-xs text-amber-400">
            KYC required.{" "}
            <Link href="/investor/onboarding" className="underline">
              File the package
            </Link>{" "}
            and wait for the issuer to call registerIdentity.
          </p>
        ) : null}
        {isConnected && isVerified && !profileQuery.data && !profileQuery.isLoading ? (
          <p className="text-xs text-amber-400">
            On-chain KYC is green, but the portal profile is missing.{" "}
            <Link href="/investor/onboarding" className="underline">
              Register the wallet
            </Link>
            .
          </p>
        ) : null}
        <Tabs value={side} onValueChange={(value) => setSide(value as AuctionSide)}>
          <TabsList>
            <TabsTrigger value="BUY">Buy</TabsTrigger>
            <TabsTrigger value="SELL">Sell</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="limit-price">Limit price (KZT / token)</Label>
            <Input id="limit-price" className="tabular" value={priceKzt} onChange={(event) => setPriceKzt(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="limit-qty">Quantity (tokens)</Label>
            <Input id="limit-qty" className="tabular" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </div>
        </div>
        <PriceCollar nav={nav} min={min} max={max} price={priceTiyn} />
        <Button
          type="button"
          className="w-full"
          disabled={gated || mutation.isPending || auction?.open === false}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Submitting…" : `Submit ${side.toLowerCase()} to batch`}
        </Button>
      </CardContent>
    </Card>
  );
}
