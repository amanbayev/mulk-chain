import { createHash, randomUUID } from "node:crypto";
import { BAITEREK, DEFAULT_INVESTOR_ID, DEFAULT_INVESTOR_WALLET, DEFAULT_ONCHAIN_ID } from "@/lib/constants";
import { collarBounds, DEFAULT_COLLAR_BPS, DEFAULT_SPV_RESERVE_BPS, inCollar, toBigInt } from "@/lib/money";
import { previewYield, DEMO_HOLDERS } from "@/lib/yield-preview";
import { fail } from "@/lib/api/errors";
import { buildInvestorProfile, newApplication, uniqueProfiles } from "@/lib/api/identity";
import type {
  AdminStats,
  ApplicationReviewStatus,
  AuctionStatus,
  CreateSubscriptionBody,
  DecideApplicationBody,
  DividendRegister,
  InitKycBody,
  InvestorProfile,
  KycApplication,
  ListedAsset,
  MintAuthorization,
  MintRequestBody,
  PortfolioResponse,
  RegisterAssetBody,
  RegisterInvestorBody,
  ReviewEvent,
  SubmitOrderBody,
  SubmitOrderResponse,
  SubscriptionRequest,
  TriggerYieldBody,
  YieldHistoryResponse,
} from "@/lib/api/types";

function hashCadastre(cadastralNumber: string): `0x${string}` {
  return `0x${createHash("sha256").update(cadastralNumber.toUpperCase()).digest("hex")}`;
}

function toRegister(preview: ReturnType<typeof previewYield>, meta: { distributionId: string; assetId: string; recordDate: string }): DividendRegister {
  return {
    distributionId: meta.distributionId,
    assetId: meta.assetId,
    recordDate: meta.recordDate,
    grossRentalIncomeTiyn: preview.grossRentalIncomeTiyn.toString(),
    operatingExpensesTiyn: preview.operatingExpensesTiyn.toString(),
    noiTiyn: preview.noiTiyn.toString(),
    spvReserveBps: preview.spvReserveBps.toString(),
    spvReserveTiyn: preview.spvReserveTiyn.toString(),
    distributablePoolTiyn: preview.distributablePoolTiyn.toString(),
    totalSupply: preview.totalSupply.toString(),
    lines: preview.lines.map((line) => ({
      investorId: line.investorId,
      wallet: line.wallet,
      iban: line.iban,
      snapshotBalance: line.snapshotBalance.toString(),
      ownershipBps: line.ownershipBps.toString(),
      grossDividendTiyn: line.grossDividendTiyn.toString(),
      withholdingTaxTiyn: line.withholdingTaxTiyn.toString(),
      netPayableTiyn: line.netPayableTiyn.toString(),
    })),
    totalGrossTiyn: preview.totalGrossTiyn.toString(),
    totalWhtTiyn: preview.totalWhtTiyn.toString(),
    totalNetPayableTiyn: preview.totalNetPayableTiyn.toString(),
    unallocatedDustTiyn: "0",
  };
}

interface LimitOrder {
  id: string;
  side: "BUY" | "SELL";
  price: bigint;
  quantity: bigint;
  ownerId: string;
}

class DemoStore {
  assets = new Map<string, ListedAsset>();
  profiles = new Map<string, InvestorProfile>();
  balances = new Map<string, Map<string, bigint>>();
  kyc = new Map<string, { kycValid: boolean; investorClass: PortfolioResponse["investorClass"] }>();
  yieldHistory = new Map<string, DividendRegister[]>();
  transactions = new Map<string, PortfolioResponse["transactions"]>();
  encumbered = new Set<string>();
  mintLog: MintAuthorization[] = [];
  orders: LimitOrder[] = [];
  subscriptions: SubscriptionRequest[] = [];
  applications: KycApplication[] = [];
  interval = {
    intervalId: `auc-${BAITEREK.assetId}`,
    assetId: BAITEREK.assetId,
    open: true,
    nav: toBigInt(BAITEREK.nav),
    collarBps: DEFAULT_COLLAR_BPS,
    opensAt: "2026-08-17T09:00:00+05:00",
  };

