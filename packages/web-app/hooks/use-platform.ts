"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { DEFAULT_INVESTOR_ID } from "@/lib/constants";

export function useInvestorId(): string {
  return DEFAULT_INVESTOR_ID;
}

export function usePortfolio() {
  const investorId = useInvestorId();
  return useQuery({
    queryKey: ["portfolio", investorId],
    queryFn: () => api.portfolio(investorId),
  });
}

export function useYieldHistory() {
  const investorId = useInvestorId();
  return useQuery({
    queryKey: ["yield-history", investorId],
    queryFn: () => api.yieldHistory(investorId),
  });
}

export function useAuction(assetId: string) {
  return useQuery({
    queryKey: ["auction", assetId],
    queryFn: () => api.auctionStatus(assetId),
  });
}
