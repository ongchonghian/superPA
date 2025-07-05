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
import { Send, Pencil, Trash2 } from 'lucide-react';
import {
    Popover,
    PopoverContent,
    PopoverAnchor,
} from '@/components/ui/popover';
import { Textarea } from './ui/textarea';

interface TaskRemarksSheetProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateTask: (task: Task) => void;
  assignees: string[];
  userId?: string;
}

export function TaskRemarksSheet({ task, open, onOpenChange, onUpdateTask, assignees = [], userId }: TaskRemarksSheetProps) {
    const [newRemark, setNewRemark] = useState('');
    const [mentionQuery, setMentionQuery] = useState('');
    const [isMentionPopoverOpen, setIsMentionPopoverOpen] = useState(false);
    const [editingRemarkId, setEditingRemarkId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
    
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open && scrollAreaRef.current) {
            // Scroll to the bottom when the sheet opens or when new remarks are added/edited/deleted
            setTimeout(() => {
                if (scrollAreaRef.current) {
                    scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
                }
            }, 100);
        }
    }, [open, task?.remarks]);

    useEffect(() => {
        // Reset editing state when the sheet is closed
        if (!open) {
            setEditingRemarkId(null);
            setEditingText('');
        }
    }, [open]);

    const handleAddRemark = () => {
        if (!task || !newRemark.trim() || !userId) return;
        const remark: Remark = {
            id: `rem_${Date.now()}_${Math.random()}`,
            text: newRemark.trim(),
            userId: userId,
            timestamp: new Date().toISOString(),
        };
        const updatedTask = {
            ...task,
            remarks: [...task.remarks, remark],
        };
        onUpdateTask(updatedTask);
        setNewRemark('');
    };

    const handleEditStart = (remark: Remark) => {
        setEditingRemarkId(remark.id);
        setEditingText(remark.text);
    };

    const handleEditCancel = () => {
        setEditingRemarkId(null);
        setEditingText('');
    };

    const handleEditSave = () => {
        if (!task || !editingRemarkId) return;
        
        const updatedRemarks = task.remarks.map(r => 
            r.id === editingRemarkId ? { ...r, text: editingText } : r
        );
        
        const updatedTask = { ...task, remarks: updatedRemarks };
        onUpdateTask(updatedTask);
        handleEditCancel();
    };

    const handleDeleteRemark = (remarkId: string) => {
        if (!task) return;
        if (window.confirm('Are you sure you want to delete this remark?')) {
            const updatedRemarks = task.remarks.filter(r => r.id !== remarkId);
            const updatedTask = { ...task, remarks: updatedRemarks };
            onUpdateTask(updatedTask);
        }
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
    
    const sortedRemarks = [...task.remarks].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const aiTodos = sortedRemarks.filter(r => r.text.startsWith('[ai-todo|'));
    const regularRemarks = sortedRemarks.filter(r => !r.text.startsWith('[ai-todo|'));

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
                            <>
                                {aiTodos.map(remark => (
                                    <div key={remark.id} className="group flex items-start gap-3">
                                        <Avatar className="h-8 w-8 border">
                                            <AvatarFallback>{remark.userId.substring(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 bg-muted/50 rounded-lg p-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold text-sm text-foreground">{remark.userId}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {formatDistanceToNow(new Date(remark.timestamp), { addSuffix: true })}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className="text-sm text-foreground/90 whitespace-pre-wrap mt-1">{remark.text}</p>
                                        </div>
                                    </div>
                                ))}

                                {aiTodos.length > 0 && regularRemarks.length > 0 && (
                                    <div className="py-2">
                                        <hr className="border-dashed" />
                                    </div>
                                )}

                                {regularRemarks.map(remark => (
                                <div key={remark.id} className="group flex items-start gap-3">
                                    <Avatar className="h-8 w-8 border">
                                        <AvatarFallback>{remark.userId.substring(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 bg-muted/50 rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-sm text-foreground">{remark.userId}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatDistanceToNow(new Date(remark.timestamp), { addSuffix: true })}
                                                </p>
                                            </div>
                                            {remark.userId === userId && editingRemarkId !== remark.id && !isComplete && (
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditStart(remark)}>
                                                        <Pencil className="h-3 w-3" />
                                                        <span className="sr-only">Edit</span>
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDeleteRemark(remark.id)}>
                                                        <Trash2 className="h-3 w-3" />
                                                        <span className="sr-only">Delete</span>
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                        {editingRemarkId === remark.id ? (
                                            <div className="mt-2 space-y-2">
                                                <Textarea 
                                                    value={editingText} 
                                                    onChange={(e) => setEditingText(e.target.value)}
                                                    className="text-sm"
                                                    rows={3}
                                                    autoFocus
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="sm" onClick={handleEditCancel}>Cancel</Button>
                                                    <Button size="sm" onClick={handleEditSave}>Save Changes</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-foreground/90 whitespace-pre-wrap mt-1">{remark.text}</p>
                                        )}
                                    </div>
                                </div>
                                ))}
                            </>
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
                                    disabled={isComplete || !userId}
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
                        <Button type="submit" disabled={!newRemark.trim() || isComplete || !userId}>
                            <Send className="h-4 w-4" />
                            <span className="sr-only">Send</span>
                        </Button>
                    </form>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
