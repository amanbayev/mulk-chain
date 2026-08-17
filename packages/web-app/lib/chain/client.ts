import { createPublicClient, createWalletClient, http, type Address, type Hex, type JsonRpcAccount } from "viem";
import { foundry } from "viem/chains";
import { ANVIL_CHAIN_ID, ANVIL_DEPLOYER, ANVIL_RPC_DIRECT } from "@/lib/chain/addresses";

const ZERO_CODE = "0x";

function browserRpcUrl(): string {
  return "/api/rpc";
}

function nodeRpcUrl(): string {
  return process.env.ANVIL_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? ANVIL_RPC_DIRECT;
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
    chain: foundry,
    transport: http(anvilRpcUrl(), { timeout: 4_000, retryCount: 0 }),
  });
}

export function getDemoWalletClient() {
  return createWalletClient({
    account: demoAccount,
    chain: foundry,
    transport: http(anvilRpcUrl(), { timeout: 8_000, retryCount: 0 }),
  });
}

export async function probeAnvil(): Promise<boolean> {
  try {
    const chainId = await getPublicClient().getChainId();
    return chainId === ANVIL_CHAIN_ID;
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
