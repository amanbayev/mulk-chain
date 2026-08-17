import { BAITEREK } from "@/lib/constants";

export interface DataRoomDocument {
  id: string;
  onchainDocId: string;
  fileName: string;
  title: string;
  description: string;
  issuer: string;
  dated: string;
  size: string;
  pages: number;
  sha256: string;
  onchainTx: `0x${string}`;
  blockNumber: number;
}

export const DATA_ROOM_DOCUMENTS: DataRoomDocument[] = [
  {
    id: "spv-charter",
    onchainDocId: "BAITEREK-BC-CHARTER",
    fileName: "SPV_Articles_of_Association_AIFC_HashAnchored.pdf",
    title: "SPV Charter",
    description: "Articles of Association for Baiterek BC SPV Ltd., registered with the AIFC Registrar of Companies and hash-anchored on MulkToken.",
    issuer: "AIFC Registrar of Companies",
    dated: "2026-01-15",
    size: "1.24 MB",
    pages: 42,
    sha256: "a7c31e9f4b8d2a1056e0c94f7d1b3a8e2c5f90d6b4a1e7c3f8d2b6a0e5c19f44",
    onchainTx: "0x4e91c2a0b7d35f18a6c4e9b0d2f7a1c8e3b5d90f6a2c4e1b7d8f0a3c5e91b2d4",
    blockNumber: 1_848_812,
  },
  {
    id: "rics-valuation",
    onchainDocId: "BAITEREK-BC-VALUATION",
    fileName: "RICS_Red_Book_Valuation_Report_2025.pdf",
    title: "Independent Appraisal",
    description: "RICS Red Book valuation as at 31 December 2025. Independent appraisal by a Big-4 / Tier-1 valuer instructed by the Security Trustee.",
    issuer: "PwC Valuation · RICS Registered Valuer",
    dated: "2025-12-31",
    size: "3.81 MB",
    pages: 68,
    sha256: "c0b8d41a93e7f25610d4c8a9e2b7f3d1a6c0e85b4f29d7a3c1e6b0d48f5a27c9",
    onchainTx: "0x91b0e4c7a2d5f38c6e1a90b4d7f2c5e8a3b6d0f19c4e7a2b5d8f1c3e6a90b4d7",
    blockNumber: 1_847_440,
  },
  {
    id: "security-deed",
    onchainDocId: "BAITEREK-BC-DEED",
    fileName: "Cadastre_Mortgage_Security_Deed_KZ.pdf",
    title: "Pledge & Security Trustee agreement",
    description: "First-ranking mortgage over the EGKN parcel, registered with the Ministry of Justice of the Republic of Kazakhstan in favour of the Security Trustee.",
    issuer: "Ministry of Justice RK · EGKN",
    dated: "2026-01-20",
    size: "2.07 MB",
    pages: 31,
    sha256: "e15f90b2c7a4d8e36b1c0f9a5d2e7c4b8a0f3d16e9c2b5a7d4f0e8c1b3a695d2",
    onchainTx: "0x2c5e9a1d4b7f0c38e6a2d9b5f1c4e7a0d3b6f8c19e2a5d7b0f4c8e1a3d6b90f2",
    blockNumber: 1_848_901,
  },
  {
    id: "afsa-sandbox",
    onchainDocId: "BAITEREK-BC-SANDBOX",
    fileName: "AFSA_FinTech_Lab_Sandbox_Approval.pdf",
    title: "Regulatory Sandbox Certificate",
    description: "AFSA FinTech Lab sandbox approval for Mülk Chain tokenised units under the AIFC framework. Authorises the ERC-3643 issuance and Periodic Batch Auction.",
    issuer: "Astana Financial Services Authority",
    dated: "2026-02-04",
    size: "890 KB",
    pages: 12,
    sha256: "9d2a6c4e1b8f0a735c9e2d4b6a1f8c0e3d5b7a92f4c1e6d0b8a3f5c7e19d2a60",
    onchainTx: "0x7a3c1e5b9d0f2a48c6e1b4d7f0a3c5e8b2d6f9a1c4e7b0d3f6a8c1e4b7d0f293",
    blockNumber: 1_849_055,
  },
];

export const ORACLE_DEMO = {
  cadastreId: BAITEREK.cadastralNumber,
  cadastreAlias: "01-123-456-789",
  encumbranceStatus: "CLEAN_PLEDGE" as const,
  blockNumber: 1_849_201,
  lastCheckTx: "0x7f8a4c91e2b0d6a3f5e8c1b947d0a2e6f3c8b1d59a0e7c4f2b8d1a6e0c5fc92b" as `0x${string}`,
  consensusNodes: 3,
  syncedNodes: 3,
  pollPeriodSeconds: 6 * 60 * 60,
  /** Phase so a typical afternoon session shows ~5h 42m remaining. */
  pollOffsetSeconds: 18 * 60,
};

export const AUCTION_DEMO = {
  epochNumber: 42,
  periodSeconds: 3 * 60 * 60,
  /** Phase so a typical evening session shows ~2h 45m remaining. */
  epochOffsetSeconds: 15 * 60,
  navUsd: 100,
  collarPct: 10,
  collarMinUsd: 90,
  collarMaxUsd: 110,
  equilibriumUsd: 98.5,
  kztPerUsd: 1_000,
  aliceStartBalance: 1_250,
  aliceFillQty: 50,
};

export const YIELD_WATERFALL_DEMO = {
  periodLabel: "2026-Q3 accruing",
  distributionId: "DIV-2026-Q3",
  recordDate: "2026-09-30",
  grossRentUsd: 12_500,
  opexUsd: 1_875,
  opexBps: 1_500,
  reserveUsd: 625,
  reserveBps: 500,
  noiUsd: 10_000,
  proRataUsd: 450,
  kztPerUsd: 1_000,
  tokenBalance: 1_250,
  tokenSupply: 12_500,
};
