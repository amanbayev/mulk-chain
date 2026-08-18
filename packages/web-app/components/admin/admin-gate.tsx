"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useAccount } from "wagmi";
import { WalletButton } from "@/components/layout/wallet-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminSession } from "@/hooks/use-admin";

export function AdminGate({ children }: { children: ReactNode }) {
  const t = useTranslations("admin");
  const { isConnected } = useAccount();
  const session = useAdminSession();

  if (!isConnected) {
    return (
      <div className="rounded-md border border-border bg-card p-6">
        <p className="label-caps">{t("gateTitle")}</p>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t("gateBody")}</p>
        <div className="mt-4">
          <WalletButton />
        </div>
      </div>
    );
  }

  if (session.isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (!session.data?.authorized) {
    return (
      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-6">
        <p className="text-sm text-amber-200">{t("forbidden")}</p>
      </div>
    );
  }

  return <>{children}</>;
}
