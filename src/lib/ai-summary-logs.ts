/**
 * Client-safe analytics shim for AI Summary.
 *
 * This file must contain ONLY browser-safe, side-effect-free helpers.
 * Do NOT import server-only modules (e.g., Firestore, firebase-admin) here.
 */

export type AiSummaryClientAnalytics = {
  trackClick: (params: { projectId: string }) => void;
  trackSuccess: (params: {
    projectId: string;
    reusedExisting: boolean;
    latencyMs: number;
  }) => void;
  trackFailure: (params: {
    projectId: string;
    code?: string;
    retryable?: boolean;
  }) => void;
};

type TelemetryPayload = Record<string, any>;

function safeEmit(event: string, payload: TelemetryPayload): void {
  try {
    // Replace or augment with your analytics SDK if configured.
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        event,
        ...payload,
      }),
    );
  } catch {
    // Swallow errors to avoid impacting UX.
  }
}

export function getAiSummaryClientAnalytics(): AiSummaryClientAnalytics {
  return {
    trackClick: ({ projectId }) => {
      safeEmit('ai_summary_click', { projectId });
    },
    trackSuccess: ({ projectId, reusedExisting, latencyMs }) => {
      safeEmit('ai_summary_success', {
        projectId,
        reusedExisting,
        latencyMs,
      });
    },
    trackFailure: ({ projectId, code, retryable }) => {
      safeEmit('ai_summary_failure', {
        projectId,
        code,
        retryable: !!retryable,
      });
    },
  };
}