import { redirect } from "next/navigation";

// The Stripe setup checklist is for admins only; it lives in the admin dashboard.
export default function BankingSetupRedirect() {
  redirect("/dashboard/admin/banking");
}
