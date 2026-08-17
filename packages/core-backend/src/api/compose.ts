import { Wallet } from "ethers";
import { BatchAuctionEngine } from "../auction/batch-auction.engine.js";
import { MockIdentityRegistryChain } from "../identity/adapters.js";
import { ClaimIssuerService } from "../identity/claim-issuer.service.js";
import { IdentityRegistrySyncer } from "../identity/identity-registry-syncer.service.js";
import { KycWebhookController } from "../identity/kyc-webhook.controller.js";
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
  const syncer = new IdentityRegistrySyncer(registry);
  const kycWebhook = new KycWebhookController(webhookSecret, claims, syncer);
  const auction = new BatchAuctionEngine();
  const yieldService = new RentalYieldService();
  const govOracle = new MockGovOracle();
  const platform = new PlatformService(auction, yieldService, govOracle, kycWebhook);
  const app = createApiGateway({ platform, auction, kycWebhook, adminApiKey });
  return { app, platform, registry, syncer, kycWebhook, claims, auction, govOracle, webhookSecret, adminApiKey, issuerWallet };
}
