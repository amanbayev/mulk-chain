import type { Address } from "viem";
import deployed from "@/lib/chain/deployed.json";

export const ANVIL_CHAIN_ID = 31337;
export const ANVIL_RPC_DIRECT = "http://127.0.0.1:8545";
export const ANVIL_DEPLOYER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;
export const ANVIL_ALICE = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;

function addr(envValue: string | undefined, fallback: string): Address {
  const value = envValue?.trim() || fallback;
  return value as Address;
}

export const CHAIN_ADDRESSES = {
  GovOracleBridge: addr(process.env.NEXT_PUBLIC_GOV_ORACLE_BRIDGE, deployed.GovOracleBridge),
  BatchAuctionEngine: addr(process.env.NEXT_PUBLIC_BATCH_AUCTION_ENGINE, deployed.BatchAuctionEngine),
  YieldVault: addr(process.env.NEXT_PUBLIC_YIELD_VAULT, deployed.YieldVault),
} as const;
