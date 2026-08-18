"use client";

import { ExternalLink, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KycBadge } from "@/components/investor/kyc-badge";
import { useOnchainInvestor } from "@/hooks/use-onchain-investor";
import { explorerAddressUrl } from "@/lib/chain/addresses";
import { copyToClipboard, shortAddress } from "@/lib/utils";

export function WalletButton() {
  const t = useTranslations("shell");
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { isVerified, isLoading } = useOnchainInvestor();
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
        {t("connect")}
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
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span className="tabular">{shortAddress(address, 6)}</span>
        </DropdownMenuLabel>
        <div className="px-2 pb-2">
          <KycBadge onchainVerified={isLoading ? undefined : isVerified} connected compact />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            const ok = await copyToClipboard(address);
            if (ok) toast.success(t("copyAddress"));
          }}
        >
          {t("copyAddress")}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={explorerAddressUrl(address)} target="_blank" rel="noreferrer">
            {t("viewExplorer")}
            <ExternalLink className="ml-auto h-3.5 w-3.5" />
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => disconnect()}>{t("disconnect")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
