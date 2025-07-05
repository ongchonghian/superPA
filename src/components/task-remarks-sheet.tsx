'use client';

import React, { useState, useRef, useEffect } from 'react';
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
import {
    Popover,
    PopoverContent,
    PopoverAnchor,
} from '@/components/ui/popover';

interface TaskRemarksSheetProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateTask: (task: Task) => void;
  assignees: string[];
}

// This is a placeholder for a real user authentication system.
const USER_ID = "user_123";

export function TaskRemarksSheet({ task, open, onOpenChange, onUpdateTask, assignees = [] }: TaskRemarksSheetProps) {
    const [newRemark, setNewRemark] = useState('');
    const [mentionQuery, setMentionQuery] = useState('');
    const [isMentionPopoverOpen, setIsMentionPopoverOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open && scrollAreaRef.current) {
            // Scroll to the bottom when the sheet opens or when new remarks are added
            setTimeout(() => {
                if (scrollAreaRef.current) {
                    scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
                }
            }, 100);
        }
    }, [open, task?.remarks.length]);

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

    const handleRemarkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setNewRemark(value);

        const cursorPos = e.target.selectionStart;
        if (cursorPos === null) {
            setIsMentionPopoverOpen(false);
            return;
        }
        
        const textBeforeCursor = value.substring(0, cursorPos);
        const lastWord = textBeforeCursor.split(/\s+/).pop() || '';

        if (lastWord.startsWith('@')) {
            setMentionQuery(lastWord.substring(1));
            setIsMentionPopoverOpen(true);
        } else {
            setIsMentionPopoverOpen(false);
        }
    };

    const handleMentionSelect = (user: string) => {
        const currentValue = newRemark;
        const cursorPos = inputRef.current?.selectionStart;
        
        if (cursorPos === undefined || cursorPos === null) return;

        const textBeforeCursor = currentValue.substring(0, cursorPos);
        const lastAt = textBeforeCursor.lastIndexOf('@');
        
        if(lastAt === -1) return;

        const prefix = currentValue.substring(0, lastAt);
        const suffix = currentValue.substring(cursorPos);

        const newText = `${prefix}@${user} ${suffix}`;
        setNewRemark(newText);
        setIsMentionPopoverOpen(false);

        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                const newCaretPosition = prefix.length + 1 + user.length + 1; // prefix + @ + user + space
                inputRef.current.setSelectionRange(newCaretPosition, newCaretPosition);
            }
        }, 0);
    };

    const filteredAssignees = assignees.filter(a => a && a.toLowerCase().includes(mentionQuery.toLowerCase()));

    if (!task) return null;

    const isComplete = task.status === 'complete';

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-lg w-[90vw] flex flex-col p-4 sm:p-6">
                <SheetHeader className="text-left">
                    <SheetTitle>Remarks for: {task.description}</SheetTitle>
                    <SheetDescription>View and add comments to this task. Type @ to mention a user.</SheetDescription>
                </SheetHeader>
                <ScrollArea className="flex-1 my-4 -mx-4 sm:-mx-6" viewportRef={scrollAreaRef}>
                    <div className="space-y-4 py-4 px-4 sm:px-6">
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
                        <Popover open={isMentionPopoverOpen && filteredAssignees.length > 0} onOpenChange={setIsMentionPopoverOpen}>
                             <PopoverAnchor asChild>
                                <Input 
                                    ref={inputRef}
                                    value={newRemark}
                                    onChange={handleRemarkChange}
                                    placeholder={isComplete ? "Task is complete" : "Add a remark..."}
                                    autoComplete="off"
                                    disabled={isComplete}
                                />
                             </PopoverAnchor>
                             <PopoverContent className="w-[250px] p-1" align="start">
                                <div className="flex flex-col gap-1">
                                    {filteredAssignees.map(user => (
                                        <Button
                                            key={user}
                                            variant="ghost"
                                            className="w-full justify-start h-8 px-2"
                                            onClick={() => handleMentionSelect(user)}
                                        >
                                            {user}
                                        </Button>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
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
