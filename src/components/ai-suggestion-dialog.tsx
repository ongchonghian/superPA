'use client';

import React, { useState } from 'react';
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
import type { Task } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface AiSuggestionDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AiSuggestionDialog({ task, open, onOpenChange }: AiSuggestionDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const { toast } = useToast();

  const handleGenerateSuggestions = async () => {
    if (!task) return;
    setIsLoading(true);
    setSuggestions([]);
    try {
      const result = await suggestNextSteps({
        taskDescription: task.description,
        discussionHistory: task.discussion,
      });
      setSuggestions(result.nextSteps);
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

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-headline">
            <WandSparkles className="h-5 w-5 text-accent" />
            AI-Powered Next Steps
          </DialogTitle>
          <DialogDescription>
            Get suggestions for what to do next on &quot;{task.description}&quot;.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            {suggestions.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-medium text-foreground">Suggestions:</h3>
                    <ul className="space-y-2 rounded-md border border-border bg-secondary/50 p-4">
                    {suggestions.map((step, index) => (
                        <li key={index} className="flex items-start gap-3">
                            <Lightbulb className="h-4 w-4 mt-1 shrink-0 text-accent"/>
                            <span className="text-sm text-secondary-foreground">{step}</span>
                        </li>
                    ))}
                    </ul>
                </div>
            )}
             {isLoading && (
                <div className="flex items-center justify-center p-8 rounded-md bg-secondary/50">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                {suggestions.length > 0 ? 'Regenerate' : 'Generate Suggestions'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
