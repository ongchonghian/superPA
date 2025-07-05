'use client';

import { AlertCircle } from 'lucide-react';
import { FirebaseTroubleshootingGuide } from './firebase-troubleshooting-guide';

export function FirebaseNotConfigured({ missingKeys, authMethodDisabled }: { missingKeys?: string[], authMethodDisabled?: boolean }) {

  const getTitleAndDescription = () => {
    if (authMethodDisabled) {
      return {
        title: "Anonymous Sign-In Is Disabled",
        description: "Your app is correctly configured, but the authentication method it uses (Anonymous Sign-In) has not been enabled in your Firebase project. Please enable it using the checklist below."
      };
    }
    if (missingKeys && missingKeys.length > 0) {
      return {
        title: "Firebase Not Configured",
        description: `Your application cannot connect to Firebase because the following required environment variable(s) are missing in your .env.local file:`,
        details: (
          <div className="mt-4 inline-block bg-destructive/10 p-3 rounded-md text-left">
              <ul className="list-disc list-inside space-y-1">
                  {missingKeys.map(key => (
                      <li key={key} className="font-mono text-sm text-destructive font-semibold">{key}</li>
                  ))}
              </ul>
          </div>
        )
      };
    }
    return {
      title: "Firebase Connection Error",
      description: "Your application is receiving an error from Firebase. This usually means your .env.local file has incorrect or invalid credentials. Please review the checklist below."
    };
  }
  
  const { title, description, details } = getTitleAndDescription();

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-3xl rounded-lg border-2 border-dashed border-destructive p-6 sm:p-8">
        <div className="text-center">
          <div className="flex justify-center">
              <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
          <h1 className="mt-4 text-2xl font-bold font-headline text-destructive">{title}</h1>
          <p className="mt-4 text-muted-foreground">
            {description}
          </p>
          {details}
        </div>

        <FirebaseTroubleshootingGuide />
      </div>
    </div>
  );
}
