/**
 * FIFO queue for IdentityRegistry txs and clearing batches.
 * Uses an in-process list by default (tests / offline). REDIS_URL is reserved for the Docker Compose worker.
 */
export class FifoQueue<T> {
  readonly items: T[] = [];

  constructor(readonly name: string) {}

  async push(item: T): Promise<void> {
    this.items.push(item);
  }

  async pop(): Promise<T | undefined> {
    return this.items.shift();
  }

  async peekAll(): Promise<T[]> {
    return [...this.items];
  }

  get size(): number {
    return this.items.length;
  }
}

export function loadInfraEnv() {
  return {
    rpcUrl: process.env.RPC_URL ?? "http://127.0.0.1:8545",
    chainId: Number(process.env.CHAIN_ID ?? "31337"),
    databaseUrl: process.env.DATABASE_URL ?? "postgres://mulk:mulk@127.0.0.1:5432/mulk_chain",
    redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
    adminApiKey: process.env.ADMIN_API_KEY ?? "test-admin-key",
    webhookSecret: process.env.KYC_WEBHOOK_SECRET ?? "test-webhook-secret",
  };
}
