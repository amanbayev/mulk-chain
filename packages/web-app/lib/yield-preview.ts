import { applyBps, DEFAULT_SPV_RESERVE_BPS, DEFAULT_WHT_BPS } from "@/lib/money";

export interface PreviewHolder {
  investorId: string;
  label: string;
  wallet: string;
  iban: string;
  balance: bigint;
  whtBps: bigint;
}

export interface YieldPreviewLine {
  investorId: string;
  label: string;
  wallet: string;
  iban: string;
  snapshotBalance: bigint;
  ownershipBps: bigint;
  grossDividendTiyn: bigint;
  withholdingTaxTiyn: bigint;
  netPayableTiyn: bigint;
}

export interface YieldPreview {
  grossRentalIncomeTiyn: bigint;
  operatingExpensesTiyn: bigint;
  noiTiyn: bigint;
  spvReserveBps: bigint;
  spvReserveTiyn: bigint;
  distributablePoolTiyn: bigint;
  totalSupply: bigint;
  lines: YieldPreviewLine[];
  totalGrossTiyn: bigint;
  totalWhtTiyn: bigint;
  totalNetPayableTiyn: bigint;
}

function distributeProportionally(weights: bigint[], pool: bigint): bigint[] {
  const total = weights.reduce((acc, qty) => acc + qty, 0n);
  if (weights.length === 0 || total === 0n || pool === 0n) {
    return weights.map(() => 0n);
  }
  const fills = weights.map((qty) => (qty * pool) / total);
  let remainder = pool - fills.reduce((acc, qty) => acc + qty, 0n);
  const rank = weights
    .map((qty, index) => ({ qty, index }))
    .sort((a, b) => (a.qty > b.qty ? -1 : a.qty < b.qty ? 1 : a.index - b.index));
  for (const row of rank) {
    if (remainder === 0n) break;
    fills[row.index] += 1n;
    remainder -= 1n;
  }
  return fills;
}

/** Mirrors `RentalYieldService`: NOI → 5% SPV reserve → per-holder WHT → net payout. */
export function previewYield(input: {
  grossRentalIncomeTiyn: bigint;
  operatingExpensesTiyn: bigint;
  spvReserveBps?: bigint;
  holders: PreviewHolder[];
}): YieldPreview {
  if (input.operatingExpensesTiyn > input.grossRentalIncomeTiyn) {
    throw new RangeError("operating expenses exceed gross rental income");
  }
  const spvReserveBps = input.spvReserveBps ?? DEFAULT_SPV_RESERVE_BPS;
  const noi = input.grossRentalIncomeTiyn - input.operatingExpensesTiyn;
  const spvReserveTiyn = applyBps(noi, spvReserveBps);
  const pool = noi - spvReserveTiyn;
  const eligible = input.holders.filter((holder) => holder.balance > 0n);
  const totalSupply = eligible.reduce((acc, holder) => acc + holder.balance, 0n);
  const grossShares = distributeProportionally(
    eligible.map((holder) => holder.balance),
    pool,
  );

  const lines: YieldPreviewLine[] = eligible.map((holder, index) => {
    const gross = grossShares[index] ?? 0n;
    const wht = applyBps(gross, holder.whtBps);
    return {
      investorId: holder.investorId,
      label: holder.label,
      wallet: holder.wallet,
      iban: holder.iban,
      snapshotBalance: holder.balance,
      ownershipBps: totalSupply === 0n ? 0n : (holder.balance * 10_000n) / totalSupply,
      grossDividendTiyn: gross,
      withholdingTaxTiyn: wht,
      netPayableTiyn: gross - wht,
    };
  });

  return {
    grossRentalIncomeTiyn: input.grossRentalIncomeTiyn,
    operatingExpensesTiyn: input.operatingExpensesTiyn,
    noiTiyn: noi,
    spvReserveBps,
    spvReserveTiyn,
    distributablePoolTiyn: pool,
    totalSupply,
    lines,
    totalGrossTiyn: lines.reduce((acc, line) => acc + line.grossDividendTiyn, 0n),
    totalWhtTiyn: lines.reduce((acc, line) => acc + line.withholdingTaxTiyn, 0n),
    totalNetPayableTiyn: lines.reduce((acc, line) => acc + line.netPayableTiyn, 0n),
  };
}

export const DEMO_HOLDERS: PreviewHolder[] = [
  {
    investorId: "inv-001",
    label: "AIFC Growth Fund I",
    wallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    iban: "KZ123456789012345678",
    balance: 1_250n,
    whtBps: DEFAULT_WHT_BPS,
  },
  {
    investorId: "inv-002",
    label: "Samruk Real Assets",
    wallet: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    iban: "KZ223456789012345678",
    balance: 4_000n,
    whtBps: DEFAULT_WHT_BPS,
  },
  {
    investorId: "inv-003",
    label: "Retail omnibus (custodian)",
    wallet: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    iban: "KZ323456789012345678",
    balance: 7_250n,
    whtBps: DEFAULT_WHT_BPS,
  },
];
