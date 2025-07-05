'use client';

import { AlertCircle } from 'lucide-react';

export function FirebaseNotConfigured() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-3xl rounded-lg border-2 border-dashed border-destructive p-6 sm:p-8 text-center">
        <div className="flex justify-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
        </div>
        <h1 className="mt-4 text-2xl font-bold font-headline text-destructive">Firebase Not Configured</h1>
        <p className="mt-4 text-muted-foreground">
          Your application is missing the required Firebase configuration. To fix this, you need to connect the app to your Firebase project.
        </p>
        <div className="mt-6 text-left text-foreground/90 space-y-4">
            <p>
                <strong>1. Go to your Firebase Project:</strong><br/>
                Open the <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">Firebase Console</a> and select the project you want to use.
            </p>
            <p>
                <strong>2. Find your Web App Config:</strong><br/>
                In Project Settings, go to the "General" tab. Scroll down to "Your apps" and find your Web App.
            </p>
            <p>
                <strong>3. Copy and Paste into `.env`:</strong><br/>
                Under "SDK setup and configuration", select "Config", and copy the key-value pairs into the <code className="bg-muted px-1 py-0.5 rounded text-sm">.env</code> file in your project's root directory.
            </p>
        </div>
        <div className="mt-6">
             <p className="text-sm text-muted-foreground">
              Example <code className="bg-muted px-1 py-0.5 rounded text-sm">.env</code> file:
            </p>
            <pre className="mt-2 text-left bg-muted/50 p-4 rounded-md text-xs overflow-x-auto">
              <code>
                NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSy...your-key"<br/>
                NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"<br/>
                NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"<br/>
                NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project.appspot.com"<br/>
                NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="1234567890"<br/>
                NEXT_PUBLIC_FIREBASE_APP_ID="1:12345:web:abcdef123"
              </code>
            </pre>
        </div>
        <p className="mt-6 font-semibold text-foreground">
          After updating the <code className="bg-muted px-1 py-0.5 rounded text-sm">.env</code> file, you must restart the development server.
        </p>
      </div>
    </div>
  );
}
