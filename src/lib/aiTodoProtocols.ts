import type { Remark } from './types';

export type AiTodoStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed';
export type PromptExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';

const AI_TODO_REGEX = /^\[ai-todo\|(pending|queued|running|completed|failed)\]\s*(.*)$/;
const AI_TODO_STATUS_UPDATE_REGEX = /\[ai-todo\|(pending|running|completed|failed|queued)\]/;

const PROMPT_EXECUTION_REGEX = /^\[prompt-execution\|(pending|running|completed|failed)\]\s*(.*)$/;

const STORAGE_LINK_REGEX = /\[View results\]\(storage:\/\/([^)]+)\)/;
const AI_EXECUTION_COMPLETE_PREFIX = 'AI execution complete.';

export interface ParsedAiTodoRemark {
  status: AiTodoStatus | null;
  rest: string;
}

export interface ParsedPromptExecutionRemark {
  status: PromptExecutionStatus | null;
  rest: string;
}

/**
 * Parse an AI To-Do remark following the existing "[ai-todo|STATUS] ..." convention.
 * Mirrors the patterns used in the UI and Home queue/runner logic.
 */
export function parseAiTodoRemark(text: string): ParsedAiTodoRemark {
  const match = text.match(AI_TODO_REGEX);
  if (!match) {
    return { status: null, rest: text };
  }
  const status = match[1] as AiTodoStatus;
  const rest = (match[2] || '').trim();
  return { status, rest };
}

/**
 * Format an AI To-Do remark string using the existing convention.
 */
export function formatAiTodoRemark(status: AiTodoStatus, rest: string): string {
  const trimmed = rest.trim();
  return trimmed
    ? `[ai-todo|${status}] ${trimmed}`
    : `[ai-todo|${status}]`;
}

/**
 * Replace any existing [ai-todo|...] status in a remark with the given one.
 * Uses the same update regex as current Home logic.
 */
export function withUpdatedAiTodoStatus(text: string, nextStatus: AiTodoStatus): string {
  if (AI_TODO_STATUS_UPDATE_REGEX.test(text)) {
    return text.replace(AI_TODO_STATUS_UPDATE_REGEX, `[ai-todo|${nextStatus}]`);
  }
  // If no tag is present but caller still wants to enforce, prepend to preserve behavior expectations.
  return formatAiTodoRemark(nextStatus, text);
}

/**
 * Parse a prompt-execution remark following the existing "[prompt-execution|STATUS] ..." convention.
 * Covers both the execution-helper and result usage.
 */
export function parsePromptExecutionRemark(text: string): ParsedPromptExecutionRemark {
  const match = text.match(PROMPT_EXECUTION_REGEX);
  if (!match) {
    return { status: null, rest: text };
  }
  const status = match[1] as PromptExecutionStatus;
  const rest = (match[2] || '').trim();
  return { status, rest };
}

/**
 * Format a prompt-execution remark string using the existing convention.
 */
export function formatPromptExecutionRemark(status: PromptExecutionStatus, rest: string): string {
  const trimmed = rest.trim();
  return trimmed
    ? `[prompt-execution|${status}] ${trimmed}`
    : `[prompt-execution|${status}]`;
}

/**
 * Determine if a remark represents an AI execution completion / result message.
 * This mirrors the pattern used today in the runner:
 *   "AI execution complete. [View results](storage://...)"
 * Optionally followed by a markdown summary section.
 */
export function isAiResultRemark(text: string): boolean {
  if (!text.startsWith(AI_EXECUTION_COMPLETE_PREFIX)) {
    return false;
  }
  return STORAGE_LINK_REGEX.test(text);
}

/**
 * Extract a "storage://..." path from a remark body.
 * Matches the "[View results](storage://...)" convention used in TaskTable/Home.
 * Returns the raw storage path part (without "storage://") or null if not found.
 */
export function extractStoragePath(text: string): string | null {
  const match = text.match(STORAGE_LINK_REGEX);
  if (!match) {
    return null;
  }
  return match[1] || null;
}

/**
 * Utility helpers to keep logic close to current expectations.
 */

export function isAiTodoRemark(text: string): boolean {
  return AI_TODO_REGEX.test(text);
}

export function isPromptExecutionRemark(text: string): boolean {
  return PROMPT_EXECUTION_REGEX.test(text);
}

/**
 * Try to resolve a storage path from a remark that might be:
 * - a standalone AI result remark, or
 * - any remark containing the existing "[View results](storage://...)" link.
 */
export function getRemarkStoragePath(remark: Pick<Remark, 'text'>): string | null {
  return extractStoragePath(remark.text);
}