"use client";

import { explorerTxUrl } from "@/lib/chain/addresses";
import { shortHash } from "@/lib/utils";

export function TxStatus({
  isSigning,
  isPending,
  isConfirming,
  isSuccess,
  hash,
  blockNumber,
}: {
  isSigning?: boolean;
  isPending: boolean;
  isConfirming: boolean;
  isSuccess: boolean;
  hash?: `0x${string}`;
  blockNumber?: bigint;
}) {
  if (!isSigning && !isPending && !isConfirming && !isSuccess) return null;

  let label = "";
  if (isSigning) label = "Sign the EIP-712 authorization in MetaMask…";
  else if (isPending) label = "Sending to Arbitrum Sepolia…";
  else if (isConfirming) label = "Sending to Arbitrum Sepolia…";
  else if (isSuccess && blockNumber !== undefined) label = `Confirmed in block #${blockNumber.toString()}`;
  else if (isSuccess) label = "Confirmed on Arbitrum Sepolia";

  return (
    <div className="rounded-md border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-100">
      <p>{label}</p>
      {hash ? (
        <a
          href={explorerTxUrl(hash)}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block font-mono text-cyan-400 hover:underline"
        >
          {shortHash(hash, 8)}
        </a>
      ) : null}
    </div>
  );
}
