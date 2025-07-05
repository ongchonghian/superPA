'use client';

import { ShieldAlert } from 'lucide-react';
import { Button } from './ui/button';
import { FirebaseTroubleshootingGuide } from './firebase-troubleshooting-guide';

export function FirestorePermissionDenied() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
        <div className="w-full max-w-3xl rounded-lg border-2 border-dashed border-destructive p-6 sm:p-8">
            <div className='text-center'>
                <div className="flex justify-center">
                    <ShieldAlert className="h-12 w-12 text-destructive" />
                </div>
                <h1 className="mt-4 text-2xl font-bold font-headline text-destructive">Firestore Permission Denied</h1>

                <p className="mt-4 text-muted-foreground">
                    Your app has connected to Firebase, but it does not have permission to read or write data. This is because your Firestore Security Rules are too restrictive. Please review step 3 in the checklist below.
                </p>
            </div>
            
            <FirebaseTroubleshootingGuide showRestartNote={false} />

            <div className="mt-6 text-center">
                <Button onClick={() => window.location.reload()}>
                    I've updated my rules, refresh the app
                </Button>
            </div>
        </div>
    </div>
  );
}
