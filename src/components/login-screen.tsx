
'use client';

import { Button } from "./ui/button";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";

interface LoginScreenProps {
  onSignIn: () => void;
}

export function LoginScreen({ onSignIn }: LoginScreenProps) {
  async function handleGoogleSignIn() {
    if (!auth || !googleProvider) {
      console.error('Firebase Auth is not configured.');
      return;
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);

      const user = result.user;
      if (!user) {
        throw new Error('No user returned from sign-in.');
      }

      const idToken = await user.getIdToken(true);

      const res = await fetch('/api/auth/session/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) {
        console.error('Failed to establish session cookie', await res.text());
        return;
      }

      onSignIn();
    } catch (err) {
      console.error('Sign-in failed', err);
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 rounded-lg border p-8 text-center">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-8 w-8 text-primary"
          >
            <path d="M7 10v4h10v-4" />
            <path d="M10.5 10V7.5a1.5 1.5 0 0 1 3 0V10" />
            <path d="M17 14v2.5a1.5 1.5 0 0 1-3 0V14" />
            <path d="M2 12s.5-5 5-5 5 5 5 5" />
            <path d="M22 12s-.5 5-5 5-5-5-5-5" />
          </svg>
          <h1 className="text-3xl font-bold font-headline text-foreground">
            Welcome to Super PA
          </h1>
        </div>
        <p className="max-w-md text-muted-foreground">
          Your AI-powered project assistant. Sign in to manage your checklists, collaborate with your team, and automate your workflow.
        </p>
        <Button onClick={handleGoogleSignIn} size="lg">
          <svg role="img" viewBox="0 0 24 24" className="mr-2 h-4 w-4">
            <path
              fill="currentColor"
              d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.02-2.37 1.62-4.38 1.62-3.82 0-6.94-3.1-6.94-6.94s3.12-6.94 6.94-6.94c2.2 0 3.54 1.23 4.38 1.92l-2.6 2.59c-.52-.49-1.18-.83-2.18-.83-2.14 0-3.89 1.73-3.89 3.89s1.75 3.89 3.89 3.89c1.34 0 2.25-.83 2.64-1.49H12.48z"
            />
          </svg>
          Sign In with Google
        </Button>
      </div>
    </div>
  );
}
