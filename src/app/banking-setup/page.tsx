"use client";

import { PublicLayout } from "@/components/layout/public-layout";
import { StripeBankingSetup } from "@/components/banking/stripe-banking-setup";

export default function DirectBankingSetupPage() {
  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50 pt-28 pb-20 px-4">
        <StripeBankingSetup />
      </div>
    </PublicLayout>
  );
}

