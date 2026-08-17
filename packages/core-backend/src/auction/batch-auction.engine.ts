import { createHash, randomUUID } from "node:crypto";
import {
  DEFAULT_COLLAR_BPS,
  absBigint,
  allocateProRata,
  collarBounds,
  uniqueSortedBigint,
} from "../lib/money.js";
import {
  BatchAuctionInputSchema,
  LimitOrderSchema,
  OpenIntervalInputSchema,
  type AuctionSide,
  type BatchAuctionInput,
  type LimitOrder,
  type OpenIntervalInput,
} from "./schemas.js";

export type RejectReason =
  | "PRICE_COLLAR"
  | "INVALID_QUANTITY"
  | "INVALID_PRICE"
  | "INVALID_ORDER"
  | "DUPLICATE_ORDER"
  | "INTERVAL_CLOSED"
  | "INTERVAL_UNKNOWN";

export interface RejectedOrder {
  orderId: string;
  reason: RejectReason;
  detail: string;
}

export interface UnfilledOrder {
  orderId: string;
  remaining: bigint;
}

export interface CurvePoint {
  price: bigint;
  demand: bigint;
  supply: bigint;
  volume: bigint;
  imbalance: bigint;
}

export interface MatchedTrade {
  tradeId: string;
  buyOrderId: string;
  sellOrderId: string;
  buyerId: string;
  sellerId: string;
  quantity: bigint;
  price: bigint;
  cashAmount: bigint;
}

export interface MatchedTradesBatch {
  readonly batchId: string;
  readonly intervalId: string;
  readonly assetId: string;
  readonly closedAt: string;
  readonly nav: bigint;
  readonly collarBps: bigint;
  readonly collar: { readonly min: bigint; readonly max: bigint };
  readonly equilibriumPrice: bigint | null;
  readonly executableVolume: bigint;
  readonly demandAtEq: bigint;
  readonly supplyAtEq: bigint;
  readonly curve: readonly CurvePoint[];
  readonly trades: readonly MatchedTrade[];
  readonly rejected: readonly RejectedOrder[];
  readonly unfilled: readonly UnfilledOrder[];
  readonly fingerprint: string;
}

interface TradingInterval {
  id: string;
  assetId: string;
  nav: bigint;
  collarBps: bigint;
  opensAt: Date;
  closed: boolean;
  orders: LimitOrder[];
  rejected: RejectedOrder[];
  orderIds: Set<string>;
}

export interface AuctionWindowStatus {
  intervalId: string;
  assetId: string;
  open: boolean;
  nav: bigint;
  collarBps: bigint;
  collar: { min: bigint; max: bigint };
  opensAt: string;
  orderCount: number;
  rejectedCount: number;
  buyQuantity: bigint;
  sellQuantity: bigint;
  indicativeDemandAtNav: bigint;
  indicativeSupplyAtNav: bigint;
}

function bookAt(price: bigint, orders: LimitOrder[]): Omit<CurvePoint, "price"> & { price: bigint } {
  let demand = 0n;
  let supply = 0n;
  for (const order of orders) {
    if (order.side === "BUY" && order.price >= price) demand += order.quantity;
    if (order.side === "SELL" && order.price <= price) supply += order.quantity;
  }
  const volume = demand < supply ? demand : supply;
  return { price, demand, supply, volume, imbalance: demand - supply };
}

function sortAggressive(orders: LimitOrder[], side: AuctionSide): LimitOrder[] {
  return [...orders].sort((a, b) => {
    if (side === "BUY") {
      if (a.price !== b.price) return a.price > b.price ? -1 : 1;
    } else if (a.price !== b.price) {
      return a.price < b.price ? -1 : 1;
    }
    const aTime = a.submittedAt?.getTime() ?? 0;
    const bTime = b.submittedAt?.getTime() ?? 0;
    if (aTime !== bTime) return aTime - bTime;
    return a.id.localeCompare(b.id);
  });
}

function allocateSide(
  orders: LimitOrder[],
  side: AuctionSide,
  cutoff: bigint,
  volume: bigint,
): Map<string, bigint> {
  const fills = new Map<string, bigint>();
  const aggressive = sortAggressive(
    orders.filter((order) => (side === "BUY" ? order.price > cutoff : order.price < cutoff)),
    side,
  );
  const atCut = orders.filter((order) => order.price === cutoff);
  let remaining = volume;

  for (const order of aggressive) {
    if (remaining === 0n) break;
    const fill = order.quantity < remaining ? order.quantity : remaining;
    fills.set(order.id, fill);
    remaining -= fill;
  }

  if (remaining > 0n && atCut.length > 0) {
    const allocated = allocateProRata(
      atCut.map((order) => order.quantity),
      remaining,
    );
    for (let i = 0; i < atCut.length; i += 1) {
      const qty = allocated[i] ?? 0n;
      if (qty > 0n) fills.set(atCut[i].id, qty);
    }
  }

  return fills;
}

