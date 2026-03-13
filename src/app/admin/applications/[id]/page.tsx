
"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";

export default function OldApplicationRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/dashboard/admin/applications/${id}`);
  }, [router, id]);

  return null;
}
