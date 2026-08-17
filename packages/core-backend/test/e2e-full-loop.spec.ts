import { Wallet } from "ethers";
import { describe, expect, it } from "vitest";
import { createGatewayStack } from "../src/api/compose.js";
import { loadContractsConfig } from "../src/config/load-contracts.js";
import { signHmacSha256 } from "../src/identity/hmac.js";

const ASSET_ID = "BAITEREK-01";
const CADASTRE = "KZ-AST-2026-TOWER-01";
const NAV = 50_000n;
const MINT_AMOUNT = 10_000n;
const TRADE_QTY = 100n;
const TRADE_PRICE = 50_000n;
const BOB_CASH = 10_000_000n;
const NOI = 1_000_000n;
const BOB_WHT_BPS = 1_000n;

function logStep(step: number, title: string, detail?: unknown): void {
  console.log(`\n[E2E] ── Step ${step}. ${title}`);
  if (detail !== undefined) {
    console.log("[E2E]", typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
  }
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

describe("E2E Full-Loop Lifecycle", () => {
  it("registers Baiterek, mints, onboards Alice & Bob, clears the auction, settles DvP T+0 and pays NOI", async () => {
    const stack = createGatewayStack();
    const contracts = loadContractsConfig();
    console.log("[E2E] Local stack ready. Cadastre template:", contracts.cadastreNumber);
    console.log("[E2E] RPC", contracts.rpcUrl, "chainId", contracts.chainId);

    const issuer = Wallet.createRandom();
    const issuerOid = Wallet.createRandom();
    const alice = Wallet.createRandom();
    const aliceOid = Wallet.createRandom();
    const bob = Wallet.createRandom();
    const bobOid = Wallet.createRandom();

    await onboard(stack, {
      investorId: "issuer",
      wallet: issuer.address,
      onchainId: issuerOid.address,
      iban: "KZ-ISSUER-BAITEREK",
      whtBps: "0",
      professional: true,
    });
    logStep(0, "Issuer wallet verified on IdentityRegistry (required for verified mint + sell)");

    logStep(1, 'Register asset "Baiterek Business Center" via POST /api/v1/issuer/assets');
    const assetRes = await stack.app.request("/api/v1/issuer/assets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        assetId: ASSET_ID,
        name: "Baiterek Business Center",
        cadastralNumber: CADASTRE,
        nav: NAV.toString(),
        spvName: "Baiterek Tower SPV Ltd.",
        spvBin: "240840012345",
        spvReserveBps: 500,
      }),
    });
    expect(assetRes.status).toBe(201);
    const asset = await readJson<{ name: string; cadastralNumber: string; nav: string; cadastreHash: string }>(assetRes);
    expect(asset.name).toBe("Baiterek Business Center");
    expect(asset.cadastralNumber).toBe(CADASTRE);
    expect(asset.nav).toBe(NAV.toString());
    console.log("[E2E] Asset listed. cadastreHash", asset.cadastreHash, "NAV", asset.nav, "collar ±10%");

    logStep(2, "Gov-Oracle mint authorization + verified mint of 10,000 MULK to the issuer");
    const mintRes = await stack.app.request("/api/v1/issuer/mint/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assetId: ASSET_ID, to: issuer.address, amount: MINT_AMOUNT.toString() }),
    });
    expect(mintRes.status).toBe(201);
    const mint = await readJson<{ status: string; proof: string; cadastreHash: string; amount?: string }>(mintRes);
    expect(mint.status).toBe("PROOF_ISSUED");
    expect(mint.proof.startsWith("0x")).toBe(true);
    expect(stack.platform.balances.get("issuer")?.get(ASSET_ID)).toBe(MINT_AMOUNT);
    expect(stack.token.balances.get(issuer.address)).toBe(MINT_AMOUNT);
    expect(await stack.registry.isVerified(issuer.address)).toBe(true);
    console.log("[E2E] Verified mint complete. Issuer MULK", MINT_AMOUNT.toString(), "proof", mint.proof);

    logStep(3, "Onboard Alice: Sumsub KYC Passed → Class Professional → IdentityRegistry sync");
    await onboard(stack, {
      investorId: "alice",
      wallet: alice.address,
      onchainId: aliceOid.address,
      iban: "KZ-ALICE-001",
      whtBps: BOB_WHT_BPS.toString(),
      professional: true,
    });
    const aliceRecord = stack.kycWebhook.investors.get("alice");
    expect(aliceRecord?.kycValid).toBe(true);
    expect(aliceRecord?.investorClass).toBe("PROFESSIONAL");
    expect(await stack.registry.isVerified(alice.address)).toBe(true);
    console.log("[E2E] Alice verified. class", aliceRecord?.investorClass, "wallet", alice.address);

    logStep(4, "Onboard Bob: Sumsub webhook → IdentityRegistry sync + fund KZT for DvP");
    await onboard(stack, {
      investorId: "bob",
      wallet: bob.address,
      onchainId: bobOid.address,
      iban: "KZ-BOB-001",
      whtBps: BOB_WHT_BPS.toString(),
      professional: true,
    });
    expect(await stack.registry.isVerified(bob.address)).toBe(true);
    stack.bank.credit("KZ-BOB-001", BOB_CASH);
    console.log("[E2E] Bob verified. IBAN KZ-BOB-001 credited", BOB_CASH.toString(), "KZT");

    logStep(5, "Issuer Sell 100 @ 50,000 KZT; Bob Buy 100 @ 50,000 KZT");
    const sellRes = await stack.app.request("/api/v1/investor/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        investorId: "issuer",
        assetId: ASSET_ID,
        side: "SELL",
        price: TRADE_PRICE.toString(),
        quantity: TRADE_QTY.toString(),
      }),
    });
    expect(sellRes.status).toBe(201);
    const sell = await readJson<{ orderId: string; intervalId: string }>(sellRes);

    const buyRes = await stack.app.request("/api/v1/investor/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        investorId: "bob",
        assetId: ASSET_ID,
        side: "BUY",
        price: TRADE_PRICE.toString(),
        quantity: TRADE_QTY.toString(),
      }),
    });
    expect(buyRes.status).toBe(201);
    const buy = await readJson<{ orderId: string }>(buyRes);
    console.log("[E2E] Orders accepted. sell", sell.orderId, "buy", buy.orderId, "interval", sell.intervalId);

    logStep(6, "Trigger auction clearing POST /api/v1/auction/clear — equilibrium + matching");
    const clearRes = await stack.app.request("/api/v1/auction/clear", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-key": stack.adminApiKey },
      body: JSON.stringify({ assetId: ASSET_ID }),
    });
    expect(clearRes.status).toBe(200);
    const batch = await readJson<{
      equilibriumPrice: string;
      executableVolume: string;
      tradeCount: number;
      fingerprint: string;
      settlements: Array<{ status: string; cashReleased: boolean; tokensReleased: boolean; saga: unknown[] }>;
    }>(clearRes);
    expect(batch.equilibriumPrice).toBe(TRADE_PRICE.toString());
    expect(batch.executableVolume).toBe(TRADE_QTY.toString());
    expect(batch.tradeCount).toBe(1);
    expect(stack.platform.clearingQueue.size).toBe(1);
    console.log(
      "[E2E] Cleared. eq",
      batch.equilibriumPrice,
      "volume",
      batch.executableVolume,
      "fingerprint",
      batch.fingerprint,
    );

    logStep(7, "Atomic DvP T+0: hold Bob KZT → release cash to issuer + MulkToken to Bob");
    expect(batch.settlements).toHaveLength(1);
    expect(batch.settlements[0]?.status).toBe("SETTLED");
    expect(batch.settlements[0]?.cashReleased).toBe(true);
    expect(batch.settlements[0]?.tokensReleased).toBe(true);
    expect(stack.platform.balances.get("issuer")?.get(ASSET_ID)).toBe(MINT_AMOUNT - TRADE_QTY);
    expect(stack.platform.balances.get("bob")?.get(ASSET_ID)).toBe(TRADE_QTY);
    expect(stack.token.balances.get(bob.address)).toBe(TRADE_QTY);
    expect(stack.token.balances.get(issuer.address)).toBe(MINT_AMOUNT - TRADE_QTY);
    expect(stack.bank.balances.get("KZ-BOB-001")).toBe(BOB_CASH - TRADE_QTY * TRADE_PRICE);
    expect(stack.bank.balances.get("KZ-ISSUER-BAITEREK")).toBe(TRADE_QTY * TRADE_PRICE);
    console.log("[E2E] DvP SETTLED. Bob MULK 100; issuer MULK 9900; cash 5,000,000 KZT → issuer IBAN");

    logStep(8, "Issuer triggers NOI 1,000,000 KZT — 5% SPV reserve + WHT on Bob");
    const yieldRes = await stack.app.request("/api/v1/issuer/yield/trigger", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        distributionId: "NOI-2026-08",
        assetId: ASSET_ID,
        recordDate: "2026-08-17",
        grossRentalIncomeTiyn: NOI.toString(),
        operatingExpensesTiyn: "0",
      }),
    });
    expect(yieldRes.status).toBe(201);
    const register = await readJson<{
      noiTiyn: string;
      spvReserveTiyn: string;
      distributablePoolTiyn: string;
      lines: Array<{ investorId: string; snapshotBalance: string; grossDividendTiyn: string; withholdingTaxTiyn: string; netPayableTiyn: string }>;
    }>(yieldRes);
    expect(register.noiTiyn).toBe(NOI.toString());
    expect(register.spvReserveTiyn).toBe("50000");
    expect(register.distributablePoolTiyn).toBe("950000");

    const bobLine = register.lines.find((line) => line.investorId === "bob");
    const issuerLine = register.lines.find((line) => line.investorId === "issuer");
    const aliceLine = register.lines.find((line) => line.investorId === "alice");
    expect(aliceLine).toBeUndefined();
    expect(bobLine?.snapshotBalance).toBe("100");
    expect(bobLine?.grossDividendTiyn).toBe("9500");
    expect(bobLine?.withholdingTaxTiyn).toBe("950");
    expect(bobLine?.netPayableTiyn).toBe("8550");
    expect(issuerLine?.snapshotBalance).toBe("9900");
    expect(issuerLine?.grossDividendTiyn).toBe("940500");
    expect(issuerLine?.withholdingTaxTiyn).toBe("0");
    expect(issuerLine?.netPayableTiyn).toBe("940500");

    console.log("[E2E] NOI distributed. reserve 50,000 | pool 950,000");
    console.log("[E2E] Bob 100/10,000 → gross 9,500 − WHT 950 = net 8,550 KZT");
    console.log("[E2E] Issuer 9,900/10,000 → gross 940,500 (WHT 0) = net 940,500 KZT");
    console.log("[E2E] Full-Loop Lifecycle complete.");
  });
});

