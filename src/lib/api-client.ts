import type { Auth } from "firebase/auth";

/** POST/GET to our API with the signed-in user's Firebase ID token attached. */
export async function apiFetch<T = any>(
  auth: Auth,
  url: string,
  body?: Record<string, unknown>,
  method: "GET" | "POST" = body ? "POST" : "GET"
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in again.");
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data as T;
}

/** The signed-in user's ID token, for server actions that check who is calling. */
export async function idTokenOf(auth: Auth): Promise<string> {
  return auth.currentUser ? auth.currentUser.getIdToken() : "";
}

/**
 * Changes a provider's, employee's or job application's status on the server,
 * which also sends the approval email when an account becomes approved.
 */
export async function updateApproval(
  auth: Auth,
  body: { kind: "provider" | "employee" | "application"; id: string; status: string; region?: string }
): Promise<{ status: string; email: "sent" | "queued" | "failed" | "none" }> {
  return apiFetch(auth, "/api/admin/approvals", body);
}

/** The toast text for the approval email outcome, if any. */
export function approvalEmailNote(email: "sent" | "queued" | "failed" | "none"): string {
  return email === "sent" ? " Approval email sent."
    : email === "queued" ? " Approval email is waiting in Admin > Emails."
    : email === "failed" ? " The approval email couldn't be sent; retry it from Admin > Emails."
    : "";
}
