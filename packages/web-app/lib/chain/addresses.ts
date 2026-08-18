import type { Address } from "viem";
import { arbitrumSepolia, foundry } from "viem/chains";
import deployed from "@/lib/chain/deployed.json";

export const ANVIL_CHAIN_ID = 31337;
export const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;
export const TARGET_CHAIN_ID = deployed.chainId;
export const ANVIL_RPC_DIRECT = "http://127.0.0.1:8545";
export const ANVIL_DEPLOYER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;
export const ANVIL_ALICE = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;

export const BLOCK_EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://sepolia.arbiscan.io";

export function getActiveChain() {
  return deployed.chainId === ARBITRUM_SEPOLIA_CHAIN_ID ? arbitrumSepolia : foundry;
}

export function explorerTxUrl(hash: string): string {
  return `${BLOCK_EXPLORER_URL}/tx/${hash}`;
}

export function explorerAddressUrl(address: string): string {
  return `${BLOCK_EXPLORER_URL}/address/${address}`;
}

function addr(envValue: string | undefined, fallback: string): Address {
  const value = envValue?.trim() || fallback;
  return value as Address;
}

export const CHAIN_ADDRESSES = {
  GovOracleBridge: addr(process.env.NEXT_PUBLIC_GOV_ORACLE_BRIDGE, deployed.GovOracleBridge),
  BatchAuctionEngine: addr(process.env.NEXT_PUBLIC_BATCH_AUCTION_ENGINE, deployed.BatchAuctionEngine),
  YieldVault: addr(process.env.NEXT_PUBLIC_YIELD_VAULT, deployed.YieldVault),
  MulkToken: addr(process.env.NEXT_PUBLIC_MULK_TOKEN_ADDRESS, deployed.MulkToken),
  GovOracle: addr(
    process.env.NEXT_PUBLIC_GOV_ORACLE_ADDRESS ?? process.env.NEXT_PUBLIC_GOV_ORACLE,
    deployed.GovOracle,
  ),
  IdentityRegistry: addr(process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS, deployed.IdentityRegistry),
  EnforcementController: addr(
    process.env.NEXT_PUBLIC_ENFORCEMENT_CONTROLLER_ADDRESS ?? process.env.NEXT_PUBLIC_ENFORCEMENT_ADDRESS,
    deployed.EnforcementController,
  ),
} as const;
