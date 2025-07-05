'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChecklistHeader } from '@/components/checklist-header';
import { TaskTable } from '@/components/task-table';
import type { Checklist, Task, TaskStatus, TaskPriority, Remark } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import Loading from './loading';
import { db } from '@/lib/firebase';
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
} from 'firebase/firestore';
import { NewChecklistDialog } from '@/components/new-checklist-dialog';
import { ImportConflictDialog } from '@/components/import-conflict-dialog';
import { PRIORITIES } from '@/lib/data';
import { ChecklistAiSuggestionDialog } from '@/components/checklist-ai-suggestion-dialog';
import type { SuggestChecklistNextStepsOutput, ChecklistSuggestion } from '@/ai/flows/suggest-checklist-next-steps';
import { suggestChecklistNextSteps } from '@/ai/flows/suggest-checklist-next-steps';
import { TaskDialog } from '@/components/task-dialog';
import { TaskRemarksSheet } from '@/components/task-remarks-sheet';

// This is a placeholder for a real user authentication system.
// In a real app, you would get this from your auth provider.
const USER_ID = "user_123";

export default function Home() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [checklistMetas, setChecklistMetas] = useState<{ id: string; name: string }[]>([]);
  const [activeChecklist, setActiveChecklist] = useState<Checklist | null>(null);
  const [activeChecklistId, setActiveChecklistId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isNewChecklistDialogOpen, setIsNewChecklistDialogOpen] = useState(false);
  const [importMode, setImportMode] = useState<'new' | 'current' | null>(null);
  const [importConflict, setImportConflict] = useState<{ conflictingId: string; name: string; tasks: Task[] } | null>(null);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<SuggestChecklistNextStepsOutput | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Effect to fetch the list of checklist names and IDs for the current user
  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, 'checklists'), where('ownerId', '==', USER_ID));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const metas = querySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name as string }));
      setChecklistMetas(metas);

      // This logic will now correctly handle setting the active ID.
      setActiveChecklistId(currentId => {
        const currentChecklistExists = metas.some(m => m.id === currentId);
        if (currentId && currentChecklistExists) {
          return currentId; // Keep the current ID if it still exists.
        }
        if (metas.length > 0) {
          return metas[0].id; // Otherwise, pick the first one.
        }
        return null; // Or null if the list is empty.
      });
      
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching checklists: ", error);
      toast({ title: "Error", description: "Could not load checklists.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  // Effect to subscribe to the currently active checklist for real-time updates
  useEffect(() => {
    if (!activeChecklistId) {
      setActiveChecklist(null);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, 'checklists', activeChecklistId), (doc) => {
      if (doc.exists()) {
        const newChecklist = { id: doc.id, ...doc.data() } as Checklist;
        setActiveChecklist(newChecklist);
      } else {
        // This handles the case where the active checklist is deleted by another client.
        // The metas listener will pick a new valid ID.
        setActiveChecklist(null);
      }
    }, (error) => {
      console.error("Error fetching active checklist: ", error);
      toast({ title: "Error", description: "Could not load selected checklist.", variant: "destructive" });
    });

    return () => unsubscribe();
  }, [activeChecklistId, toast]);
  

  const handleUpdateChecklist = useCallback(async (updatedChecklist: Partial<Checklist> & { id: string }) => {
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
    if (name) {
      try {
        const newChecklist: Omit<Checklist, 'id'> = {
          name: name,
          tasks: tasks,
          ownerId: USER_ID,
        };
        const docRef = await addDoc(collection(db, 'checklists'), newChecklist);
        setActiveChecklistId(docRef.id);
        toast({ title: "Success", description: `Checklist "${name}" created.` });
      } catch (error) {
        console.error("Error adding checklist: ", error);
        toast({ title: "Error", description: "Failed to create checklist.", variant: "destructive" });
      }
    }
  }, [toast]);
  
  const handleSwitchChecklist = useCallback((id: string) => {
    setActiveChecklistId(id);
  }, []);

  const handleDeleteChecklist = useCallback(async (id: string) => {
    if (window.confirm("Are you sure you want to delete this checklist? This action cannot be undone.")) {
      try {
        await deleteDoc(doc(db, 'checklists', id));
        toast({ title: "Success", description: "Checklist deleted." });
        // The onSnapshot listener for `checklistMetas` will handle the UI update automatically.
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
        ownerId: USER_ID,
        tasks: tasks,
    };
    await handleUpdateChecklist(checklistToUpdate);
    toast({ title: "Import Successful", description: `Checklist "${name}" has been overwritten.` });
  }, [handleUpdateChecklist, toast]);

  const handleAppendToChecklist = useCallback(async (checklistId: string, tasks: Task[]) => {
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
            let userId = 'system';
            let timestamp = new Date().toISOString();

            const userMatch = fullRemarkText.match(/(.*)\s+\(by (.*)\)$/);
            if (userMatch) {
                text = userMatch[1].trim();
                userId = userMatch[2].trim();
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

            currentTask.remarks.push({ id: `rem_${Date.now()}_${Math.random()}`, text: finalRemarkText, userId, timestamp });
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

    // Do not clear analysis results here, so the dialog can show old data while loading.
    
    const incompleteTasks = activeChecklist.tasks.filter(t => t.status !== 'complete');

    if (incompleteTasks.length === 0) {
      toast({
        title: "All tasks complete!",
        description: "There are no incomplete tasks for the AI to analyze."
      });
      return;
    }

    setIsAiLoading(true);

    try {
      const tasksToAnalyze = incompleteTasks.map(task => ({
        taskId: task.id,
        taskDescription: task.description,
        discussionHistory: task.remarks.map(r => `${r.userId}: ${r.text}`).join('\n')
      }));

      const result = await suggestChecklistNextSteps({ tasks: tasksToAnalyze });
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
      setAiAnalysisResult(null); // Clear on error as well
    } finally {
      setIsAiLoading(false);
    }
  }, [activeChecklist, toast]);

  const handleGetAiSuggestions = useCallback(() => {
    // If suggestions are already cached, just show them.
    if (aiAnalysisResult) {
      setIsAiDialogOpen(true);
    } else {
      // Otherwise, open the dialog (it will show a loading state) and fetch.
      setIsAiDialogOpen(true);
      fetchAiSuggestions();
    }
  }, [aiAnalysisResult, fetchAiSuggestions]);

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

    // The AI analysis cache is NOT cleared here automatically.
    // Instead, just remove the approved suggestion from the local state.
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
      // Use the existing state setters for the remarks sheet
      const event = new CustomEvent('open-remarks', { detail: task });
      window.dispatchEvent(event);
    }
  }, [activeChecklist]);
  
  const progress = useMemo(() => {
    if (!activeChecklist || activeChecklist.tasks.length === 0) return 0;
    const completedTasks = activeChecklist.tasks.filter(t => t.status === 'complete').length;
    return (completedTasks / activeChecklist.tasks.length) * 100;
  }, [activeChecklist]);

  // States for remarks sheet, to be controlled from multiple places
  const [remarksTask, setRemarksTask] = useState<Task | null>(null);
  const [isRemarksSheetOpen, setIsRemarksSheetOpen] = useState(false);

  useEffect(() => {
    const handleOpenRemarks = (event: Event) => {
      const customEvent = event as CustomEvent<Task>;
      setRemarksTask(customEvent.detail);
      setIsRemarksSheetOpen(true);
    };

    const handleOpenTask = (event: Event) => {
        const customEvent = event as CustomEvent<Partial<Task>>;
        const eventTask = customEvent.detail;
        const taskToOpen = activeChecklist?.tasks.find(t => t.id === eventTask.id) || eventTask;
        setDialogTask(taskToOpen);
        setIsTaskDialogOpen(true);
    }
    
    window.addEventListener('open-remarks', handleOpenRemarks);
    window.addEventListener('open-task-dialog', handleOpenTask);
    
    return () => {
      window.removeEventListener('open-remarks', handleOpenRemarks);
      window.removeEventListener('open-task-dialog', handleOpenTask);
    };
  }, [activeChecklist]);
  
  // States for task dialog
  const [dialogTask, setDialogTask] = useState<Partial<Task> | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);

  // Moved this hook to the top level to fix the order of hooks issue.
  const assignees = useMemo(() => {
    return [...new Set(activeChecklist?.tasks.map(t => t.assignee) || [])];
  }, [activeChecklist]);

  if (isLoading && !activeChecklistId) {
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
        onGetAiSuggestions={handleGetAiSuggestions}
        progress={progress}
        hasActiveChecklist={!!activeChecklist}
      />
      <main className="p-4 sm:p-6 lg:p-8">
        {activeChecklist ? (
          <TaskTable
            checklist={activeChecklist}
            onUpdate={handleUpdateChecklist}
          />
        ) : !isLoading ? (
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
        ) : (
          <Loading />
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
        onSave={(taskToSave) => {
          if (!activeChecklist) return; // Guard against no active checklist
          const exists = activeChecklist.tasks.some(t => t.id === taskToSave.id);
          if (exists) {
            const existingTask = activeChecklist.tasks.find(t => t.id === taskToSave.id)!;
            const updatedTask = { ...existingTask, ...taskToSave };
            const newTasks = activeChecklist.tasks.map(t => (t.id === updatedTask.id ? updatedTask : t));
            handleUpdateChecklist({ ...activeChecklist, tasks: newTasks });
          } else {
            const newTask = {...taskToSave, remarks: []};
            const newTasks = [...activeChecklist.tasks, newTask];
            handleUpdateChecklist({ ...activeChecklist, tasks: newTasks });
          }
        }}
      />
      <TaskRemarksSheet
        task={remarksTask}
        open={isRemarksSheetOpen}
        onOpenChange={setIsRemarksSheetOpen}
        onUpdateTask={(taskToUpdate) => {
            if (!activeChecklist) return;
            const newTasks = activeChecklist.tasks.map(t => (t.id === taskToUpdate.id ? taskToUpdate : t));
            handleUpdateChecklist({ ...activeChecklist, tasks: newTasks });
        }}
        assignees={assignees}
      />
    </div>
  );
}
