
'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import { GEMINI_MODELS, GEMINI_MODEL_CONFIGS } from '@/lib/data';
import type { AppSettings, GeminiModel } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { KeyRound, Timer, Github, Info } from 'lucide-react';
import { Separator } from './ui/separator';

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

  const selectedModelConfig = useMemo(() => {
    const modelKey = settings.model as GeminiModel;
    if (GEMINI_MODEL_CONFIGS[modelKey]) {
      return GEMINI_MODEL_CONFIGS[modelKey];
    }
    return null;
  }, [settings.model]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your AI settings and integrations. Settings are saved in your browser&apos;s local storage.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="space-y-4">
              <h3 className="text-base font-semibold text-foreground">AI Configuration</h3>
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
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
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

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="max-input-tokens">Max Input Tokens</Label>
                    <Input
                      id="max-input-tokens"
                      type="number"
                      placeholder="e.g., 262144"
                      value={settings.maxInputTokens || ''}
                      onChange={(e) => setSettings({ ...settings, maxInputTokens: parseInt(e.target.value, 10) || undefined })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-output-tokens">Max Output Tokens</Label>
                    <Input
                      id="max-output-tokens"
                      type="number"
                      placeholder="e.g., 2048"
                      value={settings.maxOutputTokens || ''}
                      onChange={(e) => setSettings({ ...settings, maxOutputTokens: parseInt(e.target.value, 10) || undefined })}
                    />
                  </div>
              </div>

              {selectedModelConfig && (
                <Alert variant="default">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Model Token Guidance</AlertTitle>
                    <AlertDescription>
                        For <strong>{settings.model}</strong>:<br/>
                        - Max Input: {selectedModelConfig.maxInput.toLocaleString()}<br/>
                        - Max Output: {selectedModelConfig.maxOutput.toLocaleString()}<br/>
                        - Leave fields blank to use model defaults (Input: {selectedModelConfig.defaultInput.toLocaleString()}, Output: {selectedModelConfig.defaultOutput.toLocaleString()}).
                    </AlertDescription>
                </Alert>
              )}


               <div className="space-y-2">
                <Label htmlFor="rerun-timeout">Re-run Timeout (minutes)</Label>
                <Input
                  id="rerun-timeout"
                  type="number"
                  min="1"
                  placeholder="e.g., 5"
                  value={settings.rerunTimeout || 5}
                  onChange={(e) => setSettings({ ...settings, rerunTimeout: parseInt(e.target.value, 10) || 5 })}
                />
                 <Alert className="mt-2" variant="default">
                    <Timer className="h-4 w-4" />
                    <AlertTitle>Task Re-run Configuration</AlertTitle>
                    <AlertDescription>
                      This sets the time in minutes after which a &quot;Retry&quot; button will appear on completed AI To-Dos, allowing you to run them again.
                    </AlertDescription>
                </Alert>
              </div>
          </div>
          
          <Separator />
          
          <div className="space-y-4">
              <h3 className="text-base font-semibold text-foreground">Integrations</h3>
              <div className="p-4 border rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Github className="h-6 w-6"/>
                  <div>
                    <h4 className="font-medium">GitHub</h4>
                    <p className="text-sm text-muted-foreground">Not connected</p>
                  </div>
                </div>
                <Button variant="outline" disabled>Connect to GitHub</Button>
              </div>
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
