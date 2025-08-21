
'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useToast } from '@/hooks/use-toast';
import type { Checklist, UserProfile, Invite } from '@/lib/types';
import { db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Copy, Check, Trash2, Mail } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

interface ShareChecklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklist: Checklist;
  userProfile: UserProfile;
  collaborators: UserProfile[];
  onUpdateCollaborators: (collaboratorIds: string[]) => void;
}

export function ShareChecklistDialog({
  open,
  onOpenChange,
  checklist,
  userProfile,
  collaborators,
  onUpdateCollaborators,
}: ShareChecklistDialogProps) {
  const { toast } = useToast();
  const [inviteLink, setInviteLink] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isCreatingLink, setIsCreatingLink] = useState(false);

  const createInviteLink = async () => {
    if (!db) return;
    setIsCreatingLink(true);
    try {
      const inviteData: Omit<Invite, 'id'> = {
        checklistId: checklist.id,
        checklistName: checklist.name,
        inviterId: userProfile.uid,
        inviterName: userProfile.displayName || 'An owner',
      };
      const docRef = await addDoc(collection(db, 'invites'), inviteData);
      const newInviteLink = `${window.location.origin}?invite=${docRef.id}`;
      setInviteLink(newInviteLink);
    } catch (error) {
      console.error('Error creating invite link:', error);
      toast({
        title: 'Error',
        description: 'Could not create invite link.',
        variant: 'destructive',
      });
    } finally {
        setIsCreatingLink(false);
    }
  };
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setIsCopied(true);
      toast({ title: 'Copied to clipboard!' });
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleRemoveCollaborator = (uid: string) => {
    const updatedCollaborators = (checklist.collaboratorIds || []).filter(id => id !== uid);
    onUpdateCollaborators(updatedCollaborators);
  }

  React.useEffect(() => {
    if (!open) {
      setInviteLink('');
      setIsCopied(false);
      setIsCreatingLink(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share "{checklist.name}"</DialogTitle>
          <DialogDescription>
            Invite others to collaborate on this checklist. Collaborators can view, add, and edit tasks.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
            <div>
                <h3 className="text-sm font-medium mb-2">People with access</h3>
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={userProfile.photoURL || ''} />
                                <AvatarFallback>{userProfile.displayName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="text-sm font-semibold">{userProfile.displayName}</p>
                                <p className="text-xs text-muted-foreground">{userProfile.email}</p>
                            </div>
                        </div>
                        <span className="text-xs text-muted-foreground">Owner</span>
                    </div>
                    {collaborators.map(c => (
                        <div key={c.uid} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={c.photoURL || ''} />
                                    <AvatarFallback>{c.displayName?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="text-sm font-semibold">{c.displayName}</p>
                                    <p className="text-xs text-muted-foreground">{c.email}</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveCollaborator(c.uid)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
            <div>
                <h3 className="text-sm font-medium mb-2">Invite with a link</h3>
                {inviteLink ? (
                <div className="flex items-center gap-2">
                    <Input value={inviteLink} readOnly />
                    <Button size="icon" variant="outline" onClick={copyToClipboard}>
                    {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                </div>
                ) : (
                <Button onClick={createInviteLink} disabled={isCreatingLink}>
                    {isCreatingLink ? 'Creating...' : 'Create Invite Link'}
                </Button>
                )}
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
