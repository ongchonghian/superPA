'use server';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth, db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, where, limit } from 'firebase/firestore';
import { createReport } from '@/lib/reports';
import type { Report } from '@/lib/types';
import {
  generateAiProjectSummary,
  AiSummaryProjectNotFoundError,
  AiSummaryPermissionDeniedError,
  AiSummaryGenerationError,
} from '@/ai/flows/ai-project-summary';
import {
  logAiSummaryAuditEvent,
  trackAiSummaryStarted,
  trackAiSummaryCompleted,
  trackAiSummaryAiError,
} from '@/lib/ai-summary-logs.server';

/**
 * Shared error response shape.
 */
type ErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHENTICATED'
  | 'PERMISSION_DENIED'
  | 'PROJECT_NOT_FOUND'
  | 'IN_FLIGHT'
  | 'AI_TIMEOUT'
  | 'AI_FAILURE'
  | 'RATE_LIMITED'
  | 'INTERNAL';

interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    retryable: boolean;
  };
}

interface AiSummaryRequestBody {
  projectId: string;
  filter?: {
    statuses?: string[];
    assignees?: string[];
    tags?: string[];
    fromDate?: string;
    toDate?: string;
  };
  filterSignature: string;
  idempotencyKey?: string;
  force?: boolean;
}

/**
 * Reuse window for existing summaries (ms).
 * Spec suggests "short reuse window (e.g., 5 minutes)".
 */
const REUSE_WINDOW_MS = 5 * 60 * 1000;

