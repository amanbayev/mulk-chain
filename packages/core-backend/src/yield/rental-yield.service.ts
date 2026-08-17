import { distributeProportionally, applyBps } from "../lib/money.js";
import { YieldRunInputSchema, type HolderSnapshot, type YieldRunInput } from "./schemas.js";

export interface DividendLine {
  investorId: string;
  wallet: string;
  iban: string;
  snapshotBalance: bigint;
  ownershipBps: bigint;
  grossDividendTiyn: bigint;
  withholdingTaxTiyn: bigint;
  netPayableTiyn: bigint;
}

export interface DividendRegister {
  distributionId: string;
  assetId: string;
  recordDate: string;
  grossRentalIncomeTiyn: bigint;
  operatingExpensesTiyn: bigint;
  noiTiyn: bigint;
  spvReserveBps: bigint;
  spvReserveTiyn: bigint;
  distributablePoolTiyn: bigint;
  totalSupply: bigint;
  lines: DividendLine[];
  totalGrossTiyn: bigint;
  totalWhtTiyn: bigint;
  totalNetPayableTiyn: bigint;
  unallocatedDustTiyn: bigint;
}

export interface TokenSnapshotPort {
  snapshotHolders(assetId: string, recordDate: Date): Promise<HolderSnapshot[]>;
}

export class InMemoryTokenSnapshot implements TokenSnapshotPort {
  constructor(private readonly holders: HolderSnapshot[]) {}

  async snapshotHolders(_assetId: string, _recordDate: Date): Promise<HolderSnapshot[]> {
    return this.holders.map((holder) => ({ ...holder }));
  }
}

export class YieldCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YieldCalculationError";
  }
}

/**
 * Snapshot-based rental yield distributor.
 * NOI = gross rent − opex; SPV reserve (default 5%) is withheld; WHT is applied per investor.
 */
export class RentalYieldService {
  constructor(private readonly snapshot?: TokenSnapshotPort) {}

  async distribute(raw: unknown): Promise<DividendRegister> {
    const parsed: YieldRunInput = YieldRunInputSchema.parse(raw);
    const holders = parsed.holders && parsed.holders.length > 0
      ? parsed.holders
      : await this.requireSnapshot(parsed.assetId, parsed.recordDate);

    if (parsed.operatingExpensesTiyn > parsed.grossRentalIncomeTiyn) {
      throw new YieldCalculationError("operating expenses exceed gross rental income");
    }

    const noi = parsed.grossRentalIncomeTiyn - parsed.operatingExpensesTiyn;
    const spvReserve = applyBps(noi, parsed.spvReserveBps);
    const pool = noi - spvReserve;
    const totalSupply = holders.reduce((acc, holder) => acc + holder.balance, 0n);
    if (totalSupply <= 0n) {
      throw new YieldCalculationError("snapshot total supply must be positive");
    }

    const eligible = holders.filter((holder) => holder.balance > 0n);
    const grossShares = distributeProportionally(
      eligible.map((holder) => holder.balance),
      pool,
    );

    const lines: DividendLine[] = [];
    let totalGross = 0n;
    let totalWht = 0n;
    let totalNet = 0n;

    for (let i = 0; i < eligible.length; i += 1) {
      const holder = eligible[i];
      const gross = grossShares[i] ?? 0n;
      const wht = applyBps(gross, holder.whtBps);
      const net = gross - wht;
      totalGross += gross;
      totalWht += wht;
      totalNet += net;
      lines.push({
        investorId: holder.investorId,
        wallet: holder.wallet,
        iban: holder.iban,
        snapshotBalance: holder.balance,
        ownershipBps: (holder.balance * 10_000n) / totalSupply,
        grossDividendTiyn: gross,
        withholdingTaxTiyn: wht,
        netPayableTiyn: net,
      });
    }

    const unallocatedDust = noi - spvReserve - totalGross;
    return {
      distributionId: parsed.distributionId,
      assetId: parsed.assetId,
      recordDate: parsed.recordDate.toISOString(),
      grossRentalIncomeTiyn: parsed.grossRentalIncomeTiyn,
      operatingExpensesTiyn: parsed.operatingExpensesTiyn,
      noiTiyn: noi,
      spvReserveBps: parsed.spvReserveBps,
      spvReserveTiyn: spvReserve,
      distributablePoolTiyn: pool,
      totalSupply,
      lines,
      totalGrossTiyn: totalGross,
      totalWhtTiyn: totalWht,
      totalNetPayableTiyn: totalNet,
      unallocatedDustTiyn: unallocatedDust,
    };
  }

  private async requireSnapshot(assetId: string, recordDate: Date): Promise<HolderSnapshot[]> {
    if (!this.snapshot) {
      throw new YieldCalculationError("holders snapshot is required when no TokenSnapshotPort is configured");
    }
    const holders = await this.snapshot.snapshotHolders(assetId, recordDate);
    if (holders.length === 0) {
      throw new YieldCalculationError("token snapshot returned no holders");
    }
    return holders;
  }
}
