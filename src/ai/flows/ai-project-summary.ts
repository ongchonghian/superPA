/**
 * @fileOverview Genkit flow for generating AI-powered project status summaries.
 *
 * Responsibilities:
 * - Load project/checklist and task data for a given projectId.
 * - Apply AiSummaryFilter (statuses, assignees, tags, date ranges).
 * - Aggregate key stats and qualitative signals (overdue/upcoming, risks, remarks).
 * - Call Genkit with a constrained prompt that follows docs/ai-summary-spec.md.
 * - Return a structured AiProjectSummaryResult suitable for Report.metadata.
 *
 * This module:
 * - Does NOT create or persist Report records.
 * - Is server-only and has no browser-specific imports.
 */

import { ai as defaultAi, configureAi } from '@/ai/genkit';
import { z } from 'genkit';
import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { TaskStatus } from '@/lib/types';
import { buildFlattenedRemarks } from '@/lib/remarks';
import { GEMINI_MODEL_CONFIGS } from '@/lib/data';
import type { GeminiModel } from '@/lib/types';

/**
 * Filter object passed from the client and API layer.
 * Matches docs/ai-summary-spec.md.
 */
export type AiSummaryFilter = {
  statuses?: string[];
  assignees?: string[];
  tags?: string[];
  fromDate?: string; // inclusive, ISO or YYYY-MM-DD
  toDate?: string; // inclusive, ISO or YYYY-MM-DD
};

/**
 * Result shape aligned with Report.metadata requirements.
 */
export type AiProjectSummaryResult = {
  contentMarkdown: string;
  overallStatus: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'UNKNOWN';
  wordCount: number;
  sectionsPresent: {
    overview: boolean;
    timeline: boolean;
    milestones: boolean;
    risks: boolean;
    blockers: boolean;
    nextSteps: boolean;
  };
  sourceStats: {
    taskCount: number;
    openTaskCount: number;
    completedTaskCount: number;
    milestoneCount: number;
    remarkCount: number;
    timeWindowDays: number | null;
  };
  sourceSnapshotRange?: {
    from: string | null;
    to: string | null;
  };
  generationConfig: {
    model: string;
    maxInputTokens?: number;
    maxOutputTokens?: number;
  };
};

/**
 * Typed errors surfaced by this flow for the API layer to map.
 */

export class AiSummaryProjectNotFoundError extends Error {
  readonly code = 'PROJECT_NOT_FOUND' as const;
  constructor(message = 'Project not found for ai-project-summary') {
    super(message);
    this.name = 'AiSummaryProjectNotFoundError';
  }
}

export class AiSummaryPermissionDeniedError extends Error {
  readonly code = 'PERMISSION_DENIED' as const;
  constructor(message = 'Permission denied for ai-project-summary') {
    super(message);
    this.name = 'AiSummaryPermissionDeniedError';
  }
}

export class AiSummaryGenerationError extends Error {
  readonly code: 'AI_TIMEOUT' | 'AI_FAILURE';
  readonly retryable: boolean;

  constructor(
    code: 'AI_TIMEOUT' | 'AI_FAILURE',
    message: string,
    retryable = true,
  ) {
    super(message);
    this.name = 'AiSummaryGenerationError';
    this.code = code;
    this.retryable = retryable;
  }
}

/**
 * Firestore data model notes:
 * - This backend is built on top of a "checklists" collection used as projects.
 * - Tasks are embedded inside checklist documents (per src/lib/types.ts).
 *
 * We follow existing query patterns:
 * - Collection: 'checklists'
 * - Filter by projectId (checklist id).
 */

const CHECKLISTS_COLLECTION = 'checklists';

const AiSummaryInputSchema = z.object({
  projectId: z.string(),
  filter: z.object({
    statuses: z.array(z.string()).optional(),
    assignees: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
  }),
  filterSignature: z.string(),
  userId: z.string(),
  // Optional model overrides for flexibility / testing
  model: z.string().optional(),
  maxInputTokens: z.number().optional(),
  maxOutputTokens: z.number().optional(),
});

