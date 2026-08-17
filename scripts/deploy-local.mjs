import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const rpc = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const pk =
  process.env.ANVIL_PRIVATE_KEY ??
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const addressesPath = path.join(root, "packages/core-backend/src/config/addresses.json");
const contractsPath = path.join(root, "packages/core-backend/src/config/contracts.json");
const outDir = path.join(root, "packages/contracts/out");

function readAbi(contractFile, contractName) {
  const file = path.join(outDir, contractFile, `${contractName}.json`);
  if (!fs.existsSync(file)) return [];
  const artifact = JSON.parse(fs.readFileSync(file, "utf8"));
  return artifact.abi ?? [];
}

console.log(`[deploy:local] RPC ${rpc}`);
const built = spawnSync("forge", ["build"], { cwd: root, stdio: "inherit", shell: true });
if (built.status !== 0) {
  console.error("[deploy:local] forge build failed. Install Foundry and run npm run bootstrap.");
  process.exit(built.status ?? 1);
}

const deployed = spawnSync(
  "forge",
  [
    "script",
    "packages/contracts/script/DeployMulkChain.s.sol:DeployMulkChain",
    "--rpc-url",
    rpc,
    "--broadcast",
    "--private-key",
    pk,
    "-vvv",
  ],
  { cwd: root, stdio: "inherit", shell: true },
);
if (deployed.status !== 0) {
  console.error("[deploy:local] forge script failed. Is Anvil running on", rpc, "?");
  process.exit(deployed.status ?? 1);
}

if (!fs.existsSync(addressesPath)) {
  console.error("[deploy:local] addresses.json was not written");
  process.exit(1);
}

const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
const contracts = {
  network: addresses.network ?? "anvil",
  chainId: addresses.chainId ?? 31337,
  rpcUrl: rpc,
  cadastreNumber: addresses.cadastreNumber,
  cadastreHash: addresses.cadastreHash,
  deployer: addresses.deployer,
  oracleSigner: addresses.oracleSigner,
  enforcement: addresses.enforcement,
  contracts: {
    IdentityRegistry: {
      address: addresses.IdentityRegistry,
      abi: readAbi("IdentityRegistry.sol", "IdentityRegistry"),
    },
    GovOracle: {
      address: addresses.GovOracle,
      abi: readAbi("GovOracle.sol", "GovOracle"),
    },
    MulkToken: {
      address: addresses.MulkToken,
      abi: readAbi("MulkToken.sol", "MulkToken"),
    },
    EnforcementController: {
      address: addresses.EnforcementController,
      abi: readAbi("EnforcementController.sol", "EnforcementController"),
    },
  },
};

fs.mkdirSync(path.dirname(contractsPath), { recursive: true });
fs.writeFileSync(contractsPath, `${JSON.stringify(contracts, null, 2)}\n`);
console.log("[deploy:local] wrote", path.relative(root, contractsPath));
console.log("[deploy:local] MulkToken", contracts.contracts.MulkToken.address);
console.log("[deploy:local] cadastre", contracts.cadastreNumber);
