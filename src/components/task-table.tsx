
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowUpDown,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Trash2,
  WandSparkles,
} from 'lucide-react';
import type { Checklist, Task, TaskPriority, TaskStatus } from '@/lib/types';
import { format, parseISO, formatDistanceToNow, isSameDay } from 'date-fns';
import { TaskDialog } from './task-dialog';
import { AiSuggestionDialog } from './ai-suggestion-dialog';
import { TaskRemarksSheet } from './task-remarks-sheet';
import {PRIORITIES, STATUSES} from '@/lib/data';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';

type SortKey = keyof Task | '';

interface TaskTableProps {
  checklist: Checklist;
  onUpdate: (checklist: Checklist) => void;
}

const statusColors: { [key in TaskStatus]: string } = {
  complete: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800',
  'in progress': 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800',
};

const priorityColors: { [key in TaskPriority]: string } = {
    High: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800',
    Medium: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800',
    Low: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600',
};

const RemarkDisplay = ({ text }: { text: string }) => {
  const newAiTodoMatch = text.match(/^\[ai-todo\|(pending|running|completed|failed)\]\s*(.*)/s);

  if (newAiTodoMatch) {
    const status = newAiTodoMatch[1];
    const todoText = newAiTodoMatch[2].trim();
    
    const statusPill = (
        <span className={`capitalize px-1.5 py-0.5 text-xs rounded-full font-medium ${
            status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' :
            status === 'running' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
            status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' :
            'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
        }`}>
            {status}
        </span>
    );

    return (
      <div className="p-2 mt-1 rounded-lg border border-accent/30 bg-accent/10">
        <div className="flex items-start gap-2.5">
          <WandSparkles className="h-4 w-4 mt-0.5 text-accent flex-shrink-0" />
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
                <h4 className="text-xs font-semibold tracking-wider uppercase text-accent">AI To-Do</h4>
                {statusPill}
            </div>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{todoText}</p>
          </div>
        </div>
      </div>
    );
  }

  return <p className="text-sm text-foreground/90 whitespace-pre-wrap">{text}</p>;
};

