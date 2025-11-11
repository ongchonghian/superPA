

'use client';

import { initializeApp, getApps, getApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let googleProvider: GoogleAuthProvider | null = null;

const ENV_KEY_MAP: Record<string, string> = {
    apiKey: 'NEXT_PUBLIC_FIREBASE_API_KEY',
    authDomain: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    projectId: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    storageBucket: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    messagingSenderId: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    appId: 'NEXT_PUBLIC_FIREBASE_APP_ID',
};

export const missingFirebaseConfigKeys: string[] = Object.entries(firebaseConfig)
    .filter(([key, value]) => !value)
    .map(([key]) => ENV_KEY_MAP[key] || key);


export const isFirebaseConfigured = missingFirebaseConfigKeys.length === 0;

if (isFirebaseConfigured) {
  try {
    // Guard against re-entrant initialization in Next.js dev / React strict mode.
    // Only initialize when we truly have no apps yet.
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }

    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    googleProvider = new GoogleAuthProvider();
  } catch (e) {
    console.error(
      'Firebase initialization failed (this is safe in dev if config is missing/misconfigured):',
      e,
    );
    // Ensure we never leave these as uninitialized TDZ-like bindings.
    app = null;
    auth = null;
    db = null;
    storage = null;
    googleProvider = null;
  }
} else {
  // Log a helpful message to the developer console without throwing.
  console.log(
    'Firebase configuration is missing or incomplete. The following keys were not found in the environment:',
    missingFirebaseConfigKeys.join(', '),
  );
}

export { app, auth, db, storage, googleProvider };