const AiSummaryOutputSchema: z.ZodType<AiProjectSummaryResult> = z.object({
  contentMarkdown: z.string(),
  overallStatus: z.enum(['ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'UNKNOWN']),
  wordCount: z.number(),
  sectionsPresent: z.object({
    overview: z.boolean(),
    timeline: z.boolean(),
    milestones: z.boolean(),
    risks: z.boolean(),
    blockers: z.boolean(),
    nextSteps: z.boolean(),
  }),
  sourceStats: z.object({
    taskCount: z.number(),
    openTaskCount: z.number(),
    completedTaskCount: z.number(),
    milestoneCount: z.number(),
    remarkCount: z.number(),
    timeWindowDays: z.number().nullable(),
  }),
  sourceSnapshotRange: z
    .object({
      from: z.string().nullable(),
      to: z.string().nullable(),
    })
    .optional(),
  generationConfig: z.object({
    model: z.string(),
    maxInputTokens: z.number().optional(),
    maxOutputTokens: z.number().optional(),
  }),
});

/**
 * Public entry point for generating an AI project summary.
 *
 * This is intentionally thin: it orchestrates
 * - data loading
 * - aggregation
 * - prompt construction
 * - Genkit flow invocation
 * - post-processing to AiProjectSummaryResult
 */
export async function generateAiProjectSummary(input: {
  projectId: string;
  filter: AiSummaryFilter;
  filterSignature: string;
  userId: string;
  model?: string;
  maxInputTokens?: number;
  maxOutputTokens?: number;
}): Promise<AiProjectSummaryResult> {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  // Configure AI client from shared Genkit setup.
  const ai = configureAi(undefined, input.model as GeminiModel | undefined);

  // Resolve model using existing GEMINI_MODEL_CONFIGS keys; fall back to first known.
  const defaultModel = Object.keys(GEMINI_MODEL_CONFIGS)[0];
  const resolvedModelName =
    (input.model && GEMINI_MODEL_CONFIGS[input.model as GeminiModel]
      ? input.model
      : defaultModel) as GeminiModel;

  const modelConfig = GEMINI_MODEL_CONFIGS[resolvedModelName];

  const generationConfig = {
    model: resolvedModelName,
    maxInputTokens: input.maxInputTokens ?? modelConfig.defaultInput,
    maxOutputTokens: input.maxOutputTokens ?? modelConfig.defaultOutput ?? 1024,
  };

  const aiProjectSummaryFlow = ai.defineFlow(
    {
      name: 'ai-project-summary',
      inputSchema: AiSummaryInputSchema,
      outputSchema: AiSummaryOutputSchema,
    },
    async (flowInput): Promise<AiProjectSummaryResult> => {
      // 1. Load project/checklist document.
      const checklist = await loadProjectChecklist(flowInput.projectId, flowInput.userId);
      if (!checklist) {
        // Callers map this to 404.
        throw new AiSummaryProjectNotFoundError();
      }

      // 2. Flatten tasks and remarks from checklist.
      const allTasks = Array.isArray(checklist.tasks) ? checklist.tasks : [];
      const {
        filteredTasks,
        remarkCount,
        timeWindowDays,
        snapshotRangeFrom,
        snapshotRangeTo,
      } = applyFilterAndAggregate(allTasks, flowInput.filter);

      const {
        taskCount,
        openTaskCount,
        completedTaskCount,
        milestoneCount,
        overdueCount,
        upcomingCount,
        riskSignals,
      } = computeTaskStats(filteredTasks);

      // If no tasks after filtering, we still proceed but mark status UNKNOWN.
      const highLevelStatus = inferOverallStatus({
        taskCount,
        openTaskCount,
        completedTaskCount,
        overdueCount,
        riskSignals,
      });

      // Build flattened remarks (for qualitative signals) using existing utility.
      const flattenedRemarks = buildFlattenedRemarks(
        filteredTasks.flatMap((t) => t.remarks || []),
      );

      const projectName = checklist.name || 'Untitled Project';

      // 3. Construct prompt per spec.
      const promptText = buildPrompt({
        projectName,
        filter: flowInput.filter,
        filterSignature: flowInput.filterSignature,
        stats: {
          taskCount,
          openTaskCount,
          completedTaskCount,
          milestoneCount,
          remarkCount,
          timeWindowDays,
          overdueCount,
          upcomingCount,
        },
        riskSignals,
        remarksSample: flattenedRemarks.slice(0, 50).map((fr) => fr.remark),
        initialStatus: highLevelStatus,
      });

      // 4. Invoke Genkit prompt with strict output constraints.
      const prompt = ai.definePrompt({
        name: 'ai-project-summary-prompt',
        input: {
          schema: z.object({
            promptText: z.string(),
          }),
        },
        output: {
          schema: z.object({
            contentMarkdown: z.string(),
          }),
        },
        config: {
          maxOutputTokens: generationConfig.maxOutputTokens,
        },
        prompt: `{{promptText}}`,
      });

      let markdown: string;
      try {
        const { output } = await prompt({ promptText });
        markdown = (output as any)?.contentMarkdown || '';
      } catch (err: any) {
        const message = err?.message || 'AI summary generation failed';
        // Map timeouts vs generic failures as best-effort.
        if (message.toLowerCase().includes('timeout')) {
          throw new AiSummaryGenerationError('AI_TIMEOUT', message, true);
        }
        throw new AiSummaryGenerationError('AI_FAILURE', message, true);
      }

      if (!markdown || typeof markdown !== 'string') {
        throw new AiSummaryGenerationError(
          'AI_FAILURE',
          'AI did not return valid Markdown content',
          true,
        );
      }

      const wordCount = computeWordCount(markdown);
      const sectionsPresent = detectSections(markdown);
      const overallStatus = normalizeOverallStatus(
        markdown,
        highLevelStatus,
      );

      const result: AiProjectSummaryResult = {
        contentMarkdown: markdown,
        overallStatus,
        wordCount,
        sectionsPresent,
        sourceStats: {
          taskCount,
          openTaskCount,
          completedTaskCount,
          milestoneCount,
          remarkCount,
          timeWindowDays,
        },
        sourceSnapshotRange: {
          from: snapshotRangeFrom,
          to: snapshotRangeTo,
        },
        generationConfig,
      };

      return result;
    },
  );

  // Execute the flow with validated input.
  const flowOutput = await aiProjectSummaryFlow({
    projectId: input.projectId,
    filter: input.filter,
    filterSignature: input.filterSignature,
    userId: input.userId,
    model: input.model,
    maxInputTokens: input.maxInputTokens,
    maxOutputTokens: input.maxOutputTokens,
  });

  // Zod schema ensures correct typing, but we still cast to exported type.
  return flowOutput;
}

/**
 * Load a single checklist/project document by id.
 *
 * For now we:
 * - Query `checklists` where id == projectId using Firestore.
 * - Assume permission is validated by the caller; if needed,
 *   this hook can be extended to check ownership/collaborators.
 */
async function loadProjectChecklist(projectId: string, userId: string) {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  const checklistsRef = collection(db, CHECKLISTS_COLLECTION);
  const q = query(checklistsRef, where('id', '==', projectId));
  const snap = await getDocs(q);

  if (snap.empty) {
    return null;
  }

  const docSnap = snap.docs[0];
  const data = docSnap.data() as any;

  // Basic shape/permission guardrails; detailed auth is handled upstream.
  if (!data || typeof data.id !== 'string') {
    return null;
  }

  // If there were explicit ownership/collaborator checks, they would align here.
  // Kept minimal to let the API layer own authz decisions.
  return {
    id: data.id,
    name: data.name ?? 'Untitled Project',
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
  };
}

/**
 * Apply filter to tasks and compute aggregate metrics.
 */
function applyFilterAndAggregate(
  tasks: any[],
  filter: AiSummaryFilter,
): {
  filteredTasks: any[];
  remarkCount: number;
  timeWindowDays: number | null;
  snapshotRangeFrom: string | null;
  snapshotRangeTo: string | null;
} {
  const {
    statuses,
    assignees,
    tags,
    fromDate,
    toDate,
  } = filter;

  const from = fromDate ? new Date(fromDate) : null;
  const to = toDate ? new Date(toDate) : null;

  const filtered: any[] = [];
  const remarkTimestamps: number[] = [];
  const taskTimestamps: number[] = [];

  for (const task of tasks) {
    if (!task || typeof task !== 'object') continue;

    // Status filter (string match; caller responsible for mapping enums).
    if (statuses && statuses.length > 0) {
      if (!statuses.includes(task.status as string)) continue;
    }

    // Assignee filter
    if (assignees && assignees.length > 0) {
      if (!assignees.includes(task.assignee as string)) continue;
    }

    // Tags filter: assume task.tags is array of strings, best-effort.
    if (tags && tags.length > 0) {
      const taskTags: string[] = Array.isArray(task.tags) ? task.tags : [];
      if (!taskTags.some((t) => tags.includes(t))) continue;
    }

    // Date range filter: use dueDate if present.
    if (from || to) {
      if (task.dueDate) {
        const due = new Date(task.dueDate);
        if (from && due < from) continue;
        if (to && due > to) continue;
        taskTimestamps.push(due.getTime());
      }
    } else if (task.dueDate) {
      const due = new Date(task.dueDate);
      if (!Number.isNaN(due.getTime())) {
        taskTimestamps.push(due.getTime());
      }
    }

    // Collect remark timestamps for snapshot range/time window
    const remarks = Array.isArray(task.remarks) ? task.remarks : [];
    for (const r of remarks) {
      if (r && typeof r.timestamp === 'string') {
        const ts = new Date(r.timestamp).getTime();
        if (!Number.isNaN(ts)) {
          remarkTimestamps.push(ts);
        }
      }
    }

    filtered.push(task);
  }

  const allTimestamps = [...taskTimestamps, ...remarkTimestamps];
  let snapshotRangeFrom: string | null = null;
  let snapshotRangeTo: string | null = null;
  let timeWindowDays: number | null = null;

  if (allTimestamps.length > 0) {
    const min = Math.min(...allTimestamps);
    const max = Math.max(...allTimestamps);
    snapshotRangeFrom = new Date(min).toISOString();
    snapshotRangeTo = new Date(max).toISOString();
    const diffMs = max - min;
    timeWindowDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24))) || 1;
  }

  const remarkCount = remarkTimestamps.length;

  return {
    filteredTasks: filtered,
    remarkCount,
    timeWindowDays,
    snapshotRangeFrom,
    snapshotRangeTo,
  };
}

