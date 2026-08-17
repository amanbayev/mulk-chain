import { createHash, randomUUID } from "node:crypto";
import { BatchAuctionEngine } from "../auction/batch-auction.engine.js";
import type { InvestorComplianceRecord } from "../identity/kyc-webhook.controller.js";
import { RentalYieldService, type DividendRegister } from "../yield/rental-yield.service.js";
import { ApiError } from "./errors.js";
import type { InitKycBody, MintRequestBody, RegisterAssetBody, SubmitOrderBody, TriggerYieldBody } from "./schemas.js";

export interface ListedAsset {
  assetId: string;
  name: string;
  cadastralNumber: string;
  cadastreHash: `0x${string}`;
  nav: bigint;
  spvName: string;
  spvBin: string;
  spvReserveBps: number;
  createdAt: string;
}

export interface InvestorProfile {
  investorId: string;
  wallet: string;
  onchainId: string;
  email?: string;
  country: string;
  provider: string;
  applicantId: string;
  onboardingUrl: string;
  status: "PENDING_KYC" | "VERIFIED" | "REJECTED";
}

export interface LedgerTx {
  id: string;
  at: string;
  type: "ORDER" | "DIVIDEND" | "MINT";
  assetId: string;
  quantity: bigint;
  note: string;
}

export interface GovOraclePort {
  authorizeVerifiedMint(input: {
    cadastralNumber: string;
    to: string;
    amount: bigint;
  }): Promise<{ proof: `0x${string}`; cadastreHash: `0x${string}`; nonce: bigint; deadline: bigint }>;
}

export class MockGovOracle implements GovOraclePort {
  encumbered = new Set<string>();

  async authorizeVerifiedMint(input: {
    cadastralNumber: string;
    to: string;
    amount: bigint;
  }): Promise<{ proof: `0x${string}`; cadastreHash: `0x${string}`; nonce: bigint; deadline: bigint }> {
    if (this.encumbered.has(input.cadastralNumber.toUpperCase())) {
      throw new ApiError(409, "ENCUMBERED", `EGKN object ${input.cadastralNumber} is encumbered`);
    }
    const cadastreHash = (`0x${createHash("sha256").update(input.cadastralNumber.toUpperCase()).digest("hex")}`) as `0x${string}`;
    const nonce = BigInt(Date.now());
    const deadline = nonce / 1000n + 3_600n;
    const proof = (`0x${createHash("sha256").update(`${input.to}:${input.amount}:${cadastreHash}:${nonce}`).digest("hex")}`) as `0x${string}`;
    return { proof, cadastreHash, nonce, deadline };
  }
}

export class PlatformService {
  readonly assets = new Map<string, ListedAsset>();
  readonly profiles = new Map<string, InvestorProfile>();
  readonly balances = new Map<string, Map<string, bigint>>();
  readonly transactions = new Map<string, LedgerTx[]>();
  readonly yieldHistory = new Map<string, DividendRegister[]>();
  readonly mintRequests: Array<{
    id: string;
    assetId: string;
    to: string;
    amount: bigint;
    proof: `0x${string}`;
    cadastreHash: `0x${string}`;
  }> = [];

  constructor(
    readonly auction: BatchAuctionEngine,
    readonly yieldService: RentalYieldService,
    readonly govOracle: GovOraclePort,
    private readonly compliance: { investors: Map<string, InvestorComplianceRecord> },
  ) {}

  initKyc(body: InitKycBody): InvestorProfile {
    const applicantId = `app-${body.investorId}`;
    const profile: InvestorProfile = {
      investorId: body.investorId,
      wallet: body.wallet,
      onchainId: body.onchainId,
      email: body.email,
      country: body.country,
      provider: body.provider,
      applicantId,
      onboardingUrl: `https://kyc.mulk.chain/session/${applicantId}?provider=${body.provider}`,
      status: "PENDING_KYC",
    };
    this.profiles.set(body.investorId, profile);
    return profile;
  }

  refreshCompliance(investorId: string): void {
    const profile = this.profiles.get(investorId);
    const record = this.compliance.investors.get(investorId);
    if (!profile || !record) return;
    profile.status = record.kycValid ? "VERIFIED" : "REJECTED";
  }

  portfolio(investorId: string) {
    const profile = this.requireProfile(investorId);
    this.refreshCompliance(investorId);
    const record = this.compliance.investors.get(investorId);
    const balances = [...(this.balances.get(investorId) ?? new Map()).entries()].map(([assetId, quantity]) => ({
      assetId,
      quantity,
    }));
    const dividends = this.yieldHistory.get(investorId) ?? [];
    const accruedDividendsTiyn = dividends.reduce((acc, register) => {
      const line = register.lines.find((row) => row.investorId === investorId);
      return acc + (line?.netPayableTiyn ?? 0n);
    }, 0n);
    return {
      investorId,
      wallet: profile.wallet,
      status: profile.status,
      investorClass: record?.investorClass ?? null,
      kycValid: record?.kycValid ?? false,
      balances,
      accruedDividendsTiyn,
      transactions: this.transactions.get(investorId) ?? [],
    };
  }