/**
 * POST /api/ai-summary
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  let userId: string | null = null;
  let projectId: string | null = null;
  let filterSignature: string | null = null;

  try {
    // 1. Parse and validate request body.
    const body = (await req.json().catch(() => null)) as AiSummaryRequestBody | null;

    if (!body || typeof body !== 'object') {
      await logAiSummaryAuditEvent({
        userId,
        projectId,
        filterSignature,
        outcome: 'VALIDATION_ERROR',
        errorCode: 'INVALID_REQUEST',
      });
      return jsonError(
        400,
        'INVALID_REQUEST',
        'Request body must be a valid JSON object.',
        false,
      );
    }

    const { projectId: bodyProjectId, filterSignature: bodyFilterSignature, filter, force } = body;
    projectId = typeof bodyProjectId === 'string' ? bodyProjectId : null;
    filterSignature =
      typeof bodyFilterSignature === 'string' ? bodyFilterSignature : null;

    if (!bodyProjectId || typeof bodyProjectId !== 'string' || !bodyProjectId.trim()) {
      await logAiSummaryAuditEvent({
        userId,
        projectId,
        filterSignature,
        outcome: 'VALIDATION_ERROR',
        errorCode: 'INVALID_REQUEST',
      });
      return jsonError(
        400,
        'INVALID_REQUEST',
        '`projectId` is required and must be a non-empty string.',
        false,
      );
    }

    if (
      !bodyFilterSignature ||
      typeof bodyFilterSignature !== 'string' ||
      !bodyFilterSignature.trim()
    ) {
      await logAiSummaryAuditEvent({
        userId,
        projectId,
        filterSignature,
        outcome: 'VALIDATION_ERROR',
        errorCode: 'INVALID_REQUEST',
      });
      return jsonError(
        400,
        'INVALID_REQUEST',
        '`filterSignature` is required and must be a non-empty string.',
        false,
      );
    }

    if (filter !== undefined) {
      const shapeOk =
        typeof filter === 'object' &&
        (filter.statuses === undefined ||
          (Array.isArray(filter.statuses) &&
            filter.statuses.every((v) => typeof v === 'string'))) &&
        (filter.assignees === undefined ||
          (Array.isArray(filter.assignees) &&
            filter.assignees.every((v) => typeof v === 'string'))) &&
        (filter.tags === undefined ||
          (Array.isArray(filter.tags) &&
            filter.tags.every((v) => typeof v === 'string'))) &&
        (filter.fromDate === undefined || typeof filter.fromDate === 'string') &&
        (filter.toDate === undefined || typeof filter.toDate === 'string');

      if (!shapeOk) {
        await logAiSummaryAuditEvent({
          userId,
          projectId,
          filterSignature,
          outcome: 'VALIDATION_ERROR',
          errorCode: 'INVALID_REQUEST',
        });
        return jsonError(
          400,
          'INVALID_REQUEST',
          '`filter` must match the expected shape.',
          false,
        );
      }
    }

    // 2. AuthN: derive authenticated user.
    userId = await getAuthenticatedUserId(req);

    if (!userId) {
      await logAiSummaryAuditEvent({
        userId: null,
        projectId,
        filterSignature,
        outcome: 'AUTH_ERROR',
        errorCode: 'UNAUTHENTICATED',
      });
      return jsonError(
        401,
        'UNAUTHENTICATED',
        'Authentication required to generate AI summaries.',
        false,
      );
    }

    // 3. AuthZ / project visibility checks.
    const project = await loadProjectForAccessCheck(bodyProjectId);
    if (!project) {
      // Intentionally 404 to avoid leaking existence.
      await logAiSummaryAuditEvent({
        userId,
        projectId,
        filterSignature,
        outcome: 'NOT_FOUND',
        errorCode: 'PROJECT_NOT_FOUND',
      });
      return jsonError(
        404,
        'PROJECT_NOT_FOUND',
        'Project not found or unavailable.',
        false,
      );
    }

    const hasPermission = userHasReportPermission(userId, project);
    if (!hasPermission) {
      await logAiSummaryAuditEvent({
        userId,
        projectId,
        filterSignature,
        outcome: 'PERMISSION_DENIED',
        errorCode: 'PERMISSION_DENIED',
      });
      return jsonError(
        403,
        'PERMISSION_DENIED',
        'You do not have permission to generate reports for this project.',
        false,
      );
    }

    // From this point we consider a valid attempt; record start telemetry.
    trackAiSummaryStarted({
      userId,
      projectId,
      filterSignature,
    });
    await logAiSummaryAuditEvent({
      userId,
      projectId,
      filterSignature,
      outcome: 'STARTED',
    });

    // 4. Idempotency / reuse: check for recent matching AI_SUMMARY report.
    const effectiveFilter = filter || {};
    const jobKey = computeJobKey(bodyProjectId, bodyFilterSignature);
    // jobKey is computed for potential future use; not persisted yet.

    const reusable = await findRecentMatchingSummary(
      bodyProjectId,
      bodyFilterSignature,
      REUSE_WINDOW_MS,
    );

    if (reusable && force !== true) {
      const durationMs = Date.now() - startTime;

      trackAiSummaryCompleted({
        userId,
        projectId,
        reportId: reusable.id,
        reusedExisting: true,
        durationMs,
      });

      await logAiSummaryAuditEvent({
        userId,
        projectId,
        filterSignature,
        outcome: 'REUSED_EXISTING',
        reportId: reusable.id,
        reusedExisting: true,
        durationMs,
      });

      return NextResponse.json(
        {
          report: reusable,
          reusedExisting: true,
        },
        { status: 200 },
      );
    }

    // 5. Call AI flow to generate new summary.
    let aiResult;
    try {
      aiResult = await generateAiProjectSummary({
        projectId: bodyProjectId,
        filter: effectiveFilter,
        filterSignature: bodyFilterSignature,
        userId,
      });
    } catch (err: any) {
      if (err instanceof AiSummaryProjectNotFoundError) {
        await logAiSummaryAuditEvent({
          userId,
          projectId,
          filterSignature,
          outcome: 'NOT_FOUND',
          errorCode: 'PROJECT_NOT_FOUND',
        });
        return jsonError(
          404,
          'PROJECT_NOT_FOUND',
          'Project not found or unavailable.',
          false,
        );
      }
      if (err instanceof AiSummaryPermissionDeniedError) {
        await logAiSummaryAuditEvent({
          userId,
          projectId,
          filterSignature,
          outcome: 'PERMISSION_DENIED',
          errorCode: 'PERMISSION_DENIED',
        });
        return jsonError(
          403,
          'PERMISSION_DENIED',
          'You do not have permission to generate reports for this project.',
          false,
        );
      }
      if (err instanceof AiSummaryGenerationError) {
        const code = err.code;
        const isTimeout = code === 'AI_TIMEOUT';

        trackAiSummaryAiError({
          userId,
          projectId,
          code,
          retryable: err.retryable,
        });

        await logAiSummaryAuditEvent({
          userId,
          projectId,
          filterSignature,
          outcome: 'AI_ERROR',
          errorCode: code,
        });

        if (isTimeout) {
          return jsonError(
            504,
            'AI_TIMEOUT',
            'AI service timed out while generating the summary.',
            true,
          );
        }

        return jsonError(
          502,
          'AI_FAILURE',
          'AI service failed to generate a summary. Please try again.',
          true,
        );
      }

      // Unknown error from AI layer.
      await logAiSummaryAuditEvent({
        userId,
        projectId,
        filterSignature,
        outcome: 'INTERNAL_ERROR',
        errorCode: 'INTERNAL',
      });

      return jsonError(
        500,
        'INTERNAL',
        'Unexpected error while generating AI summary.',
        false,
      );
    }

    // 6. Persist Report (type: AI_SUMMARY).
    const nowIso = new Date().toISOString();
    const title = buildReportTitle(project.name, bodyProjectId, nowIso);

    const reportWithoutId: Omit<Report, 'id'> = {
      projectId: bodyProjectId,
      type: 'AI_SUMMARY',
      title,
      createdAt: nowIso,
      createdBy: userId,
      contentMarkdown: aiResult.contentMarkdown,
      metadata: {
        filterSignature: bodyFilterSignature,
        overallStatus: aiResult.overallStatus,
        wordCount: aiResult.wordCount,
        sectionsPresent: aiResult.sectionsPresent,
        sourceStats: aiResult.sourceStats,
        sourceSnapshotRange: aiResult.sourceSnapshotRange,
        generationConfig: aiResult.generationConfig,
      },
    };

    const saved = await createReport(reportWithoutId);
    const durationMs = Date.now() - startTime;

    trackAiSummaryCompleted({
      userId,
      projectId,
      reportId: saved.id,
      reusedExisting: false,
      durationMs,
      wordCount: aiResult.wordCount,
      overallStatus: aiResult.overallStatus,
    });

    await logAiSummaryAuditEvent({
      userId,
      projectId,
      filterSignature,
      outcome: 'COMPLETED',
      reportId: saved.id,
      reusedExisting: false,
      durationMs,
      wordCount: aiResult.wordCount,
      overallStatus: aiResult.overallStatus,
    });

    return NextResponse.json(
      {
        report: saved,
        reusedExisting: false,
      },
      { status: 200 },
    );
  } catch (err: any) {
    // Defensive catch-all to avoid leaking internal details.
    await logAiSummaryAuditEvent({
      userId,
      projectId,
      filterSignature,
      outcome: 'INTERNAL_ERROR',
      errorCode: 'INTERNAL',
    });

    return jsonError(
      500,
      'INTERNAL',
      'Unexpected error.',
      false,
    );
  }
}

/**
 * Compute a stable job key from projectId and filterSignature.
 */
