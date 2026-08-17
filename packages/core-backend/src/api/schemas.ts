import { z } from "zod";
import { AuctionSideSchema } from "../auction/schemas.js";
import { AddressSchema, KycProviderSchema } from "../identity/schemas.js";
import { HolderSnapshotSchema } from "../yield/schemas.js";
import { BpsSchema, NonNegativeBigIntSchema, PositiveBigIntSchema } from "../lib/zod-bigint.js";

export const InitKycBodySchema = z.object({
  investorId: z.string().min(1),
  wallet: AddressSchema,
  onchainId: AddressSchema,
  provider: KycProviderSchema.default("SUMSUB"),
  email: z.string().email().optional(),
  country: z.string().min(2).max(2).default("KZ"),
  iban: z.string().min(1).optional(),
  whtBps: BpsSchema.optional(),
});

export const SubmitOrderBodySchema = z.object({
  investorId: z.string().min(1),
  assetId: z.string().min(1),
  side: AuctionSideSchema,
  price: PositiveBigIntSchema,
  quantity: PositiveBigIntSchema,
});

export const RegisterAssetBodySchema = z.object({
  assetId: z.string().min(1),
  name: z.string().min(1),
  cadastralNumber: z.string().min(3),
  nav: PositiveBigIntSchema,
  spvName: z.string().min(1),
  spvBin: z.string().min(1),
  spvReserveBps: z.number().int().min(0).max(10_000).default(500),
});

export const MintRequestBodySchema = z.object({
  assetId: z.string().min(1),
  to: AddressSchema,
  amount: PositiveBigIntSchema,
});

export const TriggerYieldBodySchema = z.object({
  distributionId: z.string().min(1),
  assetId: z.string().min(1),
  recordDate: z.coerce.date(),
  grossRentalIncomeTiyn: NonNegativeBigIntSchema,
  operatingExpensesTiyn: NonNegativeBigIntSchema,
  holders: z.array(HolderSnapshotSchema).optional(),
});

export const ClearAuctionBodySchema = z.object({
  intervalId: z.string().min(1).optional(),
  assetId: z.string().min(1).optional(),
});

export type InitKycBody = z.output<typeof InitKycBodySchema>;
export type SubmitOrderBody = z.output<typeof SubmitOrderBodySchema>;
export type RegisterAssetBody = z.output<typeof RegisterAssetBodySchema>;
export type MintRequestBody = z.output<typeof MintRequestBodySchema>;
export type TriggerYieldBody = z.output<typeof TriggerYieldBodySchema>;
