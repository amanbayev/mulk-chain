import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANVIL = process.env.ANVIL_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.text();
    const upstream = await fetch(ANVIL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: AbortSignal.timeout(4_000),
    });
    const payload = await upstream.text();
    return new Response(payload, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32000, message: "Anvil RPC unreachable" } },
      { status: 503 },
    );
  }
}
