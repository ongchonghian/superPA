

'use client';

import React, { useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { File, Loader2, Terminal, Trash2, UploadCloud, Link, ExternalLink, AlertCircle, Hourglass } from 'lucide-react';
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
import { Separator } from './ui/separator';

interface DocumentManagerProps {
  documents: Document[];
  onUpload: (files: FileList | null) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
  onView: (document: Document) => void;
  onAddUrl: (url: string) => Promise<void>;
  isUploading: boolean;
  storageCorsError: boolean;
  isCollaborator: boolean;
}

export function DocumentManager({ documents, onUpload, onDelete, onView, onAddUrl, isUploading, storageCorsError, isCollaborator }: DocumentManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const storageBucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const [docToDelete, setDocToDelete] = useState<Document | null>(null);
  const [urlToAdd, setUrlToAdd] = useState('');
  const [isAddingUrl, setIsAddingUrl] = useState(false);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await onUpload(event.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAddUrl = async () => {
    if (!urlToAdd) return;
    setIsAddingUrl(true);
    try {
      await onAddUrl(urlToAdd);
      setUrlToAdd('');
    } finally {
      setIsAddingUrl(false);
    }
  };


  return (
    <>
      <Card className="mb-6 no-print">
        <CardHeader>
          <CardTitle>Context Documents</CardTitle>
          <CardDescription>
            Provide context for the AI by uploading documents or adding a URL for the AI to read and analyze.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {storageCorsError && (
             <Alert variant="destructive" className="mb-6">
              <Terminal className="h-4 w-4" />
              <AlertTitle>CORS Policy Error Detected</AlertTitle>
              <AlertDescription>
                Your browser is blocking uploads due to a CORS policy on your Firebase Storage bucket. Please follow the troubleshooting guide to resolve this.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {/* File Upload Section */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Upload Files</h3>
              <Input
                id="file-upload"
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
                disabled={isUploading || isCollaborator}
              />
              <Button onClick={handleUploadClick} disabled={isUploading || isCollaborator} className="w-full">
                {isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UploadCloud className="mr-2 h-4 w-4" />
                )}
                Upload from Computer
              </Button>
            </div>
            
            {/* URL Input Section */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Add from URL</h3>
              <div className="flex gap-2">
                <Input
                  id="url-input"
                  type="url"
                  placeholder="https://example.com/about-us"
                  value={urlToAdd}
                  onChange={(e) => setUrlToAdd(e.target.value)}
                  disabled={isAddingUrl || isCollaborator}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
                />
                <Button onClick={handleAddUrl} disabled={isAddingUrl || isCollaborator || !urlToAdd}>
                  {isAddingUrl ? (
                     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                     <Link className="mr-2 h-4 w-4" />
                  )}
                  Add URL
                </Button>
              </div>
            </div>
          </div>
          
          {documents.length > 0 && (
            <div className="mt-6 space-y-3">
               <Separator className="my-6"/>
               <h4 className="text-sm font-medium">Associated Documents</h4>
              <ul className="rounded-md border">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between pl-3 pr-1.5 py-1.5 border-b last:border-b-0">
                      <div className="flex items-center gap-3 overflow-hidden">
                        {doc.status === 'processing' ? (
                          <Hourglass className="h-5 w-5 text-muted-foreground flex-shrink-0 animate-spin" />
                        ) : doc.status === 'failed' ? (
                          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                        ) : (
                          <File className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        )}

                        <div className="flex-1 overflow-hidden">
                          {doc.sourceUrl && doc.status !== 'complete' ? (
                             <span className="font-medium text-sm truncate italic text-muted-foreground" title={doc.sourceUrl}>
                                {doc.fileName}
                              </span>
                          ) : (
                             <button 
                                onClick={() => onView(doc)}
                                className="font-medium text-sm truncate text-left hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded-sm -ml-1 px-1"
                                title={`View ${doc.fileName}`}
                              >
                                {doc.fileName}
                              </button>
                          )}
                          
                          {doc.sourceUrl && (
                            <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary w-fit">
                                Source <ExternalLink className="h-3 w-3" />
                            </a>
                          )}

                          {doc.status === 'failed' && (
                             <p className="text-xs text-destructive truncate" title={doc.error}>{doc.error}</p>
                          )}
                        </div>

                      </div>
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
