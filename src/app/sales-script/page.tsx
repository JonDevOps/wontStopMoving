"use client";

import { PublicLayout } from "@/components/layout/public-layout";
import { SalesScriptTool } from "@/components/sales/sales-script-tool";

export default function DirectSalesScriptPage() {
  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50 pt-28 pb-20 px-4">
        <SalesScriptTool />
      </div>
    </PublicLayout>
  );
}

