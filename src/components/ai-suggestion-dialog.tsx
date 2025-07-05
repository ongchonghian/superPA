'use client';

import React, { useState, useEffect } from 'react';
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
import { suggestNextSteps } from '@/ai/flows/suggest-next-steps';
import type { Task, Remark } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface AiSuggestionDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateTask: (task: Task) => void;
}

export function AiSuggestionDialog({ task, open, onOpenChange, onUpdateTask }: AiSuggestionDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setSuggestions([]);
      setIsLoading(false);
    }
  }, [open]);

  const handleGenerateSuggestions = async () => {
    if (!task) return;
    setIsLoading(true);
    setSuggestions([]);
    try {
      const discussionHistory = task.remarks.map(r => `${r.userId}: ${r.text}`).join('\n');
      const result = await suggestNextSteps({
        taskDescription: task.description,
        discussionHistory: discussionHistory,
      });
      setSuggestions(result.nextSteps);
      if (result.nextSteps.length === 0) {
        toast({
            title: "No suggestions found",
            description: "The AI couldn't find any automatable tasks.",
        });
      }
    } catch (error) {
      console.error('AI suggestion failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate suggestions. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSuggestionAsRemark = (suggestionToAdd: string) => {
    if (!task) return;

    const newRemark: Remark = {
        id: `rem_${Date.now()}_${Math.random()}`,
        text: suggestionToAdd,
        userId: 'ai_assistant',
        timestamp: new Date().toISOString(),
    };

    const updatedTask = {
        ...task,
        remarks: [...task.remarks, newRemark],
    };

    onUpdateTask(updatedTask as Task);
    
    setSuggestions(currentSuggestions => currentSuggestions.filter(s => s !== suggestionToAdd));
    
    toast({
        title: "AI To-Do Added",
        description: "The suggestion has been added to the task's remarks.",
    });
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-headline">
            <WandSparkles className="h-5 w-5 text-accent" />
            AI To-Do Suggestions
          </DialogTitle>
          <DialogDescription>
            Let AI analyze this task and suggest automatable actions. Approved suggestions will be added as AI To-Do remarks.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            {suggestions.length > 0 ? (
                <div className="space-y-2">
                    <h3 className="text-sm font-medium text-foreground">Suggestions:</h3>
                    <ul className="space-y-2 rounded-md border border-border bg-secondary/50 p-4">
                    {suggestions.map((suggestion, index) => (
                        <li key={index} className="flex items-center justify-between gap-3 animate-in fade-in duration-300">
                           <div className="flex items-start gap-3 flex-1">
                                <Lightbulb className="h-4 w-4 mt-1 shrink-0 text-accent"/>
                                <span className="text-sm text-secondary-foreground break-words">{suggestion}</span>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleAddSuggestionAsRemark(suggestion)}>
                                Add
                            </Button>
                        </li>
                    ))}
                    </ul>
                </div>
            ) : isLoading ? (
                <div className="flex items-center justify-center p-8 rounded-md bg-secondary/50">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                 <div className="text-center text-sm text-muted-foreground py-8">
                    Click "Generate" to get started.
                 </div>
            )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleGenerateSuggestions} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <WandSparkles className="mr-2 h-4 w-4" />
                {suggestions.length > 0 ? 'Regenerate' : 'Generate'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
