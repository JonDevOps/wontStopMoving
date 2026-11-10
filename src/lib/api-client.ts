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
 * Emails a provider or employee that their account was approved. Returns
 * false instead of throwing, so a mail problem never undoes the approval.
 * Safe to repeat: the server sends each approval email at most once.
 */
export async function sendApprovalEmail(auth: Auth, kind: "provider" | "employee", id: string): Promise<boolean> {
  try {
    await apiFetch(auth, "/api/admin/notifications", { kind, id });
    return true;
  } catch {
    return false;
  }
}
