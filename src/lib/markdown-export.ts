import type { Checklist, Task, Remark, Document, UserProfile, AppSettings } from './types';

/**
 * Generate markdown for a single task, matching the inline implementation in Home.
 * This is extracted verbatim to preserve byte-for-byte output.
 */
function formatTaskToMarkdown(task: Task): string {
  const status = task.status === 'complete' ? 'x' : ' ';
  const taskDetails = `(Priority: ${task.priority}, Due: ${task.dueDate})`;
  const assigneePart = ` - *Assignee: [${task.assignee || 'Unassigned'}]*`;
  const taskLine = `- [${status}] **${task.description}** ${taskDetails}${assigneePart}`;

  const remarksLines = task.remarks
    .map((r: Remark) => {
      const remarkDate = new Date(r.timestamp);
      const dateString = remarkDate
        .toISOString()
        .split('T')[0]
        .replace(/-/g, '');
      return `  - > #${dateString} ${r.text} (by ${r.userId})`;
    })
    .join('\n');

  return `${taskLine}${remarksLines ? `\n${remarksLines}` : ''}`;
}

/**
 * Generate checklist markdown export.
 *
 * The signature accepts the parameters currently available at the Home callsite,
 * but only `checklist` is used today. The implementation is intentionally aligned
 * with the previous inline generateMarkdownContent to guarantee identical output.
 */
export function generateChecklistMarkdown(
  checklist: Checklist,
  tasks?: Task[],
  remarks?: Remark[],
  documents?: Document[],
  collaborators?: UserProfile[],
  settings?: AppSettings,
): string {
  const targetChecklist = checklist;

  const checklistTitle = `# ${targetChecklist.name}\n\n`;

  const incompleteTasks = targetChecklist.tasks.filter(
    (t) => t.status !== 'complete',
  );
  const completedTasks = targetChecklist.tasks.filter(
    (t) => t.status === 'complete',
  );

  let markdownContent = '';

  if (incompleteTasks.length > 0) {
    markdownContent += `## Incomplete Tasks\n\n`;
    markdownContent += incompleteTasks.map(formatTaskToMarkdown).join('\n\n');
    markdownContent += '\n\n';
  }

  if (completedTasks.length > 0) {
    markdownContent += `## Completed Tasks\n\n`;
    markdownContent += completedTasks.map(formatTaskToMarkdown).join('\n\n');
    markdownContent += '\n\n';
  }

  if (markdownContent.trim() === '') {
    markdownContent = 'This checklist has no tasks.';
  }

  return checklistTitle + markdownContent.trim() + '\n';
}