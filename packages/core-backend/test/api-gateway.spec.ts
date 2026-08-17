import { Wallet } from "ethers";
import { describe, expect, it } from "vitest";
import { createGatewayStack } from "../src/api/compose.js";
import { signHmacSha256 } from "../src/identity/hmac.js";

const NAV = "1000000";

async function onboardVerified(stack: ReturnType<typeof createGatewayStack>, investorId: string, wallet: string, onchainId: string) {
  await stack.app.request("/api/v1/investor/kyc/init", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ investorId, wallet, onchainId, provider: "SUMSUB" }),
  });
  const payload = {
    provider: "SUMSUB",
    applicantId: `app-${investorId}`,
    investorId,
    wallet,
    onchainId,
    reviewStatus: "completed",
    reviewAnswer: "GREEN",
    country: "KZ",
  };
  const rawBody = JSON.stringify(payload);
  await stack.app.request("/api/v1/webhooks/kyc/sumsub", {
    method: "POST",
    headers: { "content-type": "application/json", "x-payload-digest": signHmacSha256(rawBody, stack.webhookSecret) },
    body: rawBody,
  });
  await stack.syncer.processQueue();
}

describe("API Gateway", () => {
  it("registers an asset, accepts a limit order, clears the batch and distributes NOI", async () => {
    const stack = createGatewayStack();
    const investor = Wallet.createRandom();
    const onchainId = Wallet.createRandom();
    const issuerWallet = Wallet.createRandom();

    const init = await stack.app.request("/api/v1/investor/kyc/init", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        investorId: "inv-1",
        wallet: investor.address,
        onchainId: onchainId.address,
        provider: "SUMSUB",
        email: "a@b.kz",
      }),
    });
    expect(init.status).toBe(201);

    await onboardVerified(stack, "inv-1", investor.address, onchainId.address);

    const asset = await stack.app.request("/api/v1/issuer/assets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        assetId: "MULK-TOWER",
        name: "Almaty Tower",
        cadastralNumber: "KZ-75-123-456-789",
        nav: NAV,
        spvName: "Mulk Tower SPV",
        spvBin: "123456789012",
      }),
    });
    expect(asset.status).toBe(201);
    const listed = (await asset.json()) as { cadastreHash: string; nav: string };
    expect(listed.cadastreHash.startsWith("0x")).toBe(true);
    expect(listed.nav).toBe(NAV);

    const mint = await stack.app.request("/api/v1/issuer/mint/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assetId: "MULK-TOWER", to: issuerWallet.address, amount: "1000" }),
    });
    expect(mint.status).toBe(201);
    const mintBody = (await mint.json()) as { status: string; proof: string };
    expect(mintBody.status).toBe("PROOF_ISSUED");
    expect(mintBody.proof.startsWith("0x")).toBe(true);

    const status = await stack.app.request("/api/v1/auction/status?assetId=MULK-TOWER");
    expect(status.status).toBe(200);
    const window = (await status.json()) as { open: boolean; priceCollar: string; collar: { min: string; max: string } };
    expect(window.open).toBe(true);
    expect(window.priceCollar).toBe("NAV ±10%");
    expect(window.collar.min).toBe("900000");
    expect(window.collar.max).toBe("1100000");

    const order = await stack.app.request("/api/v1/investor/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        investorId: "inv-1",
        assetId: "MULK-TOWER",
        side: "BUY",
        price: NAV,
        quantity: "10",
      }),
    });
    expect(order.status).toBe(201);

    const yieldRes = await stack.app.request("/api/v1/issuer/yield/trigger", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        distributionId: "DIV-2026-Q2",
        assetId: "MULK-TOWER",
        recordDate: "2026-06-30",
        grossRentalIncomeTiyn: "1000000",
        operatingExpensesTiyn: "200000",
        holders: [
          { investorId: "inv-1", wallet: investor.address, iban: "KZ-1", balance: "70", whtBps: "0" },
          { investorId: "inv-2", wallet: Wallet.createRandom().address, iban: "KZ-2", balance: "30", whtBps: "1500" },
        ],
      }),
    });
    expect(yieldRes.status).toBe(201);
    const register = (await yieldRes.json()) as { noiTiyn: string; spvReserveTiyn: string };
    expect(register.noiTiyn).toBe("800000");
    expect(register.spvReserveTiyn).toBe("40000");

    const history = await stack.app.request("/api/v1/investor/yield/history?investorId=inv-1");
    expect(history.status).toBe(200);
    const historyBody = (await history.json()) as { distributions: unknown[] };
    expect(historyBody.distributions).toHaveLength(1);

    const portfolio = await stack.app.request("/api/v1/investor/portfolio?investorId=inv-1");
    expect(portfolio.status).toBe(200);
    const port = (await portfolio.json()) as { status: string; accruedDividendsTiyn: string; transactions: unknown[] };
    expect(port.status).toBe("VERIFIED");
    expect(port.accruedDividendsTiyn).toBe("532000");
    expect(port.transactions.length).toBeGreaterThanOrEqual(2);

    const forbidden = await stack.app.request("/api/v1/auction/clear", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assetId: "MULK-TOWER" }),
    });
    expect(forbidden.status).toBe(401);

    const cleared = await stack.app.request("/api/v1/auction/clear", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-key": stack.adminApiKey },
      body: JSON.stringify({ assetId: "MULK-TOWER" }),
    });
    expect(cleared.status).toBe(200);
    const batch = (await cleared.json()) as { executableVolume: string; fingerprint: string };
    expect(batch.fingerprint).toHaveLength(64);
    expect(batch.executableVolume).toBe("0");

    const spec = await stack.app.request("/api/v1/openapi.json");
    expect(spec.status).toBe(200);
    const openapi = (await spec.json()) as { openapi: string; paths: Record<string, unknown> };
    expect(openapi.openapi).toBe("3.1.0");
    expect(openapi.paths["/api/v1/investor/orders"]).toBeTruthy();
    expect(openapi.paths["/api/v1/issuer/assets"]).toBeTruthy();
    expect(openapi.paths["/api/v1/issuer/yield/trigger"]).toBeTruthy();
  });
});
