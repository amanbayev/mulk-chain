"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { BrandMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { WalletButton } from "@/components/layout/wallet-button";
import { Badge } from "@/components/ui/badge";
import { BAITEREK } from "@/lib/constants";
import { formatKzt } from "@/lib/money";

export default function HomePage() {
  const t = useTranslations("home");
  const brand = useTranslations("brand");
  const nav = useTranslations("nav");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b border-border px-6">
        <BrandMark />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <WalletButton />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16">
        <p className="label-caps">{t("kicker")}</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-medium tracking-tight">{t("title")}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t("body")}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm">
          <span className="label-caps">{t("liveLot")}</span>
          <span className="font-medium">{BAITEREK.name}</span>
          <span className="tabular text-muted-foreground">NAV {formatKzt(BAITEREK.nav)}</span>
          <Badge variant="success">
            {t("egkn")} {BAITEREK.inspection.status}
          </Badge>
        </div>
        <ol className="mt-8 grid gap-2 sm:grid-cols-4">
          {[t("step1"), t("step2"), t("step3"), t("step4")].map((step, index) => (
            <li key={step} className="rounded-md border border-border px-3 py-2 text-xs">
              <p className="label-caps">{String(index + 1).padStart(2, "0")}</p>
              <p className="mt-1 text-foreground">{step}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <PortalCard href="/investor/onboarding" kicker={nav("investor")} title={t("investorTitle")} body={t("investorBody")} />
          <PortalCard href="/issuer" kicker={nav("issuer")} title={t("issuerTitle")} body={t("issuerBody")} />
          <PortalCard href="/admin" kicker={nav("admin")} title={t("adminTitle")} body={t("adminBody")} />
        </div>
      </main>
      <footer className="border-t border-border px-6 py-4 text-[11px] text-muted-foreground">{brand("restricted")}</footer>
    </div>
  );
}

function PortalCard({
  href,
  kicker,
  title,
  body,
}: {
  href: string;
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-md border border-border bg-card p-6 transition-colors hover:border-foreground/20"
    >
      <p className="label-caps">{kicker}</p>
      <h2 className="mt-3 text-lg font-medium tracking-tight group-hover:text-accent">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </Link>
  );
}