  constructor() {
    this.seed();
  }

  private seed(): void {
    const listed: ListedAsset = {
      assetId: BAITEREK.assetId,
      name: BAITEREK.name,
      cadastralNumber: BAITEREK.cadastralNumber,
      cadastreHash: hashCadastre(BAITEREK.cadastralNumber),
      nav: BAITEREK.nav,
      spvName: BAITEREK.spvName,
      spvBin: BAITEREK.spvBin,
      spvReserveBps: BAITEREK.spvReserveBps,
      createdAt: BAITEREK.createdAt,
    };
    this.assets.set(listed.assetId, listed);

    const profile: InvestorProfile = {
      investorId: DEFAULT_INVESTOR_ID,
      wallet: DEFAULT_INVESTOR_WALLET,
      onchainId: DEFAULT_ONCHAIN_ID,
      iban: "KZ123456789012345678",
      whtBps: "1000",
      email: "ir@aifc-growth.kz",
      country: "KZ",
      provider: "SUMSUB",
      applicantId: `app-${DEFAULT_INVESTOR_ID}`,
      onboardingUrl: `https://kyc.mulk.chain/session/app-${DEFAULT_INVESTOR_ID}?provider=SUMSUB`,
      status: "VERIFIED",
      displayName: "AIFC Growth Fund",
      investorKind: "LEGAL_ENTITY",
      investorClass: "INSTITUTIONAL",
      kybStatus: "KYB_SUBMITTED",
      bin: BAITEREK.spvBin,
      legalName: "AIFC Growth Fund Ltd.",
      submittedAt: BAITEREK.createdAt,
      reviewStatus: "APPROVED",
      onchainConfirmed: true,
    };
    this.storeProfile(profile);
    this.kyc.set(profile.investorId, { kycValid: true, investorClass: "INSTITUTIONAL" });
    this.balances.set(profile.investorId, new Map([[BAITEREK.assetId, 1_250n]]));

    const q1 = toRegister(
      previewYield({
        grossRentalIncomeTiyn: 4_500_000_000n,
        operatingExpensesTiyn: 800_000_000n,
        holders: DEMO_HOLDERS,
      }),
      { distributionId: "DIV-2026-Q1", assetId: BAITEREK.assetId, recordDate: "2026-03-31T00:00:00.000Z" },
    );
    const q2 = toRegister(
      previewYield({
        grossRentalIncomeTiyn: 4_720_000_000n,
        operatingExpensesTiyn: 810_000_000n,
        holders: DEMO_HOLDERS,
      }),
      { distributionId: "DIV-2026-Q2", assetId: BAITEREK.assetId, recordDate: "2026-06-30T00:00:00.000Z" },
    );
    this.yieldHistory.set(DEFAULT_INVESTOR_ID, [q1, q2]);
    this.transactions.set(DEFAULT_INVESTOR_ID, [
      {
        id: "tx-mint-seed",
        at: "2026-01-16T11:00:00.000Z",
        type: "MINT",
        assetId: BAITEREK.assetId,
        quantity: "1250",
        note: "Primary allocation · verified mint",
      },
      {
        id: "tx-div-q1",
        at: q1.recordDate,
        type: "DIVIDEND",
        assetId: BAITEREK.assetId,
        quantity: q1.lines.find((line) => line.investorId === DEFAULT_INVESTOR_ID)?.netPayableTiyn ?? "0",
        note: "NOI distribution DIV-2026-Q1",
      },
      {
        id: "tx-div-q2",
        at: q2.recordDate,
        type: "DIVIDEND",
        assetId: BAITEREK.assetId,
        quantity: q2.lines.find((line) => line.investorId === DEFAULT_INVESTOR_ID)?.netPayableTiyn ?? "0",
        note: "NOI distribution DIV-2026-Q2",
      },
    ]);
  }

