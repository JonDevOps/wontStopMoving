import { getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Server-only Firebase Admin access. On App Hosting this uses the backend's
 * service account automatically; locally it uses Application Default
 * Credentials (`gcloud auth application-default login`).
 */
const PROJECT_ID = "studio-6652665935-1850d";

function adminApp(): App {
  return getApps()[0] ?? initializeApp({ projectId: process.env.GCLOUD_PROJECT || PROJECT_ID });
}

export const adminDb = () => getFirestore(adminApp());
export const adminAuth = () => getAuth(adminApp());

/** The Firebase Storage bucket (server-only files such as the mover registry). */
export const adminBucket = async () => {
  const { getStorage } = await import("firebase-admin/storage");
  return getStorage(adminApp()).bucket(process.env.STORAGE_BUCKET || `${PROJECT_ID}.firebasestorage.app`);
};
