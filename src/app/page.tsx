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
} from 'firebase/firestore';
import { NewChecklistDialog } from '@/components/new-checklist-dialog';

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

  const handleUpdateChecklist = useCallback(async (updatedChecklist: Checklist) => {
    if (!updatedChecklist.id) return;
    const { id, ...data } = updatedChecklist;
    const checklistRef = doc(db, 'checklists', id);
    try {
      await updateDoc(checklistRef, data);
    } catch (error) {
      console.error("Error updating checklist: ", error);
      toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
    }
  }, [toast]);

  const handleSaveNewChecklist = useCallback(async (name: string) => {
    if (name) {
      try {
        const newChecklist: Omit<Checklist, 'id'> = {
          name: name,
          tasks: [],
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

  const handleImportMarkdown = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      const lines = content.split('\n');
      const newTasks: Task[] = lines.map(line => {
        const match = line.match(/- \[( |x)\] (.*)/);
        if (!match) return null;

        const [, statusChar, description] = match;
        return {
          id: `task_${Date.now()}_${Math.random()}`,
          description,
          status: (statusChar === 'x' ? 'complete' : 'pending') as TaskStatus,
          priority: 'Medium' as TaskPriority,
          assignee: 'Unassigned',
          dueDate: new Date().toISOString().split('T')[0],
          remarks: [],
        };
      }).filter((task): task is Task => task !== null);

      if (newTasks.length > 0) {
        const newChecklistName = file.name.replace('.md', '');
         const newChecklist: Omit<Checklist, 'id'> = {
          name: newChecklistName,
          tasks: newTasks,
          ownerId: USER_ID,
        };
        const docRef = await addDoc(collection(db, 'checklists'), newChecklist);
        setActiveChecklistId(docRef.id);
        toast({ title: "Import successful", description: `Checklist "${newChecklistName}" with ${newTasks.length} tasks imported.` });
      } else {
        toast({ title: "Import failed", description: "No valid tasks found in the file.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleExportMarkdown = () => {
    if (!activeChecklist) return;
    const markdownContent = activeChecklist.tasks.map(task => {
      const status = task.status === 'complete' ? '[x]' : '[ ]';
      const taskLine = `- ${status} ${task.description} (Priority: ${task.priority}, Assignee: ${task.assignee}, Due: ${task.dueDate})`;
      const remarksLines = task.remarks.map(r => `  - ${r.text} [${r.userId} @ ${new Date(r.timestamp).toLocaleString()}]`).join('\n');
      return `${taskLine}${remarksLines ? `\n${remarksLines}` : ''}`;
    }).join('\n\n');

    const blob = new Blob([markdownContent], { type: 'text/markdown' });
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
        onChange={handleImportMarkdown}
        accept=".md"
        className="hidden"
      />
      <ChecklistHeader
        checklists={checklistMetas}
        activeChecklistId={activeChecklistId}
        onSwitch={handleSwitchChecklist}
        onAdd={() => setIsNewChecklistDialogOpen(true)}
        onDelete={handleDeleteChecklist}
        onImport={() => fileInputRef.current?.click()}
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
        onSave={handleSaveNewChecklist}
      />
    </div>
  );
}