  initKyc(body: InitKycBody): InvestorProfile {
    const profile: InvestorProfile = {
      investorId: body.investorId,
      wallet: body.wallet,
      onchainId: body.onchainId,
      iban: body.iban ?? `KZ-IBAN-${body.investorId}`,
      whtBps: body.whtBps ?? "0",
      email: body.email,
      country: body.country ?? "KZ",
      provider: body.provider ?? "SUMSUB",
      applicantId: `app-${body.investorId}`,
      onboardingUrl: `https://kyc.mulk.chain/session/app-${body.investorId}?provider=${body.provider ?? "SUMSUB"}`,
      status: "PENDING_KYC",
      displayName: body.email ?? body.investorId,
      investorKind: "INDIVIDUAL",
      investorClass: "RETAIL",
      kybStatus: "NOT_REQUIRED",
      submittedAt: new Date().toISOString(),
      reviewStatus: "SUBMITTED",
    };
    this.storeProfile(profile);
    const application = newApplication(profile);
    profile.applicationId = application.id;
    this.storeProfile(profile);
    this.applications.push(application);
    return profile;
  }

  registerInvestor(body: RegisterInvestorBody): InvestorProfile {
    const existing = this.findProfile(body.wallet);
    const profile = buildInvestorProfile(body, existing);
    const application = newApplication(profile);
    profile.applicationId = application.id;
    profile.reviewStatus = application.reviewStatus;
    this.storeProfile(profile);
    this.applications.push(application);
    this.kyc.set(profile.investorId, {
      kycValid: profile.status === "VERIFIED",
      investorClass: profile.investorClass ?? null,
    });
    return profile;
  }

  profileByWallet(wallet: string): InvestorProfile | null {
    return this.findProfile(wallet);
  }

  pendingKycApplications(): InvestorProfile[] {
    return uniqueProfiles(this.profiles.values()).filter(
      (profile) => profile.reviewStatus === "APPROVED" && profile.status !== "VERIFIED",
    );
  }

  listApplications(status?: ApplicationReviewStatus): KycApplication[] {
    const rows = status ? this.applications.filter((row) => row.reviewStatus === status) : this.applications;
    return [...rows]
      .reverse()
      .map((row) => ({ ...row, profile: this.findProfile(row.wallet) ?? row.profile }));
  }

  getApplication(id: string): KycApplication {
    const row = this.applications.find((item) => item.id === id);
    if (!row) fail(404, "APPLICATION_NOT_FOUND", `unknown application ${id}`);
    return { ...row, profile: this.findProfile(row.wallet) ?? row.profile };
  }

  listInvestors(): InvestorProfile[] {
    return uniqueProfiles(this.profiles.values());
  }

  adminStats(): AdminStats {
    const investors = this.listInvestors();
    return {
      submitted: this.applications.filter((row) => row.reviewStatus === "SUBMITTED").length,
      approved: this.applications.filter((row) => row.reviewStatus === "APPROVED").length,
      rejected: this.applications.filter((row) => row.reviewStatus === "REJECTED").length,
      investors: investors.length,
    };
  }

  decideApplication(body: DecideApplicationBody): KycApplication {
    const row = this.applications.find((item) => item.id === body.id);
    if (!row) fail(404, "APPLICATION_NOT_FOUND", `unknown application ${body.id}`);
    if (body.action === "REJECTED" && !body.notes?.trim()) {
      fail(400, "NOTES_REQUIRED", "reject requires notes");
    }
    const now = new Date().toISOString();
    const event: ReviewEvent = {
      id: randomUUID(),
      applicationId: row.id,
      action: body.action,
      reviewerWallet: body.reviewerWallet,
      notes: body.notes?.trim(),
      createdAt: now,
    };
    row.reviewStatus = body.action;
    row.notes = body.notes?.trim();
    row.reviewerWallet = body.reviewerWallet;
    row.reviewedAt = now;
    row.events.push(event);
    const profile = this.findProfile(row.wallet);
    if (profile) {
      profile.reviewStatus = body.action;
      profile.reviewNotes = row.notes;
      profile.reviewedAt = now;
      profile.reviewerWallet = body.reviewerWallet;
      profile.applicationId = row.id;
      profile.status = body.action === "REJECTED" ? "REJECTED" : "PENDING_KYC";
      this.storeProfile(profile);
      this.kyc.set(profile.investorId, {
        kycValid: false,
        investorClass: profile.investorClass ?? null,
      });
      row.profile = profile;
    }
    return this.getApplication(row.id);
  }

