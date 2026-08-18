import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const chainId = process.env.CHAIN_ID ?? "421614";
const rpc = process.env.RPC_URL ?? process.env.ARBITRUM_SEPOLIA_RPC_FALLBACK ?? "https://sepolia-rollup.arbitrum.io/rpc";
const broadcastPath = path.join(root, "broadcast", "DeployAll.s.sol", chainId, "run-latest.json");
const fallbackBroadcast = path.join(root, "broadcast", "DeployMulkChain.s.sol", chainId, "run-latest.json");
const addressesPath = path.join(root, "packages/core-backend/src/config/addresses.json");
const webDeployedPath = path.join(root, "packages/web-app/lib/chain/deployed.json");
const envLocalPath = path.join(root, "packages/web-app/.env.local");

function pickBroadcast() {
  if (fs.existsSync(broadcastPath)) return broadcastPath;
  if (fs.existsSync(fallbackBroadcast)) return fallbackBroadcast;
  throw new Error(`broadcast run-latest.json not found for chain ${chainId}`);
}

function createdContracts(run) {
  const byName = {};
  for (const tx of run.transactions ?? []) {
    if (tx.transactionType !== "CREATE" || !tx.contractName || !tx.contractAddress) continue;
    byName[tx.contractName] = tx.contractAddress;
  }
  return byName;
}

const runPath = pickBroadcast();
const run = JSON.parse(fs.readFileSync(runPath, "utf8"));
const created = createdContracts(run);
const addresses = fs.existsSync(addressesPath) ? JSON.parse(fs.readFileSync(addressesPath, "utf8")) : {};

const deployer = addresses.deployer ?? run.receipts?.[0]?.from ?? "";
const alice = addresses.oracleSigner ?? addresses.alice ?? deployer;

const webDeployed = {
  chainId: Number(addresses.chainId ?? chainId),
  rpcUrl: rpc,
  explorerUrl: "https://sepolia.arbiscan.io",
  deployer,
  alice,
  GovOracleBridge: created.GovOracleBridge ?? addresses.GovOracleBridge,
  BatchAuctionEngine: created.BatchAuctionEngine ?? addresses.BatchAuctionEngine,
  YieldVault: created.YieldVault ?? addresses.YieldVault,
  MulkToken: created.MulkToken ?? addresses.MulkToken,
  GovOracle: created.GovOracle ?? addresses.GovOracle,
  IdentityRegistry: created.IdentityRegistry ?? addresses.IdentityRegistry,
  EnforcementController: created.EnforcementController ?? addresses.EnforcementController,
};

fs.mkdirSync(path.dirname(webDeployedPath), { recursive: true });
fs.writeFileSync(webDeployedPath, `${JSON.stringify(webDeployed, null, 2)}\n`);

if (fs.existsSync(envLocalPath)) {
  let env = fs.readFileSync(envLocalPath, "utf8");
  const replacements = {
    NEXT_PUBLIC_MULK_TOKEN_ADDRESS: webDeployed.MulkToken,
    NEXT_PUBLIC_GOV_ORACLE_BRIDGE: webDeployed.GovOracleBridge,
    NEXT_PUBLIC_BATCH_AUCTION_ENGINE: webDeployed.BatchAuctionEngine,
    NEXT_PUBLIC_YIELD_VAULT: webDeployed.YieldVault,
    NEXT_PUBLIC_ENFORCEMENT_ADDRESS: webDeployed.EnforcementController,
  };
  for (const [key, value] of Object.entries(replacements)) {
    if (!value) continue;
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, "m");
    env = re.test(env) ? env.replace(re, line) : `${env.trimEnd()}\n${line}\n`;
  }
  fs.writeFileSync(envLocalPath, env.endsWith("\n") ? env : `${env}\n`);
}

console.log("[sync-web-deployed] source", path.relative(root, runPath));
console.log("[sync-web-deployed] wrote", path.relative(root, webDeployedPath));
console.log(JSON.stringify(webDeployed, null, 2));
