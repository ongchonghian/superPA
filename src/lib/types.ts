
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
}


export interface Document {
  id:string;
  checklistId: string;
  fileName: string;
  storagePath: string; // Path to the file in Firebase Storage
  createdAt: string; // ISO string for Firestore compatibility
  mimeType: string; // The MIME type of the file
}

export interface AppSettings {
  apiKey: string;
  model: GeminiModel | string; // Allow string for flexibility, but prefer GeminiModel
}

declare global {
  interface Window {
    showOpenFilePicker: any;
  }
}
