export type DvpStatus =
  | "CREATED"
  | "CASH_LOCKED"
  | "TOKENS_LOCKED"
  | "SETTLED"
  | "COMPENSATING"
  | "COMPENSATED"
  | "FAILED";

export interface SettlementInstruction {
  id: string;
  buyerId: string;
  sellerId: string;
  tokenAssetId: string;
  tokenAmount: bigint;
  kztTiyn: bigint;
  buyerWallet: string;
  sellerWallet: string;
  buyerIban: string;
  sellerIban: string;
}

export interface CashLock {
  escrowRef: string;
}

export interface TokenLock {
  holdRef: string;
}

export interface BankEscrowAdapter {
  lock(instructionId: string, payerIban: string, amount: bigint): Promise<CashLock>;
  release(escrowRef: string, beneficiaryIban: string): Promise<void>;
  reverse(escrowRef: string): Promise<void>;
}

export interface TokenEscrowAdapter {
  lock(instructionId: string, fromWallet: string, amount: bigint, assetId: string): Promise<TokenLock>;
  release(holdRef: string, toWallet: string): Promise<void>;
  reverse(holdRef: string): Promise<void>;
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

export interface SettlementRecord {
  instruction: SettlementInstruction;
  status: DvpStatus;
  createdAt: Date;
  updatedAt: Date;
  cashLock: CashLock | null;
  tokenLock: TokenLock | null;
  cashReleased: boolean;
  tokensReleased: boolean;
  failure: SettlementFailure | null;
  compensation: CompensationStep[];
}

export class DvpError extends Error {
  readonly stage: string;

  constructor(stage: string, message: string) {
    super(message);
    this.name = "DvpError";
    this.stage = stage;
  }
}

function fail(stage: string, error: unknown): DvpError {
  const message = error instanceof Error ? error.message : String(error);
  return new DvpError(stage, message);
}

/**
 * T+0 Delivery-versus-Payment orchestrator.
 * Sequence: lock KZT in bank escrow → lock on-chain tokens → release both legs.
 * If either lock or release fails, compensating transactions unwind the successful leg.
 */
export class DvpSettlementOrchestrator {
  private readonly records = new Map<string, SettlementRecord>();

  constructor(
    private readonly bank: BankEscrowAdapter,
    private readonly chain: TokenEscrowAdapter,
  ) {}

  get(instructionId: string): SettlementRecord | undefined {
    return this.records.get(instructionId);
  }

  async settle(instruction: SettlementInstruction, now: Date = new Date()): Promise<SettlementRecord> {
    if (instruction.tokenAmount <= 0n || instruction.kztTiyn <= 0n) {
      throw new DvpError("VALIDATE", "Both token and KZT amounts must be positive");
    }
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
      failure: null,
      compensation: [],
    };
    this.records.set(instruction.id, record);

    let cashLock: CashLock;
    try {
      cashLock = await this.bank.lock(instruction.id, instruction.buyerIban, instruction.kztTiyn);
      record.cashLock = cashLock;
      record.status = "CASH_LOCKED";
      record.updatedAt = new Date();
    } catch (error) {
      return this.terminalFail(record, "CASH_LOCK", error);
    }

    let tokenLock: TokenLock;
    try {
      tokenLock = await this.chain.lock(
        instruction.id,
        instruction.sellerWallet,
        instruction.tokenAmount,
        instruction.tokenAssetId,
      );
      record.tokenLock = tokenLock;
      record.status = "TOKENS_LOCKED";
      record.updatedAt = new Date();
    } catch (error) {
      record.failure = { stage: "TOKEN_LOCK", message: fail("TOKEN_LOCK", error).message };
      return this.compensate(record);
    }

    try {
      await this.chain.release(tokenLock.holdRef, instruction.buyerWallet);
      record.tokensReleased = true;
      record.updatedAt = new Date();
    } catch (error) {
      record.failure = { stage: "TOKEN_RELEASE", message: fail("TOKEN_RELEASE", error).message };
    }

    try {
      await this.bank.release(cashLock.escrowRef, instruction.sellerIban);
      record.cashReleased = true;
      record.updatedAt = new Date();
    } catch (error) {
      record.failure = record.failure ?? { stage: "CASH_RELEASE", message: fail("CASH_RELEASE", error).message };
    }

    if (record.tokensReleased && record.cashReleased) {
      record.status = "SETTLED";
      record.failure = null;
      record.updatedAt = new Date();
      return record;
    }

    return this.compensate(record);
  }

  private terminalFail(record: SettlementRecord, stage: string, error: unknown): SettlementRecord {
    record.status = "FAILED";
    record.failure = { stage, message: fail(stage, error).message };
    record.updatedAt = new Date();
    return record;
  }

  private async compensate(record: SettlementRecord): Promise<SettlementRecord> {
    record.status = "COMPENSATING";
    record.updatedAt = new Date();

    if (record.tokensReleased && record.tokenLock) {
      await this.step(record, "REVERSE_TOKEN_RELEASE", () => this.chain.reverse(record.tokenLock!.holdRef));
      record.tokensReleased = false;
    } else if (record.tokenLock && !record.tokensReleased) {
      await this.step(record, "REVERSE_TOKEN_LOCK", () => this.chain.reverse(record.tokenLock!.holdRef));
    }

    if (record.cashReleased && record.cashLock) {
      await this.step(record, "REVERSE_CASH_RELEASE", () => this.bank.reverse(record.cashLock!.escrowRef));
      record.cashReleased = false;
    } else if (record.cashLock && !record.cashReleased) {
      await this.step(record, "REVERSE_CASH_LOCK", () => this.bank.reverse(record.cashLock!.escrowRef));
    }

    const compensationFailed = record.compensation.some((step) => !step.ok);
    record.status = compensationFailed ? "FAILED" : "COMPENSATED";
    record.updatedAt = new Date();
    return record;
  }

