"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { WalletButton } from "@/components/layout/wallet-button";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { MarketTicker } from "@/components/layout/market-ticker";
import { MobileBottomNav } from "@/components/layout/mobile-nav";
import { PortalSwitcher, type PortalId } from "@/components/layout/portal-switcher";
import { Sidebar, type NavItem } from "@/components/layout/sidebar";

export function AppShell({
  portal,
  items,
  children,
}: {
  portal: PortalId;
  items: NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-card px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="hover:opacity-80">
            <BrandMark />
          </Link>
          <PortalSwitcher current={portal} />
          <MarketTicker />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <WalletButton />
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <Sidebar title={portal} items={items} />
        <main className="min-w-0 flex-1 overflow-auto pb-16 md:pb-0">
          <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>
        </main>
      </div>
      <MobileBottomNav items={items} />
    </div>
  );
}