/**
 * Compute derived task statistics and simple risk signals.
 */
function computeTaskStats(tasks: any[]) {
  let taskCount = 0;
  let completedTaskCount = 0;
  let openTaskCount = 0;
  let milestoneCount = 0;
  let overdueCount = 0;
  let upcomingCount = 0;

  const now = new Date();

  const riskSignals: string[] = [];

  for (const task of tasks) {
    if (!task || typeof task !== 'object') continue;
    taskCount += 1;

    const status = (task.status || '').toString().toUpperCase() as TaskStatus | string;
    const dueDateStr = typeof task.dueDate === 'string' ? task.dueDate : '';
    const hasDue = !!dueDateStr;
    const due = hasDue ? new Date(dueDateStr) : null;

    const isDone =
      status === 'DONE' ||
      status === 'COMPLETED' ||
      status === 'COMPLETE';

    if (isDone) {
      completedTaskCount += 1;
    } else {
      openTaskCount += 1;
    }

    // Naive milestone heuristic: treat explicitly tagged tasks as milestones if tags include 'milestone'.
    if (Array.isArray(task.tags) && task.tags.some((t: string) => t.toLowerCase() === 'milestone')) {
      milestoneCount += 1;
    }

    if (!isDone && hasDue && due && due.getTime() < now.getTime()) {
      overdueCount += 1;
    }

    // Upcoming within 7 days
    if (!isDone && hasDue && due) {
      const diffDays =
        (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays >= 0 && diffDays <= 7) {
        upcomingCount += 1;
      }
    }

    // Risk signal: blocked / at risk / similar statuses
    if (
      status.includes('BLOCKED') ||
      status.includes('RISK') ||
      status.includes('AT_RISK')
    ) {
      riskSignals.push(
        `Task "${truncate(task.description || '', 120)}" has risky status: ${status}`,
      );
    }
  }

  return {
    taskCount,
    openTaskCount,
    completedTaskCount,
    milestoneCount,
    overdueCount,
    upcomingCount,
    riskSignals,
  };
}

