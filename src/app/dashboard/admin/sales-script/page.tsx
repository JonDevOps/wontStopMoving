"use client";

import { EmployeeLayout } from "@/components/layout/employee-layout";
import { SalesScriptTool } from "@/components/sales/sales-script-tool";

export default function AdminSalesScriptPage() {
  return (
    <EmployeeLayout isAdmin>
      <SalesScriptTool />
    </EmployeeLayout>
  );
}

