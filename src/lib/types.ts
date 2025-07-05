import {PRIORITIES, STATUSES} from './data';

export type TaskStatus = (typeof STATUSES)[number];
export type TaskPriority = (typeof PRIORITIES)[number];

export interface Task {
  id: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  dueDate: string; // Using string (YYYY-MM-DD) to be easily serializable for localStorage
  discussion: string;
}

export interface Checklist {
  id: string;
  name: string;
  tasks: Task[];
}
