import { CompensatingSaga } from "./saga.js";
import { SettlementInstructionSchema, type CashLock, type SettlementRecord, type TokenLock } from "./types.js";
import type { BankEscrowGateway, IdentityRegistryGateway, MulkTokenEscrowGateway } from "./adapters.js";

export class DvpError extends Error {
  readonly stage: string;

  constructor(stage: string, message: string) {
    super(message);
    this.name = "DvpError";
    this.stage = stage;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface DvpOrchestratorDeps {
  bank: BankEscrowGateway;
  identity: IdentityRegistryGateway;
  token: MulkTokenEscrowGateway;
}

/**
 * T+0 Delivery-versus-Payment saga.
 * Leg A locks KZT, Leg B checks ERC-3643 isVerified and locks MulkToken,
 * then both releases fire together. Any failed leg triggers compensating rollback.
 */
export class DvpOrchestratorService {
  private readonly records = new Map<string, SettlementRecord>();

  constructor(private readonly deps: DvpOrchestratorDeps) {}

  get(instructionId: string): SettlementRecord | undefined {
    return this.records.get(instructionId);
  }

  async settle(raw: unknown, now: Date = new Date()): Promise<SettlementRecord> {
    const instruction = SettlementInstructionSchema.parse(raw);
    const existing = this.records.get(instruction.id);
    if (existing && (existing.status === "SETTLED" || existing.status === "COMPENSATED")) {
      return existing;
    }

    const record: SettlementRecord = {
      instruction,
      status: "CREATED",
      createdAt: now,
      updatedAt: now,
      cashLock: null,
      tokenLock: null,
      cashReleased: false,
      tokensReleased: false,
      buyerVerified: null,
      sellerVerified: null,
      failure: null,
      compensation: [],
      saga: [],
    };
    this.records.set(instruction.id, record);

    const saga = new CompensatingSaga();

    let cashLock: CashLock;
    try {
      cashLock = await this.deps.bank.lock(instruction.id, instruction.buyerIban, instruction.kztTiyn);
      record.cashLock = cashLock;
      record.status = "CASH_LOCKED";
      record.updatedAt = new Date();
      record.saga.push({
        at: new Date(),
        step: "LEG_A_CASH_LOCK",
        phase: "EXECUTE",
        ok: true,
        message: cashLock.escrowRef,
      });
      saga.register("cash", {
        name: "REVERSE_CASH_LOCK",
        run: async () => {
          await this.deps.bank.reverse(cashLock.escrowRef);
          record.cashReleased = false;
        },
      });
    } catch (error) {
      record.saga.push({
        at: new Date(),
        step: "LEG_A_CASH_LOCK",
        phase: "EXECUTE",
        ok: false,
        message: errorMessage(error),
      });
      return this.terminalFail(record, "CASH_LOCK", error);
    }

    let tokenLock: TokenLock;
    try {
      const buyerVerified = await this.deps.identity.isVerified(instruction.buyerWallet);
      const sellerVerified = await this.deps.identity.isVerified(instruction.sellerWallet);
      record.buyerVerified = buyerVerified;
      record.sellerVerified = sellerVerified;
      if (!buyerVerified) {
        throw new DvpError("KYC", `buyer wallet ${instruction.buyerWallet} is not isVerified`);
      }
      if (!sellerVerified) {
        throw new DvpError("KYC", `seller wallet ${instruction.sellerWallet} is not isVerified`);
      }
      tokenLock = await this.deps.token.lock(
        instruction.id,
        instruction.sellerWallet,
        instruction.tokenAmount,
        instruction.tokenAssetId,
      );
      record.tokenLock = tokenLock;
      record.status = "TOKENS_LOCKED";
      record.updatedAt = new Date();
      record.saga.push({
        at: new Date(),
        step: "LEG_B_TOKEN_LOCK",
        phase: "EXECUTE",
        ok: true,
        message: tokenLock.holdRef,
      });
      saga.register("token", {
        name: "REVERSE_TOKEN_LOCK",
        run: async () => {
          await this.deps.token.reverse(tokenLock.holdRef);
          record.tokensReleased = false;
        },
      });
    } catch (error) {
      record.saga.push({
        at: new Date(),
        step: "LEG_B_TOKEN_LOCK",
        phase: "EXECUTE",
        ok: false,
        message: errorMessage(error),
      });
      record.failure = { stage: error instanceof DvpError ? error.stage : "TOKEN_LOCK", message: errorMessage(error) };
      return this.compensate(record, saga);
    }

    const [tokenExec, cashExec] = await Promise.allSettled([
      this.deps.token.release(tokenLock.holdRef, instruction.buyerWallet),
      this.deps.bank.release(cashLock.escrowRef, instruction.sellerIban),
    ]);

    if (tokenExec.status === "fulfilled") {
      record.tokensReleased = true;
      record.saga.push({
        at: new Date(),
        step: "EXEC_TOKEN_RELEASE",
        phase: "EXECUTE",
        ok: true,
        message: instruction.buyerWallet,
      });
      saga.register("token", {
        name: "REVERSE_TOKEN_RELEASE",
        run: async () => {
          await this.deps.token.reverse(tokenLock.holdRef);
          record.tokensReleased = false;
        },
      });
    } else {
      record.saga.push({
        at: new Date(),
        step: "EXEC_TOKEN_RELEASE",
        phase: "EXECUTE",
        ok: false,
        message: errorMessage(tokenExec.reason),
      });
      record.failure = { stage: "TOKEN_RELEASE", message: errorMessage(tokenExec.reason) };
    }

    if (cashExec.status === "fulfilled") {
      record.cashReleased = true;
      record.saga.push({
        at: new Date(),
        step: "EXEC_CASH_RELEASE",
        phase: "EXECUTE",
        ok: true,
        message: instruction.sellerIban,
      });
      saga.register("cash", {
        name: "REVERSE_CASH_RELEASE",
        run: async () => {
          await this.deps.bank.reverse(cashLock.escrowRef);
          record.cashReleased = false;
        },
      });
    } else {
      record.saga.push({
        at: new Date(),
        step: "EXEC_CASH_RELEASE",
        phase: "EXECUTE",
        ok: false,
        message: errorMessage(cashExec.reason),
      });
      record.failure = record.failure ?? { stage: "CASH_RELEASE", message: errorMessage(cashExec.reason) };
    }

    if (record.tokensReleased && record.cashReleased) {
      record.status = "SETTLED";
      record.failure = null;
      record.updatedAt = new Date();
      return record;
    }

    return this.compensate(record, saga);
  }

  private terminalFail(record: SettlementRecord, stage: string, error: unknown): SettlementRecord {
    record.status = "FAILED";
    record.failure = { stage, message: errorMessage(error) };
    record.updatedAt = new Date();
    return record;
  }

  private async compensate(record: SettlementRecord, saga: CompensatingSaga): Promise<SettlementRecord> {
    record.status = "COMPENSATING";
    record.updatedAt = new Date();
    const results = await saga.rollback();
    for (const result of results) {
      record.compensation.push({
        at: new Date(),
        action: result.name,
        ok: result.ok,
        message: result.message,
      });
      record.saga.push({
        at: new Date(),
        step: result.name,
        phase: "COMPENSATE",
        ok: result.ok,
        message: result.message,
      });
    }
    record.status = results.some((result) => !result.ok) ? "FAILED" : "COMPENSATED";
    record.updatedAt = new Date();
    return record;
  }
}
