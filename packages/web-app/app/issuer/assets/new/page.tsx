"use client";

import { AssetRegistrationForm } from "@/components/issuer/asset-registration-form";
import { PageHeader } from "@/components/layout/page-header";

export default function RegisterAssetPage() {
  return (
    <div>
      <PageHeader
        kicker="Listing"
        title="Register asset"
        description="Cadastral number is validated against the EGKN canonical form before the SPV and NAV are accepted. Duplicate asset IDs are rejected."
      />
      <AssetRegistrationForm />
    </div>
  );
}
