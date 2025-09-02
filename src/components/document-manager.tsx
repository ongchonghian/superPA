

'use client';

import React, { useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { File, Loader2, Terminal, Trash2, UploadCloud } from 'lucide-react';
import type { Document } from '@/lib/types';
import { Input } from './ui/input';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DocumentManagerProps {
  documents: Document[];
  onUpload: (files: FileList | null) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
  onView: (document: Document) => void;
  isUploading: boolean;
  storageCorsError: boolean;
  isCollaborator: boolean;
}

export function DocumentManager({ documents, onUpload, onDelete, onView, isUploading, storageCorsError, isCollaborator }: DocumentManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const storageBucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const [docToDelete, setDocToDelete] = useState<Document | null>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await onUpload(event.target.files);
    // Reset file input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };


  return (
    <>
      <Card className="mb-6 no-print">
        <CardHeader>
          <CardTitle>Context Documents</CardTitle>
          <CardDescription>
            Upload documents to provide the AI with more context for better suggestions. Files are stored securely in your project's Firebase Storage bucket.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {storageCorsError && (
            <Alert variant="destructive" className="mb-6">
              <Terminal className="h-4 w-4" />
              <AlertTitle>CORS Policy Error Detected</AlertTitle>
              <AlertDescription>
                <div className="space-y-3 mt-2 text-destructive-foreground/90">
                  <p>Your browser is blocking the upload because your Firebase Storage bucket is not configured to accept requests from this web-based development environment. You must update its CORS configuration.</p>
                  <p className="font-bold">Follow these steps using the Google Cloud Shell:</p>
                  <ol className="list-decimal list-inside space-y-3">
                    <li>
                      <strong>Open Cloud Shell</strong> from your Google Cloud Console.
                    </li>
                    <li>
                      <strong>Create a file named `cors.json`</strong> with the following content. This configuration allows any origin, which is acceptable for this development environment.
                      <pre className="mt-2 p-2 bg-black/20 rounded-md text-xs font-mono select-all">
                        {`[
  {
    "origin": ["*"],
    "method": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "responseHeader": ["Content-Type", "Authorization"],
    "maxAgeSeconds": 3600
  }
]`}
                      </pre>
                    </li>
                    <li>
                      <strong>Apply the configuration</strong> by running this command, using the bucket name from your <code className="bg-black/20 px-1 py-0.5 rounded">.env.local</code> file.
                      <pre className="mt-2 p-2 bg-black/20 rounded-md text-xs font-mono select-all">
                        gcloud storage buckets update gs://{storageBucketName} --cors-file=cors.json
                      </pre>
                    </li>
                    <li>
                      <strong>Try uploading again.</strong> The change can take a minute to apply.
                    </li>
                  </ol>
                </div>
              </AlertDescription>
            </Alert>
          )}
          <div className="flex">
            <Input
              id="file-upload"
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={isUploading || isCollaborator}
            />
            <Button onClick={handleUploadClick} disabled={isUploading || isCollaborator}>
              {isUploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="mr-2 h-4 w-4" />
              )}
              Upload Documents
            </Button>
          </div>
          
          {documents.length > 0 && (
            <div className="mt-6 space-y-3">
               <h4 className="text-sm font-medium">Associated Documents</h4>
              <ul className="rounded-md border">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between pl-3 pr-1.5 py-1.5 border-b last:border-b-0">
                      <button 
                        onClick={() => onView(doc)}
                        className="flex items-center gap-3 overflow-hidden text-left hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded-sm -ml-1 px-1"
                        title={`View ${doc.fileName}`}
                      >
                          <File className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium text-sm truncate">{doc.fileName}</span>
                      </button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive flex-shrink-0" onClick={() => setDocToDelete(doc)} disabled={isUploading || isCollaborator}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete document</span>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
      <AlertDialog open={!!docToDelete} onOpenChange={(isOpen) => !isOpen && setDocToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete the document &quot;{docToDelete?.fileName}&quot;. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (docToDelete) {
                  onDelete(docToDelete.id);
                  setDocToDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
