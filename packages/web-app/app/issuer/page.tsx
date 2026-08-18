"use client";

import Link from "next/link";
import { KycRegistryForm } from "@/components/issuer/kyc-registry-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { BAITEREK } from "@/lib/constants";

const tiles = [
  {
    href: "/issuer/assets/new",
    kicker: "Listing",
    title: "Asset registration",
    body: "Cadastral number, SPV, NAV. Opens a Periodic Batch Auction window at NAV ±10%.",
  },
  {
    href: "/issuer/mint",
    kicker: "Issuance",
    title: "Verified mint",
    body: "EGKN pledge check and Gov-Oracle EIP-712 authorization. No mint without a live proof.",
  },
  {
    href: "/issuer/yield",
    kicker: "Income",
    title: "NOI trigger",
    body: "Snapshot holders, withhold 5% SPV reserve and 10% WHT, preview the register.",
  },
  {
    href: "/issuer/enforcement",
    kicker: "Governance",
    title: "3-of-5 board",
    body: "Legal, Compliance, Security, Trustee, Operations. Forced transfer and emergency pause.",
  },
];

export default function IssuerOverviewPage() {
  return (
    <div>
      <PageHeader
        kicker="Issuer & administrator"
        title="Control room"
        description={`${BAITEREK.name} is the working lot. Register identities on IdentityRegistry, then mint only against EGKN via verifiedMint.`}
      />
      <div className="mb-6">
        <KycRegistryForm />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {tiles.map((tile) => (
          <Link key={tile.href} href={tile.href}>
            <Card className="h-full transition-colors hover:border-foreground/20">
              <CardContent className="p-5">
                <p className="label-caps">{tile.kicker}</p>
                <h2 className="mt-2 text-base font-medium">{tile.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{tile.body}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
