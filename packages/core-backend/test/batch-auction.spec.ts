import { describe, expect, it } from "vitest";
import { BatchAuctionEngine, runPeriodicBatchAuction } from "../src/auction/batch-auction.engine.js";
import type { LimitOrder } from "../src/auction/schemas.js";

function order(
  id: string,
  side: LimitOrder["side"],
  price: bigint,
  quantity: bigint,
  submittedAt?: Date,
): LimitOrder {
  return { id, side, price, quantity, ownerId: id, submittedAt };
}

describe("Periodic Batch Auction", () => {
  it("rejects orders outside the ±10% NAV collar", () => {
    const nav = 1_000_000n;
    const result = runPeriodicBatchAuction({
      assetId: "MULK-TOWER",
      nav,
      orders: [
        order("cheap", "BUY", 800_000n, 10n),
        order("rich", "SELL", 1_200_000n, 10n),
        order("bid", "BUY", 1_000_000n, 5n),
        order("ask", "SELL", 1_000_000n, 5n),
      ],
    });

    expect(result.collar.min).toBe(900_000n);
    expect(result.collar.max).toBe(1_100_000n);
    expect(result.rejected.map((row) => row.orderId).sort()).toEqual(["cheap", "rich"]);
    expect(result.rejected.every((row) => row.reason === "PRICE_COLLAR")).toBe(true);
    expect(result.equilibriumPrice).toBe(1_000_000n);
    expect(result.executableVolume).toBe(5n);
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]?.quantity).toBe(5n);
    expect(result.trades[0]?.cashAmount).toBe(5n * 1_000_000n);
  });

  it("selects the equilibrium price at the demand/supply crossing that maximises volume", () => {
    const result = runPeriodicBatchAuction({
      assetId: "MULK-TOWER",
      nav: 10_000n,
      orders: [
        order("b-high", "BUY", 10_500n, 10n),
        order("b-nav", "BUY", 10_000n, 40n),
        order("s-low", "SELL", 9_500n, 15n),
        order("s-nav", "SELL", 10_000n, 35n),
      ],
    });

    const atNav = result.curve.find((point) => point.price === 10_000n);
    expect(atNav?.demand).toBe(50n);
    expect(atNav?.supply).toBe(50n);
    expect(atNav?.volume).toBe(50n);
    expect(result.equilibriumPrice).toBe(10_000n);
    expect(result.executableVolume).toBe(50n);
    expect(result.demandAtEq).toBe(50n);
    expect(result.supplyAtEq).toBe(50n);

    const bought = result.trades.reduce((acc, trade) => acc + trade.quantity, 0n);
    expect(bought).toBe(50n);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.trades)).toBe(true);
  });

  it("fills aggressive orders first and pro-rates only orders at the cutoff price", () => {
    const result = runPeriodicBatchAuction({
      assetId: "MULK-TOWER",
      nav: 10_000n,
      orders: [
        order("b-aggressive", "BUY", 10_500n, 20n),
        order("b-cut-1", "BUY", 10_000n, 60n),
        order("b-cut-2", "BUY", 10_000n, 40n),
        order("s1", "SELL", 9_800n, 50n),
        order("s2", "SELL", 10_000n, 20n),
      ],
    });

    expect(result.equilibriumPrice).toBe(10_000n);
    expect(result.executableVolume).toBe(70n);
    expect(result.demandAtEq).toBe(120n);
    expect(result.supplyAtEq).toBe(70n);

    const buyQty = (orderId: string): bigint =>
      result.trades.filter((trade) => trade.buyOrderId === orderId).reduce((acc, trade) => acc + trade.quantity, 0n);

    expect(buyQty("b-aggressive")).toBe(20n);
    expect(buyQty("b-cut-1")).toBe(30n);
    expect(buyQty("b-cut-2")).toBe(20n);
    expect(buyQty("b-cut-1") + buyQty("b-cut-2")).toBe(50n);
  });

  it("returns an empty frozen batch when the book cannot cross inside the collar", () => {
    const result = runPeriodicBatchAuction({
      assetId: "MULK-TOWER",
      nav: 100n,
      orders: [order("b", "BUY", 90n, 1n), order("s", "SELL", 110n, 1n)],
    });
    expect(result.equilibriumPrice).toBeNull();
    expect(result.executableVolume).toBe(0n);
    expect(result.trades).toHaveLength(0);
    expect(result.fingerprint).toHaveLength(64);
  });

  it("collects limit orders over a trading interval then clears once", () => {
    const engine = new BatchAuctionEngine();
    const { intervalId, collar } = engine.openInterval({
      intervalId: "session-1",
      assetId: "MULK-TOWER",
      nav: 1_000n,
    });
    expect(collar.min).toBe(900n);
    expect(collar.max).toBe(1_100n);

    expect(engine.collectOrder(intervalId, order("b1", "BUY", 1_000n, 8n)).accepted).toBe(true);
    expect(engine.collectOrder(intervalId, order("s1", "SELL", 1_000n, 8n)).accepted).toBe(true);
    const rejected = engine.collectOrder(intervalId, order("wide", "BUY", 1_500n, 1n));
    expect(rejected.accepted).toBe(false);
    expect(rejected.rejected?.reason).toBe("PRICE_COLLAR");

    const batch = engine.closeAndMatch(intervalId, new Date("2026-08-17T12:00:00Z"));
    expect(batch.intervalId).toBe("session-1");
    expect(batch.executableVolume).toBe(8n);
    expect(batch.trades[0]?.buyerId).toBe("b1");
    expect(engine.collectOrder(intervalId, order("late", "BUY", 1_000n, 1n)).rejected?.reason).toBe(
      "INTERVAL_CLOSED",
    );
  });
});
