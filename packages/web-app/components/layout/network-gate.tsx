"use client";

import { useEffect, useRef } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { Button } from "@/components/ui/button";

/**
 * If the injected wallet is on another chain, ask it to switch to Arbitrum Sepolia.
 * Missing networks trigger wallet_addEthereumChain via wagmi's chain metadata.
 */
export function NetworkGate() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending, error, reset } = useSwitchChain();
  const prompted = useRef(false);

  const needsSepolia = Boolean(isConnected && chainId !== undefined && chainId !== arbitrumSepolia.id);

  useEffect(() => {
    if (!isConnected) {
      prompted.current = false;
      reset();
    }
  }, [isConnected, reset]);

  useEffect(() => {
    if (!needsSepolia || prompted.current) return;
    prompted.current = true;
    switchChain({ chainId: arbitrumSepolia.id });
  }, [needsSepolia, switchChain]);

  if (!needsSepolia) return null;

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <p>This console reads Arbitrum Sepolia (chain 421614). Switch the connected wallet to continue.</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => switchChain({ chainId: arbitrumSepolia.id })}
        >
          {isPending ? "Requesting wallet…" : "Add / switch to Arbitrum Sepolia"}
        </Button>
      </div>
      {error ? <p className="mx-auto mt-1 max-w-6xl text-xs text-amber-200/80">{error.message}</p> : null}
    </div>
  );
}
