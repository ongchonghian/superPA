'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';

export function FirebaseNotConfigured({ missingKeys }: { missingKeys?: string[] }) {
  const hasMissingKeys = missingKeys && missingKeys.length > 0;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-3xl rounded-lg border-2 border-dashed border-destructive p-6 sm:p-8 text-center">
        <div className="flex justify-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
        </div>
        <h1 className="mt-4 text-2xl font-bold font-headline text-destructive">Firebase Not Configured</h1>

        {hasMissingKeys ? (
          <>
            <p className="mt-4 text-muted-foreground">
              Your application cannot connect to Firebase because the following required environment variable(s) are missing in your <code className="bg-muted px-1 py-0.5 rounded text-sm">.env</code> file:
            </p>
            <div className="mt-4 inline-block bg-destructive/10 p-3 rounded-md text-left">
                <ul className="list-disc list-inside space-y-1">
                    {missingKeys.map(key => (
                        <li key={key} className="font-mono text-sm text-destructive font-semibold">{key}</li>
                    ))}
                </ul>
            </div>
          </>
        ) : (
          <p className="mt-4 text-muted-foreground">
            Your application is showing this page because it's receiving an error from Firebase. This usually means your <code className="bg-muted px-1 py-0.5 rounded text-sm">.env</code> file has incorrect or invalid credentials.
          </p>
        )}


        <div className="mt-6 text-left text-foreground/90 space-y-4">
            <p>
                <strong>1. Go to your Firebase Project:</strong><br/>
                Open the <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">Firebase Console</a> and select your project.
            </p>
            <p>
                <strong>2. Find your Web App Config:</strong><br/>
                Go to Project Settings <code className="bg-muted px-1 py-0.5 rounded text-sm">&gt;</code> General tab. Scroll down to "Your apps" and find your Web App.
            </p>
            <p>
                <strong>3. Copy & Paste Configuration:</strong><br/>
                Under "SDK setup and configuration", select "Config", and copy the key-value pairs into a file named <code className="bg-muted px-1 py-0.5 rounded text-sm">.env</code> in your project's root directory.
            </p>
            <p>
                <strong>Important:</strong> Double-check that your <code className="bg-muted px-1 py-0.5 rounded text-sm">storageBucket</code> value ends in <code className="bg-muted px-1 py-0.5 rounded text-sm">.appspot.com</code>.
            </p>
        </div>

        <div className="mt-6">
             <p className="text-sm text-muted-foreground">
              Your <code className="bg-muted px-1 py-0.5 rounded text-sm">.env</code> file should look like this:
            </p>
            <pre className="mt-2 text-left bg-muted/50 p-4 rounded-md text-xs overflow-x-auto">
              <code>
                GEMINI_API_KEY="AIzaSy...your-key"<br/>
                NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSy...your-key"<br/>
                NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"<br/>
                NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"<br/>
                NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project.appspot.com"<br/>
                NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="1234567890"<br/>
                NEXT_PUBLIC_FIREBASE_APP_ID="1:12345:web:abcdef123"
              </code>
            </pre>
        </div>
        
        <div className="mt-8 bg-red-50 dark:bg-destructive/10 border-l-4 border-destructive p-4 text-left rounded-r-md">
            <div className='flex items-start gap-4'>
                <RefreshCw className="h-6 w-6 text-destructive flex-shrink-0 mt-1" />
                <div>
                    <h3 className="font-bold text-destructive">Crucial Step for Firebase Studio</h3>
                    <p className="mt-2 text-sm text-foreground/80 dark:text-foreground/80">
                        After you create or edit the <code className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive font-mono px-1 py-0.5 rounded">.env</code> file, you <strong>must</strong> restart the backend in Firebase Studio for the changes to apply. Look for a "Restart Backend" button or similar control in the Studio interface.
                    </p>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}
