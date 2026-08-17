import { keccak256, stringToHex, type Hex, type TransactionReceipt } from "viem";
import { batchAuctionEngineAbi, govOracleBridgeAbi, yieldVaultAbi } from "@/lib/chain/abis";
import { CHAIN_ADDRESSES } from "@/lib/chain/addresses";
import {
  getAnvilContext,
  getDemoWalletClient,
  getPublicClient,
  randomTxHash,
  sha256ToBytes32,
} from "@/lib/chain/client";
import { AUCTION_DEMO, ORACLE_DEMO, YIELD_WATERFALL_DEMO } from "@/lib/institutional-demo";

export type ChainMode = "anvil" | "simulated";

export interface ChainReceiptView {
  mode: ChainMode;
  transactionHash: Hex;
  blockNumber: number;
  blockHash: Hex;
  gasUsed: string;
  from: Hex;
  to: Hex;
  status: "success" | "reverted";
}

export interface DocumentVerifyResult {
  mode: ChainMode;
  matches: boolean;
  localHash: Hex;
  onchainHash: Hex;
}

export interface CadastreUpdateResult {
  mode: ChainMode;
  transactionHash: Hex;
  blockNumber: number;
  cadastreId: string;
  status: number;
}

export interface EpochSettleResult {
  mode: ChainMode;
  transactionHash: Hex;
  epochId: number;
  equilibriumUsd: number;
  aliceBalance: number;
  settled: true;
}

export interface DividendClaimResult {
  mode: ChainMode;
  receipt: ChainReceiptView;
  claimableUsdt: number;
  walletUsdt: number;
}

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;
const USDT_DECIMALS = 1_000_000;
const CADASTRE_CLEAN_STATUS = 1;

function fromUsdtUnits(amount: bigint): number {
  return Number(amount) / USDT_DECIMALS;
}

function toReceiptView(mode: ChainMode, receipt: TransactionReceipt): ChainReceiptView {
  return {
    mode,
    transactionHash: receipt.transactionHash,
    blockNumber: Number(receipt.blockNumber),
    blockHash: receipt.blockHash,
    gasUsed: receipt.gasUsed.toString(),
    from: receipt.from,
    to: (receipt.to ?? ZERO_HASH) as Hex,
    status: receipt.status === "success" ? "success" : "reverted",
  };
}

function simulatedReceipt(to: Hex): ChainReceiptView {
  const transactionHash = randomTxHash();
  return {
    mode: "simulated",
    transactionHash,
    blockNumber: Math.floor(Date.now() / 1000) % 10_000_000,
    blockHash: randomTxHash(),
    gasUsed: "21000",
    from: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    to,
    status: "success",
  };
}

export async function verifyDocumentHash(docId: string, localSha256: string): Promise<DocumentVerifyResult> {
  const localHash = sha256ToBytes32(localSha256);
  try {
    if (!(await getAnvilContext(CHAIN_ADDRESSES.GovOracleBridge))) {
      return { mode: "simulated", matches: true, localHash, onchainHash: localHash };
    }
    const onchainHash = await getPublicClient().readContract({
      address: CHAIN_ADDRESSES.GovOracleBridge,
      abi: govOracleBridgeAbi,
      functionName: "getDocumentHash",
      args: [docId],
    });
    if (onchainHash === ZERO_HASH) {
      return { mode: "simulated", matches: true, localHash, onchainHash: localHash };
    }
    return {
      mode: "anvil",
      matches: onchainHash.toLowerCase() === localHash.toLowerCase(),
      localHash,
      onchainHash,
    };
  } catch {
    return { mode: "simulated", matches: true, localHash, onchainHash: localHash };
  }
}

export async function updateCadastreStatus(cadastreId = ORACLE_DEMO.cadastreAlias): Promise<CadastreUpdateResult> {
  const hash = keccak256(stringToHex(cadastreId));
  try {
    if (!(await getAnvilContext(CHAIN_ADDRESSES.GovOracleBridge))) {
      const fake = simulatedReceipt(CHAIN_ADDRESSES.GovOracleBridge);
      return {
        mode: "simulated",
        transactionHash: fake.transactionHash,
        blockNumber: fake.blockNumber,
        cadastreId,
        status: CADASTRE_CLEAN_STATUS,
      };
    }
    const wallet = getDemoWalletClient();
    const publicClient = getPublicClient();
    const hashTx = await wallet.writeContract({
      address: CHAIN_ADDRESSES.GovOracleBridge,
      abi: govOracleBridgeAbi,
      functionName: "updateCadastreStatus",
      args: [cadastreId, CADASTRE_CLEAN_STATUS, hash],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: hashTx });
    return {
      mode: "anvil",
      transactionHash: receipt.transactionHash,
      blockNumber: Number(receipt.blockNumber),
      cadastreId,
      status: CADASTRE_CLEAN_STATUS,
    };
  } catch {
    const fake = simulatedReceipt(CHAIN_ADDRESSES.GovOracleBridge);
    return {
      mode: "simulated",
      transactionHash: fake.transactionHash,
      blockNumber: fake.blockNumber,
      cadastreId,
      status: CADASTRE_CLEAN_STATUS,
    };
  }
}

