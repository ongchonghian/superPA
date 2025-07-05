'use client';

import React from 'react';

export function FirebaseTroubleshootingGuide({ showRestartNote = true }: { showRestartNote?: boolean }) {
  return (
    <div className="mt-6 text-left text-foreground/90 space-y-4 text-sm">
        <h3 className="font-bold text-lg text-foreground">Troubleshooting Checklist</h3>
        <p>
            <strong>1. Check `.env.local` &amp; Project Settings:</strong><br/>
            Go to your <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">Firebase Console</a> &rarr; Project Settings (⚙️) &rarr; General tab. Scroll to "Your apps" and find your Web App's configuration. Ensure these values in your <code className="bg-muted px-1 py-0.5 rounded text-xs">.env.local</code> file match <strong>exactly</strong>:
            <ul className="list-disc list-inside pl-4 mt-2 space-y-1">
                <li><code className="bg-muted px-1 py-0.5 rounded text-xs">NEXT_PUBLIC_FIREBASE_PROJECT_ID</code></li>
                <li><code className="bg-muted px-1 py-0.5 rounded text-xs">NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET</code> (must be `your-project-id.appspot.com`)</li>
                <li><code className="bg-muted px-1 py-0.5 rounded text-xs">NEXT_PUBLIC_FIREBASE_API_KEY</code></li>
            </ul>
        </p>

        <p>
            <strong>2. Check Authentication Methods:</strong><br/>
            In the Firebase Console, go to Build &rarr; Authentication &rarr; Sign-in method tab. Ensure **Anonymous** sign-in is **Enabled**.
        </p>

        <p>
            <strong>3. Check Firestore (Database):</strong><br/>
            Go to Build &rarr; Firestore Database. Ensure it has been **created** (if not, create one in **Native Mode**). Then, check the **Rules** tab and make sure they allow access, for example: <code className="bg-muted px-1 py-0.5 rounded text-xs">{`allow read, write: if request.auth != null;`}</code>
        </p>

        <p>
            <strong>4. Check Cloud Storage:</strong><br/>
            Go to Build &rarr; Storage. Ensure it has been **activated**. Then, check the **Rules** tab and ensure they are also set to allow access: <code className="bg-muted px-1 py-0.5 rounded text-xs">{`allow read, write: if request.auth != null;`}</code>
        </p>
        
        {showRestartNote && (
            <div className="mt-6 bg-red-50 dark:bg-destructive/10 border-l-4 border-destructive p-4 rounded-r-md">
                <h3 className="font-bold text-destructive">Crucial Step for Firebase Studio</h3>
                <p className="mt-2 text-sm text-foreground/80 dark:text-foreground/80">
                    After you create or edit the <code className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive font-mono px-1 py-0.5 rounded">.env.local</code> file, you <strong>must</strong> restart the backend in Firebase Studio for the changes to apply.
                </p>
            </div>
        )}
    </div>
  );
}
