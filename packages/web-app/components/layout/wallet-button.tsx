"use client";

import { Wallet } from "lucide-react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { shortAddress } from "@/lib/utils";

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const injected = connectors[0];

  if (!isConnected || !address) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending || !injected}
        onClick={() => injected && connect({ connector: injected, chainId: arbitrumSepolia.id })}
      >
        <Wallet className="mr-2 h-3.5 w-3.5" />
        Connect
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="tabular">
          {shortAddress(address)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => disconnect()}>Disconnect</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
