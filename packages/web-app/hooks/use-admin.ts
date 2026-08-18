"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { api } from "@/lib/api/client";
import type { ApplicationReviewStatus } from "@/lib/api/types";

export function useAdminSession() {
  const { address } = useAccount();
  return useQuery({
    queryKey: ["admin-session", address],
    queryFn: () => api.adminSession(address),
  });
}

export function useAdminStats() {
  const { address } = useAccount();
  const session = useAdminSession();
  return useQuery({
    queryKey: ["admin-stats", address],
    enabled: Boolean(session.data?.authorized),
    queryFn: () => api.adminStats(address),
  });
}

export function useAdminApplications(status?: ApplicationReviewStatus) {
  const { address } = useAccount();
  const session = useAdminSession();
  return useQuery({
    queryKey: ["admin-applications", status, address],
    enabled: Boolean(session.data?.authorized),
    queryFn: () => api.adminApplications(address, status),
  });
}

export function useAdminApplication(id: string) {
  const { address } = useAccount();
  const session = useAdminSession();
  return useQuery({
    queryKey: ["admin-application", id, address],
    enabled: Boolean(id && session.data?.authorized),
    queryFn: () => api.adminApplication(id, address),
  });
}

export function useAdminInvestors() {
  const { address } = useAccount();
  const session = useAdminSession();
  return useQuery({
    queryKey: ["admin-investors", address],
    enabled: Boolean(session.data?.authorized),
    queryFn: () => api.adminInvestors(address),
  });
}
