import { NextResponse } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth, adminDb } from "./firebase-admin";

/**
 * Identity checks for API routes and server actions. Both are public HTTP
 * endpoints, so identity always comes from a verified Firebase ID token and
 * the role always comes from Firestore, never from the request body.
 */

export type Role = "customer" | "provider" | "employee" | "admin";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function verifyIdToken(idToken: string | null | undefined): Promise<DecodedIdToken> {
  if (!idToken) throw new HttpError(401, "Sign in required.");
  try {
    return await adminAuth().verifyIdToken(idToken);
  } catch {
    throw new HttpError(401, "Your session has expired. Please sign in again.");
  }
}

export async function requireUser(req: Request): Promise<DecodedIdToken> {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer (.+)$/);
  return verifyIdToken(match?.[1]);
}

export async function getRole(uid: string): Promise<Role | null> {
  const snap = await adminDb().doc(`users/${uid}`).get();
  if (!snap.exists) return null;
  return (snap.data()?.role as Role) ?? "customer";
}

async function checkRole(user: DecodedIdToken, roles: Role[]) {
  const role = await getRole(user.uid);
  if (!role || !roles.includes(role)) {
    throw new HttpError(403, "Your account doesn't have access to this action.");
  }
  return { user, role };
}

export async function requireRole(req: Request, roles: Role[]) {
  return checkRole(await requireUser(req), roles);
}

/** For server actions, which receive the ID token as an argument. */
export async function requireRoleFromToken(idToken: string | null | undefined, roles: Role[]) {
  return checkRole(await verifyIdToken(idToken), roles);
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    throw new HttpError(400, "Invalid request.");
  }
}

export function stripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY || "";
  return (key.startsWith("sk_live_") || key.startsWith("sk_test_")) && !key.includes("placeholder");
}

export function requireStripe() {
  if (!stripeConfigured()) throw new HttpError(503, "Payments are not configured yet.");
}

const ALLOWED_ORIGINS = [
  "https://wontstopmoving.com",
  "https://www.wontstopmoving.com",
  "https://wontstopmoving-backend-id--studio-6652665935-1850d.us-central1.hosted.app",
  "http://localhost:9002",
];

/** Where Stripe should send the customer back to. Never an arbitrary Origin header. */
export function siteOrigin(req: Request): string {
  const origin = req.headers.get("origin") || "";
  return ALLOWED_ORIGINS.includes(origin) ? origin : "https://wontstopmoving.com";
}

export const isId = (value: unknown, min = 1): value is string =>
  typeof value === "string" && value.length >= min && value.length <= 128 && /^[A-Za-z0-9_-]+$/.test(value);