function pairTrades(
  buys: LimitOrder[],
  sells: LimitOrder[],
  buyFills: Map<string, bigint>,
  sellFills: Map<string, bigint>,
  price: bigint,
  batchId: string,
): MatchedTrade[] {
  const buyQueue = sortAggressive(
    buys.filter((order) => (buyFills.get(order.id) ?? 0n) > 0n),
    "BUY",
  ).map((order) => ({ order, remaining: buyFills.get(order.id) ?? 0n }));
  const sellQueue = sortAggressive(
    sells.filter((order) => (sellFills.get(order.id) ?? 0n) > 0n),
    "SELL",
  ).map((order) => ({ order, remaining: sellFills.get(order.id) ?? 0n }));

  const trades: MatchedTrade[] = [];
  let i = 0;
  let j = 0;
  let seq = 0;
  while (i < buyQueue.length && j < sellQueue.length) {
    while (i < buyQueue.length && buyQueue[i].remaining === 0n) i += 1;
    while (j < sellQueue.length && sellQueue[j].remaining === 0n) j += 1;
    if (i >= buyQueue.length || j >= sellQueue.length) break;
    const buy = buyQueue[i];
    const sell = sellQueue[j];
    const quantity = buy.remaining < sell.remaining ? buy.remaining : sell.remaining;
    seq += 1;
    trades.push({
      tradeId: `${batchId}-${seq}`,
      buyOrderId: buy.order.id,
      sellOrderId: sell.order.id,
      buyerId: buy.order.ownerId,
      sellerId: sell.order.ownerId,
      quantity,
      price,
      cashAmount: quantity * price,
    });
    buy.remaining -= quantity;
    sell.remaining -= quantity;
  }
  return trades;
}

