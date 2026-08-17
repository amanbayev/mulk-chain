export { BatchAuctionEngine, runPeriodicBatchAuction } from "./auction/batch-auction.engine.js";
export type {
  AuctionWindowStatus,
  CurvePoint,
  MatchedTrade,
  MatchedTradesBatch,
  RejectReason,
  RejectedOrder,
  UnfilledOrder,
} from "./auction/batch-auction.engine.js";
export type { AuctionSide, BatchAuctionInput, LimitOrder } from "./auction/schemas.js";

export { DvpOrchestratorService, DvpError } from "./settlement/dvp-orchestrator.service.js";
export {
  MockBankEscrowGateway,
  MockIdentityRegistry,
  MockMulkTokenEscrow,
} from "./settlement/adapters.js";
export type {
  BankEscrowGateway,
  IdentityRegistryGateway,
  MulkTokenEscrowGateway,
} from "./settlement/adapters.js";
export type { DvpStatus, SettlementInstruction, SettlementRecord } from "./settlement/types.js";

export { RentalYieldService, InMemoryTokenSnapshot, YieldCalculationError } from "./yield/rental-yield.service.js";
export type { DividendLine, DividendRegister, TokenSnapshotPort } from "./yield/rental-yield.service.js";
export type { HolderSnapshot, YieldRunInput } from "./yield/schemas.js";

export { ClaimIssuerService } from "./identity/claim-issuer.service.js";
export { ClaimTopic } from "./identity/schemas.js";
export { KycWebhookController } from "./identity/kyc-webhook.controller.js";
export { IdentityRegistrySyncer } from "./identity/identity-registry-syncer.service.js";
export { MockIdentityRegistryChain } from "./identity/adapters.js";
export { verifyHmacSha256, signHmacSha256 } from "./identity/hmac.js";

export { createApiGateway } from "./api/gateway.js";
export { createGatewayStack } from "./api/compose.js";
export { PlatformService, MockGovOracle } from "./api/platform.service.js";
export { buildOpenApiDocument } from "./api/openapi.js";
