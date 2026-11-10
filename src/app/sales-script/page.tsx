import { redirect } from "next/navigation";

/** The call playbook is internal; staff use it from their dashboard. */
export default function SalesScriptRedirect() {
  redirect("/dashboard/employee/sales-script");
}
