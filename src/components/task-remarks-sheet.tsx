'use client';

import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { Task, Remark } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { Send } from 'lucide-react';

interface TaskRemarksSheetProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateTask: (task: Task) => void;
}

// This is a placeholder for a real user authentication system.
const USER_ID = "user_123";

export function TaskRemarksSheet({ task, open, onOpenChange, onUpdateTask }: TaskRemarksSheetProps) {
    const [newRemark, setNewRemark] = useState('');

    const handleAddRemark = () => {
        if (!task || !newRemark.trim()) return;
        const remark: Remark = {
            id: `rem_${Date.now()}_${Math.random()}`,
            text: newRemark.trim(),
            userId: USER_ID,
            timestamp: new Date().toISOString(),
        };
        const updatedTask = {
            ...task,
            remarks: [...task.remarks, remark],
        };
        onUpdateTask(updatedTask);
        setNewRemark('');
    };

    if (!task) return null;

    const isComplete = task.status === 'complete';

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-lg w-[90vw] flex flex-col p-4 sm:p-6">
                <SheetHeader className="text-left">
                    <SheetTitle>Remarks for: {task.description}</SheetTitle>
                    <SheetDescription>View and add comments to this task.</SheetDescription>
                </SheetHeader>
                <ScrollArea className="flex-1 my-4 -mx-4 sm:-mx-6 px-4 sm:px-6">
                    <div className="space-y-4 py-4">
                        {task.remarks.length > 0 ? (
                            [...task.remarks].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map(remark => (
                                <div key={remark.id} className="flex items-start gap-3">
                                    <Avatar className="h-8 w-8 border">
                                        <AvatarFallback>{remark.userId.substring(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 bg-muted/50 rounded-lg p-3">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-sm text-foreground">{remark.userId}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatDistanceToNow(new Date(remark.timestamp), { addSuffix: true })}
                                            </p>
                                        </div>
                                        <p className="text-sm text-foreground/90 whitespace-pre-wrap">{remark.text}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-8">No remarks yet.</p>
                        )}
                    </div>
                </ScrollArea>
                <SheetFooter>
                    <form
                        onSubmit={(e) => { e.preventDefault(); handleAddRemark(); }}
                        className="flex gap-2 w-full"
                    >
                        <Input 
                            value={newRemark}
                            onChange={e => setNewRemark(e.target.value)}
                            placeholder={isComplete ? "Task is complete" : "Add a remark..."}
                            autoComplete="off"
                            disabled={isComplete}
                        />
                        <Button type="submit" disabled={!newRemark.trim() || isComplete}>
                            <Send className="h-4 w-4" />
                            <span className="sr-only">Send</span>
                        </Button>
                    </form>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
