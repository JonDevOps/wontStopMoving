"use client";

import { EmployeeLayout } from "@/components/layout/employee-layout";
import { StripeBankingSetup } from "@/components/banking/stripe-banking-setup";

export default function AdminBankingSetupPage() {
  return (
    <EmployeeLayout isAdmin>
      <StripeBankingSetup />
    </EmployeeLayout>
  );
}

