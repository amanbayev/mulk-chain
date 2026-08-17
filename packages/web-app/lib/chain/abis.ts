export const govOracleBridgeAbi = [
  {
    type: "function",
    name: "getDocumentHash",
    stateMutability: "view",
    inputs: [{ name: "docId", type: "string" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "updateCadastreStatus",
    stateMutability: "nonpayable",
    inputs: [
      { name: "cadastreId", type: "string" },
      { name: "status", type: "uint8" },
      { name: "hash", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

export const batchAuctionEngineAbi = [
  {
    type: "function",
    name: "settleEpoch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "epochId", type: "uint256" },
      { name: "equilibriumPrice", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getEpoch",
    stateMutability: "view",
    inputs: [{ name: "epochId", type: "uint256" }],
    outputs: [
      { name: "settled", type: "bool" },
      { name: "equilibriumPrice", type: "uint256" },
      { name: "aliceTokens", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "aliceBalance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const yieldVaultAbi = [
  {
    type: "function",
    name: "claimDividends",
    stateMutability: "nonpayable",
    inputs: [{ name: "assetId", type: "string" }],
    outputs: [],
  },
  {
    type: "function",
    name: "claimableOf",
    stateMutability: "view",
    inputs: [{ name: "assetId", type: "string" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "aliceWalletUsdt",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
