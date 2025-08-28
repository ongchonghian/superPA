

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
  CheckCircle2,
  ArrowUpRight,
  Loader2,
  CornerDownRight,
  History,
  Hourglass,
  List,
} from 'lucide-react';
import type { Checklist, Task, TaskPriority, TaskStatus, Remark, AppSettings } from '@/lib/types';
import { format, parseISO, formatDistanceToNow, isSameDay, addMinutes, isAfter } from 'date-fns';
import {PRIORITIES, STATUSES} from '@/lib/data';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from './ui/card';

type SortKey = keyof Task | '';

interface TaskTableProps {
  checklist: Checklist;
  onUpdate: (checklist: Partial<Checklist> & { id: string }) => void;
  onExecuteAiTodo: (task: Task, remark: Remark) => void;
  runningRemarkIds: string[];
  onRunRefinedPrompt: (task: Task, parentRemark: Remark) => void;
  isOwner: boolean;
  userId: string;
  settings: AppSettings;
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

interface RemarkDisplayProps {
  remark: Remark;
  task: Task;
  onRunRefinedPrompt: (task: Task, parentRemark: Remark) => void;
  onExecuteAiTodo: (task: Task, remark: Remark) => void;
  isTaskBusy: boolean;
  isOwner: boolean;
  settings: AppSettings;
}

const RemarkDisplay = ({ remark, task, onRunRefinedPrompt, onExecuteAiTodo, isTaskBusy, isOwner, settings }: RemarkDisplayProps) => {
  const { id, text, timestamp } = remark;

  const promptExecutionMatch = text.match(/^\[prompt-execution\|(running|completed|failed)\]\s*(.*)/s);
  if (promptExecutionMatch) {
    const status = promptExecutionMatch[1];
    let content = promptExecutionMatch[2].trim();
    const storageLinkRegex = /\[View results\]\(storage:\/\/([^)]+)\)/;
    const storageMatch = content.match(storageLinkRegex);
    let path = '';
    if(storageMatch) {
        path = storageMatch[1];
        content = content.replace(storageLinkRegex, '').trim();
    }
    
    const statusPill = (
        <span className={`capitalize px-1.5 py-0.5 text-xs rounded-full font-medium ${
            status === 'running' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
            status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' :
            'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
        }`}>
            {status}
        </span>
    );

    const handleViewReport = () => {
      window.dispatchEvent(new CustomEvent('view-report', { detail: path }));
    };

    return (
      <div id={`remark-${id}`} className="p-2 mt-1 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20">
        <div className="flex items-start gap-2.5">
          <CornerDownRight className="h-4 w-4 mt-0.5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
          <div className="flex-1">
             <div className="flex justify-between items-center mb-1">
                <h4 className="text-xs font-semibold tracking-wider uppercase text-purple-700 dark:text-purple-400">Prompt Execution</h4>
                {statusPill}
            </div>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{content}</p>
            {path && (
                 <Button variant="link" className="p-0 h-auto text-sm font-medium text-primary hover:underline mt-2" onClick={handleViewReport}>
                    View Full Report
                    <ArrowUpRight className="inline-block ml-1 h-3 w-3" />
                </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render AI To-Do
  const aiTodoMatch = text.match(/^\[ai-todo\|(pending|queued|running|completed|failed)\]\s*(.*)/s);
  if (aiTodoMatch) {
    const status = aiTodoMatch[1];
    const todoText = aiTodoMatch[2].trim();
    
    const isPending = status === 'pending';
    const isQueued = status === 'queued';
    const isRunning = status === 'running';
    const isCompleted = status === 'completed';
    const isFailed = status === 'failed';
    
    const completedTime = parseISO(timestamp);
    const retryTime = addMinutes(completedTime, settings.rerunTimeout || 5);
    const canRetryCompleted = isAfter(new Date(), retryTime);

    const showRunButton = isPending;
    const showRetryButton = isFailed || (isCompleted && canRetryCompleted);
    
    const statusConfig = {
        pending: {
            icon: WandSparkles,
            color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
            iconColor: 'text-yellow-600 dark:text-yellow-400',
            borderColor: 'border-yellow-200 dark:border-yellow-800',
            bgColor: 'bg-yellow-50 dark:bg-yellow-900/20'
        },
        queued: {
            icon: Hourglass,
            color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300',
            iconColor: 'text-sky-600 dark:text-sky-400',
            borderColor: 'border-sky-200 dark:border-sky-800',
            bgColor: 'bg-sky-50 dark:bg-sky-900/20'
        },
        running: {
            icon: Loader2,
            color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
            iconColor: 'text-blue-600 dark:text-blue-400',
            borderColor: 'border-blue-200 dark:border-blue-800',
            bgColor: 'bg-blue-50 dark:bg-blue-900/20'
        },
        completed: {
            icon: CheckCircle2,
            color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
            iconColor: 'text-green-600 dark:text-green-400',
            borderColor: 'border-green-200 dark:border-green-800',
            bgColor: 'bg-green-50 dark:bg-green-900/20'
        },
        failed: {
            icon: History,
            color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
            iconColor: 'text-red-600 dark:text-red-400',
            borderColor: 'border-red-200 dark:border-red-800',
            bgColor: 'bg-red-50 dark:bg-red-900/20'
        }
    }[status] || { icon: WandSparkles, color: '', iconColor: 'text-accent', borderColor: 'border-accent/30', bgColor: 'bg-accent/10' };

    const StatusIcon = statusConfig.icon;
    
    return (
      <div id={`remark-${id}`} className={`p-2 mt-1 rounded-lg border ${statusConfig.borderColor} ${statusConfig.bgColor}`}>
        <div className="flex items-start gap-2.5">
          <StatusIcon className={`h-4 w-4 mt-0.5 ${statusConfig.iconColor} flex-shrink-0 ${isRunning ? 'animate-spin' : ''}`} />
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
                <h4 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">AI To-Do</h4>
                <span className={`capitalize px-1.5 py-0.5 text-xs rounded-full font-medium ${statusConfig.color}`}>
                  {status}
                </span>
            </div>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{todoText}</p>
            {showRunButton && (
                <div className="mt-2">
                    <Button size="sm" variant="outline" onClick={() => onExecuteAiTodo(task, remark)} disabled={isTaskBusy || !isOwner}>
                        <WandSparkles className="mr-2 h-4 w-4" />
                        Run this To-Do
                    </Button>
                </div>
            )}
            {showRetryButton && (
                 <div className="mt-2">
                    <Button size="sm" variant="outline" onClick={() => onExecuteAiTodo(task, remark)} disabled={isTaskBusy || !isOwner}>
                        <History className="mr-2 h-4 w-4" />
                        Run this To-Do (Retry)
                    </Button>
                </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // Render AI Result
  const storageLinkRegex = /\[View results\]\(storage:\/\/([^)]+)\)/;
  const storageMatch = text.match(storageLinkRegex);
  const summaryMatch = text.match(/\*\*Summary:\*\*\n(.+)/s);
  
  if (storageMatch) {
    const path = storageMatch[1];
    const summary = summaryMatch ? summaryMatch[1].trim() : '';

    const handleViewReport = () => {
      window.dispatchEvent(new CustomEvent('view-report', { detail: path }));
    };
    
    const promptGenSummaryRegex = /Generated a refined prompt for: (.*)/s;
    const promptGenMatch = summary.match(promptGenSummaryRegex);

    return (
      <div id={`remark-${id}`} className="p-2 mt-1 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="text-xs font-semibold tracking-wider uppercase text-green-700 dark:text-green-400">AI Execution Complete</h4>
            {summary && <p className="text-sm text-foreground/90 mt-1 mb-2">{summary}</p>}
            <div className="flex items-center gap-2 flex-wrap mt-2">
                <Button variant="link" className="p-0 h-auto text-sm font-medium text-primary hover:underline" onClick={handleViewReport}>
                    View Full Report
                    <ArrowUpRight className="inline-block ml-1 h-3 w-3" />
                </Button>
                
                {promptGenMatch && (
                  <Button variant="outline" size="sm" className="h-auto px-2 py-1 text-xs" onClick={() => onRunRefinedPrompt(task, remark)} disabled={isTaskBusy || !isOwner}>
                     <WandSparkles className="mr-1.5 h-3 w-3" />
                     Run Generated Prompt
                  </Button>
                )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render standard text
  return <p id={`remark-${id}`} className="text-sm text-foreground/90 whitespace-pre-wrap">{text}</p>;
};

export function TaskTable({ checklist, onUpdate, onExecuteAiTodo, runningRemarkIds, onRunRefinedPrompt, isOwner, userId, settings }: TaskTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('dueDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState({
    assignee: '',
    status: 'all',
    priority: 'all',
  });

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
      updatedRemarks.push({
        id: `rem_${Date.now()}_${Math.random()}`,
        text: systemRemarkText,
        userId: 'system',
        timestamp: new Date().toISOString(),
      });
    } else {
      const completionRemarkIndex = updatedRemarks.findIndex(
        (r) => r.text === systemRemarkText && r.userId === 'system'
      );

      if (completionRemarkIndex > -1) {
        const completionRemark = updatedRemarks[completionRemarkIndex];
        const remarkDate = parseISO(completionRemark.timestamp);
        
        if (isSameDay(remarkDate, new Date())) {
          updatedRemarks.splice(completionRemarkIndex, 1);
        } else {
          updatedRemarks.push({
            id: `rem_${Date.now()}_${Math.random()}`,
            text: systemRemarkTextIncomplete,
            userId: 'system',
            timestamp: new Date().toISOString(),
          });
        }
      } else {
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

  const openTaskDialog = (task: Partial<Task>) => {
    const event = new CustomEvent('open-task-dialog', { detail: task });
    window.dispatchEvent(event);
  };
  
  const openRemarksSheet = (task: Task) => {
    const event = new CustomEvent('open-remarks', { detail: task });
    window.dispatchEvent(event);
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
                <SelectTrigger className="w-full sm:w-[150px]"><SelectValue/></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={v => setFilters(f => ({ ...f, status: v }))}>
                <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
      </div>
      <div className="hidden md:block rounded-lg border">
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
                const isTaskBusy = task.remarks.some(r => runningRemarkIds.includes(r.id));
                
                const flattenedRemarks: {remark: Remark, level: number}[] = [];
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
            
                const addChildrenToFlattenedList = (parentId: string, level: number) => {
                    const children = remarksMap.get(parentId) || [];
                    children.forEach(child => {
                        flattenedRemarks.push({ remark: child, level: level });
                        addChildrenToFlattenedList(child.id, level + 1);
                    });
                };
                addChildrenToFlattenedList('root', 0);

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
                        {flattenedRemarks.map(({ remark, level }) => {
                          const isRunning = runningRemarkIds.includes(remark.id);
                          
                          return (
                            <div key={remark.id} className="flex items-start gap-2.5" style={{ paddingLeft: `${level * 1.5}rem` }}>
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
                                  <RemarkDisplay 
                                    remark={remark} 
                                    task={task} 
                                    onRunRefinedPrompt={onRunRefinedPrompt}
                                    onExecuteAiTodo={onExecuteAiTodo}
                                    isTaskBusy={isTaskBusy}
                                    isOwner={isOwner}
                                    settings={settings}
                                  />
                                  </div>
                                </div>
                              )
                            })}
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
                              <DropdownMenuItem onSelect={() => openTaskDialog(task)}>
                                  Edit Task
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => openRemarksSheet(task)}>
                                  <MessageSquare className="mr-2 h-4 w-4" />
                                  View/Add Remarks
                              </DropdownMenuItem>
                              {isOwner && (
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => handleDeleteTask(task.id)}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Task
                                </DropdownMenuItem>
                               )}
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
        <div className="md:hidden space-y-4">
            {filteredAndSortedTasks.length > 0 ? (
                filteredAndSortedTasks.map(task => {
                    const isTaskBusy = task.remarks.some(r => runningRemarkIds.includes(r.id));
                    
                    const flattenedRemarks: {remark: Remark, level: number}[] = [];
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
                
                    const addChildrenToFlattenedList = (parentId: string, level: number) => {
                        const children = remarksMap.get(parentId) || [];
                        children.forEach(child => {
                            flattenedRemarks.push({ remark: child, level: level });
                            addChildrenToFlattenedList(child.id, level + 1);
                        });
                    };
                    addChildrenToFlattenedList('root', 0);

                    return (
                        <Card key={task.id} data-state={task.status === 'complete' ? 'completed' : 'pending'}>
                            <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                    <Checkbox
                                        id={`complete-mobile-${task.id}`}
                                        aria-label={`Mark task ${task.description} as complete`}
                                        checked={task.status === 'complete'}
                                        onCheckedChange={(isChecked) => handleTaskCompletionChange(task, !!isChecked)}
                                        className="mt-1"
                                    />
                                    <div className="flex-1">
                                        <p className={`font-medium ${task.status === 'complete' ? 'text-muted-foreground line-through' : ''}`}>
                                            {task.description}
                                        </p>
                                        <div className="mt-2 text-xs text-muted-foreground space-y-1">
                                            <p><strong>Assignee:</strong> {task.assignee}</p>
                                            <p><strong>Due:</strong> {format(parseISO(task.dueDate), 'MMM dd, yyyy')}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <Badge variant="outline" className={priorityColors[task.priority]}>{task.priority}</Badge>
                                        <Badge variant="outline" className={statusColors[task.status]}>{task.status}</Badge>
                                    </div>
                                    <div className="no-print -mr-2">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <span className="sr-only">Open menu</span>
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                            <DropdownMenuItem onSelect={() => openTaskDialog(task)}>
                                                Edit Task
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => openRemarksSheet(task)}>
                                                <MessageSquare className="mr-2 h-4 w-4" />
                                                View/Add Remarks
                                            </DropdownMenuItem>
                                            {isOwner && (
                                                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => handleDeleteTask(task.id)}>
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete Task
                                                </DropdownMenuItem>
                                            )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                                <div className="mt-4 space-y-3">
                                    {flattenedRemarks.map(({ remark, level }) => (
                                    <div key={remark.id} className="flex items-start gap-2.5" style={{ paddingLeft: `${level * 1.5}rem` }}>
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
                                            <RemarkDisplay 
                                                remark={remark} 
                                                task={task} 
                                                onRunRefinedPrompt={onRunRefinedPrompt}
                                                onExecuteAiTodo={onExecuteAiTodo}
                                                isTaskBusy={isTaskBusy}
                                                isOwner={isOwner}
                                                settings={settings}
                                            />
                                        </div>
                                    </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )
                })
            ) : (
                 <div className="text-center text-muted-foreground py-16">
                    No tasks found.
                </div>
            )}
        </div>
      <div className="fixed bottom-8 right-8 no-print">
        <Button
          onClick={() => openTaskDialog({})}
          className="rounded-full h-16 w-16 shadow-lg"
          size="icon"
        >
          <Plus className="h-8 w-8" />
          <span className="sr-only">Add Task</span>
        </Button>
      </div>
    </div>
  );
}

    