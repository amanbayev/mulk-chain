"use client";

import type { ReactNode } from "react";
import { FilePlus2, Gavel, Landmark, ShieldCheck, Sprout } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";

const items = [
  { href: "/issuer", label: "Overview", icon: Landmark },
  { href: "/issuer/assets/new", label: "Register asset", icon: FilePlus2 },
  { href: "/issuer/mint", label: "Mint console", icon: ShieldCheck },
  { href: "/issuer/yield", label: "Yield trigger", icon: Sprout },
  { href: "/issuer/enforcement", label: "Enforcement", icon: Gavel },
];

export default function IssuerLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell portal="Issuer" items={items}>
      {children}
    </AppShell>
  );
}
