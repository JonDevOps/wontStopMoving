
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EmployeeRootRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/employee");
  }, [router]);

  return null;
}
