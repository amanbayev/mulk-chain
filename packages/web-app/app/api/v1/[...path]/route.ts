import { NextRequest, NextResponse } from "next/server";
import { authorizeAdmin, isAdminWallet } from "@/lib/api/admin-auth";
import { demoStore } from "@/lib/api/demo-store";
import { isDemoError } from "@/lib/api/errors";
import {
  persistAdminStats,
  persistConfirmKyc,
  persistCreateSubscription,
  persistDecideApplication,
  persistFillSubscription,
  persistGetApplication,
  persistListApplications,
  persistListInvestors,
  persistListSubscriptions,
  persistPendingKycApplications,
  persistProfileByWallet,
  persistRegisterInvestor,
} from "@/lib/api/persist";
import type { ApplicationReviewStatus, DecideApplicationBody } from "@/lib/api/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  const origin = process.env.CORE_BACKEND_URL?.replace(/\/$/, "");
  if (!origin) return handleDemo(request, path);
  const url = new URL(`/api/v1/${path.join("/")}`, origin);
  url.search = request.nextUrl.search;
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const adminKey = request.headers.get("x-admin-key");
  if (contentType) headers.set("content-type", contentType);
  if (adminKey) headers.set("x-admin-key", adminKey);
  const method = request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await request.text();
  const upstream = await fetch(url, { method, headers, body });
  const payload = await upstream.text();
  return new NextResponse(payload, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

async function handleDemo(request: NextRequest, path: string[]): Promise<NextResponse> {
  const route = `/${path.join("/")}`;
  const search = request.nextUrl.searchParams;
  try {
    if (request.method === "POST" && route === "/investor/kyc/init") {
      return json(demoStore.initKyc(await request.json()), 201);
    }
    if (request.method === "POST" && route === "/investor/register") {
      return json(await persistRegisterInvestor(await request.json()), 201);
    }
    if (request.method === "GET" && route === "/investor/profile") {
      const wallet = search.get("wallet");
      if (!wallet) return json({ code: "MISSING_WALLET", message: "wallet query is required" }, 400);
      const profile = await persistProfileByWallet(wallet);
      if (!profile) return json({ code: "INVESTOR_NOT_FOUND", message: `unknown wallet ${wallet}` }, 404);
      return json(profile);
    }
    if (request.method === "GET" && route === "/issuer/kyc/applications") {
      return json(await persistPendingKycApplications());
    }
    if (request.method === "POST" && route === "/issuer/kyc/confirm") {
      const body = (await request.json()) as { wallet?: string };
      if (!body.wallet) return json({ code: "MISSING_WALLET", message: "wallet is required" }, 400);
      return json(await persistConfirmKyc(body.wallet));
    }
    if (request.method === "POST" && route === "/investor/subscribe") {
      return json(await persistCreateSubscription(await request.json()), 201);
    }
    if (request.method === "GET" && route === "/issuer/subscriptions") {
      const status = search.get("status");
      return json(await persistListSubscriptions(status === "PENDING" || status === "FILLED" ? status : undefined));
    }
    if (request.method === "POST" && route === "/issuer/subscriptions/fill") {
      const body = (await request.json()) as { id?: string };
      if (!body.id) return json({ code: "MISSING_ID", message: "id is required" }, 400);
      return json(await persistFillSubscription(body.id));
    }
    if (request.method === "GET" && route === "/admin/session") {
      const wallet = request.headers.get("x-admin-wallet") ?? search.get("wallet");
      return json({ authorized: isAdminWallet(wallet) });
    }
    if (route.startsWith("/admin/")) {
      const gate = authorizeAdmin(request.headers);
      if (!gate.ok) return json({ code: "FORBIDDEN", message: gate.message }, gate.status);
    }
    if (request.method === "GET" && route === "/admin/stats") {
      return json(await persistAdminStats());
    }
    if (request.method === "GET" && route === "/admin/applications") {
      const status = search.get("status") as ApplicationReviewStatus | null;
      const allowed = status === "SUBMITTED" || status === "APPROVED" || status === "REJECTED" ? status : undefined;
      return json(await persistListApplications(allowed));
    }
    if (request.method === "GET" && route === "/admin/investors") {
      return json(await persistListInvestors());
    }
    if (request.method === "GET" && route.startsWith("/admin/applications/")) {
      const id = path[2];
      if (!id) return json({ code: "MISSING_ID", message: "application id is required" }, 400);
      return json(await persistGetApplication(id));
    }
    if (request.method === "POST" && route === "/admin/applications/decide") {
      const body = (await request.json()) as DecideApplicationBody;
      if (!body.id || !body.action || !body.reviewerWallet) {
        return json({ code: "INVALID_BODY", message: "id, action and reviewerWallet are required" }, 400);
      }
      return json(await persistDecideApplication(body));
    }
    if (request.method === "GET" && route === "/investor/portfolio") {
      const investorId = search.get("investorId");
      if (!investorId) return json({ code: "MISSING_INVESTOR", message: "investorId query is required" }, 400);
      return json(demoStore.portfolio(investorId));
    }
    if (request.method === "POST" && route === "/investor/orders") {
      return json(demoStore.placeOrder(await request.json()), 201);
    }
    if (request.method === "GET" && route === "/investor/yield/history") {
      const investorId = search.get("investorId");
      if (!investorId) return json({ code: "MISSING_INVESTOR", message: "investorId query is required" }, 400);
      return json(demoStore.yieldHistoryFor(investorId));
    }
    if (request.method === "POST" && route === "/issuer/assets") {
      return json(demoStore.registerAsset(await request.json()), 201);
    }
    if (request.method === "POST" && route === "/issuer/mint/request") {
      return json(demoStore.requestMint(await request.json()), 201);
    }
    if (request.method === "POST" && route === "/issuer/yield/trigger") {
      return json(demoStore.triggerYield(await request.json()), 201);
    }
    if (request.method === "GET" && route === "/auction/status") {
      return json(demoStore.auctionStatus(search.get("assetId") ?? undefined));
    }
    if (request.method === "GET" && route === "/issuer/assets") {
      const assetId = search.get("assetId");
      if (!assetId) return json({ code: "MISSING_ASSET", message: "assetId query is required" }, 400);
      const asset = demoStore.getAsset(assetId);
      if (!asset) return json({ code: "ASSET_NOT_FOUND", message: `unknown asset ${assetId}` }, 404);
      return json(asset);
    }
    if (request.method === "GET" && route === "/issuer/mint/latest") {
      const assetId = search.get("assetId") ?? "";
      return json(demoStore.latestMint(assetId));
    }
    return json({ code: "NOT_FOUND", message: `no demo handler for ${request.method} /api/v1${route}` }, 404);
  } catch (error) {
    if (isDemoError(error)) {
      return json({ code: error.code, message: error.message }, error.status);
    }
    const message = error instanceof Error ? error.message : "internal error";
    return json({ code: "INTERNAL_ERROR", message }, 500);
  }
}

function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export async function GET(request: NextRequest, context: { params: { path: string[] } }) {
  return proxy(request, context.params.path);
}

export async function POST(request: NextRequest, context: { params: { path: string[] } }) {
  return proxy(request, context.params.path);
}
