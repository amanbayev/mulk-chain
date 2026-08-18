export type InvestorClass = "RETAIL" | "PROFESSIONAL" | "INSTITUTIONAL" | "ACCREDITED";
export type KycStatus = "PENDING_KYC" | "VERIFIED" | "REJECTED";
export type InvestorKind = "INDIVIDUAL" | "LEGAL_ENTITY";
export type KybStatus = "NOT_REQUIRED" | "KYB_SUBMITTED";
export type AuctionSide = "BUY" | "SELL";
export type KycProvider = "SUMSUB" | "EGOV_MOBILE" | "DID";
export type LedgerTxType = "ORDER" | "DIVIDEND" | "MINT";
export type MintProofStatus = "PROOF_ISSUED";
export type EnforcementAction = "ForcedTransfer" | "Pause" | "Unpause";
export type EnforcementRole = "Legal" | "Compliance" | "Security" | "Trustee" | "Operations";

export interface ApiErrorBody {
  code: string;
  message: string;
  issues?: Array<{ path: string; message: string }>;
}

export interface InitKycBody {
  investorId: string;
  wallet: `0x${string}`;
  onchainId: `0x${string}`;
  provider?: KycProvider;
  email?: string;
  country?: string;
  iban?: string;
  whtBps?: string;
}

export interface RegisterInvestorBody {
  wallet: `0x${string}`;
  displayName: string;
  email: string;
  country?: string;
  investorKind: InvestorKind;
  investorClass?: InvestorClass;
  bin?: string;
  legalName?: string;
  onchainId?: `0x${string}`;
  onchainVerified?: boolean;
}

export interface InvestorProfile {
  investorId: string;
  wallet: string;
  onchainId: string;
  iban: string;
  whtBps: string;
  email?: string;
  country: string;
  provider: string;
  applicantId: string;
  onboardingUrl: string;
  status: KycStatus;
  displayName?: string;
  investorKind?: InvestorKind;
  investorClass?: InvestorClass;
  kybStatus?: KybStatus;
  bin?: string;
  legalName?: string;
  submittedAt?: string;
}

export interface SubscriptionRequest {
  id: string;
  wallet: `0x${string}`;
  assetId: string;
  amount: string;
  status: "PENDING" | "FILLED";
  createdAt: string;
}

export interface CreateSubscriptionBody {
  wallet: `0x${string}`;
  assetId: string;
  amount: string;
}

export interface AssetBalance {
  assetId: string;
  quantity: string;
}

export interface LedgerTx {
  id: string;
  at: string;
  type: LedgerTxType;
  assetId: string;
  quantity: string;
  note: string;
}

export interface PortfolioResponse {
  investorId: string;
  wallet: string;
  status: KycStatus;
  investorClass: InvestorClass | null;
  kycValid: boolean;
  balances: AssetBalance[];
  accruedDividendsTiyn: string;
  transactions: LedgerTx[];
}

export interface SubmitOrderBody {
  investorId: string;
  assetId: string;
  side: AuctionSide;
  price: string;
  quantity: string;
}

export interface SubmitOrderResponse {
  orderId: string;
  intervalId: string;
  accepted: true;
  wallet: string;
}

export interface RegisterAssetBody {
  assetId: string;
  name: string;
  cadastralNumber: string;
  nav: string;
  spvName: string;
  spvBin: string;
  spvReserveBps?: number;
}

export interface ListedAsset {
  assetId: string;
  name: string;
  cadastralNumber: string;
  cadastreHash: `0x${string}`;
  nav: string;
  spvName: string;
  spvBin: string;
  spvReserveBps: number;
  createdAt: string;
}

export interface MintRequestBody {
  assetId: string;
  to: `0x${string}`;
  amount: string;
}

export interface MintAuthorization {
  mintRequestId: string;
  assetId: string;
  to?: string;
  amount?: string;
  proof: `0x${string}`;
  cadastreHash: `0x${string}`;
  nonce: string;
  deadline: string;
  status: MintProofStatus;
}

export interface HolderSnapshotInput {
  investorId: string;
  wallet: string;
  iban: string;
  balance: string;
  whtBps?: string;
}

export interface TriggerYieldBody {
  distributionId: string;
  assetId: string;
  recordDate: string;
  grossRentalIncomeTiyn: string;
  operatingExpensesTiyn: string;
  holders?: HolderSnapshotInput[];
}

export interface DividendLine {
  investorId: string;
  wallet: string;
  iban: string;
  snapshotBalance: string;
  ownershipBps: string;
  grossDividendTiyn: string;
  withholdingTaxTiyn: string;
  netPayableTiyn: string;
}

export interface DividendRegister {
  distributionId: string;
  assetId: string;
  recordDate: string;
  grossRentalIncomeTiyn: string;
  operatingExpensesTiyn: string;
  noiTiyn: string;
  spvReserveBps: string;
  spvReserveTiyn: string;
  distributablePoolTiyn: string;
  totalSupply: string;
  lines: DividendLine[];
  totalGrossTiyn: string;
  totalWhtTiyn: string;
  totalNetPayableTiyn: string;
  unallocatedDustTiyn: string;
}

export interface YieldHistoryResponse {
  investorId: string;
  distributions: DividendRegister[];
}

export interface AuctionCollar {
  min: string;
  max: string;
}

export interface AuctionStatus {
  intervalId: string;
  assetId: string;
  open: boolean;
  nav: string;
  collarBps: string;
  collar: AuctionCollar;
  opensAt: string;
  orderCount: number;
  rejectedCount: number;
  buyQuantity: string;
  sellQuantity: string;
  indicativeDemandAtNav: string;
  indicativeSupplyAtNav: string;
  priceCollar: string;
}

export interface ClearAuctionBody {
  intervalId?: string;
  assetId?: string;
}

export interface PledgeInspection {
  inspectedAt: string;
  source: "EGKN";
  pledge: boolean;
  arrest: boolean;
  revocation: boolean;
  status: "CLEAR" | "ENCUMBERED" | "ARRESTED" | "REVOKED";
}

export interface AssetCatalogEntry extends ListedAsset {
  address: string;
  city: string;
  stabilizedNoiYieldBps: number;
  glaSqm: number;
  occupancyBps: number;
  tokenSupply: string;
  inspection: PledgeInspection;
}
