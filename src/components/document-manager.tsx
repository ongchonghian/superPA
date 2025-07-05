'use client';

import React, { useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { File, Info, Loader2, Trash2, UploadCloud, CheckCircle, AlertTriangle, PlayCircle } from 'lucide-react';
import type { Document } from '@/lib/types';
import { Input } from './ui/input';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { auth, storage } from '@/lib/firebase';
import { ref as storageRef, uploadString, deleteObject } from 'firebase/storage';

interface DocumentManagerProps {
  documents: Document[];
  onUpload: (files: FileList) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
  isUploading: boolean;
}

export function DocumentManager({ documents, onUpload, onDelete, isUploading }: DocumentManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFiles(event.target.files);
    } else {
      setSelectedFiles(null);
    }
  };

  const handleUploadClick = async () => {
    if (selectedFiles) {
      await onUpload(selectedFiles);
      setSelectedFiles(null);
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
    setIsDiagnosing(true);
    setDiagnosticResult(null);

    if (!storage || !auth) {
      setDiagnosticResult({
        success: false,
        message: 'Firebase Not Initialized',
        details: 'The Firebase storage or auth service could not be found. Check your .env.local file and restart the backend.',
      });
      setIsDiagnosing(false);
      return;
    }

    if (!auth.currentUser) {
      setDiagnosticResult({
        success: false,
        message: 'Not Authenticated',
        details: 'No user is signed in. The app must authenticate before it can upload files. Please refresh the page.',
      });
      setIsDiagnosing(false);
      return;
    }

    const testFilePath = `diagnostics/upload-test-${auth.currentUser.uid}-${Date.now()}.txt`;
    const testFileRef = storageRef(storage, testFilePath);
    const testContent = `This is a diagnostic file uploaded by user ${auth.currentUser.uid} at ${new Date().toISOString()}.`;

    try {
      await uploadString(testFileRef, testContent, 'raw');
      
      setDiagnosticResult({
        success: true,
        message: 'Upload Successful!',
        details: `A test file was successfully written to your Firebase Storage bucket at: ${testFilePath}. The file was deleted after the test.`,
      });

      // Clean up the test file
      try {
        await deleteObject(testFileRef);
      } catch (deleteError) {
        console.warn('Diagnostic test file cleanup failed. You may need to delete it manually from your storage bucket.', deleteError);
      }

    } catch (error: any) {
      console.error('Diagnostic upload failed:', error);
      let message = 'Upload Failed';
      let details = `An unexpected error occurred: ${error.message || 'Unknown error.'}`;

      if (error.code === 'storage/unauthorized') {
        message = 'Permission Denied';
        details = "Your security rules are preventing the upload. Ensure your Storage security rules allow writes for authenticated users: `allow write: if request.auth != null;`";
      } else if (error.code === 'storage/object-not-found') {
         message = 'Storage Bucket Not Found (404)';
         details = "The upload failed because the Storage Bucket could not be found (404 Error). This is the most common setup issue and is almost always caused by an incorrect value for `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` in your `.env.local` file.\n\n**Correct format:** `your-project-id.appspot.com`\n**Incorrect format:** `your-project-id.firebasestorage.com`\n\nPlease verify the value is correct, save the `.env.local` file, and **restart the backend**.";
      }

      setDiagnosticResult({
        success: false,
        message: message,
        details: details,
      });
    } finally {
      setIsDiagnosing(false);
    }
  };

  return (
    <Card className="mb-6 no-print">
      <CardHeader>
        <CardTitle>Context Documents</CardTitle>
        <CardDescription>
          Upload documents to provide the AI with more context for better suggestions. Files are stored securely and privately in your project's Firebase Storage bucket.
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
              onChange={handleFileSelect}
              className="cursor-pointer file:text-primary file:font-semibold"
              disabled={isUploading}
            />
             <p className="text-xs text-muted-foreground">
              {selectedFiles ? `${selectedFiles.length} file(s) selected` : 'Select one or more files to upload.'}
            </p>
          </div>
          <Button onClick={handleUploadClick} disabled={!selectedFiles || isUploading}>
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="mr-2 h-4 w-4" />
            )}
            Upload
          </Button>
        </div>
        
        {(documents.length > 0 || isUploading) && (
          <div className="mt-6 space-y-3">
             <h4 className="text-sm font-medium">Associated Documents</h4>
            <ul className="rounded-md border">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between p-3 border-b last:border-b-0 animate-in fade-in duration-300">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <File className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium text-sm truncate" title={doc.fileName}>{doc.fileName}</span>
                    </div>
                  <div className="flex items-center gap-2 sm:gap-4">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteClick(doc.id)} disabled={isUploading}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete document</span>
                    </Button>
                  </div>
                </li>
              ))}
              {isUploading && documents.length === 0 && (
                 <li className="flex items-center justify-center p-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Uploading...</span>
                 </li>
              )}
            </ul>
          </div>
        )}
         <Alert variant="default" className="mt-6 text-sm">
            <Info className="h-4 w-4" />
            <AlertTitle className="font-semibold">Having trouble uploading?</AlertTitle>
            <AlertDescription className="mt-2 space-y-4">
                <p>
                    If uploads are failing, you can run a quick diagnostic test to check your connection and permissions with Firebase Storage.
                </p>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <Button variant="secondary" onClick={runDiagnosticTest} disabled={isDiagnosing}>
                        {isDiagnosing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                        {isDiagnosing ? 'Running Test...' : 'Run Upload Test'}
                    </Button>
                </div>

                {diagnosticResult && (
                    <div className={`mt-4 p-3 rounded-md text-xs ${diagnosticResult.success ? 'bg-green-100 dark:bg-green-900/50' : 'bg-red-100 dark:bg-red-900/50'}`}>
                        <div className={`flex items-start gap-2 font-bold ${diagnosticResult.success ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                           {diagnosticResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                           {diagnosticResult.message}
                        </div>
                        {diagnosticResult.details && (
                           <p className={`mt-2 whitespace-pre-wrap ${diagnosticResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                {diagnosticResult.details}
                            </p>
                        )}
                    </div>
                )}
            </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
