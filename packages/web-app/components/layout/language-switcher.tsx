"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LOCALES, type AppLocale } from "@/lib/i18n/config";

const LABELS: Record<AppLocale, string> = { en: "EN", ru: "RU", kk: "KK" };

export function LanguageSwitcher() {
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const t = useTranslations("shell");

  async function setLocale(next: AppLocale): Promise<void> {
    if (next === locale) return;
    await fetch("/api/locale", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ locale: next }) });
    router.refresh();
  }

  return (
    <div className="flex items-center rounded-md border border-border p-0.5" role="group" aria-label={t("language")}>
      {LOCALES.map((item) => (
        <Button
          key={item}
          type="button"
          size="sm"
          variant={item === locale ? "secondary" : "ghost"}
          className="h-7 px-2 text-[11px] tracking-wide"
          onClick={() => void setLocale(item)}
        >
          {LABELS[item]}
        </Button>
      ))}
    </div>
  );
}
