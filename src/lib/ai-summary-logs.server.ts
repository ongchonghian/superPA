type AiSummaryLogOutcome =
  | 'STARTED'
  | 'REUSED_EXISTING'
  | 'COMPLETED'
  | 'AI_ERROR'
  | 'VALIDATION_ERROR'
  | 'AUTH_ERROR'
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'INTERNAL_ERROR';

export type AiSummaryAuditLogEvent = {
  userId: string | null;
  projectId: string | null;
  filterSignature: string | null;
  timestamp: string;
  outcome: AiSummaryLogOutcome;
  errorCode?: string;
  reportId?: string;
  reusedExisting?: boolean;
  durationMs?: number;
  wordCount?: number;
  overallStatus?: string;
};

type TelemetryPayload = Record<string, any>;

function safeConsoleLog(eventName: string, payload: TelemetryPayload): void {
  try {
    // JSON-structured logs for ingestion; avoid large/PII content.
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        event: eventName,
        ...payload,
      }),
    );
  } catch {
    // Never throw
  }
}

export function trackAiSummaryStarted(params: {
  userId: string | null;
  projectId: string | null;
  filterSignature: string | null;
}): void {
  safeConsoleLog('ai_summary_started', {
    userId: params.userId,
    projectId: params.projectId,
    filterSignature: params.filterSignature,
  });
}

export function trackAiSummaryCompleted(params: {
  userId: string | null;
  projectId: string | null;
  reportId: string;
  reusedExisting: boolean;
  durationMs?: number;
  wordCount?: number;
  overallStatus?: string;
}): void {
  safeConsoleLog('ai_summary_completed', {
    userId: params.userId,
    projectId: params.projectId,
    reportId: params.reportId,
    reusedExisting: params.reusedExisting,
    durationMs: params.durationMs,
    wordCount: params.wordCount,
    overallStatus: params.overallStatus,
  });
}

export function trackAiSummaryAiError(params: {
  userId: string | null;
  projectId: string | null;
  code: string;
  retryable: boolean;
}): void {
  safeConsoleLog('ai_summary_ai_error', {
    userId: params.userId,
    projectId: params.projectId,
    code: params.code,
    retryable: params.retryable,
  });
}

export async function logAiSummaryAuditEvent(
  event: Omit<AiSummaryAuditLogEvent, 'timestamp'> & { timestamp?: string },
): Promise<void> {
  const { timestamp, ...rest } = event;

  const payload: AiSummaryAuditLogEvent = {
    ...rest,
    timestamp: timestamp || new Date().toISOString(),
    userId: event.userId ?? null,
    projectId: event.projectId ?? null,
    filterSignature: event.filterSignature ?? null,
  };

  // Always log to console as JSON-structured telemetry
  safeConsoleLog('audit_event', payload);
  
  // Note: Firestore audit logging can be implemented later when Firebase is fully configured
  // For now, this serves as a placeholder that logs to console for debugging/development
}