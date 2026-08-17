/** 1 KZT = 100 tiyn. All money fields on the API are tiyn as decimal strings. */
export const TIYN_PER_KZT = 100n;
export const BPS_DENOM = 10_000n;
export const DEFAULT_COLLAR_BPS = 1_000n;
export const DEFAULT_SPV_RESERVE_BPS = 500n;
export const DEFAULT_WHT_BPS = 1_000n;

export function toBigInt(value: string | number | bigint): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  const trimmed = value.trim();
  if (!trimmed) return 0n;
  return BigInt(trimmed);
}

export function collarBounds(nav: bigint, collarBps: bigint = DEFAULT_COLLAR_BPS): { min: bigint; max: bigint } {
  return {
    min: (nav * (BPS_DENOM - collarBps)) / BPS_DENOM,
    max: (nav * (BPS_DENOM + collarBps)) / BPS_DENOM,
  };
}

export function applyBps(amount: bigint, bps: bigint): bigint {
  return (amount * bps) / BPS_DENOM;
}

export function inCollar(price: bigint, nav: bigint, collarBps: bigint = DEFAULT_COLLAR_BPS): boolean {
  const { min, max } = collarBounds(nav, collarBps);
  return price >= min && price <= max;
}

/** Parse a KZT amount typed by a human ("100 000.50") into tiyn. */
export function parseKztToTiyn(raw: string): bigint {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) return 0n;
  const negative = normalized.startsWith("-");
  const body = negative ? normalized.slice(1) : normalized;
  if (!/^\d+(\.\d{0,2})?$/.test(body)) {
    throw new RangeError("invalid KZT amount");
  }
  const [whole = "0", frac = ""] = body.split(".");
  const tiyn = BigInt(whole) * TIYN_PER_KZT + BigInt((frac + "00").slice(0, 2));
  return negative ? -tiyn : tiyn;
}

export function formatKzt(tiyn: string | number | bigint, options?: { withSymbol?: boolean }): string {
  const value = toBigInt(tiyn);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / TIYN_PER_KZT;
  const frac = abs % TIYN_PER_KZT;
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  const sign = negative ? "−" : "";
  const amount = `${sign}${grouped}.${frac.toString().padStart(2, "0")}`;
  return options?.withSymbol === false ? amount : `₸\u00a0${amount}`;
}

export function formatQty(quantity: string | number | bigint): string {
  return toBigInt(quantity).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
}

export function formatBps(bps: string | number | bigint): string {
  const value = toBigInt(bps);
  const whole = value / 100n;
  const frac = value % 100n;
  if (frac === 0n) return `${whole.toString()}%`;
  return `${whole.toString()}.${frac.toString().padStart(2, "0")}%`;
}

export function formatPercent(numerator: bigint, denominator: bigint, digits = 1): string {
  if (denominator === 0n) return "—";
  const scale = 10n ** BigInt(digits);
  const rounded = (numerator * 100n * scale + denominator / 2n) / denominator;
  const whole = rounded / scale;
  const frac = rounded % scale;
  return `${whole.toString()}.${frac.toString().padStart(digits, "0")}%`;
}
