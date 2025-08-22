
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
import { Loader2, WandSparkles, Lightbulb, MessageSquare, BookOpenCheck, ShieldAlert, PlusCircle } from 'lucide-react';
import type { Task } from '@/lib/types';
import type { ChecklistSuggestion, InformationRequest, CapabilityWarning } from '@/ai/flows/suggest-checklist-next-steps';
import { ScrollArea } from './ui/scroll-area';

interface ChecklistAiSuggestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: ChecklistSuggestion[];
  informationRequests: InformationRequest[];
  capabilityWarnings: CapabilityWarning[];
  isLoading: boolean;
  tasks: Task[];
  onAddSuggestion: (suggestion: ChecklistSuggestion) => void;
  onRegenerate: () => void;
  onProvideInfo: (taskId: string) => void;
  onAddWarning: (warning: CapabilityWarning) => void;
}

export function ChecklistAiSuggestionDialog({ 
  open, 
  onOpenChange, 
  suggestions,
  informationRequests,
  capabilityWarnings,
  isLoading, 
  tasks,
  onAddSuggestion,
  onRegenerate,
  onProvideInfo,
  onAddWarning
}: ChecklistAiSuggestionDialogProps) {
  
  const getTaskDescription = (taskId: string) => {
    return tasks.find(t => t.id === taskId)?.description || 'Unknown Task';
  }

  const suggestionsByTask = (suggestions || []).reduce((acc, suggestion) => {
    if (!acc[suggestion.taskId]) {
      acc[suggestion.taskId] = [];
    }
    acc[suggestion.taskId].push(suggestion);
    return acc;
  }, {} as Record<string, ChecklistSuggestion[]>);

  const requestsByTask = (informationRequests || []).reduce((acc, request) => {
    if (!acc[request.taskId]) {
      acc[request.taskId] = [];
    }
    acc[request.taskId].push(request);
    return acc;
  }, {} as Record<string, InformationRequest[]>);

  const warningsByTask = (capabilityWarnings || []).reduce((acc, warning) => {
    if (!acc[warning.taskId]) {
      acc[warning.taskId] = [];
    }
    acc[warning.taskId].push(warning);
    return acc;
  }, {} as Record<string, CapabilityWarning[]>);

  const hasSuggestions = suggestions && suggestions.length > 0;
  const hasRequests = informationRequests && informationRequests.length > 0;
  const hasWarnings = capabilityWarnings && capabilityWarnings.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-headline">
            <WandSparkles className="h-5 w-5 text-accent" />
            Checklist AI Analysis
          </DialogTitle>
          <DialogDescription>
            AI has analyzed incomplete tasks. Approve suggestions to add them as AI To-Dos, or answer questions to provide more context.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] -mx-6">
            <div className="py-4 px-6">
                {isLoading ? (
                    <div className="flex items-center justify-center p-8 rounded-md bg-secondary/50">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (hasSuggestions || hasRequests || hasWarnings) ? (
                    <div className="space-y-8">
                        {hasSuggestions && (
                          <div className="space-y-4">
                              <h3 className="text-base font-semibold flex items-center gap-2 text-foreground/90">
                                <Lightbulb className="h-4 w-4 text-accent"/>
                                AI To-Do Suggestions
                              </h3>
                              {Object.entries(suggestionsByTask).map(([taskId, taskSuggestions]) => (
                                  <div key={taskId} className="p-4 rounded-lg border bg-background space-y-3">
                                      <h4 className="text-sm font-semibold text-foreground">
                                          For task: <span className="font-normal italic">&quot;{getTaskDescription(taskId)}&quot;</span>
                                      </h4>
                                      <ul className="space-y-3 pt-2">
                                      {taskSuggestions.map((suggestion, index) => (
                                          <li key={index} className="flex flex-col animate-in fade-in duration-300 bg-muted/30 p-3 rounded-lg">
                                            <div className="flex items-start justify-between gap-3">
                                              <div className="flex items-start gap-3 flex-1">
                                                <WandSparkles className="h-4 w-4 mt-0.5 shrink-0 text-accent"/>
                                                <span className="text-sm text-secondary-foreground break-words font-medium">{suggestion.suggestion}</span>
                                              </div>
                                              <Button size="sm" variant="outline" onClick={() => onAddSuggestion(suggestion)}>
                                                  Add
                                              </Button>
                                            </div>
                                            <div className="flex items-start gap-2 mt-3 pt-2 border-t border-border/20 pl-1">
                                                <BookOpenCheck className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-semibold text-muted-foreground">AI&apos;s Reasoning</span>
                                                    <span className="text-xs text-muted-foreground italic">{suggestion.context}</span>
                                                </div>
                                            </div>
                                          </li>
                                      ))}
                                      </ul>
                                  </div>
                              ))}
                          </div>
                        )}
                        {hasRequests && (
                           <div className="space-y-4">
                              <h3 className="text-base font-semibold flex items-center gap-2 text-foreground/90">
                                <MessageSquare className="h-4 w-4 text-accent"/>
                                Needs More Information
                              </h3>
                              {Object.entries(requestsByTask).map(([taskId, taskRequests]) => (
                                  <div key={taskId} className="p-4 rounded-lg border bg-background space-y-3">
                                      <h4 className="text-sm font-semibold text-foreground">
                                          For task: <span className="font-normal italic">&quot;{getTaskDescription(taskId)}&quot;</span>
                                      </h4>
                                      <ul className="space-y-3 pt-2">
                                      {taskRequests.map((request, index) => (
                                          <li key={index} className="flex items-center justify-between gap-3 animate-in fade-in duration-300">
                                            <div className="flex items-start gap-3 flex-1">
                                                <MessageSquare className="h-4 w-4 mt-0.5 shrink-0 text-accent/80"/>
                                                <span className="text-sm text-secondary-foreground break-words">{request.request}</span>
                                            </div>
                                            <Button size="sm" variant="outline" onClick={() => onProvideInfo(request.taskId)}>
                                                Answer
                                            </Button>
                                          </li>
                                      ))}
                                      </ul>
                                  </div>
                              ))}
                          </div>
                        )}
                        {hasWarnings && (
                           <div className="space-y-4">
                              <h3 className="text-base font-semibold flex items-center gap-2 text-foreground/90">
                                <ShieldAlert className="h-4 w-4 text-amber-500"/>
                                Capability Warnings
                              </h3>
                              {Object.entries(warningsByTask).map(([taskId, taskWarnings]) => (
                                  <div key={taskId} className="p-4 rounded-lg border bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/50 space-y-3">
                                      <h4 className="text-sm font-semibold text-foreground">
                                          For task: <span className="font-normal italic">&quot;{getTaskDescription(taskId)}&quot;</span>
                                      </h4>
                                      <ul className="space-y-3 pt-2">
                                      {taskWarnings.map((warning, index) => (
                                          <li key={index} className="flex items-center justify-between gap-3 animate-in fade-in duration-300">
                                            <div className="flex items-start gap-3 flex-1">
                                                <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-500"/>
                                                <span className="text-sm text-amber-900 dark:text-amber-200 break-words">{warning.warning}</span>
                                            </div>
                                            <Button size="sm" variant="outline" onClick={() => onAddWarning(warning)}>
                                                <PlusCircle className="mr-2 h-4 w-4"/>
                                                Add as Remark
                                            </Button>
                                          </li>
                                      ))}
                                      </ul>
                                  </div>
                              ))}
                          </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center text-sm text-muted-foreground py-8">
                        No new suggestions were found.
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
