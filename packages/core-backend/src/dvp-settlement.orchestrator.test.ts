import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DvpSettlementOrchestrator,
  InMemoryBankEscrow,
  InMemoryTokenEscrow,
  type SettlementInstruction,
} from "./dvp-settlement.orchestrator.ts";

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

describe("DvP T+0 orchestrator", () => {
  it("settles when both cash and token legs succeed", async () => {
    const bank = new InMemoryBankEscrow();
    const chain = new InMemoryTokenEscrow();
    bank.credit("KZ-BUYER", 1_000_000n);
    chain.credit("0xseller", 100n);
    const dvp = new DvpSettlementOrchestrator(bank, chain);

    const record = await dvp.settle(instruction());
    assert.equal(record.status, "SETTLED");
    assert.equal(bank.balances.get("KZ-SELLER"), 1_000_000n);
    assert.equal(bank.balances.get("KZ-BUYER"), 0n);
    assert.equal(chain.balances.get("0xbuyer"), 100n);
    assert.equal(chain.balances.get("0xseller"), 0n);
  });

  it("reverses the cash lock if the token hold fails", async () => {
    const bank = new InMemoryBankEscrow();
    const chain = new InMemoryTokenEscrow();
    bank.credit("KZ-BUYER", 1_000_000n);
    chain.flags.failTokenLock = true;
    const dvp = new DvpSettlementOrchestrator(bank, chain);

    const record = await dvp.settle(instruction());
    assert.equal(record.status, "COMPENSATED");
    assert.equal(record.failure?.stage, "TOKEN_LOCK");
    assert.equal(bank.balances.get("KZ-BUYER"), 1_000_000n);
    assert.ok(record.compensation.some((step) => step.action === "REVERSE_CASH_LOCK" && step.ok));
  });

  it("claws back a released token leg if cash release fails", async () => {
    const bank = new InMemoryBankEscrow();
    const chain = new InMemoryTokenEscrow();
    bank.credit("KZ-BUYER", 1_000_000n);
    chain.credit("0xseller", 100n);
    bank.flags.failCashRelease = true;
    const dvp = new DvpSettlementOrchestrator(bank, chain);

    const record = await dvp.settle(instruction());
    assert.equal(record.status, "COMPENSATED");
    assert.equal(record.failure?.stage, "CASH_RELEASE");
    assert.equal(chain.balances.get("0xseller"), 100n);
    assert.equal(chain.balances.get("0xbuyer") ?? 0n, 0n);
    assert.equal(bank.balances.get("KZ-BUYER"), 1_000_000n);
  });
});
