

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
  DropdownMenuLabel,
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
  Share2,
  LogOut,
  Settings,
  Bell,
  FileText,
  ListOrdered,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import type { UserProfile, Notification } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from './ui/badge';

interface ChecklistHeaderProps {
  userProfile: UserProfile | null;
  onSignOut: () => void;
  checklists: { id: string; name: string }[];
  activeChecklistId: string | null;
  onSwitch: (id: string) => void;
  onAdd: () => void;
  onDeleteRequest: (id: string) => void;
  onInitiateImport: (mode: 'new' | 'current') => void;
  onExportMarkdown: () => void;
  onExportPdf: () => void;
  onExportConfluence: () => void;
  onGetAiSuggestions: () => void;
  onShare: () => void;
  onSettings: () => void;
  progress: number;
  hasActiveChecklist: boolean;
  isOwner: boolean;
  collaborators: UserProfile[];
  notifications: Notification[];
  onNotificationClick: (notification: Notification) => void;
  onNotificationsOpen: () => void;
  executionQueueSize: number;
}

export function ChecklistHeader({
  userProfile,
  onSignOut,
  checklists,
  activeChecklistId,
  onSwitch,
  onAdd,
  onDeleteRequest,
  onInitiateImport,
  onExportMarkdown,
  onExportPdf,
  onExportConfluence,
  onGetAiSuggestions,
  onShare,
  onSettings,
  progress,
  hasActiveChecklist,
  isOwner,
  collaborators,
  notifications,
  onNotificationClick,
  onNotificationsOpen,
  executionQueueSize,
}: ChecklistHeaderProps) {
  const unreadNotifications = notifications.filter(n => !n.read);

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
                Super PA
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
           <Button onClick={onGetAiSuggestions} size="sm" variant="outline" disabled={!hasActiveChecklist || !isOwner}>
            <WandSparkles className="mr-2 h-4 w-4" /> Suggest AI To-Dos
          </Button>
          {executionQueueSize > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative flex items-center">
                    <ListOrdered className="h-5 w-5 text-muted-foreground" />
                    <Badge variant="secondary" className="absolute -top-2 -right-3 px-1.5">{executionQueueSize}</Badge>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{executionQueueSize} AI task(s) in queue</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 w-9 p-0">
                <span className="sr-only">More actions</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onShare} disabled={!hasActiveChecklist || !isOwner}>
                <Share2 className="mr-2 h-4 w-4" /> Share
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
                  <DropdownMenuItem onSelect={onExportConfluence}>for Confluence</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {activeChecklistId && isOwner && (
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

          <DropdownMenu onOpenChange={(open) => open && onNotificationsOpen()}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="relative h-9 w-9">
                <Bell className="h-4 w-4" />
                {unreadNotifications.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-4 w-4 justify-center p-0">{unreadNotifications.length}</Badge>
                )}
                <span className="sr-only">Notifications</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length > 0 ? (
                notifications.map(notification => (
                  <DropdownMenuItem key={notification.id} onSelect={() => onNotificationClick(notification)}>
                    <FileText className="mr-2 h-4 w-4" />
                    <div className="flex-1 overflow-hidden">
                      <p className="text-xs font-semibold">New Report Ready</p>
                      <p className="truncate text-xs text-muted-foreground">
                        For task: &quot;{notification.taskDescription}&quot;
                      </p>
                    </div>
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled>
                  <p className="text-sm text-muted-foreground text-center w-full py-2">No new notifications</p>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={userProfile?.photoURL || ''} alt={userProfile?.displayName || 'User'} />
                        <AvatarFallback>{userProfile?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                    <p className="font-bold">{userProfile?.displayName}</p>
                    <p className="text-xs text-muted-foreground font-normal">{userProfile?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onSettings}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
      </div>
      {hasActiveChecklist && (
        <div className="w-full flex items-center gap-4 pt-2">
            <div className="flex items-center gap-2 flex-1">
                <Progress value={progress} className="w-full h-2" />
                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">{Math.round(progress)}%</span>
            </div>
            {collaborators.length > 0 && (
                <div className="flex items-center -space-x-2">
                    <TooltipProvider>
                        {collaborators.map(c => (
                            <Tooltip key={c.uid}>
                                <TooltipTrigger>
                                    <Avatar className="h-6 w-6 border-2 border-background">
                                        <AvatarImage src={c.photoURL || ''} />
                                        <AvatarFallback>{c.displayName?.charAt(0) || 'C'}</AvatarFallback>
                                    </Avatar>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{c.displayName}</p>
                                </TooltipContent>
                            </Tooltip>
                        ))}
                    </TooltipProvider>
                </div>
            )}
        </div>
      )}
    </header>
  );
}
