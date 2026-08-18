import { demoStore } from "@/lib/api/demo-store";
import type {
  AdminStats,
  ApplicationReviewStatus,
  CreateSubscriptionBody,
  DecideApplicationBody,
  InvestorProfile,
  KycApplication,
  RegisterInvestorBody,
  SubscriptionRequest,
} from "@/lib/api/types";
import * as neonStore from "@/lib/db/neon-store";

function useNeon(): boolean {
  return neonStore.hasDatabaseUrl();
}

export async function persistRegisterInvestor(body: RegisterInvestorBody): Promise<InvestorProfile> {
  return useNeon() ? neonStore.registerInvestor(body) : demoStore.registerInvestor(body);
}

export async function persistProfileByWallet(wallet: string): Promise<InvestorProfile | null> {
  return useNeon() ? neonStore.findProfile(wallet) : demoStore.profileByWallet(wallet);
}

export async function persistPendingKycApplications(): Promise<InvestorProfile[]> {
  return useNeon() ? neonStore.pendingKycApplications() : demoStore.pendingKycApplications();
}

export async function persistConfirmKyc(wallet: string): Promise<InvestorProfile> {
  return useNeon() ? neonStore.confirmKyc(wallet) : demoStore.confirmKyc(wallet);
}

export async function persistListApplications(status?: ApplicationReviewStatus): Promise<KycApplication[]> {
  return useNeon() ? neonStore.listApplications(status) : demoStore.listApplications(status);
}

export async function persistGetApplication(id: string): Promise<KycApplication> {
  return useNeon() ? neonStore.getApplication(id) : demoStore.getApplication(id);
}

export async function persistListInvestors(): Promise<InvestorProfile[]> {
  return useNeon() ? neonStore.listInvestors() : demoStore.listInvestors();
}

export async function persistAdminStats(): Promise<AdminStats> {
  return useNeon() ? neonStore.adminStats() : demoStore.adminStats();
}

export async function persistDecideApplication(body: DecideApplicationBody): Promise<KycApplication> {
  return useNeon() ? neonStore.decideApplication(body) : demoStore.decideApplication(body);
}

export async function persistCreateSubscription(body: CreateSubscriptionBody): Promise<SubscriptionRequest> {
  return useNeon() ? neonStore.createSubscription(body) : demoStore.createSubscription(body);
}

export async function persistListSubscriptions(status?: SubscriptionRequest["status"]): Promise<SubscriptionRequest[]> {
  return useNeon() ? neonStore.listSubscriptions(status) : demoStore.listSubscriptions(status);
}

export async function persistFillSubscription(id: string): Promise<SubscriptionRequest> {
  return useNeon() ? neonStore.fillSubscription(id) : demoStore.fillSubscription(id);
}
