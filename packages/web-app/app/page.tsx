"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-12 items-center justify-between border-b border-border px-6">
        <BrandMark />
        <ThemeToggle />
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16">
        <p className="label-caps">AIFC · EGKN · ERC-3643</p>
        <h1 className="mt-3 max-w-xl text-4xl font-medium tracking-tight">
          Institutional market infrastructure for tokenized commercial real estate.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Demo path: Investor onboarding → Issuer KYC / verifiedMint → ERC-3643 transfer. Issuance is gated by a live
          EGKN cadastre proof and OnchainID.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <PortalCard
            href="/investor/onboarding"
            kicker="Investor"
            title="Onboarding, KYC, MULK transfer"
            body="Connect MetaMask, file KYC/KYB, then sell via MulkToken.transfer after the issuer verifies OnchainID."
          />
          <PortalCard
            href="/issuer"
            kicker="Issuer & administrator"
            title="Verify identity, verifiedMint"
            body="Pending KYC queue → IdentityRegistry.registerIdentity, then fill primary subscriptions with verifiedMint."
          />
        </div>
      </main>
      <footer className="border-t border-border px-6 py-4 text-[11px] text-muted-foreground">
        Restricted access. Not an offer of securities. AIFC jurisdiction.
      </footer>
    </div>
  );
}

function PortalCard({
  href,
  kicker,
  title,
  body,
}: {
  href: string;
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-md border border-border bg-card p-6 transition-colors hover:border-foreground/20"
    >
      <p className="label-caps">{kicker}</p>
      <h2 className="mt-3 text-lg font-medium tracking-tight group-hover:text-accent">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </Link>
  );
}
