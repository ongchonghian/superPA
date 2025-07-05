'use client';

import React, { useRef, useState } from 'react';
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
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

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

  return (
    <Card className="mb-6 no-print">
      <CardHeader>
        <CardTitle>Context Documents</CardTitle>
        <CardDescription>
          Upload documents to provide more context to the AI for better suggestions.
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
      </CardContent>
    </Card>
  );
}
