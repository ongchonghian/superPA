import {PRIORITIES, STATUSES} from './data';

export type TaskStatus = (typeof STATUSES)[number];
export type TaskPriority = (typeof PRIORITIES)[number];

export interface Remark {
  id: string;
  text: string;
  userId: string;
  timestamp: string; // ISO string for Firestore compatibility
}

export interface Task {
  id: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  dueDate: string; // Using string (YYYY-MM-DD)
  remarks: Remark[];
}

export interface Checklist {
  id: string;
  name: string;
  tasks: Task[];
  ownerId: string;
  documentIds?: string[]; // Array of document IDs associated with this checklist
}

export type DocumentStatus = 'ready' | 'failed';

export interface Document {
  id: string;
  checklistId: string;
  fileName: string;
  fileDataUri: string; // The content of the file as a data URI
  status: DocumentStatus;
  createdAt: string; // ISO string for Firestore compatibility
}