function computeJobKey(projectId: string, filterSignature: string): string {
  try {
    return crypto
      .createHash('sha256')
      .update(`${projectId}:${filterSignature}`, 'utf8')
      .digest('hex');
  } catch {
    // Fallback (still deterministic) if crypto is unavailable.
    return `${projectId}:${filterSignature}`;
  }
}

/**
 * Find the most recent AI_SUMMARY report matching projectId + filterSignature
 * within the provided reuse window.
 */
async function findRecentMatchingSummary(
  projectId: string,
  filterSignature: string,
  reuseWindowMs: number,
): Promise<Report | null> {
  if (!db) {
    return null;
  }

  const now = Date.now();
  const cutoffIso = new Date(now - reuseWindowMs).toISOString();

  const reportsRef = collection(db, 'reports');

  // Query by projectId, type, and filterSignature; order by createdAt desc.
  const q = query(
    reportsRef,
    where('projectId', '==', projectId),
    where('type', '==', 'AI_SUMMARY'),
    where('metadata.filterSignature', '==', filterSignature),
    where('createdAt', '>=', cutoffIso),
    orderBy('createdAt', 'desc'),
    limit(1),
  );

  const snap = await getDocs(q);
  if (snap.empty) {
    return null;
  }

  const docSnap = snap.docs[0];
  const data = docSnap.data() as any;

  if (
    !data ||
    typeof data.projectId !== 'string' ||
    typeof data.type !== 'string' ||
    typeof data.title !== 'string' ||
    typeof data.createdAt !== 'string' ||
    typeof data.createdBy !== 'string' ||
    typeof data.contentMarkdown !== 'string' ||
    typeof data.metadata !== 'object' ||
    data.metadata === null
  ) {
    return null;
  }

  const report: Report = {
    id: docSnap.id,
    projectId: data.projectId,
    type: data.type,
    title: data.title,
    createdAt: data.createdAt,
    createdBy: data.createdBy,
    contentMarkdown: data.contentMarkdown,
    metadata: data.metadata,
  };

  return report;
}

