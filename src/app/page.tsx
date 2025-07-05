'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChecklistHeader } from '@/components/checklist-header';
import { TaskTable } from '@/components/task-table';
import { initialChecklists } from '@/lib/data';
import type { Checklist, Task, TaskStatus, TaskPriority } from '@/lib/types';
import { useToast } from "@/hooks/use-toast"
import Loading from './loading';

const LOCAL_STORAGE_KEYS = {
  CHECKLISTS: 'alpha-release-hub-checklists',
  ACTIVE_ID: 'alpha-release-hub-active',
};

export default function Home() {
  const { toast } = useToast()
  const [isMounted, setIsMounted] = useState(false);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [activeChecklistId, setActiveChecklistId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      try {
        const storedChecklists = localStorage.getItem(LOCAL_STORAGE_KEYS.CHECKLISTS);
        const storedActiveId = localStorage.getItem(LOCAL_STORAGE_KEYS.ACTIVE_ID);
        
        if (storedChecklists) {
          const parsedChecklists = JSON.parse(storedChecklists) as Checklist[];
          setChecklists(parsedChecklists);
          
          if (storedActiveId && parsedChecklists.some(c => c.id === storedActiveId)) {
            setActiveChecklistId(storedActiveId);
          } else if (parsedChecklists.length > 0) {
            setActiveChecklistId(parsedChecklists[0].id);
          } else {
            setActiveChecklistId(null);
          }
        } else {
          setChecklists(initialChecklists);
          setActiveChecklistId(initialChecklists[0]?.id || null);
        }
      } catch (error) {
        console.error("Failed to parse from localStorage", error);
        setChecklists(initialChecklists);
        setActiveChecklistId(initialChecklists[0]?.id || null);
      }
    }
  }, [isMounted]);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.CHECKLISTS, JSON.stringify(checklists));
      if (activeChecklistId) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.ACTIVE_ID, activeChecklistId);
      }
    }
  }, [checklists, activeChecklistId, isMounted]);

  const activeChecklist = checklists.find(c => c.id === activeChecklistId) || null;

  const handleUpdateChecklist = useCallback((updatedChecklist: Checklist) => {
    setChecklists(prev => prev.map(c => c.id === updatedChecklist.id ? updatedChecklist : c));
  }, []);

  const handleAddChecklist = useCallback(() => {
    const newName = prompt("Enter new checklist name:");
    if (newName) {
      const newChecklist: Checklist = {
        id: `cl_${Date.now()}`,
        name: newName,
        tasks: [],
      };
      setChecklists(prev => [...prev, newChecklist]);
      setActiveChecklistId(newChecklist.id);
      toast({ title: "Success", description: `Checklist "${newName}" created.` });
    }
  }, [toast]);
  
  const handleSwitchChecklist = useCallback((id: string) => {
    setActiveChecklistId(id);
  }, []);

  const handleDeleteChecklist = useCallback((id: string) => {
    if (window.confirm("Are you sure you want to delete this checklist? This action cannot be undone.")) {
      const remainingChecklists = checklists.filter(c => c.id !== id);
      setChecklists(remainingChecklists);
      if (activeChecklistId === id) {
        setActiveChecklistId(remainingChecklists[0]?.id || null);
      }
      toast({ title: "Success", description: "Checklist deleted." });
    }
  }, [checklists, activeChecklistId, toast]);

  const handleImportMarkdown = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeChecklist) return;

    const reader = new FileReader();
    reader.onload = (e) => {
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
          discussion: '',
        };
      }).filter((task): task is Task => task !== null);

      if (newTasks.length > 0) {
        const updatedChecklist = {
          ...activeChecklist,
          tasks: [...activeChecklist.tasks, ...newTasks]
        };
        handleUpdateChecklist(updatedChecklist);
        toast({ title: "Import successful", description: `${newTasks.length} tasks imported.` });
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
      return `- ${status} ${task.description} (Priority: ${task.priority}, Assignee: ${task.assignee}, Due: ${task.dueDate})`;
    }).join('\n');

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

  if (!isMounted) {
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
        checklists={checklists}
        activeChecklist={activeChecklist}
        onSwitch={handleSwitchChecklist}
        onAdd={handleAddChecklist}
        onDelete={handleDeleteChecklist}
        onImport={() => fileInputRef.current?.click()}
        onExportMarkdown={handleExportMarkdown}
        onExportPdf={handleExportPdf}
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
            <p className="mt-2 text-muted-foreground">Create a new checklist to get started.</p>
            <button
              onClick={handleAddChecklist}
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
    </div>
  );
}
