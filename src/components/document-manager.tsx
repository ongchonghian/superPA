
'use client';

import React, { useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { File, Loader2, Trash2, UploadCloud } from 'lucide-react';
import type { Document } from '@/lib/types';
import { Input } from './ui/input';

interface DocumentManagerProps {
  documents: Document[];
  onUpload: (files: FileList) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
  isUploading: boolean;
}

export function DocumentManager({ documents, onUpload, onDelete, isUploading }: DocumentManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      </CardContent>
    </Card>
  );
}
