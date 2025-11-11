'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Report } from '@/lib/types';
import { getAiSummaryClientAnalytics } from '@/lib/ai-summary-logs';

// LocalStorage keys
const FEATURE_SEEN_KEY = 'aiSummaryFeatureSeen';
const MENU_OPEN_COUNT_KEY = 'aiSummaryMenuOpenCount';
const MENU_OPEN_THRESHOLD = 3;

type AiSummaryFilter = {
  statuses?: string[];
  assignees?: string[];
  tags?: string[];
  fromDate?: string;
  toDate?: string;
};

type AiSummarySuccessResponse = {
  report: Report;
  reusedExisting: boolean;
};

type AiSummaryErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    retryable?: boolean;
  };
};

type AiSummaryState = {
  isInProgressByProject: Record<string, boolean>;
  showNewBadge: boolean;
};

type UseAiSummaryOptions = {
  getCurrentFilter: () => AiSummaryFilter;
  onReportReady: (report: Report) => void;
};

export function useAiSummary(options: UseAiSummaryOptions) {
  const { getCurrentFilter, onReportReady } = options;
  const { toast } = useToast();
  const analyticsInstance = useMemo(() => getAiSummaryClientAnalytics(), []);
  const [state, setState] = useState<AiSummaryState>(() => ({
    isInProgressByProject: {},
    showNewBadge: shouldShowNewBadge(),
  }));
  const inFlightRef = useRef<Record<string, boolean>>({});

  // Keep inFlightRef in sync with state to quickly short-circuit duplicate calls
  useEffect(() => {
    inFlightRef.current = state.isInProgressByProject;
  }, [state.isInProgressByProject]);

  function shouldShowNewBadge(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const seen = window.localStorage.getItem(FEATURE_SEEN_KEY);
      if (seen === 'true') return false;
      const countRaw = window.localStorage.getItem(MENU_OPEN_COUNT_KEY);
      const count = countRaw ? parseInt(countRaw, 10) : 0;
      return !Number.isNaN(count) ? count < MENU_OPEN_THRESHOLD : true;
    } catch {
      return true;
    }
  }

  const markFeatureSeen = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(FEATURE_SEEN_KEY, 'true');
      setState(prev => ({
        ...prev,
        showNewBadge: false,
      }));
    } catch {
      // Non-fatal
    }
  }, []);

  const incrementMenuOpen = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const countRaw = window.localStorage.getItem(MENU_OPEN_COUNT_KEY);
      const count = countRaw ? parseInt(countRaw, 10) : 0;
      const next = Number.isNaN(count) ? 1 : count + 1;
      window.localStorage.setItem(MENU_OPEN_COUNT_KEY, String(next));
      if (next >= MENU_OPEN_THRESHOLD) {
        window.localStorage.setItem(FEATURE_SEEN_KEY, 'true');
        setState(prev => ({
          ...prev,
          showNewBadge: false,
        }));
      }
    } catch {
      // Non-fatal
    }
  }, []);

  const setInProgress = useCallback((projectId: string, inProgress: boolean) => {
    setState(prev => {
      const nextMap = { ...prev.isInProgressByProject, [projectId]: inProgress };
      if (!inProgress) {
        // Optionally clean up false entries
        if (!nextMap[projectId]) {
          delete nextMap[projectId];
        }
      }
      return {
        ...prev,
        isInProgressByProject: nextMap,
      };
    });
  }, []);

  const buildFilterPayload = useCallback(() => {
    const raw = getCurrentFilter() || {};
    const filter: AiSummaryFilter = {};

    if (raw.statuses && raw.statuses.length) {
      filter.statuses = [...raw.statuses].sort();
    }
    if (raw.assignees && raw.assignees.length) {
      filter.assignees = [...raw.assignees].sort();
    }
    if (raw.tags && raw.tags.length) {
      filter.tags = [...raw.tags].sort();
    }
    if (raw.fromDate) {
      filter.fromDate = raw.fromDate;
    }
    if (raw.toDate) {
      filter.toDate = raw.toDate;
    }

    const normalized: Record<string, unknown> = {};
    Object.keys(filter)
      .sort()
      .forEach((key) => {
        const value = (filter as any)[key];
        if (
          value !== undefined &&
          !(
            Array.isArray(value) &&
            value.length === 0
          )
        ) {
          normalized[key] = value;
        }
      });

    const filterSignature = JSON.stringify(normalized);

    return { filter, filterSignature };
  }, [getCurrentFilter]);

  const mapErrorToMessage = (code?: string): string => {
    switch (code) {
      case 'UNAUTHENTICATED':
        return 'You must be signed in to generate AI summaries.';
      case 'PERMISSION_DENIED':
        return 'You do not have permission to generate reports for this project.';
      case 'PROJECT_NOT_FOUND':
        return 'Project not found or unavailable.';
      case 'AI_TIMEOUT':
        return 'AI summary generation timed out. Please try again.';
      case 'AI_FAILURE':
        return 'AI service failed to generate a summary. Please try again shortly.';
      case 'INVALID_REQUEST':
      case 'INTERNAL':
      default:
        return 'Failed to generate AI summary. Please try again.';
    }
  };

  const generateAiSummary = useCallback(
    async (projectId: string) => {
      const startTime = Date.now();

      if (!projectId) {
        toast({
          title: 'AI summary failed',
          description: 'No active project selected.',
          variant: 'destructive',
        });
        analyticsInstance.trackFailure({
                  projectId: 'unknown',
                  code: 'INVALID_REQUEST',
                  retryable: false,
                });
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        toast({
          title: 'AI summary failed',
          description: 'You’re offline. Reconnect to generate an AI summary.',
          variant: 'destructive',
        });
        analyticsInstance.trackFailure({
                  projectId,
                  code: 'OFFLINE',
                  retryable: true,
                });
        return;
      }

      if (inFlightRef.current[projectId]) {
        toast({
          title: 'AI summary in progress',
          description: 'AI summary is already being generated…',
        });
        return;
      }

      const { filter, filterSignature } = buildFilterPayload();

      setInProgress(projectId, true);

      analyticsInstance.trackClick({ projectId });

      const generatingToast = toast({
        title: 'Generating AI summary…',
        description: 'You can continue working. We’ll notify you when it’s ready.',
      });

      try {
        const response = await fetch('/api/ai-summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId,
            filter,
            filterSignature,
          }),
        });

        const contentType = response.headers.get('Content-Type') || '';
        let data: AiSummarySuccessResponse & AiSummaryErrorPayload | null = null;

        if (contentType.includes('application/json')) {
          data = (await response.json()) as any;
        }

        if (!response.ok) {
          const code = data?.error?.code;
          const retryable = !!data?.error?.retryable;
          const description = mapErrorToMessage(code);
          setInProgress(projectId, false);
          generatingToast.update({
            id: generatingToast.id,
            open: false,
          });
          toast({
            title: 'AI summary failed',
            description,
            variant: 'destructive',
          });

          analyticsInstance.trackFailure({
                      projectId,
                      code,
                      retryable,
                    });

          return;
        }

        if (!data || !('report' in data) || !data.report) {
          setInProgress(projectId, false);
          generatingToast.update({
            id: generatingToast.id,
            open: false,
          });
          toast({
            title: 'AI summary failed',
            description: 'Failed to generate AI summary. Please try again.',
            variant: 'destructive',
          });

          analyticsInstance.trackFailure({
                      projectId,
                      code: 'INVALID_RESPONSE',
                      retryable: true,
                    });

          return;
        }

        const { report, reusedExisting } = data as AiSummarySuccessResponse;

        setInProgress(projectId, false);

        generatingToast.update({
          id: generatingToast.id,
          open: false,
        });

        const latencyMs = Date.now() - startTime;

        analyticsInstance.trackSuccess({
                  projectId,
                  reusedExisting,
                  latencyMs,
                });

        // Mark feature as seen on first successful trigger.
        markFeatureSeen();

        const projectName =
          (report.metadata as any)?.projectName ||
          (report.metadata as any)?.project?.name ||
          'this project';

        const readyToast = toast({
          title: 'AI summary ready',
          description: 'View the summary for ' + projectName + '.',
          action: {
            label: 'Open',
            // The toast system accepts a React element for action; we rely on the
            // existing button wrapper to call this handler.
            onClick: () => {
              onReportReady(report);
            },
          } as any,
        });

        // Optional: clicking the toast body could also open, if supported by UI.
        // We do not rely on it here.

        return { report, reusedExisting, toastId: readyToast.id };
      } catch (error: any) {
        console.error('AI summary request failed', error);
        setInProgress(projectId, false);
        generatingToast.update({
          id: generatingToast.id,
          open: false,
        });
        toast({
          title: 'AI summary failed',
          description:
            'Failed to generate AI summary. Please check your connection and try again.',
          variant: 'destructive',
        });

        analyticsInstance.trackFailure({
                  projectId,
                  code: 'NETWORK_OR_UNKNOWN',
                  retryable: true,
                });
      }
    },
    [buildFilterPayload, markFeatureSeen, onReportReady, setInProgress, toast]
  );

  const getProjectInProgress = useCallback(
    (projectId: string | null | undefined): boolean => {
      if (!projectId) return false;
      return !!state.isInProgressByProject[projectId];
    },
    [state.isInProgressByProject]
  );

  const aiSummaryDisabledReasonForProject = useCallback(
    (projectId: string | null | undefined, hasActiveChecklist: boolean, isOwner: boolean): string | null => {
      if (!hasActiveChecklist || !projectId) {
        return 'Project not initialized.';
      }
      if (!isOwner) {
        return 'You don’t have access to generate summaries.';
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return 'Connect to the internet to generate an AI summary.';
      }
      if (getProjectInProgress(projectId)) {
        return 'Summary is being generated.';
      }
      return null;
    },
    [getProjectInProgress]
  );

  return useMemo(
    () => ({
      generateAiSummary,
      isInProgress: state.isInProgressByProject,
      getProjectInProgress,
      showNewBadge: state.showNewBadge,
      aiSummaryDisabledReasonForProject,
      incrementMenuOpen,
    }),
    [
      aiSummaryDisabledReasonForProject,
      generateAiSummary,
      getProjectInProgress,
      incrementMenuOpen,
      state.isInProgressByProject,
      state.showNewBadge,
    ]
  );
}