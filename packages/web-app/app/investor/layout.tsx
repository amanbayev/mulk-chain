"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { BarChart3, Building2, Landmark, ScrollText, UserPlus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";

export default function InvestorLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("nav");
  const items = [
    { href: "/investor", label: t("dashboard"), icon: Landmark },
    { href: "/investor/onboarding", label: t("onboarding"), icon: UserPlus },
    { href: "/investor/assets/BAITEREK-BC", label: t("asset"), icon: Building2 },
    { href: "/investor/trade", label: t("trade"), icon: BarChart3 },
    { href: "/investor/payouts", label: t("payouts"), icon: ScrollText },
  ];
  return <AppShell portal="Investor" items={items}>{children}</AppShell>;
}
