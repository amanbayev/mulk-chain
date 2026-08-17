import type { IssuedClaim } from "./claim-issuer.service.js";

export interface IdentityRegistryPort {
  registerIdentity(wallet: string, onchainId: string): Promise<{ txHash: string }>;
  setClaim(wallet: string, claim: IssuedClaim): Promise<{ txHash: string }>;
  isVerified(wallet: string): Promise<boolean>;
}

export interface RegistryIdentity {
  wallet: string;
  onchainId: string;
  verified: boolean;
  claims: IssuedClaim[];
}

export class MockIdentityRegistryChain implements IdentityRegistryPort {
  readonly identities = new Map<string, RegistryIdentity>();
  readonly transactions: Array<{ txHash: string; method: string; wallet: string }> = [];
  private seq = 0;

  async registerIdentity(wallet: string, onchainId: string): Promise<{ txHash: string }> {
    const txHash = this.nextTx("registerIdentity", wallet);
    this.identities.set(wallet.toLowerCase(), {
      wallet,
      onchainId,
      verified: true,
      claims: this.identities.get(wallet.toLowerCase())?.claims ?? [],
    });
    return { txHash };
  }

  async setClaim(wallet: string, claim: IssuedClaim): Promise<{ txHash: string }> {
    const txHash = this.nextTx("setClaim", wallet);
    const key = wallet.toLowerCase();
    const current = this.identities.get(key);
    if (!current) {
      throw new Error(`IdentityRegistry: ${wallet} is not registered`);
    }
    const claims = current.claims.filter((existing) => existing.topic !== claim.topic);
    claims.push(claim);
    this.identities.set(key, { ...current, claims });
    return { txHash };
  }

  async isVerified(wallet: string): Promise<boolean> {
    const row = this.identities.get(wallet.toLowerCase());
    return Boolean(row?.verified && row.onchainId);
  }

  private nextTx(method: string, wallet: string): string {
    this.seq += 1;
    const txHash = `0xreg${this.seq.toString(16).padStart(8, "0")}`;
    this.transactions.push({ txHash, method, wallet });
    return txHash;
  }
}
