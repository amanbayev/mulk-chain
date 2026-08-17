import { NextRequest, NextResponse } from "next/server";
import { demoStore, isDemoError } from "@/lib/api/demo-store";

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
