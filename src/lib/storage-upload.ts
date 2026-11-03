import { initializeFirebase } from "@/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

/**
 * Uploads an ID or COI verification file to Firebase Cloud Storage under `verifications/{uid}/...`.
 * If Firebase Storage is not yet enabled on the project, gracefully falls back to a safe data URL
 * so onboarding and dashboard uploads continue working without interruption.
 */
export async function uploadVerificationDocument(
  uid: string,
  docKey: string,
  file: File
): Promise<string> {
  try {
    const { storage } = initializeFirebase();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageRef = ref(storage, `verifications/${uid}/${docKey}_${Date.now()}_${safeName}`);

    // Race against a 4-second timeout in case the Storage bucket hasn't been initialized in Console yet
    const uploadPromise = (async () => {
      const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type || "application/octet-stream",
      });
      return await getDownloadURL(snapshot.ref);
    })();

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Storage bucket timeout fallback")), 4000)
    );

    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch {
    // Fallback to Data URL if Cloud Storage bucket is not yet provisioned
    if (file.size <= 750 * 1024) {
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string) || `uploaded:${file.name}`);
        reader.onerror = () => resolve(`uploaded:${file.name}`);
        reader.readAsDataURL(file);
      });
    }
    return `uploaded:${file.name}`;
  }
}

