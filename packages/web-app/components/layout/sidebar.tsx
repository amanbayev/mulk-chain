"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { PortalId } from "@/components/layout/portal-switcher";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export function Sidebar({
  title,
  items,
}: {
  title: PortalId;
  items: NavItem[];
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const titleKey = title === "Investor" ? "investor" : title === "Issuer" ? "issuer" : "admin";
  return (
    <aside className="hidden w-56 shrink-0 border-r border-border bg-card md:flex md:flex-col">
      <div className="px-5 py-5">
        <p className="label-caps">{t(titleKey)}</p>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/investor" && item.href !== "/issuer" && item.href !== "/admin" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border px-5 py-4 text-[11px] leading-relaxed text-muted-foreground">
        AIFC · ERC-3643
        <br />
        EGKN Smart Bridge
      </div>
    </aside>
  );
}
