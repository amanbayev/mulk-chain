import { Wallet } from "ethers";
import { BatchAuctionEngine, type MatchedTradesBatch } from "../auction/batch-auction.engine.js";
import { MockIdentityRegistryChain } from "../identity/adapters.js";
import { ClaimIssuerService } from "../identity/claim-issuer.service.js";
import { IdentityRegistrySyncer, type SyncJob } from "../identity/identity-registry-syncer.service.js";
import { KycWebhookController } from "../identity/kyc-webhook.controller.js";
import { FifoQueue } from "../infra/fifo-queue.js";
import { MockBankEscrowGateway, MockMulkTokenEscrow } from "../settlement/adapters.js";
import { DvpOrchestratorService } from "../settlement/dvp-orchestrator.service.js";
import { RentalYieldService } from "../yield/rental-yield.service.js";
import { createApiGateway } from "./gateway.js";
import { MockGovOracle, PlatformService } from "./platform.service.js";

export interface GatewayStackOptions {
  webhookSecret?: string;
  adminApiKey?: string;
}

export function createGatewayStack(options: GatewayStackOptions = {}) {
  const webhookSecret = options.webhookSecret ?? "test-webhook-secret";
  const adminApiKey = options.adminApiKey ?? "test-admin-key";
  const issuerWallet = Wallet.createRandom();
  const claims = new ClaimIssuerService({
    chainId: 31337,
    verifyingContract: issuerWallet.address,
    issuerWallet,
  });
  const registry = new MockIdentityRegistryChain();
  const identityTxQueue = new FifoQueue<SyncJob>("identity-registry");
  const syncer = new IdentityRegistrySyncer(registry, 5, identityTxQueue);
  const kycWebhook = new KycWebhookController(webhookSecret, claims, syncer);
  const auction = new BatchAuctionEngine();
  const yieldService = new RentalYieldService();
  const govOracle = new MockGovOracle();
  const bank = new MockBankEscrowGateway();
  const token = new MockMulkTokenEscrow();
  const dvp = new DvpOrchestratorService({ bank, identity: registry, token });
  const clearingQueue = new FifoQueue<MatchedTradesBatch>("clearing-batches");
  const platform = new PlatformService(auction, yieldService, govOracle, kycWebhook, {
    dvp,
    bank,
    token,
    identity: registry,
  }, clearingQueue);
  const app = createApiGateway({ platform, kycWebhook, adminApiKey });
  return {
    app,
    platform,
    registry,
    syncer,
    kycWebhook,
    claims,
    auction,
    govOracle,
    bank,
    token,
    dvp,
    identityTxQueue,
    clearingQueue,
    webhookSecret,
    adminApiKey,
    issuerWallet,
  };
}
