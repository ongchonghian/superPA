

'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
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
import { Checkbox } from './ui/checkbox';

interface TaskRemarksSheetProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateTask: (task: Task) => void;
  onDeleteRemark: (task: Task, remark: Remark) => void;
  onDeleteMultipleRemarks: (task: Task, remarkIds: string[]) => void;
  assignees: string[];
  userId?: string;
  isCollaborator: boolean;
}

export function TaskRemarksSheet({ task, open, onOpenChange, onUpdateTask, onDeleteRemark, onDeleteMultipleRemarks, assignees = [], userId, isCollaborator }: TaskRemarksSheetProps) {
    const [newRemark, setNewRemark] = useState('');
    const [mentionQuery, setMentionQuery] = useState('');
    const [isMentionPopoverOpen, setIsMentionPopoverOpen] = useState(false);
    const [editingRemarkId, setEditingRemarkId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
    const [selectedRemarkIds, setSelectedRemarkIds] = useState<string[]>([]);
    
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    const flattenedRemarks = useMemo(() => {
        if (!task) return [];

        const list: {remark: Remark, level: number}[] = [];
        const remarksMap = new Map<string, Remark[]>();
        
        task.remarks.forEach(remark => {
            const parentId = remark.parentId || 'root';
            if (!remarksMap.has(parentId)) {
                remarksMap.set(parentId, []);
            }
            remarksMap.get(parentId)!.push(remark);
        });
        
        remarksMap.forEach(children => {
            children.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        });

        const addChildrenToList = (parentId: string, level: number) => {
            const children = remarksMap.get(parentId) || [];
            children.forEach(child => {
                list.push({ remark: child, level: level });
                addChildrenToList(child.id, level + 1);
            });
        };
        
        const rootRemarks = remarksMap.get('root') || [];
        rootRemarks.forEach(remark => {
            list.push({ remark: remark, level: 0 });
            addChildrenToList(remark.id, 1);
        });
        
        return list;

    }, [task]);
    
    useEffect(() => {
        if (open && scrollAreaRef.current) {
            // Scroll to the bottom when the sheet opens or when new remarks are added/edited/deleted
            setTimeout(() => {
                if (scrollAreaRef.current) {
                    scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
                }
            }, 100);
        }
    }, [open, flattenedRemarks.length]);

    useEffect(() => {
        // Reset state when the sheet is closed or task changes
        if (!open) {
            setEditingRemarkId(null);
            setEditingText('');
            setSelectedRemarkIds([]);
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

    const handleDeleteClick = (remark: Remark) => {
        if (!task) return;
        if (window.confirm('Are you sure you want to delete this remark? This cannot be undone.')) {
            onDeleteRemark(task, remark);
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

    const handleSelectRemark = (remarkId: string, isSelected: boolean) => {
        setSelectedRemarkIds(prev => 
            isSelected ? [...prev, remarkId] : prev.filter(id => id !== remarkId)
        );
    };
    
    const handleSelectAllRemarks = (isSelected: boolean) => {
        if (isSelected) {
            setSelectedRemarkIds(task?.remarks.map(r => r.id) || []);
        } else {
            setSelectedRemarkIds([]);
        }
    };

    const handleDeleteSelected = () => {
        if (!task || selectedRemarkIds.length === 0) return;
        if (window.confirm(`Are you sure you want to delete ${selectedRemarkIds.length} selected remark(s)? This cannot be undone.`)) {
            onDeleteMultipleRemarks(task, selectedRemarkIds);
            setSelectedRemarkIds([]);
        }
    };

    const filteredAssignees = assignees.filter(a => a && a.toLowerCase().includes(mentionQuery.toLowerCase()));

    if (!task) return null;

    const isComplete = task.status === 'complete';
    const areAllSelected = task.remarks.length > 0 && selectedRemarkIds.length === task.remarks.length;
    const isIndeterminate = selectedRemarkIds.length > 0 && selectedRemarkIds.length < task.remarks.length;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-lg sm:w-[90vw] flex flex-col p-4 sm:p-6">
                <SheetHeader className="text-left">
                    <SheetTitle>Remarks for: {task.description}</SheetTitle>
                    <SheetDescription>View and add comments to this task. Type @ to mention a user.</SheetDescription>
                </SheetHeader>
                
                {task.remarks.length > 0 && !isCollaborator && (
                    <div className="flex items-center gap-3 px-4 sm:px-6 -mx-4 sm:-mx-6 py-2 border-y">
                        <Checkbox 
                            id="select-all-remarks"
                            checked={areAllSelected}
                            onCheckedChange={handleSelectAllRemarks}
                            aria-label="Select all remarks"
                            data-state={isIndeterminate ? 'indeterminate' : (areAllSelected ? 'checked' : 'unchecked')}
                        />
                        <label htmlFor="select-all-remarks" className="text-sm font-medium">
                            {selectedRemarkIds.length > 0 ? `${selectedRemarkIds.length} selected` : 'Select All'}
                        </label>
                    </div>
                )}

                <ScrollArea className="flex-1 my-0 -mx-4 sm:-mx-6" viewportRef={scrollAreaRef}>
                    <div className="space-y-4 py-4 px-4 sm:px-6">
                        {flattenedRemarks.length > 0 ? (
                           flattenedRemarks.map(({ remark, level }) => (
                            <div key={remark.id} className="group flex items-start gap-3" style={{ paddingLeft: `${level * 1.5}rem` }}>
                                {!isCollaborator && (
                                    <Checkbox
                                        id={`select-remark-${remark.id}`}
                                        className="mt-1"
                                        checked={selectedRemarkIds.includes(remark.id)}
                                        onCheckedChange={(checked) => handleSelectRemark(remark.id, !!checked)}
                                        aria-label={`Select remark from ${remark.userId}`}
                                    />
                                )}
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
                                        {editingRemarkId !== remark.id && !isComplete && selectedRemarkIds.length === 0 && (
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {remark.userId === userId && !remark.text.startsWith('[') && (
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditStart(remark)}>
                                                        <Pencil className="h-3 w-3" />
                                                        <span className="sr-only">Edit</span>
                                                    </Button>
                                                )}
                                                {!isCollaborator && (
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(remark)}>
                                                        <Trash2 className="h-3 w-3" />
                                                        <span className="sr-only">Delete</span>
                                                    </Button>
                                                )}
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
                           ))
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-8">No remarks yet.</p>
                        )}
                    </div>
                </ScrollArea>
                <SheetFooter className="mt-auto">
                    {selectedRemarkIds.length > 0 ? (
                        <div className="flex w-full justify-between items-center">
                            <span className="text-sm text-muted-foreground">{selectedRemarkIds.length} remark(s) selected</span>
                            <Button variant="destructive" onClick={handleDeleteSelected}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Selected
                            </Button>
                        </div>
                    ) : (
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
                    )}
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
