import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runPeriodicBatchAuction, type AuctionOrder } from "./batch-auction.engine.ts";

function order(id: string, side: AuctionOrder["side"], price: bigint, quantity: bigint): AuctionOrder {
  return { id, side, price, quantity, ownerId: id };
}

describe("Periodic Batch Auction", () => {
  it("rejects orders outside the ±10% NAV collar", () => {
    const nav = 1_000_000n;
    const result = runPeriodicBatchAuction({
      nav,
      orders: [
        order("cheap", "BUY", 800_000n, 10n),
        order("rich", "SELL", 1_200_000n, 10n),
        order("bid", "BUY", 1_000_000n, 5n),
        order("ask", "SELL", 1_000_000n, 5n),
      ],
    });

    assert.equal(result.collar.min, 900_000n);
    assert.equal(result.collar.max, 1_100_000n);
    assert.equal(result.rejected.length, 2);
    assert.equal(result.equilibriumPrice, 1_000_000n);
    assert.equal(result.executableVolume, 5n);
  });

  it("clears at the equilibrium price with pro-rata on the surplus side", () => {
    const nav = 10_000n;
    const result = runPeriodicBatchAuction({
      nav,
      orders: [
        order("b1", "BUY", 10_500n, 60n),
        order("b2", "BUY", 10_000n, 40n),
        order("s1", "SELL", 9_500n, 30n),
        order("s2", "SELL", 10_000n, 20n),
      ],
    });

    assert.ok(result.equilibriumPrice !== null);
    assert.equal(result.executableVolume, 50n);
    assert.equal(result.demandAtEq, 100n);
    assert.equal(result.supplyAtEq, 50n);

    const buyFills = result.fills.filter((fill) => fill.side === "BUY");
    const sellFills = result.fills.filter((fill) => fill.side === "SELL");
    const buyQty = buyFills.reduce((acc, fill) => acc + fill.filledQuantity, 0n);
    const sellQty = sellFills.reduce((acc, fill) => acc + fill.filledQuantity, 0n);
    assert.equal(buyQty, sellQty);
    assert.equal(buyQty, 50n);

    const b1 = buyFills.find((fill) => fill.orderId === "b1");
    const b2 = buyFills.find((fill) => fill.orderId === "b2");
    assert.equal(b1?.filledQuantity, 30n);
    assert.equal(b2?.filledQuantity, 20n);
    assert.equal(b1?.cashAmount, 30n * result.equilibriumPrice!);
  });

  it("returns no match when the book cannot cross inside the collar", () => {
    const result = runPeriodicBatchAuction({
      nav: 100n,
      orders: [order("b", "BUY", 90n, 1n), order("s", "SELL", 110n, 1n)],
    });
    assert.equal(result.equilibriumPrice, null);
    assert.equal(result.executableVolume, 0n);
    assert.equal(result.fills.length, 0);
  });
});