  private async step(record: SettlementRecord, action: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
      record.compensation.push({ at: new Date(), action, ok: true, message: "ok" });
    } catch (error) {
      record.compensation.push({
        at: new Date(),
        action,
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export interface InMemoryEscrowFlags {
  failCashLock?: boolean;
  failTokenLock?: boolean;
  failCashRelease?: boolean;
  failTokenRelease?: boolean;
  failCashReverse?: boolean;
  failTokenReverse?: boolean;
}

export class InMemoryBankEscrow implements BankEscrowAdapter {
  readonly balances = new Map<string, bigint>();
  readonly escrow = new Map<string, { payer: string; amount: bigint; open: boolean; beneficiary?: string }>();
  flags: InMemoryEscrowFlags = {};
  private seq = 0;

  credit(iban: string, amount: bigint): void {
    this.balances.set(iban, (this.balances.get(iban) ?? 0n) + amount);
  }

  async lock(instructionId: string, payerIban: string, amount: bigint): Promise<CashLock> {
    if (this.flags.failCashLock) throw new Error("Bank core rejected escrow hold");
    const available = this.balances.get(payerIban) ?? 0n;
    if (available < amount) throw new Error("Insufficient KZT for escrow");
    this.balances.set(payerIban, available - amount);
    this.seq += 1;
    const escrowRef = `kzt-${instructionId}-${this.seq}`;
    this.escrow.set(escrowRef, { payer: payerIban, amount, open: true });
    return { escrowRef };
  }

  async release(escrowRef: string, beneficiaryIban: string): Promise<void> {
    if (this.flags.failCashRelease) throw new Error("Bank release (seller credit) failed");
    const hold = this.requireOpen(escrowRef);
    this.balances.set(beneficiaryIban, (this.balances.get(beneficiaryIban) ?? 0n) + hold.amount);
    hold.open = false;
    hold.beneficiary = beneficiaryIban;
  }

  async reverse(escrowRef: string): Promise<void> {
    if (this.flags.failCashReverse) throw new Error("Bank reverse failed");
    const hold = this.escrow.get(escrowRef);
    if (!hold) throw new Error("Unknown cash escrow");
    if (hold.open) {
      this.balances.set(hold.payer, (this.balances.get(hold.payer) ?? 0n) + hold.amount);
      hold.open = false;
      return;
    }
    if (!hold.beneficiary) throw new Error("Cannot claw back unreleased KZT");
    const beneficiaryBal = this.balances.get(hold.beneficiary) ?? 0n;
    if (beneficiaryBal < hold.amount) throw new Error("Cannot claw back released KZT");
    this.balances.set(hold.beneficiary, beneficiaryBal - hold.amount);
    this.balances.set(hold.payer, (this.balances.get(hold.payer) ?? 0n) + hold.amount);
  }

  private requireOpen(escrowRef: string): { payer: string; amount: bigint; open: boolean; beneficiary?: string } {
    const hold = this.escrow.get(escrowRef);
    if (!hold || !hold.open) throw new Error("Cash escrow is not open");
    return hold;
  }
}

export class InMemoryTokenEscrow implements TokenEscrowAdapter {
  readonly balances = new Map<string, bigint>();
  readonly holds = new Map<string, { from: string; amount: bigint; assetId: string; open: boolean; lastTo?: string }>();
  flags: InMemoryEscrowFlags = {};
  private seq = 0;

  credit(wallet: string, amount: bigint): void {
    this.balances.set(wallet, (this.balances.get(wallet) ?? 0n) + amount);
  }

  async lock(instructionId: string, fromWallet: string, amount: bigint, assetId: string): Promise<TokenLock> {
    if (this.flags.failTokenLock) throw new Error("On-chain token hold failed");
    const available = this.balances.get(fromWallet) ?? 0n;
    if (available < amount) throw new Error("Insufficient token balance for hold");
    this.balances.set(fromWallet, available - amount);
    this.seq += 1;
    const holdRef = `tok-${instructionId}-${this.seq}`;
    this.holds.set(holdRef, { from: fromWallet, amount, assetId, open: true });
    return { holdRef };
  }

  async release(holdRef: string, toWallet: string): Promise<void> {
    if (this.flags.failTokenRelease) throw new Error("On-chain token release failed");
    const hold = this.holds.get(holdRef);
    if (!hold || !hold.open) throw new Error("Token hold is not open");
    this.balances.set(toWallet, (this.balances.get(toWallet) ?? 0n) + hold.amount);
    hold.open = false;
    hold.lastTo = toWallet;
  }

  async reverse(holdRef: string): Promise<void> {
    if (this.flags.failTokenReverse) throw new Error("On-chain token reverse failed");
    const hold = this.holds.get(holdRef);
    if (!hold) throw new Error("Unknown token hold");
    if (hold.open) {
      this.balances.set(hold.from, (this.balances.get(hold.from) ?? 0n) + hold.amount);
      hold.open = false;
      return;
    }
    if (!hold.lastTo) throw new Error("Cannot reverse unreleased hold destination");
    const destBal = this.balances.get(hold.lastTo) ?? 0n;
    if (destBal < hold.amount) throw new Error("Buyer no longer holds tokens for clawback");
    this.balances.set(hold.lastTo, destBal - hold.amount);
    this.balances.set(hold.from, (this.balances.get(hold.from) ?? 0n) + hold.amount);
  }
}