  confirmKyc(wallet: string): InvestorProfile {
    const profile = this.findProfile(wallet);
    if (!profile) fail(404, "INVESTOR_NOT_FOUND", `unknown wallet ${wallet}`);
    if (profile.reviewStatus !== "APPROVED" && profile.status !== "VERIFIED") {
      fail(409, "NOT_APPROVED", "admin must approve the KYC/KYB package before on-chain confirm");
    }
    profile.status = "VERIFIED";
    profile.reviewStatus = "APPROVED";
    profile.onchainConfirmed = true;
    this.storeProfile(profile);
    this.kyc.set(profile.investorId, {
      kycValid: true,
      investorClass: profile.investorClass ?? this.kyc.get(profile.investorId)?.investorClass ?? null,
    });
    return profile;
  }

  createSubscription(body: CreateSubscriptionBody): SubscriptionRequest {
    if (!/^0x[0-9a-fA-F]{40}$/.test(body.wallet)) fail(400, "INVALID_WALLET", "wallet must be a 20-byte hex address");
    if (!this.assets.has(body.assetId)) fail(404, "ASSET_NOT_FOUND", `unknown asset ${body.assetId}`);
    const amount = body.amount.trim();
    if (!amount || Number(amount) <= 0) fail(400, "INVALID_AMOUNT", "amount must be positive");
    const request: SubscriptionRequest = {
      id: randomUUID(),
      wallet: body.wallet,
      assetId: body.assetId,
      amount,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };
    this.subscriptions.push(request);
    return request;
  }

  listSubscriptions(status?: SubscriptionRequest["status"]): SubscriptionRequest[] {
    const rows = status ? this.subscriptions.filter((row) => row.status === status) : this.subscriptions;
    return [...rows].reverse();
  }

  fillSubscription(id: string): SubscriptionRequest {
    const row = this.subscriptions.find((item) => item.id === id);
    if (!row) fail(404, "SUBSCRIPTION_NOT_FOUND", `unknown subscription ${id}`);
    row.status = "FILLED";
    return row;
  }

  portfolio(investorId: string): PortfolioResponse {
    const profile = this.requireProfile(investorId);
    const record = this.kyc.get(investorId);
    const balances = [...(this.balances.get(investorId) ?? new Map()).entries()].map(([assetId, quantity]) => ({
      assetId,
      quantity: quantity.toString(),
    }));
    const dividends = this.yieldHistory.get(investorId) ?? [];
    const accruedDividendsTiyn = dividends.reduce((acc, register) => {
      const line = register.lines.find((row) => row.investorId === investorId);
      return acc + toBigInt(line?.netPayableTiyn ?? "0");
    }, 0n);
    return {
      investorId,
      wallet: profile.wallet,
      status: profile.status,
      investorClass: record?.investorClass ?? null,
      kycValid: record?.kycValid ?? false,
      balances,
      accruedDividendsTiyn: accruedDividendsTiyn.toString(),
      transactions: this.transactions.get(investorId) ?? [],
    };
  }

