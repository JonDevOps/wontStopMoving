
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardRootRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Standard landing page for authenticated users who hit /dashboard directly.
    // They should be sent to login which will resolve their role.
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
