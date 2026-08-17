import { z } from "zod";

/** Accepts bigint, integer number, or decimal string. Engine math always uses bigint. */
export const BigIntQuantitySchema = z
  .union([z.bigint(), z.number().int(), z.string().regex(/^-?\d+$/)])
  .transform((value): bigint => (typeof value === "bigint" ? value : BigInt(value)));

export const PositiveBigIntSchema = BigIntQuantitySchema.refine((value) => value > 0n, {
  message: "value must be > 0",
});

export const NonNegativeBigIntSchema = BigIntQuantitySchema.refine((value) => value >= 0n, {
  message: "value must be >= 0",
});

export const BpsSchema = NonNegativeBigIntSchema.refine((value) => value <= 10_000n, {
  message: "bps cannot exceed 10000",
});
