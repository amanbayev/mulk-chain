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
          Mülk Chain settles Periodic Batch Auction lots against KZT DvP T+0, with issuance gated by a live EGKN
          cadastre proof and OnchainID KYC.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <PortalCard
            href="/investor"
            kicker="Investor"
            title="Portfolio, auction ticket, rental yield"
            body="NAV, KYC Green badge, limit orders inside the ±10% collar, and NOI waterfall history."
          />
          <PortalCard
            href="/issuer"
            kicker="Issuer & administrator"
            title="Listing, verified mint, enforcement"
            body="Cadastral registration, Gov-Oracle mint console, NOI trigger, and 3-of-5 multi-sig board."
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
