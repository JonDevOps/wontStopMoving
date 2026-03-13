
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardRootRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Phase 1: Simple redirect to login. 
    // Phase 2: This will become the role-based router after session check.
    router.replace("/login");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-pulse font-black text-primary uppercase tracking-tighter">
        Verifying Session...
      </div>
    </div>
  );
}