  placeOrder(body: SubmitOrderBody): SubmitOrderResponse {
    const profile = this.requireProfile(body.investorId);
    const record = this.kyc.get(profile.investorId) ?? this.kyc.get(profile.wallet.toLowerCase());
    if (profile.status !== "VERIFIED" && !record?.kycValid) {
      fail(403, "KYC_REQUIRED", "investor must complete KYC before trading");
    }
    if (!this.interval.open || this.interval.assetId !== body.assetId) {
      fail(409, "NO_OPEN_AUCTION", `no open auction window for ${body.assetId}`);
    }
    const price = toBigInt(body.price);
    const quantity = toBigInt(body.quantity);
    if (quantity <= 0n) fail(400, "INVALID_QUANTITY", "quantity must be > 0");
    if (!inCollar(price, this.interval.nav, this.interval.collarBps)) {
      fail(400, "PRICE_COLLAR", "limit price is outside NAV ±10% collar");
    }
    const orderId = randomUUID();
    this.orders.push({ id: orderId, side: body.side, price, quantity, ownerId: body.investorId });
    const txs = this.transactions.get(body.investorId) ?? [];
    txs.push({
      id: orderId,
      at: new Date().toISOString(),
      type: "ORDER",
      assetId: body.assetId,
      quantity: body.quantity,
      note: `${body.side} @ ${body.price}`,
    });
    this.transactions.set(body.investorId, txs);
    return { orderId, intervalId: this.interval.intervalId, accepted: true, wallet: profile.wallet };
  }

  yieldHistoryFor(investorId: string): YieldHistoryResponse {
    const profile = this.findProfile(investorId);
    if (!profile) return { investorId, distributions: [] };
    return { investorId: profile.investorId, distributions: this.yieldHistory.get(profile.investorId) ?? [] };
  }

  registerAsset(body: RegisterAssetBody): ListedAsset {
    if (this.assets.has(body.assetId)) fail(409, "ASSET_EXISTS", `asset ${body.assetId} is already registered`);
    const asset: ListedAsset = {
      assetId: body.assetId,
      name: body.name,
      cadastralNumber: body.cadastralNumber,
      cadastreHash: hashCadastre(body.cadastralNumber),
      nav: body.nav,
      spvName: body.spvName,
      spvBin: body.spvBin,
      spvReserveBps: body.spvReserveBps ?? Number(DEFAULT_SPV_RESERVE_BPS),
      createdAt: new Date().toISOString(),
    };
    this.assets.set(asset.assetId, asset);
    this.interval = {
      intervalId: `auc-${asset.assetId}`,
      assetId: asset.assetId,
      open: true,
      nav: toBigInt(asset.nav),
      collarBps: DEFAULT_COLLAR_BPS,
      opensAt: new Date().toISOString(),
    };
    this.orders = [];
    return asset;
  }

  requestMint(body: MintRequestBody): MintAuthorization {
    const asset = this.assets.get(body.assetId);
    if (!asset) fail(404, "ASSET_NOT_FOUND", `unknown asset ${body.assetId}`);
    if (this.encumbered.has(asset.cadastralNumber.toUpperCase())) {
      fail(409, "ENCUMBERED", `EGKN object ${asset.cadastralNumber} is encumbered`);
    }
    const nonce = BigInt(Date.now());
    const deadline = nonce / 1000n + 3_600n;
    const cadastreHash = asset.cadastreHash;
    const proof = (`0x${createHash("sha256").update(`${body.to}:${body.amount}:${cadastreHash}:${nonce}`).digest("hex")}`) as `0x${string}`;
    const auth: MintAuthorization = {
      mintRequestId: randomUUID(),
      assetId: body.assetId,
      to: body.to,
      amount: body.amount,
      proof,
      cadastreHash,
      nonce: nonce.toString(),
      deadline: deadline.toString(),
      status: "PROOF_ISSUED",
    };
    this.mintLog.push(auth);
    return auth;
  }

