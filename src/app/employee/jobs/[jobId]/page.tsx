
"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";

export default function OldJobDetailRedirect({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/dashboard/employee/jobs/${jobId}`);
  }, [router, jobId]);

  return null;
}
