import type { AssetCatalogEntry } from "@/lib/api/types";

export const BAITEREK_ASSET_ID = "BAITEREK-BC";

/** Canonical demo lot used across investor and issuer consoles. */
export const BAITEREK: AssetCatalogEntry = {
  assetId: BAITEREK_ASSET_ID,
  name: "Baiterek Business Center",
  cadastralNumber: "01:001:0012345:15",
  cadastreHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
  nav: "10000000",
  spvName: "Baiterek BC SPV Ltd.",
  spvBin: "240140012345",
  spvReserveBps: 500,
  createdAt: "2026-01-15T00:00:00.000Z",
  address: "55 Mangilik El Avenue, Esil District, Astana 010000",
  city: "Astana · AIFC",
  stabilizedNoiYieldBps: 1120,
  glaSqm: 48_600,
  occupancyBps: 9_640,
  tokenSupply: "12500",
  inspection: {
    inspectedAt: "2026-08-12T09:40:00+05:00",
    source: "EGKN",
    pledge: false,
    arrest: false,
    revocation: false,
    status: "CLEAR",
  },
};

export const DEFAULT_INVESTOR_ID = process.env.NEXT_PUBLIC_DEFAULT_INVESTOR_ID ?? "inv-001";
export const DEFAULT_INVESTOR_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;
export const DEFAULT_ONCHAIN_ID = "0x3C44cddDb6a900fa2b585dd299e03d12FA4293BC" as const;

export const ENFORCEMENT_ROLES = ["Legal", "Compliance", "Security", "Trustee", "Operations"] as const;
export const ENFORCEMENT_THRESHOLD = 3;

/** Well-known Anvil accounts 2–6, used only for the local 3-of-5 board simulation. */
export const DEMO_ENFORCEMENT_SIGNERS = [
  { role: "Legal" as const, address: "0x3C44cddDb6a900fa2b585dd299e03d12FA4293BC" },
  { role: "Compliance" as const, address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906" },
  { role: "Security" as const, address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65" },
  { role: "Trustee" as const, address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc" },
  { role: "Operations" as const, address: "0x976EA74026E726554dB657fA54763abd0C3a0aa9" },
];