/**
 * Auth helper:
 * Derive current userId reusing Firebase Auth on the server.
 *
 * Note:
 * - This mirrors existing patterns (client SDK usage) but should be adapted
 *   to your actual auth/session mechanism (e.g., cookies, Admin SDK).
 * - For now, we treat lack of a resolved user as unauthenticated.
 */
async function getAuthenticatedUserId(_req: NextRequest): Promise<string | null> {
  try {
    // If you have a dedicated server-side auth helper (e.g., getCurrentUser),
    // invoke it here instead. This placeholder checks the client auth export.
    // In many Next.js + Firebase setups, you would validate a session cookie
    // or Authorization header using the Admin SDK. Kept minimal per instructions.
    if (!auth) {
      return null;
    }

    // No direct server-side user from firebase/auth; expect integration to be
    // wired via upstream middleware or replaced with a real implementation.
    // Returning null here ensures we fail closed (UNAUTHENTICATED) until wired.
    return null;
  } catch {
    return null;
  }
}

/**
 * Project access helper:
 * Load minimal project/checklist document for authorization decisions.
 *
 * Mirrors patterns from ai-project-summary flow (checklists as projects).
 */
async function loadProjectForAccessCheck(projectId: string): Promise<{
  id: string;
  name: string;
  ownerId?: string;
  collaboratorIds?: string[];
} | null> {
  if (!db) {
    return null;
  }

  const checklistsRef = collection(db, 'checklists');
  const q = query(checklistsRef, where('id', '==', projectId), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) {
    return null;
  }

  const docSnap = snap.docs[0];
  const data = docSnap.data() as any;

  if (!data || typeof data.id !== 'string') {
    return null;
  }

  return {
    id: data.id,
    name: typeof data.name === 'string' ? data.name : 'Untitled Project',
    ownerId: typeof data.ownerId === 'string' ? data.ownerId : undefined,
    collaboratorIds: Array.isArray(data.collaboratorIds)
      ? data.collaboratorIds.filter((v: any) => typeof v === 'string')
      : undefined,
  };
}

/**
 * Permission helper:
 * Ensure user has read + export/report capabilities.
 *
 * For now:
 * - Allow if user is owner or collaborator.
 * - Can be extended to role-based access controls as they are introduced.
 */
function userHasReportPermission(
  userId: string,
  project: {
    ownerId?: string;
    collaboratorIds?: string[];
  },
): boolean {
  if (!userId) return false;

  if (project.ownerId && project.ownerId === userId) {
    return true;
  }

  if (
    project.collaboratorIds &&
    Array.isArray(project.collaboratorIds) &&
    project.collaboratorIds.includes(userId)
  ) {
    return true;
  }

  // Default deny; adjust when explicit export/report roles are added.
  return false;
}

/**
 * Build a deterministic, human-readable report title.
 */
function buildReportTitle(
  projectName: string | undefined,
  projectId: string,
  isoTimestamp: string,
): string {
  const datePart = isoTimestamp.slice(0, 10);
  const base = projectName && projectName.trim().length > 0
    ? projectName.trim()
    : projectId;
  return `AI Project Summary – ${base} – ${datePart}`;
}

/**
 * Helper to emit JSON error responses in canonical shape.
 */
function jsonError(
  status: number,
  code: ErrorCode,
  message: string,
  retryable: boolean,
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        retryable,
      },
    },
    { status },
  );
}