/**
 * Infer an initial overall status from basic metrics; AI can refine via content,
 * but we use this as a fallback and reference in the prompt.
 */
function inferOverallStatus(input: {
  taskCount: number;
  openTaskCount: number;
  completedTaskCount: number;
  overdueCount: number;
  riskSignals: string[];
}): 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'UNKNOWN' {
  const { taskCount, openTaskCount, completedTaskCount, overdueCount, riskSignals } =
    input;

  if (taskCount === 0) {
    return 'UNKNOWN';
  }

  const completionRatio =
    taskCount > 0 ? completedTaskCount / taskCount : 0;

  if (overdueCount > taskCount * 0.2 || riskSignals.length > 3) {
    return 'OFF_TRACK';
  }

  if (overdueCount > 0 || riskSignals.length > 0 || completionRatio < 0.5) {
    return 'AT_RISK';
  }

  if (completionRatio >= 0.8 && overdueCount === 0 && riskSignals.length === 0) {
    return 'ON_TRACK';
  }

  return 'AT_RISK';
}

/**
 * Construct a single, strict prompt string encoding the spec.
 */
function buildPrompt(args: {
  projectName: string;
  filter: AiSummaryFilter;
  filterSignature: string;
  stats: {
    taskCount: number;
    openTaskCount: number;
    completedTaskCount: number;
    milestoneCount: number;
    remarkCount: number;
    timeWindowDays: number | null;
    overdueCount: number;
    upcomingCount: number;
  };
  riskSignals: string[];
  remarksSample: { id: string; text: string; userId: string; timestamp: string }[];
  initialStatus: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'UNKNOWN';
}): string {
  const {
    projectName,
    filter,
    filterSignature,
    stats,
    riskSignals,
    remarksSample,
    initialStatus,
  } = args;

  const scopeDescription = buildScopeDescription(filter);

  const riskBullets =
    riskSignals.length > 0
      ? riskSignals.map((r) => `- ${r}`).join('\n')
      : '- No explicit high-risk statuses detected based on provided data.';

  const remarksBullets =
    remarksSample.length > 0
      ? remarksSample
          .slice(0, 10)
          .map(
            (r) =>
              `- Remark (${r.timestamp || 'unknown time'}): ${truncate(
                r.text || '',
                200,
              )}`,
          )
          .join('\n')
      : '- Not specified.';

  return `
You are generating an executive-level AI Project Summary for stakeholders.

SYSTEM & RULES (MUST FOLLOW):
- Use ONLY the provided project data. Do NOT invent tasks, owners, or dates.
- Output MUST be valid Markdown.
- Structure and section order MUST be EXACTLY:
  1. # AI Project Summary – [Project Name]
  2. ## Executive Overview
  3. ## Overall Status
  4. ## Key Achievements Since Last Update
  5. ## Upcoming Milestones
  6. ## Risks & Issues
  7. ## Decisions & Dependencies
  8. ## Next Steps & Asks
- Tone: concise, neutral-professional, outcome-focused.
- Length: ~300–700 words total.
- Use bullet points heavily. No deep nesting. Avoid walls of text.
- Overall Status section MUST clearly pick EXACTLY ONE of:
  - On Track
  - At Risk
  - Off Track
  - Unknown
- If data is missing for something, state "Not specified" or an honest equivalent.
- Prefer latest information when signals conflict; if still unclear, call it out.
- Do NOT include any extra sections beyond those required.

PROJECT CONTEXT:
- Project Name: ${projectName}
- Filter / Scope: ${scopeDescription}
- Filter Signature (idempotency hint): ${filterSignature}
- Source Stats:
  - Total Tasks (after filters): ${stats.taskCount}
  - Open Tasks: ${stats.openTaskCount}
  - Completed Tasks: ${stats.completedTaskCount}
  - Milestones (heuristic): ${stats.milestoneCount}
  - Remarks (discussion items): ${stats.remarkCount}
  - Overdue Items: ${stats.overdueCount}
  - Upcoming (next 7 days): ${stats.upcomingCount}
  - Effective Time Window (days, derived from activity): ${
    stats.timeWindowDays ?? 'Not specified'
  }

INITIAL STATUS SIGNAL:
- Heuristic assessment (for your reference only): ${initialStatus}

QUALITATIVE SIGNALS:
- Risk/Blocker Indicators:
${riskBullets}

- Representative Remarks Sample:
${remarksBullets}

YOUR TASK:
Using ONLY the context above:
- Synthesize a clear, exec-ready status summary in Markdown.
- Follow the exact required headings and order.
- In "Overall Status", choose one explicit label and justify it concisely based on the data.
- In each section, use 3–7 concise bullet points where applicable.
- Be specific, avoid fluff, and never fabricate unknown details.

Begin the Markdown summary now.
  `.trim();
}

