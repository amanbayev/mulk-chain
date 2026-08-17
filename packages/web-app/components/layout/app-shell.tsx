"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { WalletButton } from "@/components/layout/wallet-button";
import { Sidebar, type NavItem } from "@/components/layout/sidebar";

export function AppShell({
  portal,
  items,
  children,
}: {
  portal: "Investor" | "Issuer";
  items: NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-12 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="hover:opacity-80">
            <BrandMark />
          </Link>
          <span className="hidden text-[11px] tracking-[0.16em] text-muted-foreground sm:inline">
            {portal.toUpperCase()} CONSOLE
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={portal === "Investor" ? "/issuer" : "/investor"}
            className="hidden text-xs text-muted-foreground hover:text-foreground sm:inline"
          >
            {portal === "Investor" ? "Issuer" : "Investor"}
          </Link>
          <ThemeToggle />
          <WalletButton />
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <Sidebar title={portal} items={items} />
        <main className="min-w-0 flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
