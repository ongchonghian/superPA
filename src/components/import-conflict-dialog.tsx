'use client';

import React from 'react';
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
import { Button } from './ui/button';

interface ImportConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklistName: string;
  onOverwrite: () => void;
  onAppend: () => void;
}

export function ImportConflictDialog({
  open,
  onOpenChange,
  checklistName,
  onOverwrite,
  onAppend,
}: ImportConflictDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Import Conflict</AlertDialogTitle>
          <AlertDialogDescription>
            A checklist named &quot;{checklistName}&quot; already exists. What would you like to do?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="outline" onClick={onAppend}>Append Tasks</Button>
          <AlertDialogAction onClick={onOverwrite}>Overwrite Checklist</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
