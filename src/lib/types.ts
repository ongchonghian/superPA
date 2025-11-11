
import {PRIORITIES, STATUSES, GEMINI_MODELS} from './data';

export type TaskStatus = (typeof STATUSES)[number];
export type TaskPriority = (typeof PRIORITIES)[number];
export type GeminiModel = (typeof GEMINI_MODELS)[number];

export interface Remark {
  id: string;
  text: string;
  userId: string;
  timestamp: string; // ISO string for Firestore compatibility
  parentId?: string; // For nesting remarks
}

export interface Task {
  id:string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  dueDate: string; // Using string (YYYY-MM-DD)
  remarks: Remark[];
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface Checklist {
  id: string;
  name: string;
  tasks: Task[];
  ownerId: string;
  collaboratorIds?: string[];
  documentIds?: string[]; // Array of document IDs associated with this checklist
}

export interface Invite {
    id: string;
    checklistId: string;
    checklistName: string;
    inviterId: string;
    inviterName: string;
    email: string; // The email of the user being invited
    createdAt: any; // Firestore ServerTimestamp
}


export interface Document {
  id: string;
  checklistId: string;
  fileName: string;
  storagePath: string; // Path to the file in Firebase Storage
  createdAt: string; // ISO string for Firestore compatibility
  mimeType: string; // The MIME type of the file
  sourceUrl?: string; // The original URL if sourced from the web
  status?: 'processing' | 'complete' | 'failed'; // Status for web-sourced documents
  error?: string; // Error message if processing failed
}

/**
 * Report types supported by the system.
 *
 * Phase 1:
 * - 'AI_SUMMARY' for AI-generated project status summaries (see docs/ai-summary-spec.md).
 *
 * Designed to be easily extended with additional report types in future phases.
 */
export type ReportType = 'AI_SUMMARY';

/**
 * Shared Report model for persisted, exportable reports.
 *
 * Stored in Firestore under the `reports` collection.
 * `createdAt` and optional `sourceSnapshotRange` timestamps are ISO strings.
 */
export interface Report {
  id: string;
  projectId: string;
  type: ReportType;
  title: string;
  createdAt: string; // ISO timestamp
  createdBy: string;
  contentMarkdown: string;
  metadata: {
    filterSignature: string;
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
}

export interface Notification {
  id: string;
  taskId: string;
  remarkId: string;
  taskDescription: string;
  timestamp: string;
  read: boolean;
}

export interface AppSettings {
  apiKey: string;
  model: GeminiModel | string; // Allow string for flexibility, but prefer GeminiModel
  rerunTimeout: number; // in minutes
  maxInputTokens?: number;
  maxOutputTokens?: number;
}

declare global {
  interface Window {
    showOpenFilePicker: any;
  }
}
