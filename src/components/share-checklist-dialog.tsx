

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
import { addDoc, collection, serverTimestamp, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { Copy, Check, Trash2, Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';

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
  const [inviteEmail, setInviteEmail] = useState('');

  const createInviteLink = async () => {
    if (!db) return;
    if (!inviteEmail || !/^\S+@\S+\.\S+$/.test(inviteEmail)) {
        toast({ title: 'Invalid Email', description: 'Please enter a valid email address.', variant: 'destructive' });
        return;
    }
    
    // Check if the user is already a collaborator or the owner
    const allEmails = [userProfile.email, ...collaborators.map(c => c.email)];
    if (allEmails.includes(inviteEmail)) {
      toast({ title: 'Already a Member', description: 'This user already has access to the checklist.', variant: 'destructive' });
      return;
    }

    setIsCreatingLink(true);
    try {
      // Clean up any old, unaccepted invites for this email on this checklist
      const q = query(collection(db, 'invites'), where('checklistId', '==', checklist.id), where('email', '==', inviteEmail));
      const existingInvites = await getDocs(q);
      const batch = writeBatch(db);
      existingInvites.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      // Create new invite
      const inviteData: Omit<Invite, 'id'> = {
        checklistId: checklist.id,
        checklistName: checklist.name,
        inviterId: userProfile.uid,
        inviterName: userProfile.displayName || 'An owner',
        email: inviteEmail,
        createdAt: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, 'invites'), inviteData);
      const newInviteLink = `${window.location.origin}?invite=${docRef.id}`;
      setInviteLink(newInviteLink);
      setInviteEmail('');
      toast({ title: 'Invite Link Created', description: 'Copy the link and send it to your collaborator.' });
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
      setInviteEmail('');
      setIsCopied(false);
      setIsCreatingLink(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share "{checklist.name}"</DialogTitle>
          <DialogDescription>
            Invite others to collaborate on this checklist. Collaborators can view and edit tasks.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-6">
            <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">People with access</h3>
                <ScrollArea className="max-h-48 pr-3 -mr-3">
                  <div className="space-y-3">
                      {/* Owner */}
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                  <AvatarImage src={userProfile.photoURL || undefined} />
                                  <AvatarFallback>{userProfile.displayName?.charAt(0) || 'U'}</AvatarFallback>
                              </Avatar>
                              <div>
                                  <p className="text-sm font-semibold">{userProfile.displayName}</p>
                                  <p className="text-xs text-muted-foreground">{userProfile.email}</p>
                              </div>
                          </div>
                          <span className="text-xs text-muted-foreground font-medium">Owner</span>
                      </div>
                      {/* Collaborators */}
                      {collaborators.map(c => (
                          <div key={c.uid} className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                  <Avatar className="h-9 w-9">
                                      <AvatarImage src={c.photoURL || undefined} />
                                      <AvatarFallback>{c.displayName?.charAt(0) || 'C'}</AvatarFallback>
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
                </ScrollArea>
            </div>
            <div className="space-y-3">
                <Label htmlFor="invite-email" className="text-sm font-medium">Invite new collaborator</Label>
                <div className="flex items-center gap-2">
                    <Input 
                        id="invite-email"
                        type="email"
                        placeholder="Enter collaborator's email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        disabled={isCreatingLink}
                    />
                    <Button onClick={createInviteLink} disabled={isCreatingLink || !inviteEmail} size="icon">
                        <Send className="h-4 w-4" />
                        <span className="sr-only">Send Invite</span>
                    </Button>
                </div>

                {inviteLink && (
                    <div className="space-y-2 pt-2">
                        <Label htmlFor="invite-link">Share this unique link</Label>
                        <div className="flex items-center gap-2">
                            <Input id="invite-link" value={inviteLink} readOnly />
                            <Button size="icon" variant="outline" onClick={copyToClipboard}>
                            {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
