export const BPS_DENOM = 10_000n;
export const DEFAULT_COLLAR_BPS = 1_000n;
export const DEFAULT_SPV_RESERVE_BPS = 500n;

export function absBigint(value: bigint): bigint {
  return value < 0n ? -value : value;
}

export function applyBps(amount: bigint, bps: bigint): bigint {
  if (amount < 0n) {
    throw new RangeError("amount must be >= 0");
  }
  if (bps < 0n) {
    throw new RangeError("bps must be >= 0");
  }
  return (amount * bps) / BPS_DENOM;
}

export function collarBounds(nav: bigint, collarBps: bigint): { min: bigint; max: bigint } {
  if (nav <= 0n) {
    throw new RangeError("NAV must be positive");
  }
  if (collarBps > BPS_DENOM) {
    throw new RangeError("collar bps cannot exceed 100%");
  }
  return {
    min: (nav * (BPS_DENOM - collarBps)) / BPS_DENOM,
    max: (nav * (BPS_DENOM + collarBps)) / BPS_DENOM,
  };
}

/** Largest-remainder pro-rata so that sum(result) === executable. */
export function allocateProRata(weights: bigint[], executable: bigint): bigint[] {
  const total = weights.reduce((acc, qty) => acc + qty, 0n);
  if (weights.length === 0 || total === 0n || executable === 0n) {
    return weights.map(() => 0n);
  }
  if (executable >= total) {
    return [...weights];
  }
  const fills = weights.map((qty) => (qty * executable) / total);
  let remainder = executable - fills.reduce((acc, qty) => acc + qty, 0n);
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

/** Largest-remainder split of `pool` in proportion to `weights`. Sum(result) === pool when pool > 0. */
export function distributeProportionally(weights: bigint[], pool: bigint): bigint[] {
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

export function uniqueSortedBigint(values: bigint[]): bigint[] {
  const seen = new Set<string>();
  const out: bigint[] = [];
  for (const value of values) {
    const key = value.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return out;
}
