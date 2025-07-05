'use client';

import React, { useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { File, Info, Loader2, PlayCircle, Trash2, UploadCloud } from 'lucide-react';
import type { Document } from '@/lib/types';
import { Input } from './ui/input';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { auth, storage } from '@/lib/firebase';
import { ref as storageRef, uploadString } from 'firebase/storage';
import { FirebaseTroubleshootingGuide } from './firebase-troubleshooting-guide';
import { useToast } from '@/hooks/use-toast';

interface DocumentManagerProps {
  documents: Document[];
  onUpload: (files: FileList) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
  isUploading: boolean;
}

export function DocumentManager({ documents, onUpload, onDelete, isUploading }: DocumentManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleUploadClick = async () => {
    if (fileInputRef.current?.files) {
      await onUpload(fileInputRef.current.files);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };
  
  const handleDeleteClick = async (docId: string) => {
    if (window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
        await onDelete(docId);
    }
  }

  const runDiagnosticTest = async () => {
    if (!storage || !auth || !auth.currentUser) {
        toast({
            title: "Pre-check Failed",
            description: "Could not run test because Firebase is not fully initialized or you are not signed in. Please refresh the page.",
            variant: "destructive"
        });
        return;
    }

    toast({
        title: "Running Upload Test...",
        description: "Check your browser's developer console (Network tab) for the result. A 404 error indicates a configuration issue.",
    });
    
    try {
        const testFilePath = `diagnostics/upload-test-${auth.currentUser.uid}-${Date.now()}.txt`;
        const testFileRef = storageRef(storage, testFilePath);
        const testContent = `This is a diagnostic file uploaded by user ${auth.currentUser.uid} at ${new Date().toISOString()}.`;
        
        // We don't need to await or handle success/error here.
        // The purpose is to trigger the network request for the user to observe.
        uploadString(testFileRef, testContent, 'raw');
    } catch (error) {
        // The browser will likely throw a CORS error before this is ever reached.
        // We are intentionally not handling it to prevent the app from crashing.
        console.error("Diagnostic upload could not be initiated.", error);
    }
  };

  return (
    <Card className="mb-6 no-print">
      <CardHeader>
        <CardTitle>Context Documents</CardTitle>
        <CardDescription>
          Upload documents to provide the AI with more context for better suggestions. Files are stored securely in your project's Firebase Storage bucket.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 space-y-2">
            <label htmlFor="file-upload" className="sr-only">Choose files</label>
            <Input
              id="file-upload"
              ref={fileInputRef}
              type="file"
              multiple
              className="cursor-pointer file:text-primary file:font-semibold"
              disabled={isUploading}
            />
          </div>
          <Button onClick={handleUploadClick} disabled={isUploading}>
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="mr-2 h-4 w-4" />
            )}
            Upload
          </Button>
        </div>
        
        {documents.length > 0 && (
          <div className="mt-6 space-y-3">
             <h4 className="text-sm font-medium">Associated Documents</h4>
            <ul className="rounded-md border">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between p-3 border-b last:border-b-0">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <File className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium text-sm truncate" title={doc.fileName}>{doc.fileName}</span>
                    </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive flex-shrink-0" onClick={() => handleDeleteClick(doc.id)} disabled={isUploading}>
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete document</span>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
         <Alert variant="default" className="mt-6 text-sm">
            <Info className="h-4 w-4" />
            <AlertTitle className="font-semibold">Having trouble uploading?</AlertTitle>
            <AlertDescription className="mt-2 space-y-3">
                <p>If uploads fail or seem to hang, it's almost always a Firebase configuration issue. Use the diagnostic test below for a definitive answer.</p>
                <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-semibold text-foreground">How to Diagnose:</h4>
                    <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                        <li>Open your browser's Developer Tools and switch to the <strong>Network</strong> tab.</li>
                        <li>Click the "Run Upload Test" button.</li>
                        <li>Look for a request to <code className="text-xs">firebasestorage.googleapis.com</code>. If you see a <strong className="text-destructive">404 Not Found</strong> error, it confirms your <code className="text-xs">.env.local</code> configuration is incorrect.</li>
                    </ol>
                     <Button className="mt-4" variant="secondary" onClick={runDiagnosticTest}>
                        <PlayCircle className="mr-2 h-4 w-4" />
                        Run Upload Test
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                    <strong>Why does it hang instead of showing a 404 error?</strong> Before uploading, your browser sends a "preflight" (OPTIONS) request to ask for permission. If the bucket name is wrong, Google's server responds to this preflight with a 404. Your browser sees this as a failed permission check and blocks the actual upload for security reasons, which can look like a timeout or a hung request in the app.
                </p>
            </AlertDescription>
        </Alert>

        <div className="mt-6">
            <FirebaseTroubleshootingGuide />
        </div>
      </CardContent>
    </Card>
  );
}
