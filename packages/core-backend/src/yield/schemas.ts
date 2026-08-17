import { z } from "zod";
import { DEFAULT_SPV_RESERVE_BPS } from "../lib/money.js";
import { BpsSchema, NonNegativeBigIntSchema } from "../lib/zod-bigint.js";

export const HolderSnapshotSchema = z.object({
  investorId: z.string().min(1),
  wallet: z.string().min(1),
  iban: z.string().min(1),
  balance: NonNegativeBigIntSchema,
  /** Withholding tax in bps applied to this investor's gross dividend. */
  whtBps: BpsSchema.default(0n),
});

export const YieldRunInputSchema = z.object({
  distributionId: z.string().min(1),
  assetId: z.string().min(1),
  recordDate: z.coerce.date(),
  grossRentalIncomeTiyn: NonNegativeBigIntSchema,
  operatingExpensesTiyn: NonNegativeBigIntSchema,
  spvReserveBps: BpsSchema.default(DEFAULT_SPV_RESERVE_BPS),
  holders: z.array(HolderSnapshotSchema).optional(),
});

export type HolderSnapshot = z.output<typeof HolderSnapshotSchema>;
export type YieldRunInput = z.output<typeof YieldRunInputSchema>;
