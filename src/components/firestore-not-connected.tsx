'use client';

import { AlertCircle, WifiOff } from 'lucide-react';

export function FirestoreNotConnected() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
        <div className="w-full max-w-3xl rounded-lg border-2 border-dashed border-destructive p-6 sm:p-8 text-center">
            <div className="flex justify-center">
                <WifiOff className="h-12 w-12 text-destructive" />
            </div>
            <h1 className="mt-4 text-2xl font-bold font-headline text-destructive">Cannot Connect to Firestore</h1>

            <p className="mt-4 text-muted-foreground">
                The application could not reach your Cloud Firestore database. This usually happens for one of a few reasons. Please check the following:
            </p>

            <div className="mt-6 text-left text-foreground/90 space-y-4">
                <p>
                    <strong>1. Is Firestore Enabled?</strong><br/>
                    Go to your <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">Firebase Console</a>, select your project, and navigate to the <strong>Firestore Database</strong> section under &quot;Build&quot;. If you see a &quot;Create database&quot; button, you need to enable it.
                </p>
                <p>
                    <strong>Important:</strong> When prompted, be sure to start in <strong>Native mode</strong>, not Datastore mode.
                </p>
                 <p>
                    <strong>2. Is Your Internet Connection Stable?</strong><br/>
                    The error can be triggered by a temporary loss of connectivity. Please ensure you have a stable internet connection.
                </p>
                <p>
                    <strong>3. Is the Project ID Correct?</strong><br/>
                    Double-check that the `NEXT_PUBLIC_FIREBASE_PROJECT_ID` in your <code className="bg-muted px-1 py-0.5 rounded text-sm">.env.local</code> file exactly matches the Project ID in your Firebase project settings.
                </p>
            </div>
            
            <div className="mt-8 bg-red-50 dark:bg-destructive/10 border-l-4 border-destructive p-4 text-left rounded-r-md">
                <div className='flex items-start gap-4'>
                    <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0 mt-1" />
                    <div>
                        <h3 className="font-bold text-destructive">Technical Details</h3>
                        <p className="mt-2 text-sm text-foreground/80 dark:text-foreground/80">
                            The client received a timeout error when trying to connect. This is often a temporary issue or a configuration problem. After checking the steps above, restarting the backend may help.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}
