"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { api, MulkApiError } from "@/lib/api/client";

export function useConnectedInvestorId(): string | undefined {
  const { address } = useAccount();
  return address;
}

export function useInvestorProfile(wallet?: string) {
  return useQuery({
    queryKey: ["investor-profile", wallet?.toLowerCase()],
    enabled: Boolean(wallet),
    queryFn: async () => {
      if (!wallet) return null;
      try {
        return await api.investorProfile(wallet);
      } catch (error) {
        if (error instanceof MulkApiError && error.status === 404) return null;
        throw error;
      }
    },
  });
}

export function usePendingKycApplications() {
  return useQuery({
    queryKey: ["kyc-applications"],
    queryFn: () => api.pendingKycApplications(),
  });
}

export function usePendingSubscriptions() {
  return useQuery({
    queryKey: ["subscriptions", "PENDING"],
    queryFn: () => api.listSubscriptions("PENDING"),
  });
}
