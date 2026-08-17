import { describe, expect, it } from "vitest";
import {
  MockBankEscrowGateway,
  MockIdentityRegistry,
  MockMulkTokenEscrow,
} from "../src/settlement/adapters.js";
import { DvpOrchestratorService } from "../src/settlement/dvp-orchestrator.service.js";
import type { SettlementInstruction } from "../src/settlement/types.js";

function instruction(): SettlementInstruction {
  return {
    id: "dvp-1",
    buyerId: "buyer",
    sellerId: "seller",
    tokenAssetId: "MULK-TOWER",
    tokenAmount: 100n,
    kztTiyn: 1_000_000n,
    buyerWallet: "0xbuyer",
    sellerWallet: "0xseller",
    buyerIban: "KZ-BUYER",
    sellerIban: "KZ-SELLER",
  };
}

function setup(options?: { verifyBuyer?: boolean; verifySeller?: boolean }) {
  const bank = new MockBankEscrowGateway();
  const identity = new MockIdentityRegistry();
  const token = new MockMulkTokenEscrow();
  bank.credit("KZ-BUYER", 1_000_000n);
  token.credit("0xseller", 100n);
  if (options?.verifyBuyer !== false) identity.markVerified("0xbuyer");
  if (options?.verifySeller !== false) identity.markVerified("0xseller");
  const dvp = new DvpOrchestratorService({ bank, identity, token });
  return { bank, identity, token, dvp };
}

describe("DvP T+0 orchestrator", () => {
  it("settles atomically when cash lock, KYC, token lock and both releases succeed", async () => {
    const { bank, token, dvp } = setup();
    const record = await dvp.settle(instruction());

    expect(record.status).toBe("SETTLED");
    expect(record.buyerVerified).toBe(true);
    expect(record.sellerVerified).toBe(true);
    expect(record.cashReleased).toBe(true);
    expect(record.tokensReleased).toBe(true);
    expect(bank.balances.get("KZ-SELLER")).toBe(1_000_000n);
    expect(bank.balances.get("KZ-BUYER")).toBe(0n);
    expect(token.balances.get("0xbuyer")).toBe(100n);
    expect(token.balances.get("0xseller")).toBe(0n);
    expect(record.compensation).toHaveLength(0);
  });

  it("fails without touching tokens when the bank escrow gateway rejects Leg A", async () => {
    const { bank, token, dvp } = setup();
    bank.flags.failCashLock = true;

    const record = await dvp.settle(instruction());
    expect(record.status).toBe("FAILED");
    expect(record.failure?.stage).toBe("CASH_LOCK");
    expect(record.tokenLock).toBeNull();
    expect(token.balances.get("0xseller")).toBe(100n);
    expect(bank.balances.get("KZ-BUYER")).toBe(1_000_000n);
  });

  it("rolls back both legs when the bank gateway fails seller credit after locks", async () => {
    const { bank, token, dvp } = setup();
    bank.flags.failCashRelease = true;

    const record = await dvp.settle(instruction());
    expect(record.status).toBe("COMPENSATED");
    expect(record.failure?.stage).toBe("CASH_RELEASE");
    expect(record.compensation.some((step) => step.action === "REVERSE_CASH_LOCK" && step.ok)).toBe(true);
    expect(record.compensation.some((step) => step.action === "REVERSE_TOKEN_RELEASE" && step.ok)).toBe(true);
    expect(bank.balances.get("KZ-BUYER")).toBe(1_000_000n);
    expect(bank.balances.get("KZ-SELLER") ?? 0n).toBe(0n);
    expect(token.balances.get("0xseller")).toBe(100n);
    expect(token.balances.get("0xbuyer") ?? 0n).toBe(0n);
  });

  it("compensates the cash lock when the buyer is not isVerified on Leg B", async () => {
    const { bank, token, dvp } = setup({ verifyBuyer: false });
    const record = await dvp.settle(instruction());

    expect(record.status).toBe("COMPENSATED");
    expect(record.failure?.stage).toBe("KYC");
    expect(record.buyerVerified).toBe(false);
    expect(record.compensation.some((step) => step.action === "REVERSE_CASH_LOCK" && step.ok)).toBe(true);
    expect(bank.balances.get("KZ-BUYER")).toBe(1_000_000n);
    expect(token.balances.get("0xseller")).toBe(100n);
  });
});
