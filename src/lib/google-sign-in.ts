import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
  type UserCredential,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";

export type SelfServiceRole = "customer" | "provider";

/** Opens the Google popup and returns the signed-in Firebase user. */
export async function signInWithGooglePopup(auth: Auth, completeSignIn: (operation: () => Promise<UserCredential>) => Promise<UserCredential>): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const { user } = await completeSignIn(() => signInWithPopup(auth, provider));
  return user;
}

/** Returns the user's role from their profile, or null if they have no profile yet. */
export async function getProfileRole(firestore: Firestore, uid: string): Promise<string | null> {
  const snap = await getDoc(doc(firestore, "users", uid));
  return snap.exists() ? ((snap.data().role as string) ?? "customer") : null;
}

/**
 * Creates the Firestore profile for a new self-service account. Matches the
 * email/password signup: customers get a profile, providers also get a
 * pending provider record that an admin must approve. Admin profiles can never
 * be created here (the Firestore rules reject them too).
 */
export async function createSelfServiceProfile(
  firestore: Firestore,
  user: User,
  details: { role: SelfServiceRole; name?: string; state?: string }
): Promise<void> {
  const email = user.email ?? "";
  const name = details.name || user.displayName || email.split("@")[0];
  await setDoc(doc(firestore, "users", user.uid), {
    id: user.uid,
    email,
    name,
    role: details.role,
    state: details.state ?? "",
    createdAt: serverTimestamp(),
  });
  if (details.role === "provider") {
    await setDoc(doc(firestore, "providers", user.uid), {
      uid: user.uid,
      businessName: name,
      email,
      status: "pending",
      isEmployee: false,
      services: [],
      rating: 0,
      reviewCount: 0,
      onboarding: {
        signupDate: new Date().toISOString(),
        insuranceUploaded: false,
        licenseVerified: false,
      },
    });
  }
}

export function dashboardForRole(role: string | null): string {
  if (role === "admin") return "/dashboard/admin";
  if (role === "employee") return "/dashboard/employee";
  if (role === "provider") return "/dashboard/provider";
  return "/dashboard/customer";
}

/** Friendly message for Google popup errors, or null when the user just closed the popup. */
export function googleErrorMessage(error: unknown): string | null {
  const code = (error as { code?: string })?.code ?? "";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return null;
  if (code === "auth/mfa-cancelled") return "Verification cancelled. Sign in again when you are ready.";
  if (code === "auth/popup-blocked") return "Your browser blocked the Google window. Allow pop-ups for this site and try again.";
  if (code === "auth/account-exists-with-different-credential")
    return "This email already has an account. Sign in with your email and password instead.";
  if (code === "auth/unauthorized-domain") return "Google sign-in isn't enabled for this web address yet.";
  return "Google sign-in failed. Please try again.";
}

export async function signOutQuietly(auth: Auth) {
  try {
    await signOut(auth);
  } catch {
    // ignore
  }
}
