
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, useFirestore } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function DashboardRootRedirect() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    if (isUserLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    // Role Resolver for direct /dashboard access
    const resolveRole = async () => {
      try {
        const userDoc = await getDoc(doc(firestore, "users", user.uid));
        if (userDoc.exists()) {
          const role = userDoc.data().role;
          if (role === 'admin') router.replace('/dashboard/admin');
          else if (role === 'employee') router.replace('/dashboard/employee');
          else router.replace('/dashboard/customer');
        } else {
          router.replace("/login");
        }
      } catch (error) {
        console.error("Role resolution error:", error);
        router.replace("/login");
      }
    };

    resolveRole();
  }, [user, isUserLoading, router, firestore]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-pulse font-black text-primary uppercase tracking-tighter">
        Resolving Dashboard...
      </div>
    </div>
  );
}
