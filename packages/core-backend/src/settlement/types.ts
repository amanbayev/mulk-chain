import { z } from "zod";
import { PositiveBigIntSchema } from "../lib/zod-bigint.js";

export const SettlementInstructionSchema = z.object({
  id: z.string().min(1),
  buyerId: z.string().min(1),
  sellerId: z.string().min(1),
  tokenAssetId: z.string().min(1),
  tokenAmount: PositiveBigIntSchema,
  kztTiyn: PositiveBigIntSchema,
  buyerWallet: z.string().min(1),
  sellerWallet: z.string().min(1),
  buyerIban: z.string().min(1),
  sellerIban: z.string().min(1),
});

export type SettlementInstruction = z.output<typeof SettlementInstructionSchema>;

export type DvpStatus =
  | "CREATED"
  | "CASH_LOCKED"
  | "TOKENS_LOCKED"
  | "SETTLED"
  | "COMPENSATING"
  | "COMPENSATED"
  | "FAILED";

export interface CashLock {
  escrowRef: string;
}

export interface TokenLock {
  holdRef: string;
}

export interface SettlementFailure {
  stage: string;
  message: string;
}

export interface CompensationStep {
  at: Date;
  action: string;
  ok: boolean;
  message: string;
}

export interface SagaLogEntry {
  at: Date;
  step: string;
  phase: "EXECUTE" | "COMPENSATE";
  ok: boolean;
  message: string;
}

export interface SettlementRecord {
  instruction: SettlementInstruction;
  status: DvpStatus;
  createdAt: Date;
  updatedAt: Date;
  cashLock: CashLock | null;
  tokenLock: TokenLock | null;
  cashReleased: boolean;
  tokensReleased: boolean;
  buyerVerified: boolean | null;
  sellerVerified: boolean | null;
  failure: SettlementFailure | null;
  compensation: CompensationStep[];
  saga: SagaLogEntry[];
}
