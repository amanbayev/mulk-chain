"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { api } from "@/lib/api/client";

export function useInvestorId(): string | undefined {
  const { address } = useAccount();
  return address;
}

export function usePortfolio() {
  const investorId = useInvestorId();
  return useQuery({
    queryKey: ["portfolio", investorId],
    enabled: Boolean(investorId),
    queryFn: () => api.portfolio(investorId!),
  });
}

export function useYieldHistory() {
  const investorId = useInvestorId();
  return useQuery({
    queryKey: ["yield-history", investorId],
    enabled: Boolean(investorId),
    queryFn: () => api.yieldHistory(investorId ?? ""),
  });
}

export function useAuction(assetId: string) {
  return useQuery({
    queryKey: ["auction", assetId],
    queryFn: () => api.auctionStatus(assetId),
  });
}
