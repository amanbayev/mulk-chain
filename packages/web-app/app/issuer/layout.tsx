"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { FilePlus2, Gavel, Landmark, ShieldCheck, Sprout } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";

export default function IssuerLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("nav");
  const items = [
    { href: "/issuer", label: t("overview"), icon: Landmark },
    { href: "/issuer/assets/new", label: t("registerAsset"), icon: FilePlus2 },
    { href: "/issuer/mint", label: t("mint"), icon: ShieldCheck },
    { href: "/issuer/yield", label: t("yield"), icon: Sprout },
    { href: "/issuer/enforcement", label: t("enforcement"), icon: Gavel },
  ];
  return <AppShell portal="Issuer" items={items}>{children}</AppShell>;
}
