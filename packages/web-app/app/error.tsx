"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("error");
  return (
    <div className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-start justify-center px-6 py-16">
      <p className="label-caps">Error</p>
      <h1 className="mt-2 text-2xl font-medium tracking-tight">{t("title")}</h1>
      <Button type="button" className="mt-6" onClick={() => reset()}>
        {t("retry")}
      </Button>
    </div>
  );
}
