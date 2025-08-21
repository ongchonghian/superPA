
'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GEMINI_MODELS } from '@/lib/data';
import type { AppSettings } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { KeyRound } from 'lucide-react';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  settings: initialSettings,
  onSave,
}: SettingsDialogProps) {
  const [settings, setSettings] = useState<AppSettings>(initialSettings);

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings, open]);

  const handleSave = () => {
    onSave(settings);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>AI Settings</DialogTitle>
          <DialogDescription>
            Configure the AI model and provide your own API key. These settings are saved in your browser&apos;s local storage and are never stored on the server.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="api-key">Gemini API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="Enter your Gemini API Key"
              value={settings.apiKey || ''}
              onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
            />
             <Alert className="mt-2">
              <KeyRound className="h-4 w-4" />
              <AlertTitle>Want to use your own API Key?</AlertTitle>
              <AlertDescription>
                You can get your own free Gemini API key from {' '}
                <a href="https://aistudio.google.com/keys" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                   Google AI Studio
                </a>.
              </AlertDescription>
            </Alert>
          </div>
          <div className="space-y-2">
            <Label htmlFor="model">Gemini Model</Label>
            <Select
              value={settings.model}
              onValueChange={(value) => setSettings({ ...settings, model: value })}
            >
              <SelectTrigger id="model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GEMINI_MODELS.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
