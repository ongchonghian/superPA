'use client';

import { AlertCircle, ShieldAlert } from 'lucide-react';
import { Button } from './ui/button';

export function FirestorePermissionDenied() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
        <div className="w-full max-w-3xl rounded-lg border-2 border-dashed border-destructive p-6 sm:p-8 text-center">
            <div className="flex justify-center">
                <ShieldAlert className="h-12 w-12 text-destructive" />
            </div>
            <h1 className="mt-4 text-2xl font-bold font-headline text-destructive">Firestore Permissions Required</h1>

            <p className="mt-4 text-muted-foreground">
                Your app has connected to Firebase successfully, but it does not have permission to read or write data. This is because your Firestore Security Rules are too restrictive.
            </p>

            <div className="mt-6 text-left text-foreground/90 space-y-4">
                <p>
                    <strong>1. Go to your Firebase Project:</strong><br/>
                    Open the <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">Firebase Console</a> and select your project.
                </p>
                <p>
                    <strong>2. Navigate to Firestore Database:</strong><br/>
                    In the left-hand menu, click on <strong>Firestore Database</strong> under the &quot;Build&quot; section.
                </p>
                <p>
                    <strong>3. Open the &quot;Rules&quot; tab.</strong><br/>
                    Select the <strong>Rules</strong> tab from the top bar.
                </p>
                <p>
                    <strong>4. Update your rules:</strong><br/>
                    Replace the entire contents of the rules editor with the following code. This will allow any signed-in user to read and write data.
                </p>
            </div>
            
            <div className="mt-4">
                 <pre className="mt-2 text-left bg-muted/50 p-4 rounded-md text-xs overflow-x-auto">
                    <code>
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      // Allow read/write access for any signed-in user.
      // For production apps, you should replace this with more secure rules.
      allow read, write: if request.auth != null;
    }
  }
}`}
                    </code>
                </pre>
            </div>

            <div className="mt-6">
                <Button onClick={() => window.location.reload()}>
                    I've updated my rules, refresh the app
                </Button>
            </div>
            
            <div className="mt-8 bg-yellow-50 dark:bg-yellow-500/10 border-l-4 border-yellow-400 p-4 text-left rounded-r-md">
                <div className='flex items-start gap-4'>
                    <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-bold text-yellow-600 dark:text-yellow-400">Security Note</h3>
                        <p className="mt-2 text-sm text-foreground/80 dark:text-foreground/80">
                            These rules are great for getting started. For a real production application, you would want to write more granular rules to ensure users can only access their own data.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}
