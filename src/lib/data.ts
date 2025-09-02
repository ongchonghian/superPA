
import type { Checklist, TaskPriority, TaskStatus, GeminiModel } from './types';

export const PRIORITIES = ['High', 'Medium', 'Low'] as const;
export const STATUSES = ['complete', 'in progress', 'pending'] as const;

export const GEMINI_MODELS = [
  'gemini-1.5-pro-latest',
  'gemini-1.5-flash-latest',
  'gemini-2.5-flash',
] as const;


export const GEMINI_MODEL_CONFIGS: Record<GeminiModel, { maxInput: number; maxOutput: number; defaultInput: number; defaultOutput: number; }> = {
  'gemini-1.5-pro-latest': {
    maxInput: 1048576,
    maxOutput: 8192,
    defaultInput: 262144,
    defaultOutput: 2048,
  },
  'gemini-1.5-flash-latest': {
    maxInput: 1048576,
    maxOutput: 8192,
    defaultInput: 131072,
    defaultOutput: 2048,
  },
  'gemini-2.5-flash': {
    maxInput: 1048576,
    maxOutput: 8192,
    defaultInput: 131072,
    defaultOutput: 8192,
  },
};


// Note: this data is now only for reference and is not used to initialize the app.
// The app now fetches data from Firestore.
export const initialChecklists: Checklist[] = [
  {
    id: 'cl_1',
    name: 'Q3 Feature Launch',
    ownerId: 'user_123',
    collaboratorIds: [],
    documentIds: [],
    tasks: [
      {
        id: 'task_1',
        description: 'Design the new user dashboard',
        status: 'complete',
        priority: 'High',
        assignee: 'Alice',
        dueDate: '2024-08-15',
        remarks: [{
          id: 'rem_1',
          text: 'Initial mockups are done. Need to finalize the color palette.',
          userId: 'Alice',
          timestamp: new Date('2024-07-20T10:00:00Z').toISOString()
        }]
      },
      {
        id: 'task_2',
        description: 'Develop the authentication flow',
        status: 'in progress',
        priority: 'High',
        assignee: 'Bob',
        dueDate: '2024-08-20',
        remarks: [{
          id: 'rem_2',
          text: 'Using OAuth 2.0. Encountered an issue with the redirect URI.',
          userId: 'Bob',
          timestamp: new Date('2024-07-21T14:30:00Z').toISOString()
        }]
      },
      {
        id: 'task_3',
        description: 'Set up the production database',
        status: 'pending',
        priority: 'Medium',
        assignee: 'Charlie',
        dueDate: '2024-08-25',
        remarks: [{
          id: 'rem_3',
          text: 'Waiting for credentials from the infra team.',
          userId: 'Charlie',
          timestamp: new Date('2024-07-22T09:00:00Z').toISOString()
        }]
      },
      {
        id: 'task_4',
        description: 'Write API documentation',
        status: 'pending',
        priority: 'Low',
        assignee: 'Alice',
        dueDate: '2024-09-01',
        remarks: []
      }
    ]
  },
  {
    id: 'cl_2',
    name: 'Marketing Campaign',
    ownerId: 'user_123',
    collaboratorIds: [],
    documentIds: [],
    tasks: [
      {
        id: 'task_5',
        description: 'Draft blog post for launch announcement',
        status: 'in progress',
        priority: 'High',
        assignee: 'Diana',
        dueDate: '2024-08-10',
        remarks: []
      },
      {
        id: 'task_6',
        description: 'Prepare social media assets',
        status: 'pending',
        priority: 'Medium',
        assignee: 'Eve',
        dueDate: '2024-08-18',
        remarks: []
      }
    ]
  }
];
