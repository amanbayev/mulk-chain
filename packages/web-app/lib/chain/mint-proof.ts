import { encodeAbiParameters, keccak256, toBytes, type Address, type Hex } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { CHAIN_ADDRESSES } from "@/lib/chain/addresses";

export const EGKN_CADASTRE_NUMBER = "KZ-AST-2026-TOWER-01";
export const EGKN_CADASTRE_HASH = keccak256(toBytes(EGKN_CADASTRE_NUMBER));
export const TOKEN_DECIMALS = 18;
export const KZ_COUNTRY_CODE = 398;

export const MINT_AUTHORIZATION_TYPES = {
  MintAuthorization: [
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "cadastreHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export function mintTypedDataDomain() {
  return {
    name: "MulkToken",
    version: "1",
    chainId: arbitrumSepolia.id,
    verifyingContract: CHAIN_ADDRESSES.MulkToken,
  } as const;
}

export function encodeCadastreProof(
  cadastreHash: Hex,
  nonce: bigint,
  deadline: bigint,
  signature: Hex,
): Hex {
  return encodeAbiParameters(
    [
      { type: "bytes32" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "bytes" },
    ],
    [cadastreHash, nonce, deadline, signature],
  );
}

export function nextMintNonce(): bigint {
  return BigInt(Date.now());
}

export function mintDeadline(ttlSeconds = 3600): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + ttlSeconds);
}

export function mintAuthorizationMessage(params: {
  to: Address;
  amount: bigint;
  cadastreHash?: Hex;
  nonce?: bigint;
  deadline?: bigint;
}) {
  return {
    to: params.to,
    amount: params.amount,
    cadastreHash: params.cadastreHash ?? EGKN_CADASTRE_HASH,
    nonce: params.nonce ?? nextMintNonce(),
    deadline: params.deadline ?? mintDeadline(),
  };
}
