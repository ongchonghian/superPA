
'use client';

import React from 'react';
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
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Plus,
  Trash2,
  FileUp,
  FileDown,
  MoreVertical,
  WandSparkles,
} from 'lucide-react';

interface ChecklistHeaderProps {
  checklists: { id: string; name: string }[];
  activeChecklistId: string | null;
  onSwitch: (id: string) => void;
  onAdd: () => void;
  onDeleteRequest: (id: string) => void;
  onInitiateImport: (mode: 'new' | 'current') => void;
  onExportMarkdown: () => void;
  onExportPdf: () => void;
  onGetAiSuggestions: () => void;
  progress: number;
  hasActiveChecklist: boolean;
}

export function ChecklistHeader({
  checklists,
  activeChecklistId,
  onSwitch,
  onAdd,
  onDeleteRequest,
  onInitiateImport,
  onExportMarkdown,
  onExportPdf,
  onGetAiSuggestions,
  progress,
  hasActiveChecklist,
}: ChecklistHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex flex-col items-center justify-between gap-4 border-b border-border bg-background/80 p-4 backdrop-blur-sm no-print">
      <div className="flex w-full flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-7 w-7 text-primary"
              >
                <path d="M7 10v4h10v-4" />
                <path d="M10.5 10V7.5a1.5 1.5 0 0 1 3 0V10" />
                <path d="M17 14v2.5a1.5 1.5 0 0 1-3 0V14" />
                <path d="M2 12s.5-5 5-5 5 5 5 5" />
                <path d="M22 12s-.5 5-5 5-5-5-5-5" />
              </svg>
              <h1 className="text-2xl font-bold font-headline text-foreground">
                Alpha Release Hub
              </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {checklists.length > 0 && (
            <Select value={activeChecklistId || ''} onValueChange={onSwitch}>
              <SelectTrigger className="w-[180px] sm:w-[250px]">
                <SelectValue placeholder="Select a checklist" />
              </SelectTrigger>
              <SelectContent>
                {checklists.map((checklist) => (
                  <SelectItem key={checklist.id} value={checklist.id}>
                    {checklist.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={onAdd} size="sm">
            <Plus className="mr-2 h-4 w-4" /> New
          </Button>
           <Button onClick={onGetAiSuggestions} size="sm" variant="outline" disabled={!hasActiveChecklist}>
            <WandSparkles className="mr-2 h-4 w-4" /> Suggest AI To-Dos
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 w-9 p-0">
                <span className="sr-only">More actions</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FileUp className="mr-2 h-4 w-4" /> Import...
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={() => onInitiateImport('new')}>
                    As New Checklist
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => onInitiateImport('current')}
                    disabled={!hasActiveChecklist}
                  >
                    Add to Current Checklist
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger disabled={!hasActiveChecklist}>
                  <FileDown className="mr-2 h-4 w-4" /> Export
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={onExportMarkdown}>as Markdown</DropdownMenuItem>
                  <DropdownMenuItem onSelect={onExportPdf}>as PDF</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {activeChecklistId && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => onDeleteRequest(activeChecklistId)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Current Checklist
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {hasActiveChecklist && (
        <div className="w-full flex items-center gap-4 pt-2">
            <Progress value={progress} className="w-full h-2" />
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">{Math.round(progress)}%</span>
        </div>
      )}
    </header>
  );
}
