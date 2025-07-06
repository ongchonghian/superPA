'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChecklistHeader } from '@/components/checklist-header';
import { TaskTable } from '@/components/task-table';
import type { Checklist, Task, TaskStatus, TaskPriority, Remark, Document } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import Loading from './loading';
import { isFirebaseConfigured, missingFirebaseConfigKeys, db, storage, auth } from '@/lib/firebase';
import { FirebaseNotConfigured } from '@/components/firebase-not-configured';
import { FirestoreNotConnected } from '@/components/firestore-not-connected';
import { FirestorePermissionDenied } from '@/components/firestore-permission-denied';
import { ref as storageRef, uploadBytes, deleteObject } from 'firebase/storage';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  arrayUnion,
  arrayRemove,
  writeBatch,
} from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { NewChecklistDialog } from '@/components/new-checklist-dialog';
import { ImportConflictDialog } from '@/components/import-conflict-dialog';
import { PRIORITIES } from '@/lib/data';
import { ChecklistAiSuggestionDialog } from '@/components/checklist-ai-suggestion-dialog';
import type { SuggestChecklistNextStepsOutput, ChecklistSuggestion, InformationRequest } from '@/ai/flows/suggest-checklist-next-steps';
import { suggestChecklistNextSteps } from '@/ai/flows/suggest-checklist-next-steps';
import { TaskDialog } from '@/components/task-dialog';
import { TaskRemarksSheet } from '@/components/task-remarks-sheet';
import { DocumentManager } from '@/components/document-manager';

