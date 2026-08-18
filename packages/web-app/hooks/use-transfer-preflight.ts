"use client";

import { isAddress, parseUnits, zeroAddress, type Address } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { CHAIN_ADDRESSES } from "@/lib/chain/addresses";
import { TOKEN_DECIMALS } from "@/lib/chain/mint-proof";
import { identityRegistryAbi, mulkTokenAbi } from "@/lib/contracts/abis";
import { formatTokenUnits } from "@/lib/money";

export function useTransferPreflight(to?: string, amount?: string) {
  const { address: from } = useAccount();
  const recipient = to && isAddress(to) ? (to as Address) : undefined;
  let parsed = 0n;
  let amountValid = false;
  try {
    if (amount?.trim()) {
      parsed = parseUnits(amount.trim(), TOKEN_DECIMALS);
      amountValid = parsed > 0n;
    }
  } catch {
    amountValid = false;
  }

  const enabledFrom = Boolean(from);
  const enabledTo = Boolean(recipient);
  const enabledFull = Boolean(from && recipient && amountValid);

  const fromVerified = useReadContract({
    address: CHAIN_ADDRESSES.IdentityRegistry,
    abi: identityRegistryAbi,
    functionName: "isVerified",
    args: [from ?? zeroAddress],
    query: { enabled: enabledFrom },
  });
  const toVerified = useReadContract({
    address: CHAIN_ADDRESSES.IdentityRegistry,
    abi: identityRegistryAbi,
    functionName: "isVerified",
    args: [recipient ?? zeroAddress],
    query: { enabled: enabledTo },
  });
  const frozen = useReadContract({
    address: CHAIN_ADDRESSES.MulkToken,
    abi: mulkTokenAbi,
    functionName: "frozen",
    args: [from ?? zeroAddress],
    query: { enabled: enabledFrom },
  });
  const toFrozen = useReadContract({
    address: CHAIN_ADDRESSES.MulkToken,
    abi: mulkTokenAbi,
    functionName: "frozen",
    args: [recipient ?? zeroAddress],
    query: { enabled: enabledTo },
  });
  const available = useReadContract({
    address: CHAIN_ADDRESSES.MulkToken,
    abi: mulkTokenAbi,
    functionName: "availableBalance",
    args: [from ?? zeroAddress],
    query: { enabled: enabledFrom },
  });
  const valid = useReadContract({
    address: CHAIN_ADDRESSES.MulkToken,
    abi: mulkTokenAbi,
    functionName: "validateTransfer",
    args: [from ?? zeroAddress, recipient ?? zeroAddress, parsed],
    query: { enabled: enabledFull },
  });

  const reasons: string[] = [];
  if (from && fromVerified.data === false) reasons.push("Sender is not IdentityRegistry.isVerified");
  if (recipient && toVerified.data === false) reasons.push("Recipient is not IdentityRegistry.isVerified");
  if (frozen.data === true) reasons.push("Sender address is frozen");
  if (toFrozen.data === true) reasons.push("Recipient address is frozen");
  if (amountValid && available.data !== undefined && available.data < parsed) {
    reasons.push(`Insufficient available balance (${formatTokenUnits(available.data)} MULK)`);
  }
  if (enabledFull && valid.data === false && reasons.length === 0) {
    reasons.push("validateTransfer returned false (pause, freeze, KYC, or available balance)");
  }

  const blocked = reasons.length > 0 || (enabledFull && valid.data === false);
  const ready = enabledFull && valid.data === true && reasons.length === 0;

  return {
    from,
    to: recipient,
    amount: parsed,
    amountValid,
    fromVerified: fromVerified.data ?? false,
    toVerified: toVerified.data ?? false,
    frozen: frozen.data ?? false,
    available: available.data ?? 0n,
    valid: valid.data ?? false,
    blocked,
    ready,
    reasons,
    isLoading:
      enabledFull &&
      (valid.isLoading || fromVerified.isLoading || toVerified.isLoading || frozen.isLoading || toFrozen.isLoading),
  };
}
