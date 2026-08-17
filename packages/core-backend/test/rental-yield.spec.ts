import { describe, expect, it } from "vitest";
import { InMemoryTokenSnapshot } from "../src/yield/rental-yield.service.js";
import { RentalYieldService } from "../src/yield/rental-yield.service.js";

describe("Rental yield distribution", () => {
  it("deducts a 5% SPV reserve from NOI and applies per-investor WHT", async () => {
    const service = new RentalYieldService();
    const register = await service.distribute({
      distributionId: "DIV-2026-Q2",
      assetId: "MULK-TOWER",
      recordDate: "2026-06-30T00:00:00Z",
      grossRentalIncomeTiyn: 1_000_000n,
      operatingExpensesTiyn: 200_000n,
      holders: [
        {
          investorId: "A",
          wallet: "0xa",
          iban: "KZ-A",
          balance: 70n,
          whtBps: 1_500n,
        },
        {
          investorId: "B",
          wallet: "0xb",
          iban: "KZ-B",
          balance: 30n,
          whtBps: 0n,
        },
      ],
    });

    expect(register.noiTiyn).toBe(800_000n);
    expect(register.spvReserveBps).toBe(500n);
    expect(register.spvReserveTiyn).toBe(40_000n);
    expect(register.distributablePoolTiyn).toBe(760_000n);

    const lineA = register.lines.find((line) => line.investorId === "A");
    const lineB = register.lines.find((line) => line.investorId === "B");
    expect(lineA?.grossDividendTiyn).toBe(532_000n);
    expect(lineA?.withholdingTaxTiyn).toBe(79_800n);
    expect(lineA?.netPayableTiyn).toBe(452_200n);
    expect(lineB?.grossDividendTiyn).toBe(228_000n);
    expect(lineB?.withholdingTaxTiyn).toBe(0n);
    expect(lineB?.netPayableTiyn).toBe(228_000n);

    expect(register.totalGrossTiyn + register.spvReserveTiyn + register.unallocatedDustTiyn).toBe(
      register.noiTiyn,
    );
    expect(register.totalNetPayableTiyn + register.totalWhtTiyn).toBe(register.totalGrossTiyn);
  });

  it("skips zero-balance wallets and preserves NOI identity with largest-remainder dust", async () => {
    const snapshot = new InMemoryTokenSnapshot([
      { investorId: "A", wallet: "0xa", iban: "KZ-A", balance: 1n, whtBps: 0n },
      { investorId: "B", wallet: "0xb", iban: "KZ-B", balance: 1n, whtBps: 0n },
      { investorId: "C", wallet: "0xc", iban: "KZ-C", balance: 1n, whtBps: 0n },
      { investorId: "Z", wallet: "0xz", iban: "KZ-Z", balance: 0n, whtBps: 0n },
    ]);
    const service = new RentalYieldService(snapshot);
    const register = await service.distribute({
      distributionId: "DIV-DUST",
      assetId: "MULK-TOWER",
      recordDate: "2026-03-31",
      grossRentalIncomeTiyn: 103n,
      operatingExpensesTiyn: 3n,
    });

    expect(register.noiTiyn).toBe(100n);
    expect(register.spvReserveTiyn).toBe(5n);
    expect(register.lines).toHaveLength(3);
    expect(register.lines.some((line) => line.investorId === "Z")).toBe(false);
    expect(register.totalGrossTiyn).toBe(95n);
    expect(register.unallocatedDustTiyn).toBe(0n);
    expect(register.totalGrossTiyn + register.spvReserveTiyn).toBe(100n);
    const shares = register.lines.map((line) => line.grossDividendTiyn).sort();
    expect(shares[0]).toBe(31n);
    expect(shares[1]).toBe(32n);
    expect(shares[2]).toBe(32n);
  });
});