async function onboard(
  stack: ReturnType<typeof createGatewayStack>,
  input: {
    investorId: string;
    wallet: string;
    onchainId: string;
    iban: string;
    whtBps: string;
    professional: boolean;
  },
): Promise<void> {
  const init = await stack.app.request("/api/v1/investor/kyc/init", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      investorId: input.investorId,
      wallet: input.wallet,
      onchainId: input.onchainId,
      provider: "SUMSUB",
      country: "KZ",
      iban: input.iban,
      whtBps: input.whtBps,
    }),
  });
  expect(init.status).toBe(201);

  const payload = {
    provider: "SUMSUB",
    applicantId: `app-${input.investorId}`,
    investorId: input.investorId,
    wallet: input.wallet,
    onchainId: input.onchainId,
    reviewStatus: "completed",
    reviewAnswer: "GREEN",
    applicantType: "individual",
    pep: false,
    sanctionsHit: false,
    professional: input.professional,
    country: "KZ",
  };
  const rawBody = JSON.stringify(payload);
  const webhook = await stack.app.request("/api/v1/webhooks/kyc/sumsub", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-payload-digest": signHmacSha256(rawBody, stack.webhookSecret),
    },
    body: rawBody,
  });
  expect(webhook.status).toBe(200);
  console.log(
    `[E2E] FIFO IdentityRegistry jobs for ${input.investorId}: ${stack.syncer.queue.length} pending`,
  );
  const results = await stack.syncer.processQueue();
  expect(results.every((row) => row.ok)).toBe(true);
  console.log(`[E2E] Synced ${input.investorId} → IdentityRegistry (${results.length} txs)`);
}
