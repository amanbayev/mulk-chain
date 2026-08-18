import { createPublicClient, createWalletClient, http, type Address, type Hex, type JsonRpcAccount } from "viem";
import {
  ANVIL_DEPLOYER,
  TARGET_CHAIN_ID,
  getActiveChain,
} from "@/lib/chain/addresses";

const ZERO_CODE = "0x";
const RPC_TIMEOUT_MS = TARGET_CHAIN_ID === 421614 ? 12_000 : 4_000;

function browserRpcUrl(): string {
  return "/api/rpc";
}

function nodeRpcUrl(): string {
  return (
    process.env.ARBITRUM_SEPOLIA_RPC_FALLBACK ??
    process.env.ANVIL_RPC_URL ??
    "https://sepolia-rollup.arbitrum.io/rpc"
  );
}

export function anvilRpcUrl(): string {
  if (typeof window === "undefined") return nodeRpcUrl();
  return browserRpcUrl();
}

export const demoAccount: JsonRpcAccount = {
  address: ANVIL_DEPLOYER,
  type: "json-rpc",
};

export function getPublicClient() {
  return createPublicClient({
    chain: getActiveChain(),
    transport: http(anvilRpcUrl(), { timeout: RPC_TIMEOUT_MS, retryCount: 1 }),
  });
}

export function getDemoWalletClient() {
  return createWalletClient({
    account: demoAccount,
    chain: getActiveChain(),
    transport: http(anvilRpcUrl(), { timeout: RPC_TIMEOUT_MS * 2, retryCount: 1 }),
  });
}

export async function probeAnvil(): Promise<boolean> {
  try {
    const chainId = await getPublicClient().getChainId();
    return chainId === TARGET_CHAIN_ID;
  } catch {
    return false;
  }
}

export async function isContractDeployed(address: Address): Promise<boolean> {
  try {
    const code = await getPublicClient().getCode({ address });
    return Boolean(code && code !== ZERO_CODE);
  } catch {
    return false;
  }
}

export async function getAnvilContext(address: Address): Promise<boolean> {
  if (!(await probeAnvil())) return false;
  return isContractDeployed(address);
}

export function randomTxHash(): Hex {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}` as Hex;
}

export function sha256ToBytes32(sha256Hex: string): Hex {
  const clean = sha256Hex.replace(/^0x/i, "").toLowerCase();
  return `0x${clean.padStart(64, "0")}` as Hex;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
