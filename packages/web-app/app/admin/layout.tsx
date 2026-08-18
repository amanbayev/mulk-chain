"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList, Landmark, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { AdminGate } from "@/components/admin/admin-gate";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("nav");
  const items = [
    { href: "/admin", label: t("overview"), icon: Landmark },
    { href: "/admin/applications", label: t("queue"), icon: ClipboardList },
    { href: "/admin/investors", label: t("investors"), icon: Users },
  ];
  return (
    <AppShell portal="Admin" items={items}>
      <AdminGate>{children}</AdminGate>
    </AppShell>
  );
}
