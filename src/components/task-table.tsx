'use client';

import React, { useState, useMemo } from 'react';
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
  MoreHorizontal,
  Plus,
  Trash2,
  WandSparkles,
} from 'lucide-react';
import type { Checklist, Task, TaskPriority, TaskStatus } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { TaskDialog } from './task-dialog';
import { AiSuggestionDialog } from './ai-suggestion-dialog';
import {PRIORITIES, STATUSES} from '@/lib/data';

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

  const handleUpdateTask = (updatedTask: Task) => {
    const newTasks = checklist.tasks.map(t => (t.id === updatedTask.id ? updatedTask : t));
    onUpdate({ ...checklist, tasks: newTasks });
  };
  
  const handleAddTask = (newTask: Task) => {
    const newTasks = [...checklist.tasks, newTask];
    onUpdate({ ...checklist, tasks: newTasks });
  };
  
  const handleSaveTask = (taskToSave: Task) => {
      const exists = checklist.tasks.some(t => t.id === taskToSave.id);
      if (exists) {
        handleUpdateTask(taskToSave);
      } else {
        handleAddTask(taskToSave);
      }
  };

  const handleDeleteTask = (taskId: string) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
        const newTasks = checklist.tasks.filter(t => t.id !== taskId);
        onUpdate({ ...checklist, tasks: newTasks });
    }
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
              <TableHead>
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
              filteredAndSortedTasks.map(task => (
                <TableRow key={task.id} className={task.status === 'complete' ? 'bg-muted/50' : ''}>
                  <TableCell className={`font-medium ${task.status === 'complete' ? 'text-muted-foreground line-through' : ''}`}>
                    {task.description}
                  </TableCell>
                  <TableCell>{task.assignee}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={priorityColors[task.priority]}>{task.priority}</Badge>
                  </TableCell>
                  <TableCell>{format(parseISO(task.dueDate), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[task.status]}>
                      {task.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right no-print">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => {setDialogTask(task); setIsTaskDialogOpen(true);}}>
                            Edit Task
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => {setAiSuggestionTask(task); setIsAiDialogOpen(true);}}>
                          <WandSparkles className="mr-2 h-4 w-4" />
                          Suggest Next Steps
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => handleDeleteTask(task.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Task
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
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
      />
    </div>
  );
}
