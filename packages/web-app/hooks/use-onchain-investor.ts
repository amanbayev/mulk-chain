"use client";

import { useCallback } from "react";
import { zeroAddress, type Address } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { CHAIN_ADDRESSES } from "@/lib/chain/addresses";
import { identityRegistryAbi, mulkTokenAbi } from "@/lib/contracts/abis";
import { TOKEN_DECIMALS } from "@/lib/chain/mint-proof";

export function useOnchainInvestor(wallet?: Address) {
  const { address: connected } = useAccount();
  const address = wallet ?? connected;
  const enabled = Boolean(address);

  const balanceQuery = useReadContract({
    address: CHAIN_ADDRESSES.MulkToken,
    abi: mulkTokenAbi,
    functionName: "balanceOf",
    args: [address ?? zeroAddress],
    query: { enabled },
  });

  const verifiedQuery = useReadContract({
    address: CHAIN_ADDRESSES.IdentityRegistry,
    abi: identityRegistryAbi,
    functionName: "isVerified",
    args: [address ?? zeroAddress],
    query: { enabled },
  });

  const onchainIdQuery = useReadContract({
    address: CHAIN_ADDRESSES.IdentityRegistry,
    abi: identityRegistryAbi,
    functionName: "investorOnchainID",
    args: [address ?? zeroAddress],
    query: { enabled },
  });

  const decimalsQuery = useReadContract({
    address: CHAIN_ADDRESSES.MulkToken,
    abi: mulkTokenAbi,
    functionName: "decimals",
  });

  const refetch = useCallback(async () => {
    await Promise.all([balanceQuery.refetch(), verifiedQuery.refetch(), onchainIdQuery.refetch()]);
  }, [balanceQuery.refetch, verifiedQuery.refetch, onchainIdQuery.refetch]);

  return {
    address,
    isConnected: Boolean(connected),
    balance: balanceQuery.data ?? 0n,
    isVerified: verifiedQuery.data ?? false,
    onchainId: onchainIdQuery.data,
    decimals: decimalsQuery.data ?? TOKEN_DECIMALS,
    isLoading: enabled && (balanceQuery.isLoading || verifiedQuery.isLoading),
    isError: balanceQuery.isError || verifiedQuery.isError,
    refetch,
  };
}

export function useIsContractAgent(kind: "token" | "registry", wallet?: Address) {
  const { address: connected } = useAccount();
  const address = wallet ?? connected;
  const enabled = Boolean(address);
  const token = kind === "token";

  const agentQuery = useReadContract({
    address: token ? CHAIN_ADDRESSES.MulkToken : CHAIN_ADDRESSES.IdentityRegistry,
    abi: token ? mulkTokenAbi : identityRegistryAbi,
    functionName: "agents",
    args: [address ?? zeroAddress],
    query: { enabled },
  });

  const ownerQuery = useReadContract({
    address: token ? CHAIN_ADDRESSES.MulkToken : CHAIN_ADDRESSES.IdentityRegistry,
    abi: token ? mulkTokenAbi : identityRegistryAbi,
    functionName: "owner",
  });

  const isOwner = Boolean(address && ownerQuery.data && ownerQuery.data.toLowerCase() === address.toLowerCase());
  return {
    isAgent: Boolean(agentQuery.data) || isOwner,
    isLoading: enabled && (agentQuery.isLoading || ownerQuery.isLoading),
  };
}
