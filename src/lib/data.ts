import type { Checklist, TaskPriority, TaskStatus } from './types';

export const PRIORITIES = ['High', 'Medium', 'Low'] as const;
export const STATUSES = ['complete', 'in progress', 'pending'] as const;

export const initialChecklists: Checklist[] = [
  {
    id: 'cl_1',
    name: 'Q3 Feature Launch',
    tasks: [
      {
        id: 'task_1',
        description: 'Design the new user dashboard',
        status: 'complete',
        priority: 'High',
        assignee: 'Alice',
        dueDate: '2024-08-15',
        discussion: 'Initial mockups are done. Need to finalize the color palette.'
      },
      {
        id: 'task_2',
        description: 'Develop the authentication flow',
        status: 'in progress',
        priority: 'High',
        assignee: 'Bob',
        dueDate: '2024-08-20',
        discussion: 'Using OAuth 2.0. Encountered an issue with the redirect URI.'
      },
      {
        id: 'task_3',
        description: 'Set up the production database',
        status: 'pending',
        priority: 'Medium',
        assignee: 'Charlie',
        dueDate: '2024-08-25',
        discussion: 'Waiting for credentials from the infra team.'
      },
      {
        id: 'task_4',
        description: 'Write API documentation',
        status: 'pending',
        priority: 'Low',
        assignee: 'Alice',
        dueDate: '2024-09-01',
        discussion: 'Initial draft using Swagger/OpenAPI. Needs review.'
      }
    ]
  },
  {
    id: 'cl_2',
    name: 'Marketing Campaign',
    tasks: [
      {
        id: 'task_5',
        description: 'Draft blog post for launch announcement',
        status: 'in progress',
        priority: 'High',
        assignee: 'Diana',
        dueDate: '2024-08-10',
        discussion: 'First draft is ready for review. Focusing on the new AI features.'
      },
      {
        id: 'task_6',
        description: 'Prepare social media assets',
        status: 'pending',
        priority: 'Medium',
        assignee: 'Eve',
        dueDate: '2024-08-18',
        discussion: 'Waiting for final branding guidelines from the design team.'
      }
    ]
  }
];
