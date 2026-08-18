"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type PortalId = "Investor" | "Issuer" | "Admin";

const PORTALS: { id: PortalId; href: string; key: "investor" | "issuer" | "admin" }[] = [
  { id: "Investor", href: "/investor", key: "investor" },
  { id: "Issuer", href: "/issuer", key: "issuer" },
  { id: "Admin", href: "/admin", key: "admin" },
];

export function PortalSwitcher({ current }: { current: PortalId }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const active = PORTALS.find((portal) => portal.id === current) ?? PORTALS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="hidden h-8 px-2 text-[11px] tracking-[0.14em] sm:inline-flex">
          {t("console", { portal: t(active.key).toUpperCase() })}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {PORTALS.map((portal) => (
          <DropdownMenuItem key={portal.id} asChild>
            <Link href={pathname.startsWith(portal.href) ? pathname : portal.href}>{t(portal.key)}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