/**
 * Build a human-readable description of the applied filters.
 */
function buildScopeDescription(filter: AiSummaryFilter): string {
  const parts: string[] = [];

  if (filter.statuses?.length) {
    parts.push(`Statuses in [${filter.statuses.join(', ')}]`);
  }
  if (filter.assignees?.length) {
    parts.push(`Assignees in [${filter.assignees.join(', ')}]`);
  }
  if (filter.tags?.length) {
    parts.push(`Tags overlapping [${filter.tags.join(', ')}]`);
  }
  if (filter.fromDate || filter.toDate) {
    parts.push(
      `Due dates between ${filter.fromDate || 'any'} and ${
        filter.toDate || 'any'
      }`,
    );
  }

  if (parts.length === 0) {
    return 'All available tasks and remarks for this project at time of generation.';
  }

  return parts.join('; ');
}

/**
 * Detect which required sections are present from headings.
 */
function detectSections(markdown: string): AiProjectSummaryResult['sectionsPresent'] {
  const lower = markdown.toLowerCase();

  return {
    overview: lower.includes('## executive overview'),
    timeline:
      lower.includes('## overall status') ||
      lower.includes('## upcoming milestones'),
    milestones: lower.includes('## upcoming milestones'),
    risks: lower.includes('## risks & issues') || lower.includes('## risks & issues'),
    blockers:
      lower.includes('blocker') ||
      lower.includes('blocked') ||
      lower.includes('## risks & issues') ||
      lower.includes('## risks & issues'),
    nextSteps: lower.includes('## next steps & asks') || lower.includes('## next steps & asks'),
  };
}

