
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OldEmployeeJobsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/employee/jobs");
  }, [router]);

  return null;
}
