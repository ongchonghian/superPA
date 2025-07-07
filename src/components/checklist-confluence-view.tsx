
'use client';

import React from 'react';
import type { Checklist } from '@/lib/types';
import { format, parseISO } from 'date-fns';

interface ChecklistConfluenceViewProps {
  checklist: Checklist | null;
}

// Note: This component uses inline styles because Confluence can be particular about pasted HTML.
// Using basic HTML tags and inline styles gives the most reliable copy-paste result.
export function ChecklistConfluenceView({ checklist }: ChecklistConfluenceViewProps) {
  if (!checklist) return null;

  return (
    <div>
      <h1>{checklist.name}</h1>
      <table style={{ borderCollapse: 'collapse', width: '100%', border: '1px solid #dfe1e6' }}>
        <thead style={{ backgroundColor: '#f4f5f7' }}>
          <tr>
            <th style={{ border: '1px solid #dfe1e6', padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>Status</th>
            <th style={{ border: '1px solid #dfe1e6', padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>Task</th>
            <th style={{ border: '1px solid #dfe1e6', padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>Priority</th>
            <th style={{ border: '1px solid #dfe1e6', padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>Assignee</th>
            <th style={{ border: '1px solid #dfe1e6', padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>Due Date</th>
          </tr>
        </thead>
        <tbody>
          {checklist.tasks.map(task => (
            <tr key={task.id}>
              <td style={{ border: '1px solid #dfe1e6', padding: '8px', verticalAlign: 'top' }}>
                {task.status === 'complete' ? '✅ Done' : '⬜ To Do'}
              </td>
              <td style={{ border: '1px solid #dfe1e6', padding: '8px', verticalAlign: 'top' }}>
                <p style={{ margin: 0 }}>{task.description}</p>
                {task.remarks && task.remarks.length > 0 && (
                  <div style={{ marginTop: '8px', paddingLeft: '16px', fontSize: '12px', color: '#5e6c84' }}>
                    <strong>Remarks:</strong>
                    <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px' }}>
                      {task.remarks.map(remark => (
                        <li key={remark.id}>
                          {remark.text} <em>(by {remark.userId})</em>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </td>
              <td style={{ border: '1px solid #dfe1e6', padding: '8px', verticalAlign: 'top' }}>{task.priority}</td>
              <td style={{ border: '1px solid #dfe1e6', padding: '8px', verticalAlign: 'top' }}>{task.assignee}</td>
              <td style={{ border: '1px solid #dfe1e6', padding: '8px', verticalAlign: 'top' }}>{format(parseISO(task.dueDate), 'MMM dd, yyyy')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
