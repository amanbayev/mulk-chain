import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIMARY_RPC =
  process.env.ARBITRUM_SEPOLIA_RPC_URL ??
  process.env.ARBITRUM_SEPOLIA_RPC_FALLBACK ??
  process.env.ANVIL_RPC_URL ??
  "https://sepolia-rollup.arbitrum.io/rpc";

const FALLBACK_RPC = process.env.ARBITRUM_SEPOLIA_RPC_FALLBACK ?? "https://sepolia-rollup.arbitrum.io/rpc";

async function forward(url: string, body: string): Promise<Response> {
  const upstream = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    signal: AbortSignal.timeout(12_000),
  });
  const payload = await upstream.text();
  return new Response(payload, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.text();
  try {
    const primary = await forward(PRIMARY_RPC, body);
    if (primary.status < 400) return primary;
    if (PRIMARY_RPC !== FALLBACK_RPC) {
      const fallback = await forward(FALLBACK_RPC, body);
      if (fallback.status < 400) return fallback;
    }
    return primary;
  } catch {
    try {
      return await forward(FALLBACK_RPC, body);
    } catch {
      return NextResponse.json(
        { jsonrpc: "2.0", id: null, error: { code: -32000, message: "Arbitrum Sepolia RPC unreachable" } },
        { status: 503 },
      );
    }
  }
}
