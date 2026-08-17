import { randomUUID } from "node:crypto";
import type { IdentityRegistryPort } from "./adapters.js";
import type { IssuedClaim } from "./claim-issuer.service.js";
import { FifoQueue } from "../infra/fifo-queue.js";

export type SyncJobType = "REGISTER_IDENTITY" | "SET_CLAIM";

export interface RegisterIdentityJob {
  id: string;
  type: "REGISTER_IDENTITY";
  wallet: string;
  onchainId: string;
  attempts: number;
}

export interface SetClaimJob {
  id: string;
  type: "SET_CLAIM";
  wallet: string;
  claim: IssuedClaim;
  attempts: number;
}

export type SyncJob = RegisterIdentityJob | SetClaimJob;

export interface SyncResult {
  jobId: string;
  type: SyncJobType;
  ok: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Background worker that submits IdentityRegistry.registerIdentity / setClaim txs.
 * Jobs are FIFO; registerIdentity is always enqueued before claims for the same wallet.
 */
export class IdentityRegistrySyncer {
  readonly fifo: FifoQueue<SyncJob>;
  readonly processed: SyncResult[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly registry: IdentityRegistryPort,
    private readonly maxAttempts = 5,
    fifo?: FifoQueue<SyncJob>,
  ) {
    this.fifo = fifo ?? new FifoQueue<SyncJob>("identity-registry");
  }

  get queue(): SyncJob[] {
    return this.fifo.items;
  }

  enqueueRegister(wallet: string, onchainId: string): RegisterIdentityJob {
    const job: RegisterIdentityJob = { id: randomUUID(), type: "REGISTER_IDENTITY", wallet, onchainId, attempts: 0 };
    this.queue.push(job);
    return job;
  }

  enqueueClaim(wallet: string, claim: IssuedClaim): SetClaimJob {
    const job: SetClaimJob = { id: randomUUID(), type: "SET_CLAIM", wallet, claim, attempts: 0 };
    this.queue.push(job);
    return job;
  }

  start(intervalMs = 250): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.processQueue();
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async processQueue(): Promise<SyncResult[]> {
    if (this.running) return [];
    this.running = true;
    const batch: SyncResult[] = [];
    const pending = this.queue.splice(0, this.queue.length);
    try {
      for (const job of pending) {
        const result = await this.execute(job);
        batch.push(result);
        this.processed.push(result);
        if (!result.ok && job.attempts + 1 < this.maxAttempts) {
          job.attempts += 1;
          this.queue.push(job);
        }
      }
    } finally {
      this.running = false;
    }
    return batch;
  }

  private async execute(job: SyncJob): Promise<SyncResult> {
    try {
      if (job.type === "REGISTER_IDENTITY") {
        const { txHash } = await this.registry.registerIdentity(job.wallet, job.onchainId);
        return { jobId: job.id, type: job.type, ok: true, txHash };
      }
      const { txHash } = await this.registry.setClaim(job.wallet, job.claim);
      return { jobId: job.id, type: job.type, ok: true, txHash };
    } catch (error) {
      return {
        jobId: job.id,
        type: job.type,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