export function TaskTable({ checklist, onUpdate }: TaskTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('dueDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState({
    assignee: '',
    status: 'all',
    priority: 'all',
  });
  const [dialogTask, setDialogTask] = useState<Partial<Task> | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [aiSuggestionTask, setAiSuggestionTask] = useState<Task | null>(null);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [remarksTask, setRemarksTask] = useState<Task | null>(null);
  const [isRemarksSheetOpen, setIsRemarksSheetOpen] = useState(false);

  useEffect(() => {
    if (isRemarksSheetOpen && remarksTask) {
      const updatedTask = checklist.tasks.find(t => t.id === remarksTask.id);
      if (updatedTask) {
        setRemarksTask(updatedTask);
      }
    }
  }, [checklist, remarksTask, isRemarksSheetOpen]);

  const assignees = useMemo(() => [...new Set(checklist.tasks.map(t => t.assignee))], [checklist.tasks]);

  const filteredAndSortedTasks = useMemo(() => {
    let tasks = [...checklist.tasks];
    if (filters.status !== 'all') {
      tasks = tasks.filter(t => t.status === filters.status);
    }
    if (filters.priority !== 'all') {
      tasks = tasks.filter(t => t.priority === filters.priority);
    }
    if (filters.assignee) {
      tasks = tasks.filter(t => t.assignee.toLowerCase().includes(filters.assignee.toLowerCase()));
    }
    if (sortKey) {
      tasks.sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return tasks;
  }, [checklist.tasks, filters, sortKey, sortDirection]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const handleUpdateTask = (taskToUpdate: Task) => {
      const newTasks = checklist.tasks.map(t => (t.id === taskToUpdate.id ? taskToUpdate : t));
      onUpdate({ ...checklist, tasks: newTasks });
  };
  
  const handleSaveTask = (taskToSave: Omit<Task, 'remarks'>) => {
      const exists = checklist.tasks.some(t => t.id === taskToSave.id);
      if (exists) {
        const existingTask = checklist.tasks.find(t => t.id === taskToSave.id)!;
        const updatedTask = { ...existingTask, ...taskToSave };
        handleUpdateTask(updatedTask);
      } else {
        const newTask = {...taskToSave, remarks: []};
        const newTasks = [...checklist.tasks, newTask];
        onUpdate({ ...checklist, tasks: newTasks });
      }
  };

  const handleDeleteTask = (taskId: string) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
        const newTasks = checklist.tasks.filter(t => t.id !== taskId);
        onUpdate({ ...checklist, tasks: newTasks });
    }
  };

  const handleTaskCompletionChange = (task: Task, isComplete: boolean) => {
    const newStatus = isComplete ? 'complete' : 'pending';
    if (task.status === newStatus) return;

    let updatedRemarks = [...task.remarks];
    const systemRemarkText = "Marked as completed.";
    const systemRemarkTextIncomplete = "Marked as incomplete.";

    if (isComplete) {
      // Task is being marked as complete
      updatedRemarks.push({
        id: `rem_${Date.now()}_${Math.random()}`,
        text: systemRemarkText,
        userId: 'system',
        timestamp: new Date().toISOString(),
      });
    } else {
      // Task is being marked as incomplete
      const completionRemarkIndex = updatedRemarks.findIndex(
        (r) => r.text === systemRemarkText && r.userId === 'system'
      );

      if (completionRemarkIndex > -1) {
        const completionRemark = updatedRemarks[completionRemarkIndex];
        const remarkDate = parseISO(completionRemark.timestamp);
        
        if (isSameDay(remarkDate, new Date())) {
          // If unchecked on the same day, remove the "Marked as completed." remark.
          updatedRemarks.splice(completionRemarkIndex, 1);
        } else {
          // If unchecked on a different day, add "Marked as incomplete."
          updatedRemarks.push({
            id: `rem_${Date.now()}_${Math.random()}`,
            text: systemRemarkTextIncomplete,
            userId: 'system',
            timestamp: new Date().toISOString(),
          });
        }
      } else {
         // This case handles if it was somehow marked complete without the system remark.
         updatedRemarks.push({
            id: `rem_${Date.now()}_${Math.random()}`,
            text: systemRemarkTextIncomplete,
            userId: 'system',
            timestamp: new Date().toISOString(),
        });
      }
    }

    const updatedTask = { ...task, status: newStatus, remarks: updatedRemarks };
    handleUpdateTask(updatedTask);
  };
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-center no-print">
        <h2 className="text-2xl font-bold font-headline text-foreground flex-shrink-0">{checklist.name}</h2>
        <div className="flex flex-wrap gap-2 w-full">
            <Input
                placeholder="Filter by assignee..."
                value={filters.assignee}
                onChange={e => setFilters(f => ({ ...f, assignee: e.target.value }))}
                className="max-w-xs"
            />
            <Select value={filters.priority} onValueChange={v => setFilters(f => ({ ...f, priority: v }))}>
                <SelectTrigger className="w-[150px]"><SelectValue/></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={v => setFilters(f => ({ ...f, status: v }))}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-px p-2"></TableHead>
              <TableHead className="w-[40%]">
                <Button variant="ghost" onClick={() => handleSort('description')}>
                  Task <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('assignee')}>
                  Assignee <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('priority')}>
                  Priority <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                 <Button variant="ghost" onClick={() => handleSort('dueDate')}>
                  Due Date <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="no-print"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedTasks.length > 0 ? (
              filteredAndSortedTasks.map(task => {
                const sortedRemarks = [...task.remarks].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                const aiTodos = sortedRemarks.filter(r => r.text.startsWith('[ai-todo|'));
                const regularRemarks = sortedRemarks.filter(r => !r.text.startsWith('[ai-todo|'));
                
                return (
                  <TableRow key={task.id} data-state={task.status === 'complete' ? 'completed' : 'pending'}>
                    <TableCell className="p-2 align-top">
                      <Checkbox
                          id={`complete-${task.id}`}
                          aria-label={`Mark task ${task.description} as complete`}
                          checked={task.status === 'complete'}
                          onCheckedChange={(isChecked) => handleTaskCompletionChange(task, !!isChecked)}
                        />
                    </TableCell>
                    <TableCell className={`font-medium align-top ${task.status === 'complete' ? 'text-muted-foreground' : ''}`}>
                      <div className={task.status === 'complete' ? 'line-through' : ''}>{task.description}</div>
                      
                      <div className="mt-4 space-y-3">
                        {aiTodos.length > 0 && (
                          aiTodos.map(remark => (
                          <div key={remark.id} className="flex items-start gap-2.5">
                            <Avatar className="h-6 w-6 border text-xs">
                                <AvatarFallback>{remark.userId.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="grid gap-0.5 flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="text-xs font-semibold text-foreground">{remark.userId}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(remark.timestamp), { addSuffix: true })}
                                    </p>
                                </div>
                                <RemarkDisplay text={remark.text} />
                            </div>
                          </div>
                        )))}

                        {aiTodos.length > 0 && regularRemarks.length > 0 && (
                          <div className="py-2"><hr className="border-dashed" /></div>
                        )}

                        {regularRemarks.length > 0 && (
                          regularRemarks.map(remark => (
                          <div key={remark.id} className="flex items-start gap-2.5">
                            <Avatar className="h-6 w-6 border text-xs">
                                <AvatarFallback>{remark.userId.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="grid gap-0.5 flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="text-xs font-semibold text-foreground">{remark.userId}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(remark.timestamp), { addSuffix: true })}
                                    </p>
                                </div>
                                <RemarkDisplay text={remark.text} />
                            </div>
                          </div>
                        )))}
                      </div>

                    </TableCell>
                    <TableCell className="align-top">{task.assignee}</TableCell>
                    <TableCell className="align-top">
                      <Badge variant="outline" className={priorityColors[task.priority]}>{task.priority}</Badge>
                    </TableCell>
                    <TableCell className="align-top">{format(parseISO(task.dueDate), 'MMM dd, yyyy')}</TableCell>
                    <TableCell className="align-top">
                      <Badge variant="outline" className={statusColors[task.status]}>
                        {task.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right align-top no-print">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => {setDialogTask(task); setIsTaskDialogOpen(true);}} disabled={task.status === 'complete'}>
                              Edit Task
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => {setRemarksTask(task); setIsRemarksSheetOpen(true);}}>
                              <MessageSquare className="mr-2 h-4 w-4" />
                              {task.status === 'complete' ? 'View Remarks' : 'Add Remark'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => {setAiSuggestionTask(task); setIsAiDialogOpen(true);}} disabled={task.status === 'complete'}>
                            <WandSparkles className="mr-2 h-4 w-4" />
                            Suggest AI To-Do
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => handleDeleteTask(task.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Task
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No tasks found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end no-print">
        <Button onClick={() => { setDialogTask({}); setIsTaskDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Task
        </Button>
      </div>
      
      <TaskDialog
        task={dialogTask}
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        onSave={handleSaveTask}
      />
      <AiSuggestionDialog
        task={aiSuggestionTask}
        open={isAiDialogOpen}
        onOpenChange={setIsAiDialogOpen}
        onUpdateTask={handleUpdateTask}
      />
      <TaskRemarksSheet
        task={remarksTask}
        open={isRemarksSheetOpen}
        onOpenChange={setIsRemarksSheetOpen}
        onUpdateTask={handleUpdateTask}
        assignees={assignees}
      />
    </div>
  );
}
