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

  // Effect to fetch the list of checklist names and IDs for the current user
  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, 'checklists'), where('ownerId', '==', USER_ID));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const metas = querySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name as string }));
      setChecklistMetas(metas);

      if (!activeChecklistId && metas.length > 0) {
        setActiveChecklistId(metas[0].id);
      } else if (metas.length === 0) {
        setActiveChecklistId(null);
        setActiveChecklist(null);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching checklists: ", error);
      toast({ title: "Error", description: "Could not load checklists.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [activeChecklistId, toast]);

  // Effect to subscribe to the currently active checklist for real-time updates
  useEffect(() => {
    if (!activeChecklistId) {
      setActiveChecklist(null);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, 'checklists', activeChecklistId), (doc) => {
      if (doc.exists()) {
        setActiveChecklist({ id: doc.id, ...doc.data() } as Checklist);
      } else {
        setActiveChecklist(null);
        setActiveChecklistId(null); // Reset if it was deleted
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
        // The useEffect for checklistMetas will handle switching to another checklist or the empty state
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

            const userMatch = fullRemarkText.match(/(.*)\(by (.*)\)$/);
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
    const sectionHeader = `## Incomplete Tasks\n\n`;

    const markdownContent = activeChecklist.tasks.map(task => {
      const status = task.status === 'complete' ? 'x' : ' ';
      
      const taskDetails = `(Priority: ${task.priority}, Due: ${task.dueDate})`;
      const assigneePart = task.assignee !== 'Unassigned' ? ` - *Assignee: [${task.assignee}]*` : '';

      const taskLine = `- [${status}] **${task.description}** ${taskDetails}${assigneePart}`;
      
      const remarksLines = task.remarks.map(r => {
        const remarkDate = new Date(r.timestamp);
        const dateString = remarkDate.toISOString().split('T')[0].replace(/-/g, '');
        return `  - > #${dateString} ${r.text} (by ${r.userId})`;
      }).join('\n');
      
      return `${taskLine}${remarksLines ? `\n${remarksLines}` : ''}`;
    }).join('\n\n');

    const fullContent = checklistTitle + sectionHeader + markdownContent;
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
  
  const progress = useMemo(() => {
    if (!activeChecklist || activeChecklist.tasks.length === 0) return 0;
    const completedTasks = activeChecklist.tasks.filter(t => t.status === 'complete').length;
    return (completedTasks / activeChecklist.tasks.length) * 100;
  }, [activeChecklist]);

  if (isLoading) {
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
        progress={progress}
        hasActiveChecklist={!!activeChecklist}
      />
      <main className="p-4 sm:p-6 lg:p-8">
        {activeChecklist ? (
          <TaskTable
            checklist={activeChecklist}
            onUpdate={handleUpdateChecklist}
          />
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
    </div>
  );
}