/**
 * Normalize Overall Status based on AI content while enforcing allowed values.
 * If we can parse a valid status from the markdown, use it; otherwise fall back
 * to heuristic initialStatus or UNKNOWN.
 */
function normalizeOverallStatus(
  markdown: string,
  initialStatus: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'UNKNOWN',
): 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'UNKNOWN' {
  const text = markdown.toLowerCase();

  // Try to extract explicit label from Overall Status section.
  if (text.includes('overall status')) {
    if (/\bon track\b/.test(text)) return 'ON_TRACK';
    if (/\bat risk\b/.test(text)) return 'AT_RISK';
    if (/\boff track\b/.test(text)) return 'OFF_TRACK';
    if (/\bunknown\b/.test(text)) return 'UNKNOWN';
  }

  // Fallback to heuristic.
  return initialStatus || 'UNKNOWN';
}

/**
 * Basic word count utility: split on whitespace.
 */
function computeWordCount(markdown: string): number {
  const words = markdown
    .replace(/[#*_`>-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return words.length;
}

/**
 * Truncate a string to N chars with ellipsis.
 */
function truncate(value: string, maxLen: number): string {
  if (!value) return '';
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen - 1)}…`;
}

/**
 * Note:
 * No dynamic firestore imports or query helpers are used here to keep the flow
 * tree-shakable and compatible with the existing Firebase client setup.
 */