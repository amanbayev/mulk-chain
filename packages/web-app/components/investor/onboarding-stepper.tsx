"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "wallet", label: "Wallet connected" },
  { id: "profile", label: "Profile filed" },
  { id: "pending", label: "KYC pending" },
  { id: "verified", label: "OnchainID verified" },
  { id: "trade", label: "Trade unlocked" },
] as const;

export function OnboardingStepper({
  connected,
  hasProfile,
  onchainVerified,
}: {
  connected: boolean;
  hasProfile: boolean;
  onchainVerified: boolean;
}) {
  const current = !connected
    ? 0
    : !hasProfile
      ? 1
      : !onchainVerified
        ? 2
        : 4;

  return (
    <ol className="grid gap-2 sm:grid-cols-5">
      {STEPS.map((step, index) => {
        const done =
          (step.id === "wallet" && connected) ||
          (step.id === "profile" && hasProfile) ||
          (step.id === "pending" && hasProfile && !onchainVerified) ||
          (step.id === "verified" && onchainVerified) ||
          (step.id === "trade" && onchainVerified);
        const active = index === current || (onchainVerified && step.id === "trade");
        return (
          <li
            key={step.id}
            className={cn(
              "rounded-md border px-3 py-2 text-xs",
              done || active ? "border-cyan-500/40 bg-cyan-500/5 text-foreground" : "border-border text-muted-foreground",
            )}
          >
            <p className="label-caps">{String(index + 1).padStart(2, "0")}</p>
            <p className="mt-1 font-medium">{step.label}</p>
          </li>
        );
      })}
      {!onchainVerified ? (
        <li className="sm:col-span-5">
          <Link href="/investor/onboarding" className="text-xs text-cyan-400 hover:underline">
            Continue onboarding
          </Link>
        </li>
      ) : null}
    </ol>
  );
}
