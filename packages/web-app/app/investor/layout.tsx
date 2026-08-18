"use client";

import type { ReactNode } from "react";
import { BarChart3, Building2, Landmark, ScrollText, UserPlus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";

const items = [
  { href: "/investor", label: "Dashboard", icon: Landmark },
  { href: "/investor/onboarding", label: "Onboarding", icon: UserPlus },
  { href: "/investor/assets/BAITEREK-BC", label: "Baiterek BC", icon: Building2 },
  { href: "/investor/trade", label: "Order terminal", icon: BarChart3 },
  { href: "/investor/payouts", label: "Payout history", icon: ScrollText },
];

export default function InvestorLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell portal="Investor" items={items}>
      {children}
    </AppShell>
  );
}