export default function Home() {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [authMethodDisabled, setAuthMethodDisabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [firestoreError, setFirestoreError] = useState(false);
  const [firestorePermissionError, setFirestorePermissionError] = useState(false);
  const [checklistMetas, setChecklistMetas] = useState<{ id: string; name: string }[]>([]);
  const [activeChecklist, setActiveChecklist] = useState<Checklist | null>(null);
  const [activeChecklistId, setActiveChecklistId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isNewChecklistDialogOpen, setIsNewChecklistDialogOpen] = useState(false);
  const [importMode, setImportMode] = useState<'new' | 'current' | null>(null);
  const [importConflict, setImportConflict] = useState<{ conflictingId: string; name: string; tasks: Task[] } | null>(null);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<SuggestChecklistNextStepsOutput | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [storageCorsError, setStorageCorsError] = useState(false);
  const [remarksTask, setRemarksTask] = useState<Task | null>(null);
  const [isRemarksSheetOpen, setIsRemarksSheetOpen] = useState(false);
  const [dialogTask, setDialogTask] = useState<Partial<Task> | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);

  // If Firebase is not configured statically, show guidance.
  if (!isFirebaseConfigured) {
    return <FirebaseNotConfigured missingKeys={missingFirebaseConfigKeys} />;
  }

  // Effect to handle anonymous authentication
  useEffect(() => {
    if (!auth) {
      setAuthError(true);
      setAuthInitialized(true);
      return;
    }

    try {
      const unsubscribe = onAuthStateChanged(auth, user => {
        if (user) {
          setUserId(user.uid);
          setAuthInitialized(true);
        } else {
          signInAnonymously(auth).catch((error: any) => {
            console.error("Anonymous sign-in failed: ", error);
            if (error.code === 'auth/configuration-not-found') {
              setAuthError(true);
            } else if (error.code === 'auth/admin-restricted-operation' || error.code === 'auth/operation-not-allowed') {
              setAuthMethodDisabled(true);
            }
            setAuthInitialized(true);
          });
        }
      });
      return () => unsubscribe();
    } catch (error: any) {
      console.error("Failed to initialize auth listener:", error);
      if (error.code === 'auth/configuration-not-found') {
        setAuthError(true);
      } else if (error.code === 'auth/admin-restricted-operation' || error.code === 'auth/operation-not-allowed') {
        setAuthMethodDisabled(true);
      }
      setAuthInitialized(true);
    }
  }, []);
  
  // Effect to fetch the list of checklist names and IDs for the current user
  useEffect(() => {
    if (!authInitialized || !userId || !db) {
      if(authInitialized) setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setFirestoreError(false); // Reset on each attempt
    setFirestorePermissionError(false); // Reset on each attempt

    const q = query(collection(db, 'checklists'), where('ownerId', '==', userId));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const metas = querySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name as string }));
      setChecklistMetas(metas);

      setActiveChecklistId(currentId => {
        // If current active ID is still valid, keep it.
        if (metas.some(m => m.id === currentId)) {
          return currentId;
        }
        // Otherwise, pick the first one, or null if empty.
        return metas.length > 0 ? metas[0].id : null;
      });

      if (metas.length === 0) {
        setActiveChecklist(null);
      }
      
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching checklists: ", error);
      if (error.code === 'unavailable') {
        setFirestoreError(true);
      } else if (error.code === 'permission-denied') {
        setFirestorePermissionError(true);
      } else {
        toast({ title: "Error", description: "Could not load checklists.", variant: "destructive" });
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toast, authInitialized, userId]);

  // Effect to subscribe to the currently active checklist for real-time updates
  useEffect(() => {
    if (!activeChecklistId || !db) {
      setActiveChecklist(null);
      setDocuments([]);
      if (authInitialized) setIsLoading(false); // Stop loading if there's no checklist to load
      return;
    }

    setIsLoading(true);
    const unsubscribe = onSnapshot(doc(db, 'checklists', activeChecklistId), (doc) => {
      if (doc.exists()) {
        const newChecklist = { id: doc.id, ...doc.data() } as Checklist;
        setActiveChecklist(newChecklist);
      } else {
        // This can happen if the active checklist is deleted
        setActiveChecklist(null);
        setActiveChecklistId(null);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching active checklist: ", error);
      toast({ title: "Error", description: "Could not load selected checklist.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [activeChecklistId, toast, authInitialized]);
  
  // Effect to subscribe to documents associated with the active checklist
  useEffect(() => {
    if (!activeChecklist || !activeChecklist.documentIds || activeChecklist.documentIds.length === 0 || !db) {
      setDocuments([]);
      return;
    }

    const q = query(collection(db, 'documents'), where('__name__', 'in', activeChecklist.documentIds));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const fetchedDocs = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Document));
        setDocuments(fetchedDocs);
    }, (error) => {
        console.error("Error fetching documents: ", error);
        toast({ title: "Error", description: "Could not load associated documents.", variant: "destructive" });
    });

    return () => unsubscribe();
  }, [activeChecklist, toast]);

  const handleUpdateChecklist = useCallback(async (updatedChecklist: Partial<Checklist> & { id: string }) => {
    if (!db) return;
    const { id, ...data } = updatedChecklist;
    const checklistRef = doc(db, 'checklists', id);
    try {
      await updateDoc(checklistRef, data);
    } catch (error) {
      console.error("Error updating checklist: ", error);
      toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
    }
  }, [toast]);

  const handleSaveNewChecklist = useCallback(async (name: string, tasks: Task[] = []) => {
    if (name && userId) {
      try {
        const newChecklist: Omit<Checklist, 'id'> = {
          name: name,
          tasks: tasks,
          ownerId: userId,
          documentIds: [],
        };
        const docRef = await addDoc(collection(db!, 'checklists'), newChecklist);
        setActiveChecklistId(docRef.id);
        toast({ title: "Success", description: `Checklist "${name}" created.` });
      } catch (error) {
        console.error("Error adding checklist: ", error);
        toast({ title: "Error", description: "Failed to create checklist.", variant: "destructive" });
      }
    }
  }, [toast, userId]);
  
  const handleSwitchChecklist = useCallback((id: string) => {
    setActiveChecklistId(id);
  }, []);

  const handleDeleteChecklist = useCallback(async (id: string) => {
    if (window.confirm("Are you sure you want to delete this checklist? This action cannot be undone.")) {
      try {
        await deleteDoc(doc(db!, 'checklists', id));
        toast({ title: "Success", description: "Checklist deleted." });
      } catch (error) {
        console.error("Error deleting checklist: ", error);
        toast({ title: "Error", description: "Failed to delete checklist.", variant: "destructive" });
      }
    }
  }, [toast]);
  
  const handleInitiateImport = (mode: 'new' | 'current') => {
    setImportMode(mode);
    fileInputRef.current?.click();
  };
  
  const handleOverwriteChecklist = useCallback(async (checklistId: string, name: string, tasks: Task[]) => {
    const checklistToUpdate = {
        id: checklistId,
        name: name,
        tasks: tasks,
    };
    await handleUpdateChecklist(checklistToUpdate);
    toast({ title: "Import Successful", description: `Checklist "${name}" has been overwritten.` });
  }, [handleUpdateChecklist, toast]);

  const handleAppendToChecklist = useCallback(async (checklistId: string, tasks: Task[]) => {
    if (!db) return;
    const checklistRef = doc(db, 'checklists', checklistId);
    try {
        const docSnap = await getDoc(checklistRef);
        if (docSnap.exists()) {
            const existingChecklist = docSnap.data() as Omit<Checklist, 'id'>;
            const updatedChecklist = {
                id: checklistId,
                tasks: [...existingChecklist.tasks, ...tasks],
            };
            await handleUpdateChecklist(updatedChecklist);
            toast({ title: "Import Successful", description: `${tasks.length} tasks appended to "${existingChecklist.name}".`});
        }
    } catch (error) {
        console.error("Error appending to checklist:", error);
        toast({ title: "Error", description: "Failed to append tasks to the checklist.", variant: "destructive" });
    }
  }, [handleUpdateChecklist, toast]);

  const handleFileSelectedForImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!importMode) return;

    const file = event.target.files?.[0];
    if (!file) {
      setImportMode(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        if (!content) {
            toast({ title: "Import failed", description: "File is empty.", variant: "destructive" });
            return;
        }
        
        const lines = content.split('\n');
        const newTasks: Task[] = [];
        let currentTask: Task | null = null;
        
        const checklistNameMatch = lines[0]?.match(/^#\s+(.*)/);
        if (!checklistNameMatch) {
          toast({ title: "Import failed", description: "Invalid format: Checklist must start with a '# Checklist Name' title.", variant: "destructive" });
          return;
        }
        const newChecklistName = checklistNameMatch[1].trim();

        for (const line of lines) {
          const taskMatch = line.match(/^- \[( |x)\]\s+(.*)/);
          if (taskMatch) {
            if (currentTask) {
              newTasks.push(currentTask);
            }
            
            const [, statusChar, taskContent] = taskMatch;
            let description = taskContent.trim();
            let priority: TaskPriority = 'Medium';
            let assignee = 'Unassigned';
            let dueDate = new Date().toISOString().split('T')[0];

            const assigneeMatch = description.match(/-\s*\*Assignee:\s*\[(.*?)\]\*/);
            if (assigneeMatch) {
              assignee = assigneeMatch[1].trim();
              description = description.substring(0, assigneeMatch.index).trim();
            }
            
            const detailsMatch = description.match(/\(([^)]+)\)$/);
            if (detailsMatch) {
              const detailsStr = detailsMatch[1];
              description = description.substring(0, detailsMatch.index).trim();

              const detailsArr = detailsStr.split(',').map(d => d.trim());
              detailsArr.forEach(detail => {
                const [key, ...valueParts] = detail.split(':').map(p => p.trim());
                const value = valueParts.join(':').trim();

                if (key.toLowerCase() === 'priority') {
                  const parsedPriority = value as TaskPriority;
                  if (PRIORITIES.includes(parsedPriority)) {
                    priority = parsedPriority;
                  }
                } else if (key.toLowerCase() === 'due') {
                  try {
                    const parsedDate = new Date(value);
                    if (!isNaN(parsedDate.getTime())) {
                      dueDate = parsedDate.toISOString().split('T')[0];
                    }
                  } catch (error) { /* keep default if date is invalid */ }
                }
              });
            }
            
            description = description.replace(/\*\*/g, '').replace(/\*/g, '');

            currentTask = {
              id: `task_${Date.now()}_${Math.random()}`,
              description,
              status: (statusChar === 'x' ? 'complete' : 'pending') as TaskStatus,
              priority, assignee, dueDate, remarks: [],
            };
            continue;
          }

          const remarkMatch = line.match(/^\s*(?:-\s*)?>\s*(.*)/);
          if (remarkMatch && currentTask) {
            let fullRemarkText = remarkMatch[1].trim();
            let text = fullRemarkText;
            let remarkUserId = 'system';
            let timestamp = new Date().toISOString();

            const userMatch = fullRemarkText.match(/(.*)\s+\(by (.*)\)$/);
            if (userMatch) {
                text = userMatch[1].trim();
                remarkUserId = userMatch[2].trim();
            }

            const timestampMatch = text.match(/^#(\d{8})\s*(.*)/);
            if (timestampMatch) {
                const dateStr = timestampMatch[1];
                text = timestampMatch[2].trim();
                const year = dateStr.substring(0, 4);
                const month = dateStr.substring(4, 6);
                const day = dateStr.substring(6, 8);
                const parsedTimestamp = new Date(`${year}-${month}-${day}T12:00:00Z`);
                if (!isNaN(parsedTimestamp.getTime())) {
                    timestamp = parsedTimestamp.toISOString();
                }
            }

            let finalRemarkText = text;
            const aiTodoMatchOld = text.match(/^TODO \(Assigned to AI\):\s*(.*)/s);
            if (aiTodoMatchOld) {
              finalRemarkText = `[ai-todo|pending] ${aiTodoMatchOld[1].trim()}`;
            }

            currentTask.remarks.push({ id: `rem_${Date.now()}_${Math.random()}`, text: finalRemarkText, userId: remarkUserId, timestamp });
          }
        }
        if (currentTask) { newTasks.push(currentTask); }

        if (importMode === 'new') {
            const existingChecklist = checklistMetas.find(meta => meta.name === newChecklistName);
            if (existingChecklist) {
              setImportConflict({ conflictingId: existingChecklist.id, name: newChecklistName, tasks: newTasks });
              return;
            }
            await handleSaveNewChecklist(newChecklistName, newTasks);
            toast({ title: "Import successful", description: `Checklist "${newChecklistName}" with ${newTasks.length} tasks imported.` });

        } else if (importMode === 'current') {
            if (!activeChecklist) {
              toast({ title: "Import failed", description: "No active checklist to import into.", variant: "destructive" });
              return;
            }
            if (newTasks.length > 0) {
              const updatedChecklist = { ...activeChecklist, tasks: [...activeChecklist.tasks, ...newTasks] };
              await handleUpdateChecklist(updatedChecklist);
              toast({ title: "Import successful", description: `${newTasks.length} tasks added to "${activeChecklist.name}".` });
            } else {
              toast({ title: "Import failed", description: "No valid tasks found in the file.", variant: "destructive" });
            }
        }
      } catch (error) {
        console.error("Error during import:", error);
        toast({ title: "Import failed", description: "An unexpected error occurred while parsing the file.", variant: "destructive" });
      } finally {
        setImportMode(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    };
    reader.readAsText(file);
  };

  const handleExportMarkdown = () => {
    if (!activeChecklist) return;

    const checklistTitle = `# ${activeChecklist.name}\n\n`;

    const formatTaskToMarkdown = (task: Task) => {
      const status = task.status === 'complete' ? 'x' : ' ';
      
      const taskDetails = `(Priority: ${task.priority}, Due: ${task.dueDate})`;
      const assigneePart = ` - *Assignee: [${task.assignee || 'Unassigned'}]*`;

      const taskLine = `- [${status}] **${task.description}** ${taskDetails}${assigneePart}`;
      
      const remarksLines = task.remarks.map(r => {
        const remarkDate = new Date(r.timestamp);
        const dateString = remarkDate.toISOString().split('T')[0].replace(/-/g, '');
        // The remark text from the database already includes the stateful AI to-do format, e.g., "[ai-todo|pending] ..."
        // This ensures lossless export.
        return `  - > #${dateString} ${r.text} (by ${r.userId})`;
      }).join('\n');
      
      return `${taskLine}${remarksLines ? `\n${remarksLines}` : ''}`;
    };

    const incompleteTasks = activeChecklist.tasks.filter(t => t.status !== 'complete');
    const completedTasks = activeChecklist.tasks.filter(t => t.status === 'complete');
    
    let markdownContent = '';

    if (incompleteTasks.length > 0) {
      markdownContent += `## Incomplete Tasks\n\n`;
      markdownContent += incompleteTasks.map(formatTaskToMarkdown).join('\n\n');
      markdownContent += '\n\n';
    }

    if (completedTasks.length > 0) {
      markdownContent += `## Completed Tasks\n\n`;
      markdownContent += completedTasks.map(formatTaskToMarkdown).join('\n\n');
      markdownContent += '\n\n';
    }

    // Fallback if the checklist is empty
    if (markdownContent.trim() === '') {
        markdownContent = 'This checklist has no tasks.';
    }

    const fullContent = checklistTitle + markdownContent.trim() + '\n';
    const blob = new Blob([fullContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeChecklist.name.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export successful", description: "Checklist exported as Markdown." });
  };

  const handleExportPdf = () => {
    toast({ title: "Preparing PDF...", description: "Your browser's print dialog will open." });
    setTimeout(() => window.print(), 500);
  };
  
  const fetchAiSuggestions = useCallback(async () => {
    if (!activeChecklist) return;
    
    const incompleteTasks = activeChecklist.tasks.filter(t => t.status !== 'complete');

    if (incompleteTasks.length === 0) {
      toast({
        title: "All tasks complete!",
        description: "There are no incomplete tasks for the AI to analyze."
      });
      return;
    }

    setIsAiLoading(true);
    setIsAiDialogOpen(true);

    try {
      const tasksToAnalyze = incompleteTasks.map(task => ({
        taskId: task.id,
        taskDescription: task.description,
        discussionHistory: task.remarks.map(r => `${r.userId}: ${r.text}`).join('\n')
      }));

      const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      const contextDocuments = documents.map(doc => ({
            fileName: doc.fileName,
            fileUri: `gs://${storageBucket}/${doc.storagePath}`,
      }));

      const result = await suggestChecklistNextSteps({ 
        tasks: tasksToAnalyze,
        contextDocuments: contextDocuments.length > 0 ? contextDocuments : undefined,
      });

      setAiAnalysisResult(result);

      if (!result.suggestions?.length && !result.informationRequests?.length) {
        toast({
            title: "No new suggestions found",
            description: "The AI couldn't find any new automatable tasks or opportunities to ask for more information.",
        });
      }
    } catch (error) {
      console.error('Checklist AI suggestion failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate suggestions. Please try again.',
        variant: 'destructive',
      });
      setAiAnalysisResult(null); 
    } finally {
      setIsAiLoading(false);
    }
  }, [activeChecklist, documents, toast]);

  const handleAddSuggestionAsRemark = useCallback((suggestionToAdd: ChecklistSuggestion) => {
    if (!activeChecklist) return;

    const targetTask = activeChecklist.tasks.find(t => t.id === suggestionToAdd.taskId);
    if (!targetTask) return;

    const newRemark: Remark = {
        id: `rem_${Date.now()}_${Math.random()}`,
        text: suggestionToAdd.suggestion,
        userId: 'ai_assistant',
        timestamp: new Date().toISOString(),
    };

    const updatedTask = {
        ...targetTask,
        remarks: [...targetTask.remarks, newRemark],
    };

    const updatedTasks = activeChecklist.tasks.map(t =>
      t.id === updatedTask.id ? updatedTask : t
    );
    
    handleUpdateChecklist({ ...activeChecklist, tasks: updatedTasks });

    setAiAnalysisResult(currentResult => {
      if (!currentResult) return null;
      return {
          ...currentResult,
          suggestions: (currentResult.suggestions || []).filter(s => !(s.suggestion === suggestionToAdd.suggestion && s.taskId === suggestionToAdd.taskId))
      };
    });
    
    toast({
        title: "AI To-Do Added",
        description: "The suggestion has been added to the task's remarks.",
    });
  }, [activeChecklist, handleUpdateChecklist, toast]);

  const handleProvideInfo = useCallback((taskId: string) => {
    if (!activeChecklist) return;
    const task = activeChecklist.tasks.find(t => t.id === taskId);
    if (task) {
      setIsAiDialogOpen(false); // Close the AI dialog
      setRemarksTask(task);     // Set the task for the remarks sheet
      setIsRemarksSheetOpen(true); // Open the remarks sheet
    }
  }, [activeChecklist]);

  const handleUploadDocuments = useCallback(async (files: FileList) => {
    if (!activeChecklist || !db || !storage || !auth) {
        toast({ title: "Error", description: "No active checklist selected or storage not configured.", variant: "destructive" });
        return;
    }

    if (!auth.currentUser) {
      toast({
        title: "Authentication Error",
        description: "Your session could not be verified. Please refresh the page and try again.",
        variant: "destructive"
      });
      return;
    }
    
    setStorageCorsError(false);
    setIsUploading(true);
    const uploadToast = toast({ title: "Uploading...", description: `Starting upload of ${files.length} document(s).` });

    try {
        const uploadPromises = Array.from(files).map(async (file) => {
            const docId = `doc_${Date.now()}_${file.name}`;
            const path = `checklists/${activeChecklist.id}/${docId}`;
            const fileRef = storageRef(storage, path);
            
            // Upload the file to Firebase Storage
            await uploadBytes(fileRef, file);

            // Create a document record in Firestore
            const newDocRef = doc(collection(db, "documents"));
            const batch = writeBatch(db);

            batch.set(newDocRef, {
                checklistId: activeChecklist.id,
                fileName: file.name,
                storagePath: path,
                createdAt: new Date().toISOString(),
            });

            // Associate document with checklist
            const checklistRef = doc(db, 'checklists', activeChecklist.id);
            batch.update(checklistRef, {
                documentIds: arrayUnion(newDocRef.id)
            });

            await batch.commit();
        });

        await Promise.all(uploadPromises);

        uploadToast.update({ id: uploadToast.id, title: "Upload complete", description: `${files.length} document(s) are ready for AI context.` });
    } catch (error: any) {
        console.error("Error uploading documents:", error);
        
        let errorMessage = "Could not upload documents. Please try again.";
        const errorString = (error.message || '').toLowerCase();

        if (error.code === 'storage/unauthorized' || errorString.includes('cors') || errorString.includes('access control')) {
            errorMessage = "Permission denied due to a CORS policy on your bucket. See guide below.";
            setStorageCorsError(true);
        } else if (error.code === 'storage/object-not-found') {
             errorMessage = "Storage bucket not found. Please verify NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in your .env.local file.";
        }
        uploadToast.update({ id: uploadToast.id, title: "Upload Failed", description: errorMessage, variant: "destructive" });
    } finally {
        setIsUploading(false);
    }
  }, [activeChecklist, toast]);

  const handleDeleteDocument = useCallback(async (documentId: string) => {
    if (!activeChecklist || !db || !storage) {
        toast({ title: "Error", description: "Cannot delete document: no active checklist.", variant: "destructive" });
        return;
    }

    const docToDeleteRef = doc(db, 'documents', documentId);
    let documentData: Document;

    // 1. Get the document from Firestore to find the storage path
    try {
        const docSnap = await getDoc(docToDeleteRef);
        if (!docSnap.exists()) {
            throw new Error("Document record not found in Firestore.");
        }
        documentData = { id: docSnap.id, ...docSnap.data() } as Document;
    } catch (error) {
        console.error("Error fetching document to delete:", error);
        // If the doc doesn't exist, it might be a stale reference. Try to clean it up.
        try {
            const checklistRef = doc(db, 'checklists', activeChecklist.id);
            await updateDoc(checklistRef, { documentIds: arrayRemove(documentId) });
            toast({ title: "Cleanup Complete", description: "A stale document reference was removed." });
        } catch (cleanupError) {
            console.error("Failed to clean up stale document reference:", cleanupError);
            toast({ title: "Error", description: "Could not find document record to delete.", variant: "destructive" });
        }
        return;
    }

    // 2. Attempt to delete the file from Firebase Storage
    try {
        const fileRef = storageRef(storage, documentData.storagePath);
        await deleteObject(fileRef);
    } catch (error: any) {
        if (error.code === 'storage/object-not-found') {
            console.warn(`File not found in storage at path: ${documentData.storagePath}. Proceeding with Firestore cleanup.`);
        } else {
            // For other storage errors (e.g., permissions), stop and alert the user.
            console.error("Error deleting file from Storage:", error);
            toast({ title: "Storage Error", description: "Could not delete file. Check storage permissions.", variant: "destructive" });
            return;
        }
    }

    // 3. Delete the Firestore document and remove its ID from the checklist
    try {
        const batch = writeBatch(db);
        batch.delete(docToDeleteRef);
        
        const checklistRef = doc(db, 'checklists', activeChecklist.id);
        batch.update(checklistRef, {
            documentIds: arrayRemove(documentId)
        });

        await batch.commit();
        toast({ title: "Success", description: `Document "${documentData.fileName}" deleted.` });
    } catch (error) {
        console.error("Error committing Firestore deletes:", error);
        toast({ title: "Database Error", description: "Failed to update database records.", variant: "destructive" });
    }
  }, [activeChecklist, toast]);

  const progress = useMemo(() => {
    if (!activeChecklist || activeChecklist.tasks.length === 0) return 0;
    const completedTasks = activeChecklist.tasks.filter(t => t.status === 'complete').length;
    return (completedTasks / activeChecklist.tasks.length) * 100;
  }, [activeChecklist]);

  const assignees = useMemo(() => {
    if (!activeChecklist) return [];
    return [...new Set(activeChecklist.tasks.map(t => t.assignee))];
  }, [activeChecklist]);

  useEffect(() => {
    const handleOpenTaskDialog = (event: Event) => {
      const customEvent = event as CustomEvent<Partial<Task>>;
      setDialogTask(customEvent.detail);
      setIsTaskDialogOpen(true);
    };

    const handleOpenRemarks = (event: Event) => {
      const customEvent = event as CustomEvent<Task>;
      setRemarksTask(customEvent.detail);
      setIsRemarksSheetOpen(true);
    };

    window.addEventListener('open-task-dialog', handleOpenTaskDialog);
    window.addEventListener('open-remarks', handleOpenRemarks);

    return () => {
      window.removeEventListener('open-task-dialog', handleOpenTaskDialog);
      window.removeEventListener('open-remarks', handleOpenRemarks);
    };
  }, []);

  const handleUpdateTask = useCallback((taskToUpdate: Task) => {
    if (!activeChecklist) return;
    const newTasks = activeChecklist.tasks.map(t => (t.id === taskToUpdate.id ? taskToUpdate : t));
    handleUpdateChecklist({ ...activeChecklist, tasks: newTasks });
  }, [activeChecklist, handleUpdateChecklist]);

  const handleSaveTask = useCallback((taskToSave: Omit<Task, 'remarks'>) => {
      if (!activeChecklist) return; // Guard against no active checklist
      const exists = activeChecklist.tasks.some(t => t.id === taskToSave.id);
      if (exists) {
        const existingTask = activeChecklist.tasks.find(t => t.id === taskToSave.id)!;
        const updatedTask = { ...existingTask, ...taskToSave };
        handleUpdateTask(updatedTask);
      } else {
        const newTask = {...taskToSave, remarks: []};
        const newTasks = [...activeChecklist.tasks, newTask];
        handleUpdateChecklist({ ...activeChecklist, tasks: newTasks });
      }
  },[activeChecklist, handleUpdateChecklist]);


  if (authError || authMethodDisabled) {
    return <FirebaseNotConfigured missingKeys={missingFirebaseConfigKeys} authMethodDisabled={authMethodDisabled} />;
  }
  
  if (firestorePermissionError) {
    return <FirestorePermissionDenied />;
  }

  if (firestoreError) {
    return <FirestoreNotConnected />;
  }

  if (!authInitialized || (isLoading && !activeChecklistId)) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen bg-background">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelectedForImport}
        accept=".md"
        className="hidden"
      />
      <ChecklistHeader
        checklists={checklistMetas}
        activeChecklistId={activeChecklistId}
        onSwitch={handleSwitchChecklist}
        onAdd={() => setIsNewChecklistDialogOpen(true)}
        onDelete={handleDeleteChecklist}
        onInitiateImport={handleInitiateImport}
        onExportMarkdown={handleExportMarkdown}
        onExportPdf={handleExportPdf}
        onGetAiSuggestions={fetchAiSuggestions}
        progress={progress}
        hasActiveChecklist={!!activeChecklist}
      />
      <main className="p-4 sm:p-6 lg:p-8">
        {activeChecklist ? (
          <>
            <DocumentManager 
              documents={documents}
              onUpload={handleUploadDocuments}
              onDelete={handleDeleteDocument}
              isUploading={isUploading}
              storageCorsError={storageCorsError}
            />
            <TaskTable
              checklist={activeChecklist}
              onUpdate={handleUpdateChecklist}
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-center h-[60vh]">
            <h2 className="text-xl font-semibold text-foreground">No Checklist Selected</h2>
            <p className="mt-2 text-muted-foreground">Create a new checklist or import one to get started.</p>
            <button
              onClick={() => setIsNewChecklistDialogOpen(true)}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Create Checklist
            </button>
          </div>
        )}
      </main>
      <div className="print-only hidden">
        {activeChecklist && <TaskTable checklist={activeChecklist} onUpdate={() => {}} />}
      </div>
      <NewChecklistDialog
        open={isNewChecklistDialogOpen}
        onOpenChange={setIsNewChecklistDialogOpen}
        onSave={(name) => handleSaveNewChecklist(name)}
      />
      <ImportConflictDialog
        open={!!importConflict}
        onOpenChange={(isOpen) => !isOpen && setImportConflict(null)}
        checklistName={importConflict?.name || ''}
        onOverwrite={() => {
          if (importConflict) {
            handleOverwriteChecklist(importConflict.conflictingId, importConflict.name, importConflict.tasks);
            setImportConflict(null);
          }
        }}
        onAppend={() => {
          if (importConflict) {
            handleAppendToChecklist(importConflict.conflictingId, importConflict.tasks);
            setImportConflict(null);
          }
        }}
      />
       <ChecklistAiSuggestionDialog
        open={isAiDialogOpen}
        onOpenChange={setIsAiDialogOpen}
        suggestions={aiAnalysisResult?.suggestions || []}
        informationRequests={aiAnalysisResult?.informationRequests || []}
        isLoading={isAiLoading}
        tasks={activeChecklist?.tasks || []}
        onAddSuggestion={handleAddSuggestionAsRemark}
        onRegenerate={fetchAiSuggestions}
        onProvideInfo={handleProvideInfo}
      />
      <TaskDialog
        task={dialogTask}
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        onSave={handleSaveTask}
      />
      <TaskRemarksSheet
        task={remarksTask}
        open={isRemarksSheetOpen}
        onOpenChange={setIsRemarksSheetOpen}
        onUpdateTask={handleUpdateTask}
        assignees={assignees}
        userId={userId || undefined}
      />
    </div>
  );
}
