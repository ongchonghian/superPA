
import { initializeApp, getApps, getApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// Automatically correct a common misconfiguration for the storage bucket URL.
let storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
if (storageBucket && storageBucket.endsWith('.firebasestorage.com')) {
    console.log('Correcting storage bucket URL from .firebasestorage.com to .appspot.com');
    storageBucket = storageBucket.replace('.firebasestorage.com', '.appspot.com');
}

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: storageBucket,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

const ENV_KEY_MAP: Record<string, string> = {
    apiKey: 'NEXT_PUBLIC_FIREBASE_API_KEY',
    authDomain: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    projectId: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    storageBucket: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    messagingSenderId: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    appId: 'NEXT_PUBLIC_FIREBASE_APP_ID',
};

export const missingFirebaseConfigKeys: string[] = Object.entries(firebaseConfig)
    .filter(([key, value]) => key !== 'storageBucket' && !value) // storageBucket is checked separately now
    .map(([key]) => ENV_KEY_MAP[key] || key);

if (!firebaseConfig.storageBucket) {
    missingFirebaseConfigKeys.push('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET');
}


export const isFirebaseConfigured = missingFirebaseConfigKeys.length === 0;

if (isFirebaseConfigured) {
  try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch(e) {
    console.error("Firebase initialization failed:", e);
  }
} else {
    // Log a helpful message to the developer console.
    console.log("Firebase configuration is missing or incomplete. The following keys were not found in the environment:", missingFirebaseConfigKeys.join(', '));
}

export { app, auth, db, storage };
