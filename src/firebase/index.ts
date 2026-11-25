'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (!getApps().length) {
    // Important! initializeApp() is called without any arguments because Firebase App Hosting
    // integrates with the initializeApp() function to provide the environment variables needed to
    // populate the FirebaseOptions in production. It is critical that we attempt to call initializeApp()
    // without arguments.
    let firebaseApp;
    try {
      // Attempt to initialize via Firebase App Hosting environment variables
      firebaseApp = initializeApp();
    } catch (e) {
      // Only warn in production because it's normal to use the firebaseConfig to initialize
      // during development
      if (process.env.NODE_ENV === "production") {
        console.warn('Automatic initialization failed. Falling back to firebase config object.', e);
      }
      firebaseApp = initializeApp(firebaseConfig);
    }

    return getSdks(firebaseApp);
  }

  // If already initialized, return the SDKs with the already initialized App
  return getSdks(getApp());
}

// Local development against the Firebase emulators (`npm run dev:local`).
// Never set in production, so live builds always talk to the real project.
const USE_EMULATORS = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true';
let emulatorsConnected = false;

export function getSdks(firebaseApp: FirebaseApp) {
  const auth = getAuth(firebaseApp);
  const connectNow = USE_EMULATORS && !emulatorsConnected && typeof window !== 'undefined';
  // Long polling works through the dev server's proxy; streaming may not.
  const firestore = connectNow ? initializeFirestore(firebaseApp, { experimentalForceLongPolling: true }) : getFirestore(firebaseApp);
  if (connectNow) {
    emulatorsConnected = true;
    // Same origin as the page; next.config.ts forwards these to the emulators.
    const { protocol, hostname, port } = window.location;
    connectAuthEmulator(auth, `${protocol}//${hostname}:${port}`, { disableWarnings: true });
    connectFirestoreEmulator(firestore, hostname, Number(port));
  }
  return {
    firebaseApp,
    auth,
    firestore,
    storage: getStorage(firebaseApp)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
