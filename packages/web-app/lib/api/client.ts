import type {
  ApiErrorBody,
  AuctionStatus,
  CreateSubscriptionBody,
  DividendRegister,
  InitKycBody,
  InvestorProfile,
  MintAuthorization,
  MintRequestBody,
  PortfolioResponse,
  RegisterAssetBody,
  RegisterInvestorBody,
  SubmitOrderBody,
  SubmitOrderResponse,
  SubscriptionRequest,
  TriggerYieldBody,
  YieldHistoryResponse,
} from "@/lib/api/types";

export class MulkApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly issues?: ApiErrorBody["issues"],
  ) {
    super(message);
    this.name = "MulkApiError";
  }
}

function apiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  return base && base.length > 0 ? base.replace(/\/$/, "") : "";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as ApiErrorBody & T;
  if (!response.ok) {
    throw new MulkApiError(
      response.status,
      payload.code ?? "HTTP_ERROR",
      payload.message ?? response.statusText,
      payload.issues,
    );
  }
  return payload as T;
}

export const api = {
  initKyc(body: InitKycBody): Promise<InvestorProfile> {
    return request("/api/v1/investor/kyc/init", { method: "POST", body: JSON.stringify(body) });
  },
  registerInvestor(body: RegisterInvestorBody): Promise<InvestorProfile> {
    return request("/api/v1/investor/register", { method: "POST", body: JSON.stringify(body) });
  },
  investorProfile(wallet: string): Promise<InvestorProfile> {
    return request(`/api/v1/investor/profile?wallet=${encodeURIComponent(wallet)}`);
  },
  pendingKycApplications(): Promise<InvestorProfile[]> {
    return request("/api/v1/issuer/kyc/applications");
  },
  confirmKyc(wallet: string): Promise<InvestorProfile> {
    return request("/api/v1/issuer/kyc/confirm", { method: "POST", body: JSON.stringify({ wallet }) });
  },
  subscribe(body: CreateSubscriptionBody): Promise<SubscriptionRequest> {
    return request("/api/v1/investor/subscribe", { method: "POST", body: JSON.stringify(body) });
  },
  listSubscriptions(status?: SubscriptionRequest["status"]): Promise<SubscriptionRequest[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return request(`/api/v1/issuer/subscriptions${query}`);
  },
  fillSubscription(id: string): Promise<SubscriptionRequest> {
    return request("/api/v1/issuer/subscriptions/fill", { method: "POST", body: JSON.stringify({ id }) });
  },
  portfolio(investorId: string): Promise<PortfolioResponse> {
    return request(`/api/v1/investor/portfolio?investorId=${encodeURIComponent(investorId)}`);
  },
  placeOrder(body: SubmitOrderBody): Promise<SubmitOrderResponse> {
    return request("/api/v1/investor/orders", { method: "POST", body: JSON.stringify(body) });
  },
  yieldHistory(investorId: string): Promise<YieldHistoryResponse> {
    return request(`/api/v1/investor/yield/history?investorId=${encodeURIComponent(investorId)}`);
  },
  registerAsset(body: RegisterAssetBody) {
    return request<RegisterAssetBody & { cadastreHash: `0x${string}`; createdAt: string; spvReserveBps: number }>(
      "/api/v1/issuer/assets",
      { method: "POST", body: JSON.stringify(body) },
    );
  },
  requestMint(body: MintRequestBody): Promise<MintAuthorization> {
    return request("/api/v1/issuer/mint/request", { method: "POST", body: JSON.stringify(body) });
  },
  triggerYield(body: TriggerYieldBody): Promise<DividendRegister> {
    return request("/api/v1/issuer/yield/trigger", { method: "POST", body: JSON.stringify(body) });
  },
  auctionStatus(assetId: string): Promise<AuctionStatus> {
    return request(`/api/v1/auction/status?assetId=${encodeURIComponent(assetId)}`);
  },
};
