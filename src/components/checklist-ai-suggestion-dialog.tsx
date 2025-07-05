'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, WandSparkles, Lightbulb } from 'lucide-react';
import type { Task } from '@/lib/types';
import type { ChecklistSuggestion } from '@/ai/flows/suggest-checklist-next-steps';
import { ScrollArea } from './ui/scroll-area';

interface ChecklistAiSuggestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: ChecklistSuggestion[];
  isLoading: boolean;
  tasks: Task[];
  onAddSuggestion: (suggestion: ChecklistSuggestion) => void;
  onRegenerate: () => void;
}

export function ChecklistAiSuggestionDialog({ 
  open, 
  onOpenChange, 
  suggestions, 
  isLoading, 
  tasks,
  onAddSuggestion,
  onRegenerate,
}: ChecklistAiSuggestionDialogProps) {
  
  const suggestionsByTask = suggestions.reduce((acc, suggestion) => {
    if (!acc[suggestion.taskId]) {
      acc[suggestion.taskId] = [];
    }
    acc[suggestion.taskId].push(suggestion);
    return acc;
  }, {} as Record<string, ChecklistSuggestion[]>);

  const getTaskDescription = (taskId: string) => {
    return tasks.find(t => t.id === taskId)?.description || 'Unknown Task';
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-headline">
            <WandSparkles className="h-5 w-5 text-accent" />
            Checklist AI To-Do Suggestions
          </DialogTitle>
          <DialogDescription>
            AI has analyzed all incomplete tasks. Approved suggestions will be added as AI To-Do remarks to the relevant tasks.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] -mx-6">
            <div className="py-4 px-6 space-y-6">
                {isLoading ? (
                    <div className="flex items-center justify-center p-8 rounded-md bg-secondary/50">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : Object.keys(suggestionsByTask).length > 0 ? (
                    Object.entries(suggestionsByTask).map(([taskId, taskSuggestions]) => (
                        <div key={taskId} className="space-y-3">
                            <h3 className="text-sm font-semibold text-foreground border-b pb-2">
                                For task: <span className="font-normal italic">&quot;{getTaskDescription(taskId)}&quot;</span>
                            </h3>
                            <ul className="space-y-3 pt-2">
                            {taskSuggestions.map((suggestion, index) => (
                                <li key={index} className="flex items-start justify-between gap-3 animate-in fade-in duration-300">
                                <div className="flex items-start gap-3 flex-1">
                                    <Lightbulb className="h-4 w-4 mt-1 shrink-0 text-accent"/>
                                    <div className="flex flex-col">
                                        <span className="text-sm text-secondary-foreground break-words font-medium">{suggestion.suggestion}</span>
                                        <span className="text-xs text-muted-foreground mt-1 italic">&quot;{suggestion.context}&quot;</span>
                                    </div>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => onAddSuggestion(suggestion)}>
                                    Add
                                </Button>
                                </li>
                            ))}
                            </ul>
                        </div>
                    ))
                ) : (
                    <div className="text-center text-sm text-muted-foreground py-8">
                        No suggestions were found. You can try again.
                    </div>
                )}
            </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={onRegenerate} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <WandSparkles className="mr-2 h-4 w-4" />
                Regenerate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
