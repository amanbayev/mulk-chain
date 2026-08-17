import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface DeployedContractArtifact {
  address: string;
  abi: unknown[];
}

export interface ContractsConfig {
  network: string;
  chainId: number;
  rpcUrl: string;
  cadastreNumber: string;
  cadastreHash: string;
  deployer: string;
  oracleSigner: string;
  enforcement: {
    legal: string;
    compliance: string;
    security: string;
    trustee: string;
    operations: string;
  };
  contracts: {
    IdentityRegistry: DeployedContractArtifact;
    GovOracle: DeployedContractArtifact;
    MulkToken: DeployedContractArtifact;
    EnforcementController: DeployedContractArtifact;
  };
}

export function loadContractsConfig(): ContractsConfig {
  const file = join(dirname(fileURLToPath(import.meta.url)), "contracts.json");
  return JSON.parse(readFileSync(file, "utf8")) as ContractsConfig;
}
