

'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChecklistHeader } from '@/components/checklist-header';
import { TaskTable } from '@/components/task-table';
import type { Checklist, Task, TaskStatus, TaskPriority, Remark, Document, UserProfile, Invite, AppSettings, Notification } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import Loading from './loading';
import { isFirebaseConfigured, missingFirebaseConfigKeys, db, storage, auth, googleProvider } from '@/lib/firebase';
import { FirebaseNotConfigured } from '@/components/firebase-not-configured';
import { FirestoreNotConnected } from '@/components/firestore-not-connected';
import { FirestorePermissionDenied } from '@/components/firestore-permission-denied';
import { ref as storageRef, uploadBytes, deleteObject, getBytes } from 'firebase/storage';
import {
  collection,
  query,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  arrayUnion,
  arrayRemove,
  writeBatch,
  where,
  or,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { NewChecklistDialog } from '@/components/new-checklist-dialog';
import { ImportConflictDialog } from '@/components/import-conflict-dialog';
import { PRIORITIES, GEMINI_MODELS } from '@/lib/data';
import { ChecklistAiSuggestionDialog } from '@/components/checklist-ai-suggestion-dialog';
import type { SuggestChecklistNextStepsOutput, ChecklistSuggestion, InformationRequest, CapabilityWarning } from '@/ai/flows/suggest-checklist-next-steps';
import { suggestChecklistNextSteps } from '@/ai/flows/suggest-checklist-next-steps';
import { executeAiTodo } from '@/ai/flows/execute-ai-todo';
import { processUrl } from '@/ai/flows/process-url';
import { TaskDialog } from '@/components/task-dialog';
import { TaskRemarksSheet } from '@/components/task-remarks-sheet';
import { DocumentManager } from '@/components/document-manager';
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
import { ReportViewerDialog } from '@/components/report-viewer-dialog';
import { ChecklistPrintView } from '@/components/checklist-print-view';
import { ChecklistConfluenceView } from '@/components/checklist-confluence-view';
import { LoginScreen } from '@/components/login-screen';
import { ShareChecklistDialog } from '@/components/share-checklist-dialog';
import { SettingsDialog } from '@/components/settings-dialog';
import JSZip from 'jszip';


export default function Home() {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
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
  const confluenceExportRef = useRef<HTMLDivElement>(null);
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
  const [runningRemarkIds, setRunningRemarkIds] = useState<string[]>([]);
  const [checklistToDelete, setChecklistToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isReportViewerOpen, setIsReportViewerOpen] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    apiKey: '',
    model: GEMINI_MODELS[0],
    rerunTimeout: 5,
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [executionQueue, setExecutionQueue] = useState<{taskId: string, remarkId: string}[]>([]);


  // Load settings from localStorage on initial render
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('super-pa-settings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        // Ensure rerunTimeout has a default value if it's missing
        if (typeof parsedSettings.rerunTimeout !== 'number') {
          parsedSettings.rerunTimeout = 5;
        }
        setSettings(parsedSettings);
      }
    } catch (error) {
      console.error("Could not load settings from localStorage", error);
    }
  }, []);

  const handleSaveSettings = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('super-pa-settings', JSON.stringify(newSettings));
      toast({
        title: "Settings Saved",
        description: "Your new AI settings have been saved locally.",
      });
    } catch (error) {
       console.error("Could not save settings to localStorage", error);
       toast({
        title: "Error Saving Settings",
        description: "Your settings could not be saved to your browser's local storage.",
        variant: "destructive",
      });
    }
    setIsSettingsDialogOpen(false);
  }, [toast]);

  const isOwner = useMemo(() => {
    if (!user || !activeChecklist) return false;
    return activeChecklist.ownerId === user.uid;
  }, [user, activeChecklist]);

  // If Firebase is not configured statically, show guidance.
  if (!isFirebaseConfigured) {
    return <FirebaseNotConfigured missingKeys={missingFirebaseConfigKeys} />;
  }
  
  const handleSignIn = async () => {
    if (!auth || !googleProvider) return;
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Google sign-in failed:", error);
      if (error.code === 'auth/popup-closed-by-user') return;
      if (error.code === 'auth/unauthorized-domain') {
          setAuthMethodDisabled(true); // Triggers the specific error screen
          return;
      }
      toast({
        title: "Sign-in Failed",
        description: "Could not sign in with Google. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    await signOut(auth);
  };
  
  // Effect to handle auth state changes and user profile management
  useEffect(() => {
    if (!auth || !db) {
        setAuthError(true);
        setAuthInitialized(true);
        return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          // Create new user profile
          const newUserProfile: UserProfile = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
          };
          await setDoc(userRef, newUserProfile);
          setUserProfile(newUserProfile);
        } else {
          setUserProfile(userSnap.data() as UserProfile);
        }
        
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setAuthInitialized(true);
    }, (error) => {
        console.error("Auth state listener error:", error);
        setAuthError(true);
        setAuthInitialized(true);
    });

    return () => unsubscribe();
  }, [toast]);
  
  // Effect to handle incoming invites from URL
  useEffect(() => {
      if (!user || !user.email || !db) return;

      const handleInvite = async () => {
          const params = new URLSearchParams(window.location.search);
          const inviteId = params.get('invite');

          if (inviteId) {
              const inviteRef = doc(db, 'invites', inviteId);
              try {
                  const inviteSnap = await getDoc(inviteRef);
                  if (inviteSnap.exists()) {
                      const inviteData = inviteSnap.data() as Invite;
                      
                      // Verify the invite is for the current user
                      if (inviteData.email !== user.email) {
                          toast({
                              title: "Invitation Mismatch",
                              description: "This invitation is intended for a different user.",
                              variant: "destructive",
                          });
                          return;
                      }

                      const checklistRef = doc(db, 'checklists', inviteData.checklistId);

                      // Add user to collaborators and delete invite in one transaction
                      const batch = writeBatch(db);
                      batch.update(checklistRef, {
                          collaboratorIds: arrayUnion(user.uid)
                      });
                      batch.delete(inviteRef);
                      await batch.commit();

                      toast({
                          title: "Invitation Accepted!",
                          description: `You can now collaborate on the "${inviteData.checklistName}" checklist.`,
                      });
                  } else {
                      toast({
                          title: "Invalid Invitation",
                          description: "This invitation link is either invalid or has expired.",
                          variant: "destructive",
                      });
                  }
              } catch (error) {
                  console.error("Error handling invite:", error);
                  toast({
                      title: "Error",
                      description: "Could not process the invitation.",
                      variant: "destructive",
                  });
              } finally {
                  // Clean URL
                  const newUrl = window.location.pathname;
                  window.history.replaceState({}, document.title, newUrl);
              }
          }
      };
      
      handleInvite();
  }, [user, toast]);

  // Effect to fetch the list of checklist names and IDs for the current user (owned or collaborated)
  useEffect(() => {
    if (!authInitialized || !user || !db) {
      if(authInitialized) setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setFirestoreError(false); // Reset on each attempt
    setFirestorePermissionError(false); // Reset on each attempt

    const q = query(
        collection(db, 'checklists'), 
        or(
            where('ownerId', '==', user.uid),
            where('collaboratorIds', 'array-contains', user.uid)
        )
    );
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
  }, [toast, authInitialized, user]);

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

  // Effect to subscribe to the currently active checklist for real-time updates and cleanup stale tasks
  useEffect(() => {
    if (!activeChecklistId || !db) {
      setActiveChecklist(null);
      setDocuments([]);
      setUsers([]);
      if (authInitialized) setIsLoading(false); // Stop loading if there's no checklist to load
      return;
    }

    setIsLoading(true);
    const unsubscribe = onSnapshot(doc(db, 'checklists', activeChecklistId), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const newChecklist = { id: docSnapshot.id, ...docSnapshot.data() } as Checklist;
        
        // Check for stale running tasks
        let wasModified = false;
        const now = new Date().getTime();
        const thirtyMinutesAgo = now - (30 * 60 * 1000);
        
        const cleanedTasks = newChecklist.tasks.map(task => {
          let taskModified = false;
          const cleanedRemarks = task.remarks.map(remark => {
            if (remark.text.startsWith('[ai-todo|running]')) {
              const remarkTime = new Date(remark.timestamp).getTime();
              if (remarkTime < thirtyMinutesAgo) {
                taskModified = true;
                wasModified = true;
                return { ...remark, text: remark.text.replace('[ai-todo|running]', '[ai-todo|pending]') };
              }
            }
            return remark;
          });

          if (taskModified) {
            const systemRemark: Remark = {
              id: `rem_reset_${Date.now()}_${Math.random()}`,
              text: 'AI to-do was stuck in a running state and has been reset automatically.',
              userId: 'system',
              timestamp: new Date().toISOString(),
            };
            return { ...task, remarks: [...cleanedRemarks, systemRemark] };
          }
          return task;
        });

        if (wasModified) {
          console.log("Detected and reset stale running AI to-dos.");
          handleUpdateChecklist({ id: newChecklist.id, tasks: cleanedTasks });
          // The snapshot listener will fire again with the updated data, so we don't set state here.
        } else {
          setActiveChecklist(newChecklist);
        }

      } else {
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
  }, [activeChecklistId, toast, authInitialized, handleUpdateChecklist]);

    // Effect to detect new reports and create notifications using localStorage
    useEffect(() => {
      if (!activeChecklist || !user) {
        setNotifications([]);
        return;
      };

      const lastReadTimestampStr = localStorage.getItem(`super-pa-last-read-${user.uid}-${activeChecklist.id}`);
      const lastReadTimestamp = lastReadTimestampStr ? new Date(lastReadTimestampStr) : new Date(0);
      
      const newNotifications: Notification[] = [];

      activeChecklist.tasks.forEach(task => {
        task.remarks.forEach(remark => {
          const remarkTimestamp = new Date(remark.timestamp);
          if (remark.userId === 'ai_executor' && remarkTimestamp > lastReadTimestamp) {
            newNotifications.push({
              id: `notif_${remark.id}`,
              taskId: task.id,
              remarkId: remark.id,
              taskDescription: task.description,
              timestamp: remark.timestamp,
              read: false,
            });
          }
        });
      });
  
      if (newNotifications.length > 0) {
        setNotifications(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const trulyNew = newNotifications.filter(n => !existingIds.has(n.id));
          return [...prev, ...trulyNew];
        });
      }
    }, [activeChecklist, user]);

    const handleNotificationsOpen = useCallback(() => {
      if (!user || !activeChecklistId) return;
      const now = new Date().toISOString();
      localStorage.setItem(`super-pa-last-read-${user.uid}-${activeChecklistId}`, now);
  }, [user, activeChecklistId]);
  
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

  // Effect to fetch collaborator profiles
  useEffect(() => {
    if (!activeChecklist || (!activeChecklist.collaboratorIds && !activeChecklist.ownerId) || !db) {
        setUsers([]);
        return;
    }
    const allUserIds = [activeChecklist.ownerId, ...(activeChecklist.collaboratorIds || [])];
    const uniqueUserIds = [...new Set(allUserIds)].filter(id => !!id);
    
    if (uniqueUserIds.length === 0) {
        setUsers([]);
        return;
    }

    const q = query(collection(db, 'users'), where('uid', 'in', uniqueUserIds));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const fetchedUsers = querySnapshot.docs.map(d => d.data() as UserProfile);
        setUsers(fetchedUsers);
    }, (error) => {
        console.error("Error fetching user profiles:", error);
        toast({ title: "Error", description: "Could not load collaborator profiles.", variant: "destructive" });
    });

    return () => unsubscribe();
  }, [activeChecklist, toast]);
  
  const handleViewContent = useCallback(async (docToView: Document) => {
    if (!storage) return;

    setIsReportLoading(true);
    setIsReportViewerOpen(true);
    setReportContent(''); // Clear previous content

    try {
      const fileRef = storageRef(storage, docToView.storagePath);
      const fileBytes = await getBytes(fileRef);
      const decoder = new TextDecoder('utf-8');
      const markdownContent = decoder.decode(fileBytes);
      setReportContent(markdownContent);
    } catch (error: any) {
      console.error("Error fetching content:", error);
      let description = "Could not load the content from storage.";
      if (error.code === 'storage/object-not-found') {
        description = "The file was not found. It may have been deleted.";
      } else if (error.code === 'storage/unauthorized') {
        description = "You do not have permission to view this file. Check your Storage Security Rules.";
      }
      toast({
        title: "Error Loading Content",
        description,
        variant: "destructive"
      });
      setIsReportViewerOpen(false); // Close dialog on error
    } finally {
      setIsReportLoading(false);
    }
  }, [storage, toast]);

  // Effect to handle viewing a report
  useEffect(() => {
    const handleViewReport = async (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      const storagePath = customEvent.detail;
      // This is a bit of a hack. We don't have the full Document object here,
      // so we create a partial one. This is sufficient for handleViewContent.
      await handleViewContent({ storagePath } as Document);
    };

    window.addEventListener('view-report', handleViewReport);
    return () => {
      window.removeEventListener('view-report', handleViewReport);
    };
  }, [handleViewContent]);
  
  const handleAiError = (error: any, toastId?: string) => {
    console.error("AI execution failed:", error);
    let title = "AI Error";
    let description = "The AI could not complete the task. See the console for details.";

    const errorMessage = error.message || '';
    if (errorMessage.includes('503') || errorMessage.toLowerCase().includes('overloaded')) {
        title = "AI Model Overloaded";
        description = "The AI model is currently experiencing high demand. Please try again in a few moments.";
    } else if (errorMessage.toLowerCase().includes('api key not valid')) {
        title = "Invalid API Key";
        description = "Your Gemini API key is not valid. Please check your AI Settings.";
    }

    if (toastId) {
        toast.update(toastId, { title, description, variant: "destructive" });
    } else {
        toast({ title, description, variant: "destructive" });
    }
  };

  const findChecklistByName = useCallback(async (name: string): Promise<{ id: string; name: string } | null> => {
    if (!db || !user) return null;
    
    const checklistsQuery = query(collection(db, 'checklists'), where('ownerId', '==', user.uid));
    const querySnapshot = await getDocs(checklistsQuery);
    
    if (querySnapshot.empty) {
        return null;
    }

    const normalizedNameToFind = name.trim().toLowerCase();

    for (const doc of querySnapshot.docs) {
        const checklistData = doc.data();
        const checklistName = checklistData.name as string | undefined;
        if (checklistName && checklistName.trim().toLowerCase() === normalizedNameToFind) {
            return { id: doc.id, name: checklistName };
        }
    }

    return null;
  }, [user]);

  const handleSaveNewChecklist = useCallback(async (name: string, tasks: Task[] = []) => {
    if (!name || !user) return;

    // Final safeguard check before writing to the database.
    const existingChecklist = await findChecklistByName(name);
    if (existingChecklist) {
        console.error(`Safeguard triggered: Prevented duplicate creation of checklist "${name}".`);
        toast({ title: "Import Error", description: `A checklist named "${name}" already exists. The operation was aborted to prevent duplicates.`, variant: "destructive" });
        return;
    }

    try {
        const newChecklist: Omit<Checklist, 'id'> = {
            name: name,
            tasks: tasks,
            ownerId: user.uid,
            collaboratorIds: [],
            documentIds: [],
        };
        const docRef = await addDoc(collection(db!, 'checklists'), newChecklist);
        setActiveChecklistId(docRef.id);
        toast({ title: "Success", description: `Checklist "${name}" created.` });
    } catch (error) {
        console.error("Error adding checklist: ", error);
        toast({ title: "Error", description: "Failed to create checklist.", variant: "destructive" });
    }
  }, [toast, user, findChecklistByName]);
  
  const handleSwitchChecklist = useCallback((id: string) => {
    setActiveChecklistId(id);
    setNotifications([]);
  }, []);

  const handleRequestDeleteChecklist = (id: string) => {
    const checklistMeta = checklistMetas.find(c => c.id === id);
    if (checklistMeta) {
      setChecklistToDelete(checklistMeta);
    }
  };

  const handleDeleteChecklist = useCallback(async (id: string) => {
    if (!db || !storage) {
        toast({ title: "Error", description: "Database or storage not initialized.", variant: "destructive" });
        return;
    }
    const deleteToast = toast({ title: "Deleting checklist..." });

    try {
        const checklistRef = doc(db, 'checklists', id);
        const checklistSnap = await getDoc(checklistRef);

        if (!checklistSnap.exists()) {
            throw new Error("Checklist not found.");
        }

        const checklistData = checklistSnap.data() as Checklist;
        const documentIds = checklistData.documentIds || [];

        const batch = writeBatch(db);

        // Delete all associated documents from Storage and their Firestore records
        if (documentIds.length > 0) {
            const docPromises = documentIds.map(async (docId) => {
                const docRef = doc(db, 'documents', docId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const docData = docSnap.data() as Document;
                    // Delete file from Storage
                    const fileRef = storageRef(storage, docData.storagePath);
                    await deleteObject(fileRef).catch(err => {
                        // Ignore if file is already deleted, but throw other errors
                        if (err.code !== 'storage/object-not-found') throw err;
                    });
                    // Delete Firestore document record in the batch
                    batch.delete(docRef);
                }
            });
            await Promise.all(docPromises);
        }

        // Delete the checklist itself
        batch.delete(checklistRef);
        await batch.commit();
        
        // If the deleted checklist was the active one, immediately update the state
        // to make the UI feel instantaneous and prevent issues with stale state.
        if (activeChecklistId === id) {
          const remainingChecklists = checklistMetas.filter(c => c.id !== id);
          const newActiveId = remainingChecklists.length > 0 ? remainingChecklists[0].id : null;
          setActiveChecklistId(newActiveId);
        }

        deleteToast.update({ id: deleteToast.id, title: "Success", description: `Checklist "${checklistData.name}" deleted.` });
    } catch (error: any) {
        console.error("Error deleting checklist:", error);
        deleteToast.update({ id: deleteToast.id, title: "Error", description: error.message || "Failed to delete checklist.", variant: "destructive" });
    } finally {
        setChecklistToDelete(null); // Close the dialog
    }
  }, [db, storage, toast, activeChecklistId, checklistMetas]);
  
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
            
            const existingTaskDescriptions = new Set(existingChecklist.tasks.map(t => t.description.trim().toLowerCase()));
            const tasksToAppend = tasks.filter(t => !existingTaskDescriptions.has(t.description.trim().toLowerCase()));

            if (tasksToAppend.length > 0) {
              const updatedTasks = [...existingChecklist.tasks, ...tasksToAppend];
              await handleUpdateChecklist({ id: checklistId, tasks: updatedTasks });
              toast({ title: "Import Successful", description: `${tasksToAppend.length} new task(s) appended to "${existingChecklist.name}".`});
            } else {
              toast({ title: "No new tasks found", description: `All tasks from the file already exist in "${existingChecklist.name}".`});
            }
        }
    } catch (error) {
        console.error("Error appending to checklist:", error);
        toast({ title: "Error", description: "Failed to append tasks to the checklist.", variant: "destructive" });
    }
  }, [db, handleUpdateChecklist, toast]);

  const handleFileSelectedForImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!importMode || !user || !db) return;

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
            if (!fullRemarkText) continue;

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
            const existingChecklist = await findChecklistByName(newChecklistName);

            if (existingChecklist) {
              setImportConflict({ conflictingId: existingChecklist.id, name: newChecklistName, tasks: newTasks });
            } else {
              await handleSaveNewChecklist(newChecklistName, newTasks);
            }

        } else if (importMode === 'current') {
            if (!activeChecklist) {
              toast({ title: "Import failed", description: "No active checklist to import into.", variant: "destructive" });
              return;
            }
            if (newTasks.length > 0) {
              await handleAppendToChecklist(activeChecklist.id, newTasks);
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
  
  const generateMarkdownContent = useCallback((checklist: Checklist): string => {
    const checklistTitle = `# ${checklist.name}\n\n`;

    const formatTaskToMarkdown = (task: Task) => {
      const status = task.status === 'complete' ? 'x' : ' ';
      const taskDetails = `(Priority: ${task.priority}, Due: ${task.dueDate})`;
      const assigneePart = ` - *Assignee: [${task.assignee || 'Unassigned'}]*`;
      const taskLine = `- [${status}] **${task.description}** ${taskDetails}${assigneePart}`;
      
      const remarksLines = task.remarks.map(r => {
        const remarkDate = new Date(r.timestamp);
        const dateString = remarkDate.toISOString().split('T')[0].replace(/-/g, '');
        return `  - > #${dateString} ${r.text} (by ${r.userId})`;
      }).join('\n');
      
      return `${taskLine}${remarksLines ? `\n${remarksLines}` : ''}`;
    };

    const incompleteTasks = checklist.tasks.filter(t => t.status !== 'complete');
    const completedTasks = checklist.tasks.filter(t => t.status === 'complete');
    
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

    if (markdownContent.trim() === '') {
        markdownContent = 'This checklist has no tasks.';
    }

    return checklistTitle + markdownContent.trim() + '\n';
  }, []);

  const handleExportMarkdown = () => {
    if (!activeChecklist) return;

    const fullContent = generateMarkdownContent(activeChecklist);
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

  const handleExportConfluence = () => {
    if (!confluenceExportRef.current) return;
    
    const htmlContent = confluenceExportRef.current.innerHTML;
    // Use the Clipboard API to write the HTML content.
    // We use a Blob with 'text/html' type to give a hint to the clipboard.
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const clipboardItem = new ClipboardItem({ 'text/html': blob });

    navigator.clipboard.write([clipboardItem]).then(() => {
        toast({
            title: "Copied to clipboard!",
            description: "You can now paste the table into your Confluence page.",
        });
    }, (err) => {
        console.error('Could not copy HTML to clipboard: ', err);
        toast({
            title: "Copy Failed",
            description: "Could not copy table to clipboard. Your browser might not support this feature.",
            variant: 'destructive',
        });
    });
  };

  const handleExportZip = useCallback(async () => {
    if (!activeChecklist || !storage) {
        toast({ title: 'Error', description: 'No active checklist to export.', variant: 'destructive' });
        return;
    }
    const exportToast = toast({ title: 'Preparing download...', description: 'Gathering reports and creating zip file.' });
    
    try {
        const zip = new JSZip();
        
        // 1. Add checklist markdown to root
        const markdownContent = generateMarkdownContent(activeChecklist);
        zip.file(`${activeChecklist.name.replace(/\s+/g, '_')}.md`, markdownContent);

        // 2. Find all report links and fetch them
        const reportPromises: Promise<void>[] = [];
        const storageLinkRegex = /\[View results\]\(storage:\/\/([^)]+)\)/;

        activeChecklist.tasks.forEach((task, taskIndex) => {
            const safeTaskName = task.description.replace(/[^\w\s-]/g, '').trim().substring(0, 50) || `task-${taskIndex + 1}`;
            let reportCounter = 1;

            task.remarks.forEach(remark => {
                const match = remark.text.match(storageLinkRegex);
                if (match) {
                    const storagePath = match[1];
                    const reportPromise = getBytes(storageRef(storage, storagePath))
                        .then(reportBytes => {
                            const reportContent = new TextDecoder('utf-8').decode(reportBytes);
                            zip.file(`${safeTaskName}/report-${reportCounter}.md`, reportContent);
                            reportCounter++;
                        })
                        .catch(error => {
                            console.error(`Failed to fetch report: ${storagePath}`, error);
                            // Add a failure note in the zip instead of failing the whole export
                            zip.file(`${safeTaskName}/FAILED_TO_FETCH_REPORT_${reportCounter}.txt`, `Could not fetch report from ${storagePath}.\nError: ${error.message}`);
                        });
                    reportPromises.push(reportPromise);
                }
            });
        });

        await Promise.all(reportPromises);
        
        // 3. Generate and download zip
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeChecklist.name.replace(/\s+/g, '_')}_export.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        exportToast.update({ id: exportToast.id, title: 'Export Complete', description: 'Your checklist and reports have been downloaded.' });

    } catch (error) {
        console.error('Failed to create zip file', error);
        exportToast.update({ id: exportToast.id, title: 'Export Failed', description: 'Could not create the zip file.', variant: 'destructive' });
    }
  }, [activeChecklist, storage, toast, generateMarkdownContent]);
  
  const fileToDataUri = useCallback((file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read file as data URI.'));
        }
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }, []);

  const getContextDocumentsForAi = useCallback(async (): Promise<{ fileName: string; fileDataUri: string; }[]> => {
    if (!storage) return [];

    const documentPromises = documents.map(async (doc) => {
      try {
        const fileRef = storageRef(storage, doc.storagePath);
        const fileBytes = await getBytes(fileRef);

        if (fileBytes.byteLength === 0) {
          console.warn(`Skipping empty document for AI context: ${doc.fileName}`);
          return null;
        }
        
        const safeMimeType = doc.mimeType === 'application/octet-stream' ? 'text/plain' : doc.mimeType || 'text/plain';
        const blob = new Blob([fileBytes], { type: safeMimeType });
        const dataUri = await fileToDataUri(blob);
        
        return {
          fileName: doc.fileName,
          fileDataUri: dataUri,
        };
      } catch (error) {
        console.error(`Failed to load document ${doc.fileName} for AI context:`, error);
        toast({
          title: "Context file error",
          description: `Could not load ${doc.fileName}. It might be missing from storage.`,
          variant: "destructive",
        })
        return null;
      }
    });

    const settledDocuments = await Promise.all(documentPromises);
    return settledDocuments.filter((d): d is { fileName: string; fileDataUri: string; } => d !== null);
  }, [documents, storage, fileToDataUri, toast]);
  
  const fetchAiSuggestions = useCallback(async () => {
    if (!activeChecklist || !db) return;
    
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
        discussionHistory: task.remarks.map(r => r.text).join('\n---\n')
      }));
      
      const contextDocuments = await getContextDocumentsForAi();

      const result = await suggestChecklistNextSteps({ 
        tasks: tasksToAnalyze,
        contextDocuments: contextDocuments.length > 0 ? contextDocuments : undefined,
        apiKey: settings.apiKey,
        model: settings.model as any,
      });

      setAiAnalysisResult(result);

      if (!result.suggestions?.length && !result.informationRequests?.length && !result.capabilityWarnings?.length) {
        toast({
            title: "No new suggestions found",
            description: "The AI couldn't find any new automatable tasks or issues.",
        });
      }
    } catch (error) {
      handleAiError(error);
      setAiAnalysisResult(null); 
    } finally {
      setIsAiLoading(false);
    }
  }, [activeChecklist, getContextDocumentsForAi, toast, db, settings]);

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
    
    handleUpdateChecklist({ id: activeChecklist.id, tasks: updatedTasks });

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

  const handleAddWarningAsRemark = useCallback((warningToAdd: CapabilityWarning) => {
    if (!activeChecklist) return;
    const targetTask = activeChecklist.tasks.find(t => t.id === warningToAdd.taskId);
    if (!targetTask) return;
    
    const newRemark: Remark = {
        id: `rem_${Date.now()}_${Math.random()}`,
        text: `Capability Warning: ${warningToAdd.warning}`,
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
    
    handleUpdateChecklist({ id: activeChecklist.id, tasks: updatedTasks });

    setAiAnalysisResult(currentResult => {
      if (!currentResult) return null;
      return {
          ...currentResult,
          capabilityWarnings: (currentResult.capabilityWarnings || []).filter(w => !(w.warning === warningToAdd.warning && w.taskId === warningToAdd.taskId))
      };
    });
    
    toast({
        title: "Warning Saved",
        description: "The capability warning has been saved as a remark.",
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

  const enqueueAiTodo = useCallback(async (task: Task, remark: Remark) => {
    if (!activeChecklist || !db) return;

    // Update the remark status to 'queued' in Firestore
    const statusUpdateRegex = /\[ai-todo\|(pending|running|completed|failed|queued)\]/;
    const updatedRemarks = task.remarks.map(r => 
      r.id === remark.id 
          ? { ...r, text: r.text.replace(statusUpdateRegex, '[ai-todo|queued]'), timestamp: new Date().toISOString() } 
          : r
    );
    const updatedTask = { ...task, remarks: updatedRemarks };
    const updatedTasks = activeChecklist.tasks.map(t => (t.id === task.id ? updatedTask : t));

    await handleUpdateChecklist({ id: activeChecklist.id, tasks: updatedTasks });

    // Add to the client-side queue
    setExecutionQueue(prev => [...prev, { taskId: task.id, remarkId: remark.id }]);
    toast({ title: "AI To-Do Queued", description: "Your request has been added to the queue." });

  }, [activeChecklist, db, handleUpdateChecklist, toast]);

  // Effect to process the execution queue
  useEffect(() => {
    const processQueue = async () => {
        if (executionQueue.length > 0 && runningRemarkIds.length === 0 && activeChecklist && db && storage) {
            const { taskId, remarkId } = executionQueue[0];
            
            // Find the task and remark from the current checklist state
            const task = activeChecklist.tasks.find(t => t.id === taskId);
            const remark = task?.remarks.find(r => r.id === remarkId);
            
            if (!task || !remark) {
                console.warn(`Task or remark not found for queue item, skipping. TaskID: ${taskId}, RemarkID: ${remarkId}`);
                setExecutionQueue(prev => prev.slice(1)); // Dequeue the invalid item
                return;
            }

            setExecutionQueue(prev => prev.slice(1)); // Dequeue
            
            // Now, execute the AI to-do
            const executionToast = toast({ title: "AI Execution Started", description: "The AI is now working on your to-do." });
            setRunningRemarkIds(prev => [...prev, remark.id]);
    
            const statusUpdateRegex = /\[ai-todo\|(pending|running|completed|failed|queued)\]/;

            // Update status to 'running'
            const tasksWithRunning = activeChecklist.tasks.map(t => {
              if (t.id !== task.id) return t;
              return {
                ...t,
                remarks: t.remarks.map(r => 
                  r.id === remark.id 
                      ? { ...r, text: r.text.replace(statusUpdateRegex, '[ai-todo|running]'), timestamp: new Date().toISOString() } 
                      : r
                )
              };
            });
            await updateDoc(doc(db, 'checklists', activeChecklist.id), { tasks: tasksWithRunning });

            try {
                const taskForAi = tasksWithRunning.find(t => t.id === task.id)!;
                const aiTodoText = remark.text.replace(statusUpdateRegex, '').trim();
                const contextDocuments = await getContextDocumentsForAi();
                
                const result = await executeAiTodo({
                    aiTodoText,
                    taskDescription: taskForAi.description,
                    discussionHistory: taskForAi.remarks.map(r => r.text).join('\n---\n'),
                    contextDocuments: contextDocuments.length > 0 ? contextDocuments : undefined,
                    apiKey: settings.apiKey,
                    model: settings.model as any,
                    maxOutputTokens: settings.maxOutputTokens,
                });

                const markdownBlob = new Blob([result.resultMarkdown], { type: 'text/markdown;charset=utf-8' });
                const resultFileName = `execution_result_${remark.id}.md`;
                const resultPath = `checklists/${activeChecklist.id}/executions/${resultFileName}`;
                const resultRef = storageRef(storage, resultPath);
                await uploadBytes(resultRef, markdownBlob);

                const resultRemark: Remark = {
                    id: `rem_res_${Date.now()}`,
                    text: `AI execution complete. [View results](storage://${resultPath})\n\n**Summary:**\n${result.summary}`,
                    userId: 'ai_executor',
                    timestamp: new Date().toISOString(),
                    parentId: remark.id, // Nest the result under the original to-do
                };
                
                // Update remark to 'completed' and add result remark
                const finalTasks = tasksWithRunning.map(t => {
                    if (t.id !== task.id) return t;
                    const updatedRemarks = t.remarks.map(r => 
                        r.id === remark.id 
                        ? { ...r, text: r.text.replace(statusUpdateRegex, '[ai-todo|completed]') } 
                        : r
                    );
                    return { ...t, remarks: [...updatedRemarks, resultRemark] };
                });
                await updateDoc(doc(db, 'checklists', activeChecklist.id), { tasks: finalTasks });

                executionToast.update({ id: executionToast.id, title: "Execution Complete", description: "AI has finished the task and posted the results." });
            } catch (error: any) {
                handleAiError(error, executionToast.id);
                
                // Update remark to 'failed' and add error remark
                const tasksWithFailed = tasksWithRunning.map(t => {
                    if (t.id !== task.id) return t;
                    const failureReasonRemark: Remark = {
                        id: `rem_fail_${Date.now()}`,
                        text: `AI execution failed. Error: ${error.message || 'An unknown error occurred.'}`,
                        userId: 'system',
                        timestamp: new Date().toISOString(),
                        parentId: remark.id, // Nest the failure under the original to-do
                    };
                    const updatedRemarks = t.remarks.map(r => r.id === remark.id ? { ...r, text: r.text.replace(statusUpdateRegex, '[ai-todo|failed]') } : r);
                    return { ...t, remarks: [...updatedRemarks, failureReasonRemark] };
                });
                await updateDoc(doc(db, 'checklists', activeChecklist.id), { tasks: tasksWithFailed });
            } finally {
                setRunningRemarkIds(prev => prev.filter(id => id !== remark.id));
            }
        }
    };
    processQueue();
  }, [executionQueue, runningRemarkIds, activeChecklist, db, storage, getContextDocumentsForAi, handleAiError, toast, settings]);

  const handleRunRefinedPrompt = useCallback(async (taskToUpdate: Task, parentRemark: Remark) => {
    if (!activeChecklist || !db || !user) {
        toast({ title: "Error", description: "Cannot run prompt: context is missing.", variant: "destructive" });
        return;
    }

    const topicMatch = parentRemark.text.match(/\*\*Summary:\*\*\nGenerated a refined prompt for: (.*)/s);
    if (!topicMatch) {
        toast({ title: "Error", description: "Could not extract topic from parent remark.", variant: "destructive" });
        return;
    }
    const topic = topicMatch[1].trim();
    
    // Find the original `[ai-todo]` remark that this result belongs to.
    const originalTodoRemark = taskToUpdate.remarks.find(r => r.id === parentRemark.parentId);
    if (!originalTodoRemark) {
        toast({ title: "Error", description: "Could not find the original AI to-do for this action.", variant: "destructive" });
        return;
    }
    
    const childRemark: Remark = {
        id: `rem_child_${Date.now()}_${Math.random()}`,
        parentId: originalTodoRemark.id, // Nest under the original `[ai-todo]`
        text: `[prompt-execution|pending] Execute the refined prompt to ${topic}`,
        userId: user.uid,
        timestamp: new Date().toISOString(),
    };
    
    setRunningRemarkIds(prev => [...prev, childRemark.id]);
    const executionToast = toast({ title: "Prompt Execution Started", description: "The AI is now executing the refined prompt." });
    
    const tasksWithChild = activeChecklist.tasks.map(t => {
      if (t.id === taskToUpdate.id) {
        const remarksWithChild = [...t.remarks, childRemark];
        return { ...t, remarks: remarksWithChild };
      }
      return t;
    });
    
    const tasksWithRunning = tasksWithChild.map(t => {
        if (t.id === taskToUpdate.id) {
            const updatedRemarks = t.remarks.map(r => r.id === childRemark.id ? {...r, text: r.text.replace('[prompt-execution|pending]', '[prompt-execution|running]')} : r);
            return {...t, remarks: updatedRemarks };
        }
        return t;
    });

    try {
        const checklistDocRef = doc(db, 'checklists', activeChecklist.id);
        await updateDoc(checklistDocRef, { tasks: tasksWithRunning });
        
        const taskForExecution = tasksWithRunning.find(t => t.id === taskToUpdate.id)!;
        
        const refinedPromptResult = await executeAiTodo({
            aiTodoText: `Execute the refined prompt to ${topic}`,
            taskDescription: taskForExecution.description,
            discussionHistory: taskForExecution.remarks.map(r => r.text).join('\n---\n'),
            contextDocuments: await getContextDocumentsForAi(),
            apiKey: settings.apiKey,
            model: settings.model as any,
        });
        
        const markdownBlob = new Blob([refinedPromptResult.resultMarkdown], { type: 'text/markdown;charset=utf-8' });
        const resultFileName = `execution_result_${childRemark.id}.md`;
        const resultPath = `checklists/${activeChecklist.id}/executions/${resultFileName}`;
        const resultRef = storageRef(storage!, resultPath);
        await uploadBytes(resultRef, markdownBlob);

        const resultRemarkText = `[prompt-execution|completed] ${refinedPromptResult.summary} [View results](storage://${resultPath})`;

        const finalTasks = tasksWithRunning.map(t => {
            if (t.id !== taskToUpdate.id) return t;
            const updatedRemarks = t.remarks.map(r => r.id === childRemark.id ? {...r, text: resultRemarkText } : r);
            return {...t, remarks: updatedRemarks };
        });
        
        await updateDoc(checklistDocRef, { tasks: finalTasks });
        executionToast.update({ id: executionToast.id, title: "Execution Complete", description: "Refined prompt has been executed." });

    } catch (error: any) {
        handleAiError(error, executionToast.id);
        
        const tasksWithFailed = tasksWithRunning.map(t => {
            if (t.id !== taskToUpdate.id) return t;
            const updatedRemarks = t.remarks.map(r => 
                r.id === childRemark.id 
                ? { ...r, text: `[prompt-execution|failed] Error: ${error.message || 'An unknown error occurred.'}` }
                : r
            );
            return { ...t, remarks: updatedRemarks };
        });
        
        try {
            const checklistDocRef = doc(db!, 'checklists', activeChecklist.id);
            await updateDoc(checklistDocRef, { tasks: tasksWithFailed });
        } catch (revertError) {
             console.error("CRITICAL: Failed to revert prompt execution status after an execution error.", revertError);
        }
    } finally {
        setRunningRemarkIds(prev => prev.filter(id => id !== childRemark.id));
    }
  }, [activeChecklist, db, user, storage, getContextDocumentsForAi, toast, handleAiError, settings]);


  const handleUploadDocuments = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
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
            
            let mimeType = file.type;
            if (!mimeType || mimeType === 'application/octet-stream') {
                if (file.name.endsWith('.md')) {
                    mimeType = 'text/markdown';
                } else {
                    mimeType = 'text/plain'; 
                }
            }

            batch.set(newDocRef, {
                checklistId: activeChecklist.id,
                fileName: file.name,
                storagePath: path,
                createdAt: new Date().toISOString(),
                mimeType: mimeType,
                status: 'complete',
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
  }, [activeChecklist, toast, db, storage, auth]);

  const handleAddUrl = useCallback(async (url: string) => {
    if (!activeChecklist || !db || !storage) {
      toast({ title: "Error", description: "Cannot add URL: checklist or services not ready.", variant: "destructive" });
      return;
    }

    let urlObj;
    try {
      urlObj = new URL(url);
    } catch (e) {
      toast({ title: "Invalid URL", description: "Please enter a valid URL.", variant: "destructive" });
      return;
    }

    const docId = `doc_url_${Date.now()}`;
    const fileName = `Analysis of ${urlObj.hostname}.md`;
    const newDocRef = doc(db, 'documents', docId);
    const checklistRef = doc(db, 'checklists', activeChecklist.id);
    
    // Create initial document record in "processing" state
    const newDocData: Omit<Document, 'id'> = {
      checklistId: activeChecklist.id,
      fileName: fileName,
      storagePath: '', // Will be filled in after processing
      createdAt: new Date().toISOString(),
      mimeType: 'text/markdown',
      sourceUrl: url,
      status: 'processing',
    };
    
    const batch = writeBatch(db);
    batch.set(newDocRef, newDocData);
    batch.update(checklistRef, { documentIds: arrayUnion(docId) });
    await batch.commit();

    toast({ title: "Processing URL", description: "The AI is now analyzing the URL content." });

    // Asynchronously call the AI flow
    try {
      const result = await processUrl({ 
        url,
        apiKey: settings.apiKey,
        model: settings.model as any,
        maxOutputTokens: settings.maxOutputTokens,
      });

      const markdownBlob = new Blob([result.resultMarkdown], { type: 'text/markdown;charset=utf-8' });
      const resultPath = `checklists/${activeChecklist.id}/url_analysis/${docId}.md`;
      const resultRef = storageRef(storage, resultPath);
      await uploadBytes(resultRef, markdownBlob);
      
      // Update document to 'complete' with the storage path
      await updateDoc(newDocRef, {
        storagePath: resultPath,
        status: 'complete',
      });

    } catch (error: any) {
      console.error("Error processing URL:", error);
      const errorMessage = error.message || 'An unknown error occurred.';
      
      // Update document to 'failed' with the error message
      await updateDoc(newDocRef, {
        status: 'failed',
        error: errorMessage,
      });

      handleAiError(error);
    }

  }, [activeChecklist, db, storage, toast, settings, handleAiError]);

  const handleDeleteDocument = useCallback(async (documentId: string) => {
    if (!activeChecklist || !db || !storage) {
        toast({ title: "Error", description: "Cannot delete document: no active checklist.", variant: "destructive" });
        return;
    }
    
    let docToDelete: Document | undefined;
    
    try {
        const docSnap = await getDoc(doc(db, 'documents', documentId));
        if (docSnap.exists()) {
            docToDelete = { id: docSnap.id, ...docSnap.data() } as Document;
        }
    } catch (error) {
        console.error("Error fetching document to delete:", error);
        toast({ title: "Error", description: "Could not find document record to delete.", variant: "destructive" });
        return;
    }
    
    if (!docToDelete) {
        toast({ title: "Error", description: "Document not found.", variant: "destructive" });
        return;
    }

    try {
      if (docToDelete.storagePath) {
        const fileRef = storageRef(storage, docToDelete.storagePath);
        await deleteObject(fileRef).catch(error => {
            if (error.code !== 'storage/object-not-found') {
                throw error;
            }
        });
      }
    } catch (error: any) {
        console.error("Error deleting file from Storage:", error);
        toast({ title: "Storage Error", description: "Could not delete file. Check storage permissions.", variant: "destructive" });
        return;
    }

    try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'documents', documentId));
        
        const checklistRef = doc(db, 'checklists', activeChecklist.id);
        batch.update(checklistRef, {
            documentIds: arrayRemove(documentId)
        });

        await batch.commit();
        toast({ title: "Success", description: `Document "${docToDelete.fileName}" deleted.` });
    } catch (error) {
        console.error("Error committing Firestore deletes:", error);
        toast({ title: "Database Error", description: "Failed to update database records.", variant: "destructive" });
    }
  }, [activeChecklist, toast, db, storage]);

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
    handleUpdateChecklist({ id: activeChecklist.id, tasks: newTasks });
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
        handleUpdateChecklist({ id: activeChecklist.id, tasks: newTasks });
      }
  },[activeChecklist, handleUpdateChecklist]);

  const handleDeleteRemark = useCallback(async (taskToUpdate: Task, remarkToDelete: Remark) => {
    if (!activeChecklist || !storage) return;

    let updatedRemarks = taskToUpdate.remarks.filter(r => r.id !== remarkToDelete.id && r.parentId !== remarkToDelete.id);
    const updatedTask = { ...taskToUpdate, remarks: updatedRemarks };
    handleUpdateTask(updatedTask);
    
    // Check if the remark has a report and delete it from storage
    const storageLinkRegex = /\[View results\]\(storage:\/\/([^)]+)\)/;
    const storageMatch = remarkToDelete.text.match(storageLinkRegex);
    if (storageMatch) {
        try {
            const path = storageMatch[1];
            const fileRef = storageRef(storage, path);
            await deleteObject(fileRef);
            toast({ title: "Report Deleted", description: "The associated AI report has been deleted." });
        } catch (error: any) {
            if (error.code !== 'storage/object-not-found') {
                console.error("Error deleting report from storage:", error);
                toast({ title: "Storage Error", description: "Could not delete associated report.", variant: "destructive" });
            }
        }
    }
  }, [activeChecklist, storage, handleUpdateTask, toast]);

  const handleDeleteMultipleRemarks = useCallback(async (taskToUpdate: Task, remarkIdsToDelete: string[]) => {
    if (!activeChecklist || !storage) return;
  
    const remarksToDelete = new Set(remarkIdsToDelete);
    const reportsToDelete: string[] = [];
  
    // Find all reports associated with the remarks to be deleted
    taskToUpdate.remarks.forEach(remark => {
      if (remarksToDelete.has(remark.id)) {
        const storageLinkRegex = /\[View results\]\(storage:\/\/([^)]+)\)/;
        const storageMatch = remark.text.match(storageLinkRegex);
        if (storageMatch) {
          reportsToDelete.push(storageMatch[1]);
        }
      }
    });
  
    // Delete reports from Storage
    const deleteReportPromises = reportsToDelete.map(path => {
      const fileRef = storageRef(storage, path);
      return deleteObject(fileRef).catch(error => {
        if (error.code !== 'storage/object-not-found') {
          console.error("Error deleting report from storage:", error);
          toast({ title: "Storage Error", description: `Could not delete report: ${path}`, variant: "destructive" });
        }
      });
    });
  
    await Promise.all(deleteReportPromises);
  
    // Filter out the deleted remarks from the task
    const updatedRemarks = taskToUpdate.remarks.filter(r => !remarksToDelete.has(r.id));
    const updatedTask = { ...taskToUpdate, remarks: updatedRemarks };
    handleUpdateTask(updatedTask);
  
    toast({ title: "Remarks Deleted", description: `${remarkIdsToDelete.length} remark(s) have been deleted.` });
  
  }, [activeChecklist, storage, handleUpdateTask, toast]);

  const handleUpdateCollaborators = async (collaboratorIds: string[]) => {
    if (!activeChecklist) return;
    await handleUpdateChecklist({ id: activeChecklist.id, collaboratorIds });
    toast({ title: "Collaborators Updated", description: "The list of collaborators has been updated."});
  };

  const handleNotificationClick = (notification: Notification) => {
    setNotifications(prev => prev.filter(n => n.id !== notification.id));
    // Wait for the next render cycle for the notification to be removed from the DOM
    // before attempting to scroll to the element.
    setTimeout(() => {
        const remarkElement = document.getElementById(`remark-${notification.remarkId}`) || document.getElementById(`remark-mobile-${notification.remarkId}`);
        if (remarkElement) {
            remarkElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            remarkElement.classList.add('animate-pulse', 'bg-accent/20', 'rounded-lg');
            setTimeout(() => {
                remarkElement.classList.remove('animate-pulse', 'bg-accent/20', 'rounded-lg');
            }, 3000);
        }
    }, 100);
  };


  if (!authInitialized) {
    return <Loading />;
  }

  if (authError || authMethodDisabled) {
    return <FirebaseNotConfigured missingKeys={missingFirebaseConfigKeys} authMethodDisabled={authMethodDisabled} />;
  }
  
  if (firestorePermissionError) {
    return <FirestorePermissionDenied />;
  }

  if (firestoreError) {
    return <FirestoreNotConnected />;
  }

  if (!user) {
    return <LoginScreen onSignIn={handleSignIn} />;
  }

  if (isLoading && !activeChecklist) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen bg-background">
      <ChecklistHeader
        userProfile={userProfile}
        onSignOut={handleSignOut}
        checklists={checklistMetas}
        activeChecklistId={activeChecklistId}
        onSwitch={handleSwitchChecklist}
        onAdd={() => setIsNewChecklistDialogOpen(true)}
        onDeleteRequest={handleRequestDeleteChecklist}
        onInitiateImport={handleInitiateImport}
        onExportMarkdown={handleExportMarkdown}
        onExportPdf={handleExportPdf}
        onExportConfluence={handleExportConfluence}
        onExportZip={handleExportZip}
        onGetAiSuggestions={fetchAiSuggestions}
        onShare={() => setIsShareDialogOpen(true)}
        onSettings={() => setIsSettingsDialogOpen(true)}
        progress={progress}
        hasActiveChecklist={!!activeChecklist}
        isOwner={isOwner}
        collaborators={users.filter(u => u.uid !== user.uid)}
        notifications={notifications}
        onNotificationClick={handleNotificationClick}
        onNotificationsOpen={handleNotificationsOpen}
        executionQueueSize={executionQueue.length}
      />
      <main className="p-4 sm:p-6 lg:p-8">
        {activeChecklist ? (
          <>
            <DocumentManager 
              documents={documents}
              onUpload={handleUploadDocuments}
              isUploading={isUploading}
              storageCorsError={storageCorsError}
              onDelete={handleDeleteDocument}
              onView={handleViewContent}
              onAddUrl={handleAddUrl}
              isCollaborator={!isOwner}
            />
            <TaskTable
              checklist={activeChecklist}
              onUpdate={handleUpdateChecklist}
              onExecuteAiTodo={enqueueAiTodo}
              onRunRefinedPrompt={handleRunRefinedPrompt}
              runningRemarkIds={runningRemarkIds}
              isOwner={isOwner}
              userId={user.uid}
              settings={settings}
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-center h-[60vh] no-print">
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

      <div className="hidden">
        <div ref={confluenceExportRef}>
            <ChecklistConfluenceView checklist={activeChecklist} />
        </div>
      </div>

      <div className="hidden print:block">
        {activeChecklist && <ChecklistPrintView checklist={activeChecklist} />}
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
        capabilityWarnings={aiAnalysisResult?.capabilityWarnings || []}
        isLoading={isAiLoading}
        tasks={activeChecklist?.tasks || []}
        onAddSuggestion={handleAddSuggestionAsRemark}
        onRegenerate={fetchAiSuggestions}
        onProvideInfo={handleProvideInfo}
        onAddWarning={handleAddWarningAsRemark}
      />
      <TaskDialog
        task={dialogTask}
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        onSave={handleSaveTask}
        isCollaborator={!isOwner}
      />
      <TaskRemarksSheet
        task={remarksTask}
        open={isRemarksSheetOpen}
        onOpenChange={setIsRemarksSheetOpen}
        onUpdateTask={handleUpdateTask}
        onDeleteRemark={handleDeleteRemark}
        onDeleteMultipleRemarks={handleDeleteMultipleRemarks}
        assignees={assignees}
        userId={user?.uid}
        isCollaborator={!isOwner}
      />
      <AlertDialog
        open={!!checklistToDelete}
        onOpenChange={(isOpen) => !isOpen && setChecklistToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              checklist &quot;{checklistToDelete?.name}&quot; and all of its associated tasks and documents.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (checklistToDelete) {
                  handleDeleteChecklist(checklistToDelete.id);
                }
              }}
            >
              Delete Checklist
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ReportViewerDialog
        open={isReportViewerOpen}
        onOpenChange={setIsReportViewerOpen}
        content={reportContent}
        isLoading={isReportLoading}
      />
      {activeChecklist && userProfile && (
        <ShareChecklistDialog
            open={isShareDialogOpen}
            onOpenChange={setIsShareDialogOpen}
            checklist={activeChecklist}
            userProfile={userProfile}
            collaborators={users}
            onUpdateCollaborators={handleUpdateCollaborators}
        />
      )}
      <SettingsDialog
        open={isSettingsDialogOpen}
        onOpenChange={setIsSettingsDialogOpen}
        settings={settings}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