  placeOrder(body: SubmitOrderBody) {
    this.refreshCompliance(body.investorId);
    const profile = this.requireProfile(body.investorId);
    const record = this.compliance.investors.get(body.investorId);
    if (!record?.kycValid) {
      throw new ApiError(403, "KYC_REQUIRED", "investor must complete KYC before trading");
    }
    const window = this.auction.findOpenInterval(body.assetId);
    if (!window) {
      throw new ApiError(409, "NO_OPEN_AUCTION", `no open auction window for ${body.assetId}`);
    }
    const orderId = randomUUID();
    const collected = this.auction.collectOrder(window.intervalId, {
      id: orderId,
      side: body.side,
      price: body.price,
      quantity: body.quantity,
      ownerId: body.investorId,
    });
    if (!collected.accepted) {
      throw new ApiError(400, collected.rejected?.reason ?? "ORDER_REJECTED", collected.rejected?.detail ?? "order rejected");
    }
    this.pushTx(body.investorId, {
      id: orderId,
      at: new Date().toISOString(),
      type: "ORDER",
      assetId: body.assetId,
      quantity: body.quantity,
      note: `${body.side} @ ${body.price.toString()}`,
    });
    return { orderId, intervalId: window.intervalId, accepted: true, wallet: profile.wallet };
  }

  yieldHistoryFor(investorId: string): DividendRegister[] {
    this.requireProfile(investorId);
    return this.yieldHistory.get(investorId) ?? [];
  }

  registerAsset(body: RegisterAssetBody): ListedAsset {
    if (this.assets.has(body.assetId)) {
      throw new ApiError(409, "ASSET_EXISTS", `asset ${body.assetId} is already registered`);
    }
    const cadastreHash = (`0x${createHash("sha256").update(body.cadastralNumber.toUpperCase()).digest("hex")}`) as `0x${string}`;
    const asset: ListedAsset = {
      assetId: body.assetId,
      name: body.name,
      cadastralNumber: body.cadastralNumber,
      cadastreHash,
      nav: body.nav,
      spvName: body.spvName,
      spvBin: body.spvBin,
      spvReserveBps: body.spvReserveBps,
      createdAt: new Date().toISOString(),
    };
    this.assets.set(body.assetId, asset);
    this.auction.openInterval({
      intervalId: `auc-${body.assetId}`,
      assetId: body.assetId,
      nav: body.nav,
    });
    return asset;
  }

  async requestMint(body: MintRequestBody) {
    const asset = this.assets.get(body.assetId);
    if (!asset) throw new ApiError(404, "ASSET_NOT_FOUND", `unknown asset ${body.assetId}`);
    const proof = await this.govOracle.authorizeVerifiedMint({
      cadastralNumber: asset.cadastralNumber,
      to: body.to,
      amount: body.amount,
    });
    const id = randomUUID();
    this.mintRequests.push({ id, assetId: body.assetId, to: body.to, amount: body.amount, ...proof });
    return { mintRequestId: id, assetId: body.assetId, ...proof, status: "PROOF_ISSUED" as const };
  }

  async triggerYield(body: TriggerYieldBody): Promise<DividendRegister> {
    const asset = this.assets.get(body.assetId);
    if (!asset) throw new ApiError(404, "ASSET_NOT_FOUND", `unknown asset ${body.assetId}`);
    const register = await this.yieldService.distribute({
      distributionId: body.distributionId,
      assetId: body.assetId,
      recordDate: body.recordDate,
      grossRentalIncomeTiyn: body.grossRentalIncomeTiyn,
      operatingExpensesTiyn: body.operatingExpensesTiyn,
      holders: body.holders,
    });
    for (const line of register.lines) {
      const list = this.yieldHistory.get(line.investorId) ?? [];
      list.push(register);
      this.yieldHistory.set(line.investorId, list);
      this.pushTx(line.investorId, {
        id: `${register.distributionId}-${line.investorId}`,
        at: register.recordDate,
        type: "DIVIDEND",
        assetId: body.assetId,
        quantity: line.netPayableTiyn,
        note: `NOI distribution ${register.distributionId}`,
      });
    }
    return register;
  }

  private requireProfile(investorId: string): InvestorProfile {
    const profile = this.profiles.get(investorId);
    if (!profile) throw new ApiError(404, "INVESTOR_NOT_FOUND", `unknown investor ${investorId}`);
    return profile;
  }

  private pushTx(investorId: string, tx: LedgerTx): void {
    const list = this.transactions.get(investorId) ?? [];
    list.push(tx);
    this.transactions.set(investorId, list);
  }
}
