'use client';

import { WifiOff } from 'lucide-react';
import { FirebaseTroubleshootingGuide } from './firebase-troubleshooting-guide';

export function FirestoreNotConnected() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
        <div className="w-full max-w-3xl rounded-lg border-2 border-dashed border-destructive p-6 sm:p-8">
            <div className='text-center'>
                <div className="flex justify-center">
                    <WifiOff className="h-12 w-12 text-destructive" />
                </div>
                <h1 className="mt-4 text-2xl font-bold font-headline text-destructive">Cannot Connect to Firestore</h1>

                <p className="mt-4 text-muted-foreground">
                    The application timed out trying to reach your Cloud Firestore database. This indicates a network or configuration problem. Please review the checklist below to resolve the issue.
                </p>
            </div>

            <FirebaseTroubleshootingGuide />
        </div>
    </div>
  );
}
