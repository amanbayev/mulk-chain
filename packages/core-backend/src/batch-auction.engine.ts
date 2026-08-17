export type AuctionSide = "BUY" | "SELL";

export interface AuctionOrder {
  id: string;
  side: AuctionSide;
  /** Limit price in tiyn (0.01 KZT) per lot. */
  price: bigint;
  /** Integer lots (whole tokenized shares). */
  quantity: bigint;
  ownerId: string;
}

export interface BatchAuctionInput {
  /** NAV in tiyn per lot. Collar is ±10% unless overridden. */
  nav: bigint;
  /** Basis points from NAV. Default 1000 = 10%. */
  collarBps?: bigint;
  orders: AuctionOrder[];
}

export type RejectReason = "PRICE_COLLAR" | "INVALID_QUANTITY" | "INVALID_PRICE";

export interface RejectedOrder {
  orderId: string;
  reason: RejectReason;
  detail: string;
}

export interface AuctionFill {
  orderId: string;
  ownerId: string;
  side: AuctionSide;
  filledQuantity: bigint;
  price: bigint;
  /** Cash in tiyn = filledQuantity * equilibriumPrice. */
  cashAmount: bigint;
}

export interface BatchAuctionResult {
  equilibriumPrice: bigint | null;
  collar: { min: bigint; max: bigint };
  executableVolume: bigint;
  demandAtEq: bigint;
  supplyAtEq: bigint;
  fills: AuctionFill[];
  rejected: RejectedOrder[];
  unfilled: Array<{ orderId: string; remaining: bigint }>;
}

const DEFAULT_COLLAR_BPS = 1000n;
const BPS_DENOM = 10_000n;

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function uniqueSorted(values: bigint[]): bigint[] {
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

function bookAt(
  price: bigint,
  orders: AuctionOrder[],
): { demand: bigint; supply: bigint; volume: bigint; imbalance: bigint } {
  let demand = 0n;
  let supply = 0n;
  for (const order of orders) {
    if (order.side === "BUY" && order.price >= price) demand += order.quantity;
    if (order.side === "SELL" && order.price <= price) supply += order.quantity;
  }
  const volume = demand < supply ? demand : supply;
  return { demand, supply, volume, imbalance: demand - supply };
}

function proRata(quantities: bigint[], executable: bigint): bigint[] {
  const total = quantities.reduce((acc, qty) => acc + qty, 0n);
  if (total === 0n || executable === 0n) {
    return quantities.map(() => 0n);
  }
  if (executable >= total) {
    return [...quantities];
  }
  const fills = quantities.map((qty) => (qty * executable) / total);
  let remainder = executable - fills.reduce((acc, qty) => acc + qty, 0n);
  const rank = quantities
    .map((qty, index) => ({ qty, index }))
    .sort((a, b) => (a.qty > b.qty ? -1 : a.qty < b.qty ? 1 : a.index - b.index));
  for (const row of rank) {
    if (remainder === 0n) break;
    fills[row.index] += 1n;
    remainder -= 1n;
  }
  return fills;
}

/**
 * Periodic Batch Auction for illiquid RWA shares.
 * 1. Drop orders outside the NAV price collar (±10%).
 * 2. Pick the equilibrium (cut-off) price that maximises executable volume.
 * 3. Match pro-rata on the surplus side at that single clearing price.
 */
export function runPeriodicBatchAuction(input: BatchAuctionInput): BatchAuctionResult {
  if (input.nav <= 0n) {
    throw new RangeError("NAV must be positive");
  }
  const collarBps = input.collarBps ?? DEFAULT_COLLAR_BPS;
  const min = (input.nav * (BPS_DENOM - collarBps)) / BPS_DENOM;
  const max = (input.nav * (BPS_DENOM + collarBps)) / BPS_DENOM;
  const collar = { min, max };

  const rejected: RejectedOrder[] = [];
  const eligible: AuctionOrder[] = [];

  for (const order of input.orders) {
    if (order.quantity <= 0n) {
      rejected.push({ orderId: order.id, reason: "INVALID_QUANTITY", detail: "quantity must be > 0" });
      continue;
    }
    if (order.price <= 0n) {
      rejected.push({ orderId: order.id, reason: "INVALID_PRICE", detail: "price must be > 0" });
      continue;
    }
    if (order.price < min || order.price > max) {
      rejected.push({
        orderId: order.id,
        reason: "PRICE_COLLAR",
        detail: `price ${order.price} outside [${min}, ${max}] (NAV ${input.nav} ±${collarBps} bps)`,
      });
      continue;
    }
    eligible.push(order);
  }

  const candidates = uniqueSorted([min, input.nav, max, ...eligible.map((order) => order.price)]);
  let best: { price: bigint; demand: bigint; supply: bigint; volume: bigint; imbalance: bigint } | null = null;

  for (const price of candidates) {
    const snapshot = bookAt(price, eligible);
    if (snapshot.volume === 0n) continue;
    if (
      best === null ||
      snapshot.volume > best.volume ||
      (snapshot.volume === best.volume && abs(price - input.nav) < abs(best.price - input.nav)) ||
      (snapshot.volume === best.volume &&
        abs(price - input.nav) === abs(best.price - input.nav) &&
        abs(snapshot.imbalance) < abs(best.imbalance))
    ) {
      best = { price, ...snapshot };
    }
  }

  if (best === null) {
    return {
      equilibriumPrice: null,
      collar,
      executableVolume: 0n,
      demandAtEq: 0n,
      supplyAtEq: 0n,
      fills: [],
      rejected,
      unfilled: eligible.map((order) => ({ orderId: order.id, remaining: order.quantity })),
    };
  }

  const buys = eligible.filter((order) => order.side === "BUY" && order.price >= best.price);
  const sells = eligible.filter((order) => order.side === "SELL" && order.price <= best.price);
  const buyFills =
    best.demand > best.supply ? proRata(buys.map((order) => order.quantity), best.volume) : buys.map((order) => order.quantity);
  const sellFills =
    best.supply > best.demand ? proRata(sells.map((order) => order.quantity), best.volume) : sells.map((order) => order.quantity);

  const fills: AuctionFill[] = [];
  const remaining = new Map<string, bigint>();
  for (const order of eligible) remaining.set(order.id, order.quantity);

  const apply = (orders: AuctionOrder[], allocated: bigint[]): void => {
    for (let i = 0; i < orders.length; i += 1) {
      const filledQuantity = allocated[i] ?? 0n;
      if (filledQuantity === 0n) continue;
      const order = orders[i];
      fills.push({
        orderId: order.id,
        ownerId: order.ownerId,
        side: order.side,
        filledQuantity,
        price: best.price,
        cashAmount: filledQuantity * best.price,
      });
      remaining.set(order.id, (remaining.get(order.id) ?? 0n) - filledQuantity);
    }
  };

  apply(buys, buyFills);
  apply(sells, sellFills);

  return {
    equilibriumPrice: best.price,
    collar,
    executableVolume: best.volume,
    demandAtEq: best.demand,
    supplyAtEq: best.supply,
    fills,
    rejected,
    unfilled: [...remaining.entries()]
      .filter(([, qty]) => qty > 0n)
      .map(([orderId, remainingQty]) => ({ orderId, remaining: remainingQty })),
  };
}

export class BatchAuctionEngine {
  run(input: BatchAuctionInput): BatchAuctionResult {
    return runPeriodicBatchAuction(input);
  }
}
