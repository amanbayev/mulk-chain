import type { CashLock, TokenLock } from "./types.js";

export interface BankEscrowGateway {
  lock(instructionId: string, payerIban: string, amount: bigint): Promise<CashLock>;
  release(escrowRef: string, beneficiaryIban: string): Promise<void>;
  reverse(escrowRef: string): Promise<void>;
}

export interface IdentityRegistryGateway {
  isVerified(wallet: string): Promise<boolean>;
}

export interface MulkTokenEscrowGateway {
  lock(instructionId: string, fromWallet: string, amount: bigint, assetId: string): Promise<TokenLock>;
  release(holdRef: string, toWallet: string): Promise<void>;
  reverse(holdRef: string): Promise<void>;
}

export interface GatewayFaultFlags {
  failCashLock?: boolean;
  failTokenLock?: boolean;
  failCashRelease?: boolean;
  failTokenRelease?: boolean;
  failCashReverse?: boolean;
  failTokenReverse?: boolean;
}

export class MockBankEscrowGateway implements BankEscrowGateway {
  readonly balances = new Map<string, bigint>();
  readonly escrow = new Map<string, { payer: string; amount: bigint; open: boolean; beneficiary?: string }>();
  flags: GatewayFaultFlags = {};
  private seq = 0;

  credit(iban: string, amount: bigint): void {
    this.balances.set(iban, (this.balances.get(iban) ?? 0n) + amount);
  }

  async lock(instructionId: string, payerIban: string, amount: bigint): Promise<CashLock> {
    if (this.flags.failCashLock) throw new Error("Bank escrow gateway rejected KZT hold");
    const available = this.balances.get(payerIban) ?? 0n;
    if (available < amount) throw new Error("Insufficient KZT for escrow");
    this.balances.set(payerIban, available - amount);
    this.seq += 1;
    const escrowRef = `kzt-${instructionId}-${this.seq}`;
    this.escrow.set(escrowRef, { payer: payerIban, amount, open: true });
    return { escrowRef };
  }

  async release(escrowRef: string, beneficiaryIban: string): Promise<void> {
    if (this.flags.failCashRelease) throw new Error("Bank escrow gateway failed seller credit");
    const hold = this.escrow.get(escrowRef);
    if (!hold || !hold.open) throw new Error("Cash escrow is not open");
    this.balances.set(beneficiaryIban, (this.balances.get(beneficiaryIban) ?? 0n) + hold.amount);
    hold.open = false;
    hold.beneficiary = beneficiaryIban;
  }

  async reverse(escrowRef: string): Promise<void> {
    if (this.flags.failCashReverse) throw new Error("Bank escrow gateway reverse failed");
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
}

export class MockIdentityRegistry implements IdentityRegistryGateway {
  readonly verified = new Set<string>();

  markVerified(wallet: string): void {
    this.verified.add(wallet);
  }

  async isVerified(wallet: string): Promise<boolean> {
    return this.verified.has(wallet);
  }
}

export class MockMulkTokenEscrow implements MulkTokenEscrowGateway {
  readonly balances = new Map<string, bigint>();
  readonly holds = new Map<string, { from: string; amount: bigint; assetId: string; open: boolean; lastTo?: string }>();
  flags: GatewayFaultFlags = {};
  private seq = 0;

  credit(wallet: string, amount: bigint): void {
    this.balances.set(wallet, (this.balances.get(wallet) ?? 0n) + amount);
  }

  async lock(instructionId: string, fromWallet: string, amount: bigint, assetId: string): Promise<TokenLock> {
    if (this.flags.failTokenLock) throw new Error("MulkToken hold failed");
    const available = this.balances.get(fromWallet) ?? 0n;
    if (available < amount) throw new Error("Insufficient token balance for hold");
    this.balances.set(fromWallet, available - amount);
    this.seq += 1;
    const holdRef = `tok-${instructionId}-${this.seq}`;
    this.holds.set(holdRef, { from: fromWallet, amount, assetId, open: true });
    return { holdRef };
  }

  async release(holdRef: string, toWallet: string): Promise<void> {
    if (this.flags.failTokenRelease) throw new Error("MulkToken release failed");
    const hold = this.holds.get(holdRef);
    if (!hold || !hold.open) throw new Error("Token hold is not open");
    this.balances.set(toWallet, (this.balances.get(toWallet) ?? 0n) + hold.amount);
    hold.open = false;
    hold.lastTo = toWallet;
  }

  async reverse(holdRef: string): Promise<void> {
    if (this.flags.failTokenReverse) throw new Error("MulkToken reverse failed");
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
