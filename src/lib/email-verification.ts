import { sendEmailVerification, type User } from 'firebase/auth';

/** Email delivery failure must not turn a successfully created account into a signup error. */
export async function sendSignupVerification(user: User): Promise<boolean> {
  if (user.emailVerified || !user.email) return true;
  try {
    await sendEmailVerification(user);
    return true;
  } catch {
    // The signed-in user can retry in the verification notice in their dashboard.
    return false;
  }
}