function fingerprintBatch(payload: {
  intervalId: string;
  assetId: string;
  equilibriumPrice: bigint | null;
  trades: MatchedTrade[];
}): string {
  const canonical = JSON.stringify({
    intervalId: payload.intervalId,
    assetId: payload.assetId,
    equilibriumPrice: payload.equilibriumPrice?.toString() ?? null,
    trades: payload.trades.map((trade) => ({
      tradeId: trade.tradeId,
      buyOrderId: trade.buyOrderId,
      sellOrderId: trade.sellOrderId,
      quantity: trade.quantity.toString(),
      price: trade.price.toString(),
    })),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function freezeBatch(batch: MatchedTradesBatch): MatchedTradesBatch {
  Object.freeze(batch.collar);
  Object.freeze(batch.curve);
  Object.freeze(batch.trades);
  Object.freeze(batch.rejected);
  Object.freeze(batch.unfilled);
  return Object.freeze(batch);
}

function rejectOrder(orderId: string, reason: RejectReason, detail: string): RejectedOrder {
  return { orderId, reason, detail };
}

/**
 * Periodic Batch Auction for illiquid RWA lots.
 * Collects limit orders over a discrete interval, drops prices outside NAV ±10%,
 * then clears at the volume-maximising equilibrium with pro-rata only at the cutoff.
 */
export class BatchAuctionEngine {
  private readonly intervals = new Map<string, TradingInterval>();

  openInterval(input: unknown): { intervalId: string; collar: { min: bigint; max: bigint } } {
    const parsed: OpenIntervalInput = OpenIntervalInputSchema.parse(input);
    const intervalId = parsed.intervalId ?? randomUUID();
    if (this.intervals.has(intervalId)) {
      throw new Error(`Interval ${intervalId} already exists`);
    }
    const collarBps = parsed.collarBps ?? DEFAULT_COLLAR_BPS;
    this.intervals.set(intervalId, {
      id: intervalId,
      assetId: parsed.assetId,
      nav: parsed.nav,
      collarBps,
      opensAt: parsed.opensAt ?? new Date(),
      closed: false,
      orders: [],
      rejected: [],
      orderIds: new Set(),
    });
    return { intervalId, collar: collarBounds(parsed.nav, collarBps) };
  }

  collectOrder(intervalId: string, rawOrder: unknown): { accepted: boolean; rejected?: RejectedOrder } {
    const interval = this.intervals.get(intervalId);
    if (!interval) {
      return {
        accepted: false,
        rejected: rejectOrder("unknown", "INTERVAL_UNKNOWN", `interval ${intervalId} does not exist`),
      };
    }
    if (interval.closed) {
      const id = typeof rawOrder === "object" && rawOrder !== null && "id" in rawOrder
        ? String((rawOrder as { id: unknown }).id)
        : "unknown";
      return { accepted: false, rejected: rejectOrder(id, "INTERVAL_CLOSED", "trading interval is closed") };
    }

    const parsed = LimitOrderSchema.safeParse(rawOrder);
    if (!parsed.success) {
      const id =
        typeof rawOrder === "object" && rawOrder !== null && "id" in rawOrder
          ? String((rawOrder as { id: unknown }).id)
          : "invalid";
      const issue = parsed.error.issues[0];
      const path = issue?.path.join(".") ?? "order";
      const reason: RejectReason =
        path.includes("quantity") ? "INVALID_QUANTITY" : path.includes("price") ? "INVALID_PRICE" : "INVALID_ORDER";
      return { accepted: false, rejected: rejectOrder(id, reason, issue?.message ?? parsed.error.message) };
    }

    const order = parsed.data;
    if (interval.orderIds.has(order.id)) {
      const rejected = rejectOrder(order.id, "DUPLICATE_ORDER", "order id already collected in this interval");
      interval.rejected.push(rejected);
      return { accepted: false, rejected };
    }

    const { min, max } = collarBounds(interval.nav, interval.collarBps);
    if (order.price < min || order.price > max) {
      const rejected = rejectOrder(
        order.id,
        "PRICE_COLLAR",
        `price ${order.price} outside [${min}, ${max}] (NAV ${interval.nav} ±${interval.collarBps} bps)`,
      );
      interval.rejected.push(rejected);
      interval.orderIds.add(order.id);
      return { accepted: false, rejected };
    }

    interval.orderIds.add(order.id);
    interval.orders.push({
      ...order,
      submittedAt: order.submittedAt ?? new Date(interval.opensAt.getTime() + interval.orders.length),
    });
    return { accepted: true };
  }

  getStatus(intervalId: string): AuctionWindowStatus {
    const interval = this.intervals.get(intervalId);
    if (!interval) {
      throw new Error(`Interval ${intervalId} does not exist`);
    }
    return this.toStatus(interval);
  }

  findOpenInterval(assetId?: string): AuctionWindowStatus | null {
    for (const interval of this.intervals.values()) {
      if (interval.closed) continue;
      if (assetId && interval.assetId !== assetId) continue;
      return this.toStatus(interval);
    }
    return null;
  }

  private toStatus(interval: TradingInterval): AuctionWindowStatus {
    let buyQuantity = 0n;
    let sellQuantity = 0n;
    for (const order of interval.orders) {
      if (order.side === "BUY") buyQuantity += order.quantity;
      else sellQuantity += order.quantity;
    }
    const atNav = bookAt(interval.nav, interval.orders);
    return {
      intervalId: interval.id,
      assetId: interval.assetId,
      open: !interval.closed,
      nav: interval.nav,
      collarBps: interval.collarBps,
      collar: collarBounds(interval.nav, interval.collarBps),
      opensAt: interval.opensAt.toISOString(),
      orderCount: interval.orders.length,
      rejectedCount: interval.rejected.length,
      buyQuantity,
      sellQuantity,
      indicativeDemandAtNav: atNav.demand,
      indicativeSupplyAtNav: atNav.supply,
    };
  }

  closeAndMatch(intervalId: string, closedAt: Date = new Date()): MatchedTradesBatch {
    const interval = this.intervals.get(intervalId);
    if (!interval) {
      throw new Error(`Interval ${intervalId} does not exist`);
    }
    interval.closed = true;
    return this.matchParsed({
      intervalId: interval.id,
      assetId: interval.assetId,
      nav: interval.nav,
      collarBps: interval.collarBps,
      orders: interval.orders,
      closedAt,
      priorRejected: interval.rejected,
    });
  }

  match(input: unknown): MatchedTradesBatch {
    const parsed: BatchAuctionInput = BatchAuctionInputSchema.parse(input);
    const { min, max } = collarBounds(parsed.nav, parsed.collarBps);
    const eligible: LimitOrder[] = [];
    const rejected: RejectedOrder[] = [];
    for (const order of parsed.orders) {
      if (order.price < min || order.price > max) {
        rejected.push(
          rejectOrder(
            order.id,
            "PRICE_COLLAR",
            `price ${order.price} outside [${min}, ${max}] (NAV ${parsed.nav} ±${parsed.collarBps} bps)`,
          ),
        );
        continue;
      }
      eligible.push(order);
    }
    return this.matchParsed({
      intervalId: parsed.intervalId ?? "adhoc",
      assetId: parsed.assetId,
      nav: parsed.nav,
      collarBps: parsed.collarBps,
      orders: eligible,
      closedAt: parsed.closedAt ?? new Date(),
      priorRejected: rejected,
    });
  }

  private matchParsed(params: {
    intervalId: string;
    assetId: string;
    nav: bigint;
    collarBps: bigint;
    orders: LimitOrder[];
    closedAt: Date;
    priorRejected: RejectedOrder[];
  }): MatchedTradesBatch {
    const collar = collarBounds(params.nav, params.collarBps);
    const candidates = uniqueSortedBigint([
      collar.min,
      params.nav,
      collar.max,
      ...params.orders.map((order) => order.price),
    ]);
    const curve = candidates.map((price) => bookAt(price, params.orders));

    let best: CurvePoint | null = null;
    for (const point of curve) {
      if (point.volume === 0n) continue;
      if (
        best === null ||
        point.volume > best.volume ||
        (point.volume === best.volume && absBigint(point.imbalance) < absBigint(best.imbalance)) ||
        (point.volume === best.volume &&
          absBigint(point.imbalance) === absBigint(best.imbalance) &&
          absBigint(point.price - params.nav) < absBigint(best.price - params.nav))
      ) {
        best = point;
      }
    }

    const closedAt = params.closedAt.toISOString();
    const seed = `${params.intervalId}:${closedAt}`;

    if (best === null) {
      const empty: MatchedTradesBatch = {
        batchId: createHash("sha256").update(seed).digest("hex").slice(0, 16),
        intervalId: params.intervalId,
        assetId: params.assetId,
        closedAt,
        nav: params.nav,
        collarBps: params.collarBps,
        collar,
        equilibriumPrice: null,
        executableVolume: 0n,
        demandAtEq: 0n,
        supplyAtEq: 0n,
        curve,
        trades: [],
        rejected: params.priorRejected,
        unfilled: params.orders.map((order) => ({ orderId: order.id, remaining: order.quantity })),
        fingerprint: "",
      };
      const frozen = freezeBatch({
        ...empty,
        fingerprint: fingerprintBatch({
          intervalId: empty.intervalId,
          assetId: empty.assetId,
          equilibriumPrice: null,
          trades: [],
        }),
      });
      return frozen;
    }

    const buys = params.orders.filter((order) => order.side === "BUY" && order.price >= best.price);
    const sells = params.orders.filter((order) => order.side === "SELL" && order.price <= best.price);
    const buyFills = allocateSide(buys, "BUY", best.price, best.volume);
    const sellFills = allocateSide(sells, "SELL", best.price, best.volume);
    const batchId = createHash("sha256").update(seed).digest("hex").slice(0, 16);
    const trades = pairTrades(buys, sells, buyFills, sellFills, best.price, batchId);

    const remaining = new Map<string, bigint>();
    for (const order of params.orders) remaining.set(order.id, order.quantity);
    for (const [orderId, filled] of buyFills) {
      remaining.set(orderId, (remaining.get(orderId) ?? 0n) - filled);
    }
    for (const [orderId, filled] of sellFills) {
      remaining.set(orderId, (remaining.get(orderId) ?? 0n) - filled);
    }

    const batch: MatchedTradesBatch = {
      batchId,
      intervalId: params.intervalId,
      assetId: params.assetId,
      closedAt,
      nav: params.nav,
      collarBps: params.collarBps,
      collar,
      equilibriumPrice: best.price,
      executableVolume: best.volume,
      demandAtEq: best.demand,
      supplyAtEq: best.supply,
      curve,
      trades,
      rejected: params.priorRejected,
      unfilled: [...remaining.entries()]
        .filter(([, qty]) => qty > 0n)
        .map(([orderId, remainingQty]) => ({ orderId, remaining: remainingQty })),
      fingerprint: fingerprintBatch({
        intervalId: params.intervalId,
        assetId: params.assetId,
        equilibriumPrice: best.price,
        trades,
      }),
    };
    return freezeBatch(batch);
  }
}

export function runPeriodicBatchAuction(input: unknown): MatchedTradesBatch {
  return new BatchAuctionEngine().match(input);
}