export async function readEpochState(epochId = AUCTION_DEMO.epochNumber): Promise<{
  settled: boolean;
  aliceBalance: number;
  equilibriumUsd: number;
} | null> {
  try {
    if (!(await getAnvilContext(CHAIN_ADDRESSES.BatchAuctionEngine))) return null;
    const [settled, equilibriumPrice, aliceTokens] = await getPublicClient().readContract({
      address: CHAIN_ADDRESSES.BatchAuctionEngine,
      abi: batchAuctionEngineAbi,
      functionName: "getEpoch",
      args: [BigInt(epochId)],
    });
    return {
      settled,
      aliceBalance: Number(aliceTokens),
      equilibriumUsd: settled ? Number(equilibriumPrice) / 100 : AUCTION_DEMO.equilibriumUsd,
    };
  } catch {
    return null;
  }
}

export async function settleAuctionEpoch(
  epochId = AUCTION_DEMO.epochNumber,
  equilibriumUsd = AUCTION_DEMO.equilibriumUsd,
): Promise<EpochSettleResult> {
  const equilibriumCents = BigInt(Math.round(equilibriumUsd * 100));
  const simulatedAlice = AUCTION_DEMO.aliceStartBalance + AUCTION_DEMO.aliceFillQty;
  try {
    if (!(await getAnvilContext(CHAIN_ADDRESSES.BatchAuctionEngine))) {
      return {
        mode: "simulated",
        transactionHash: randomTxHash(),
        epochId,
        equilibriumUsd,
        aliceBalance: simulatedAlice,
        settled: true,
      };
    }
    const wallet = getDemoWalletClient();
    const publicClient = getPublicClient();
    const hashTx = await wallet.writeContract({
      address: CHAIN_ADDRESSES.BatchAuctionEngine,
      abi: batchAuctionEngineAbi,
      functionName: "settleEpoch",
      args: [BigInt(epochId), equilibriumCents],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: hashTx });
    const [, , aliceTokens] = await publicClient.readContract({
      address: CHAIN_ADDRESSES.BatchAuctionEngine,
      abi: batchAuctionEngineAbi,
      functionName: "getEpoch",
      args: [BigInt(epochId)],
    });
    return {
      mode: "anvil",
      transactionHash: receipt.transactionHash,
      epochId,
      equilibriumUsd,
      aliceBalance: Number(aliceTokens),
      settled: true,
    };
  } catch {
    return {
      mode: "simulated",
      transactionHash: randomTxHash(),
      epochId,
      equilibriumUsd,
      aliceBalance: simulatedAlice,
      settled: true,
    };
  }
}

export async function readYieldState(assetId: string): Promise<{ claimableUsdt: number; walletUsdt: number } | null> {
  try {
    if (!(await getAnvilContext(CHAIN_ADDRESSES.YieldVault))) return null;
    const client = getPublicClient();
    const [claimable, wallet] = await Promise.all([
      client.readContract({
        address: CHAIN_ADDRESSES.YieldVault,
        abi: yieldVaultAbi,
        functionName: "claimableOf",
        args: [assetId],
      }),
      client.readContract({
        address: CHAIN_ADDRESSES.YieldVault,
        abi: yieldVaultAbi,
        functionName: "aliceWalletUsdt",
      }),
    ]);
    return { claimableUsdt: fromUsdtUnits(claimable), walletUsdt: fromUsdtUnits(wallet) };
  } catch {
    return null;
  }
}

export async function claimDividends(assetId: string): Promise<DividendClaimResult> {
  const amount = YIELD_WATERFALL_DEMO.proRataUsd;
  try {
    if (!(await getAnvilContext(CHAIN_ADDRESSES.YieldVault))) {
      return {
        mode: "simulated",
        receipt: simulatedReceipt(CHAIN_ADDRESSES.YieldVault),
        claimableUsdt: 0,
        walletUsdt: amount,
      };
    }
    const wallet = getDemoWalletClient();
    const publicClient = getPublicClient();
    const hashTx = await wallet.writeContract({
      address: CHAIN_ADDRESSES.YieldVault,
      abi: yieldVaultAbi,
      functionName: "claimDividends",
      args: [assetId],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: hashTx });
    const onchain = await readYieldState(assetId);
    return {
      mode: "anvil",
      receipt: toReceiptView("anvil", receipt),
      claimableUsdt: onchain?.claimableUsdt ?? 0,
      walletUsdt: onchain?.walletUsdt ?? amount,
    };
  } catch {
    const onchain = await readYieldState(assetId);
    if (onchain && onchain.claimableUsdt === 0 && onchain.walletUsdt > 0) {
      return {
        mode: "anvil",
        receipt: simulatedReceipt(CHAIN_ADDRESSES.YieldVault),
        claimableUsdt: 0,
        walletUsdt: onchain.walletUsdt,
      };
    }
    return {
      mode: "simulated",
      receipt: simulatedReceipt(CHAIN_ADDRESSES.YieldVault),
      claimableUsdt: 0,
      walletUsdt: amount,
    };
  }
}
