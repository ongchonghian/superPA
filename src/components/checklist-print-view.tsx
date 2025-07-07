
'use client';

import React from 'react';
import type { Checklist, Task, TaskPriority, TaskStatus, Remark } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CheckCircle2, WandSparkles } from 'lucide-react';

interface ChecklistPrintViewProps {
  checklist: Checklist;
}

const statusColors: { [key in TaskStatus]: string } = {
  complete: 'bg-green-100 text-green-800 border-green-200',
  'in progress': 'bg-blue-100 text-blue-800 border-blue-200',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
};

const priorityColors: { [key in TaskPriority]: string } = {
    High: 'bg-red-100 text-red-800 border-red-200',
    Medium: 'bg-orange-100 text-orange-800 border-orange-200',
    Low: 'bg-gray-100 text-gray-800 border-gray-200',
};

const RemarkPrintDisplay = ({ text }: { text: string }) => {
  const newAiTodoMatch = text.match(/^\[ai-todo\|(pending|running|completed|failed)\]\s*(.*)/s);
  if (newAiTodoMatch) {
    const status = newAiTodoMatch[1];
    const todoText = newAiTodoMatch[2].trim();
    return (
      <div className="p-2 mt-1 rounded-lg border border-accent/30 bg-accent/10">
        <div className="flex items-start gap-2.5">
          <WandSparkles className="h-4 w-4 mt-0.5 text-accent flex-shrink-0" />
          <div className="flex-1">
            <h4 className="text-xs font-semibold tracking-wider uppercase text-accent">AI To-Do ({status})</h4>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{todoText}</p>
          </div>
        </div>
      </div>
    );
  }

  const promptExecutionMatch = text.match(/^\[prompt-execution\|(running|completed|failed)\]\s*(.*)/s);
  if (promptExecutionMatch) {
    const status = promptExecutionMatch[1];
    let content = promptExecutionMatch[2].trim();
    const storageLinkRegex = /\[View results\]\(storage:\/\/([^)]+)\)/;
    const storageMatch = content.match(storageLinkRegex);
    if(storageMatch) {
        content = content.replace(storageLinkRegex, '').trim();
    }
    return (
      <div className="p-2 mt-1 rounded-lg border border-purple-200 bg-purple-50">
        <div className="flex items-start gap-2.5">
          <WandSparkles className="h-4 w-4 mt-0.5 text-purple-600 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="text-xs font-semibold tracking-wider uppercase text-purple-700">Prompt Execution ({status})</h4>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{content}</p>
             {storageMatch && <p className="text-xs text-muted-foreground">(Full report available in interactive view)</p>}
          </div>
        </div>
      </div>
    );
  }

  const storageLinkRegex = /\[View results\]\(storage:\/\/([^)]+)\)/;
  const storageMatch = text.match(storageLinkRegex);
  const summaryMatch = text.match(/\*\*Summary:\*\*\n(.+)/s);
  if (storageMatch) {
    const summary = summaryMatch ? summaryMatch[1].trim() : '';
    return (
      <div className="p-2 mt-1 rounded-lg border border-green-200 bg-green-50">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="text-xs font-semibold tracking-wider uppercase text-green-700">AI Execution Complete</h4>
            {summary && <p className="text-sm text-foreground/90 mt-1 mb-2">{summary}</p>}
            <p className="text-xs text-muted-foreground">(Full report available in the interactive view)</p>
          </div>
        </div>
      </div>
    );
  }

  return <p className="text-sm text-foreground/90 whitespace-pre-wrap">{text}</p>;
};

export function ChecklistPrintView({ checklist }: ChecklistPrintViewProps) {
  if (!checklist) return null;

  const incompleteTasks = checklist.tasks.filter(t => t.status !== 'complete');
  const completedTasks = checklist.tasks.filter(t => t.status === 'complete');

  const renderTaskRow = (task: Task) => {
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

    const flattenedRemarks: {remark: Remark, level: number}[] = [];
    const addChildrenToFlattenedList = (parentId: string, level: number) => {
        const children = remarksMap.get(parentId) || [];
        children.forEach(child => {
            flattenedRemarks.push({ remark: child, level: level });
            addChildrenToFlattenedList(child.id, level + 1);
        });
    };
    addChildrenToFlattenedList('root', 0);


    return (
      <TableRow key={task.id}>
        <TableCell className="w-[40%] font-medium align-top">
          <div>{task.description}</div>
          {flattenedRemarks.length > 0 && (
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
                      <RemarkPrintDisplay text={remark.text} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TableCell>
        <TableCell className="align-top">{task.assignee}</TableCell>
        <TableCell className="align-top">
          <Badge variant="outline" className={`${priorityColors[task.priority]} print-badge`}>{task.priority}</Badge>
        </TableCell>
        <TableCell className="align-top">{format(parseISO(task.dueDate), 'MMM dd, yyyy')}</TableCell>
        <TableCell className="align-top">
            <Badge variant="outline" className={`${statusColors[task.status]} print-badge`}>
            {task.status}
            </Badge>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div className="p-1">
      <h1 className="text-3xl font-bold font-headline mb-2">{checklist.name}</h1>
      <p className="text-muted-foreground mb-6">A printed report of the &quot;{checklist.name}&quot; checklist.</p>

      {incompleteTasks.length > 0 && (
        <section className="mb-8 page-break-before">
          <h2 className="text-2xl font-bold font-headline mb-4">Incomplete Tasks</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Task</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incompleteTasks.map(renderTaskRow)}
            </TableBody>
          </Table>
        </section>
      )}

      {completedTasks.length > 0 && (
        <section className="page-break-before">
          <h2 className="text-2xl font-bold font-headline mb-4">Completed Tasks</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Task</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completedTasks.map(renderTaskRow)}
            </TableBody>
          </Table>
        </section>
      )}

      {checklist.tasks.length === 0 && (
        <p className="text-muted-foreground text-center py-8">This checklist has no tasks.</p>
      )}
    </div>
  );
}
