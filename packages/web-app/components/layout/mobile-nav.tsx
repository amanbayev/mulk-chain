"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/components/layout/sidebar";

export function MobileBottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const t = useTranslations("shell");
  const primary = items.slice(0, 4);

  return (
    <nav
      aria-label={t("navAria")}
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {primary.map((item) => {
        const active =
          pathname === item.href || (item.href !== "/investor" && item.href !== "/issuer" && item.href !== "/admin" && pathname.startsWith(item.href));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px]",
              active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