  triggerYield(body: TriggerYieldBody): DividendRegister {
    const asset = this.assets.get(body.assetId);
    if (!asset) fail(404, "ASSET_NOT_FOUND", `unknown asset ${body.assetId}`);
    const holders = body.holders && body.holders.length > 0
      ? body.holders.map((holder) => ({
          investorId: holder.investorId,
          label: holder.investorId,
          wallet: holder.wallet,
          iban: holder.iban,
          balance: toBigInt(holder.balance),
          whtBps: toBigInt(holder.whtBps ?? "1000"),
        }))
      : DEMO_HOLDERS;
    const preview = previewYield({
      grossRentalIncomeTiyn: toBigInt(body.grossRentalIncomeTiyn),
      operatingExpensesTiyn: toBigInt(body.operatingExpensesTiyn),
      spvReserveBps: BigInt(asset.spvReserveBps),
      holders,
    });
    const register = toRegister(preview, {
      distributionId: body.distributionId,
      assetId: body.assetId,
      recordDate: new Date(body.recordDate).toISOString(),
    });
    for (const line of register.lines) {
      const list = this.yieldHistory.get(line.investorId) ?? [];
      list.push(register);
      this.yieldHistory.set(line.investorId, list);
    }
    return register;
  }

  auctionStatus(assetId?: string): AuctionStatus {
    if (assetId && assetId !== this.interval.assetId) fail(404, "NO_AUCTION", "no matching auction window");
    const collar = collarBounds(this.interval.nav, this.interval.collarBps);
    const buyQuantity = this.orders.filter((order) => order.side === "BUY").reduce((acc, order) => acc + order.quantity, 0n);
    const sellQuantity = this.orders.filter((order) => order.side === "SELL").reduce((acc, order) => acc + order.quantity, 0n);
    const atNavBuy = this.orders.filter((order) => order.side === "BUY" && order.price >= this.interval.nav).reduce((acc, order) => acc + order.quantity, 0n);
    const atNavSell = this.orders.filter((order) => order.side === "SELL" && order.price <= this.interval.nav).reduce((acc, order) => acc + order.quantity, 0n);
    return {
      intervalId: this.interval.intervalId,
      assetId: this.interval.assetId,
      open: this.interval.open,
      nav: this.interval.nav.toString(),
      collarBps: this.interval.collarBps.toString(),
      collar: { min: collar.min.toString(), max: collar.max.toString() },
      opensAt: this.interval.opensAt,
      orderCount: this.orders.length,
      rejectedCount: 0,
      buyQuantity: buyQuantity.toString(),
      sellQuantity: sellQuantity.toString(),
      indicativeDemandAtNav: atNavBuy.toString(),
      indicativeSupplyAtNav: atNavSell.toString(),
      priceCollar: "NAV ±10%",
    };
  }

  latestMint(assetId: string): MintAuthorization | null {
    return [...this.mintLog].reverse().find((row) => row.assetId === assetId) ?? null;
  }

  getAsset(assetId: string): ListedAsset | undefined {
    return this.assets.get(assetId);
  }

  private storeProfile(profile: InvestorProfile): void {
    this.profiles.set(profile.investorId, profile);
    this.profiles.set(profile.wallet.toLowerCase(), profile);
  }

  private findProfile(investorIdOrWallet: string): InvestorProfile | null {
    const direct = this.profiles.get(investorIdOrWallet) ?? this.profiles.get(investorIdOrWallet.toLowerCase());
    if (direct) return direct;
    for (const profile of this.profiles.values()) {
      if (profile.wallet.toLowerCase() === investorIdOrWallet.toLowerCase()) return profile;
    }
    return null;
  }

  private requireProfile(investorId: string): InvestorProfile {
    const profile = this.findProfile(investorId);
    if (!profile) fail(404, "INVESTOR_NOT_FOUND", `unknown investor ${investorId}`);
    return profile;
  }
}

const globalStore = globalThis as typeof globalThis & { __mulkDemo?: DemoStore };
export const demoStore = globalStore.__mulkDemo ?? new DemoStore();
globalStore.__mulkDemo = demoStore;

export { isDemoError } from "@/lib/api/errors";
