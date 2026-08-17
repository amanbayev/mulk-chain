import { z } from "zod";
import { DEFAULT_COLLAR_BPS } from "../lib/money.js";
import { BpsSchema, PositiveBigIntSchema } from "../lib/zod-bigint.js";

export const AuctionSideSchema = z.enum(["BUY", "SELL"]);

export const LimitOrderSchema = z.object({
  id: z.string().min(1),
  side: AuctionSideSchema,
  price: PositiveBigIntSchema,
  quantity: PositiveBigIntSchema,
  ownerId: z.string().min(1),
  submittedAt: z.coerce.date().optional(),
});

export const OpenIntervalInputSchema = z.object({
  intervalId: z.string().min(1).optional(),
  assetId: z.string().min(1),
  nav: PositiveBigIntSchema,
  collarBps: BpsSchema.optional().default(DEFAULT_COLLAR_BPS),
  opensAt: z.coerce.date().optional(),
  closesAt: z.coerce.date().optional(),
});

export const BatchAuctionInputSchema = z.object({
  intervalId: z.string().min(1).optional(),
  assetId: z.string().min(1).default("MULK"),
  nav: PositiveBigIntSchema,
  collarBps: BpsSchema.optional().default(DEFAULT_COLLAR_BPS),
  orders: z.array(LimitOrderSchema),
  closedAt: z.coerce.date().optional(),
});

export type AuctionSide = z.infer<typeof AuctionSideSchema>;
export type LimitOrder = z.output<typeof LimitOrderSchema>;
export type OpenIntervalInput = z.output<typeof OpenIntervalInputSchema>;
export type BatchAuctionInput = z.output<typeof BatchAuctionInputSchema>;
