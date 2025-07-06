
'use server';

/**
 * @fileOverview AI-powered suggestion of AI To-Do items for an entire checklist.
 *
 * - suggestChecklistNextSteps - A function that suggests automatable sub-tasks for a given list of tasks.
 * - SuggestChecklistNextStepsInput - The input type for the suggestChecklistNextSteps function.
 * - SuggestChecklistNextStepsOutput - The return type for the suggestChecklistNextSteps function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TaskAnalysisSchema = z.object({
  taskId: z.string().describe('The unique identifier for the task.'),
  taskDescription: z.string().describe('The detailed description of the task.'),
  discussionHistory: z
    .string()
    .describe('The historical discussion related to the task, including existing remarks and AI To-Dos.'),
});

const DocumentContextSchema = z.object({
  fileName: z.string(),
  fileDataUri: z.string().describe("A document file, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});

const SuggestChecklistNextStepsInputSchema = z.object({
  tasks: z.array(TaskAnalysisSchema).describe('A list of tasks to analyze for potential AI To-Do items.'),
  contextDocuments: z.array(DocumentContextSchema).optional().describe('A list of context documents to provide project context.'),
});
export type SuggestChecklistNextStepsInput = z.infer<typeof SuggestChecklistNextStepsInputSchema>;

const ChecklistSuggestionSchema = z.object({
    taskId: z.string().describe('The ID of the task for which the suggestion is being made.'),
    suggestion: z.string().describe('The suggested AI To-Do item, formatted as "[ai-todo|pending] {description}".'),
    context: z.string().describe('A brief explanation of why this suggestion is being made, referencing the source remark(s) or to-do(s).'),
});

const InformationRequestSchema = z.object({
  taskId: z.string().describe('The ID of the task this information request relates to.'),
  request: z.string().describe('A clear, specific question for the user to provide more context, which will enable the generation of a better AI To-Do.'),
});
export type InformationRequest = z.infer<typeof InformationRequestSchema>;


const SuggestChecklistNextStepsOutputSchema = z.object({
  suggestions: z
    .array(ChecklistSuggestionSchema)
    .describe('A list of suggested AI To-Do items for the provided tasks, with context.'),
  informationRequests: z.array(InformationRequestSchema).optional().describe('A list of questions to ask the user to get more context for generating better suggestions. This should be used when a task is too vague to create a concrete AI To-Do.')
});
export type SuggestChecklistNextStepsOutput = z.infer<typeof SuggestChecklistNextStepsOutputSchema>;

export async function suggestChecklistNextSteps(input: SuggestChecklistNextStepsInput): Promise<SuggestChecklistNextStepsOutput> {
  return suggestChecklistNextStepsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestChecklistNextStepsPrompt',
  input: {schema: SuggestChecklistNextStepsInputSchema},
  output: {schema: SuggestChecklistNextStepsOutputSchema},
  prompt: `You are an AI assistant that analyzes a list of tasks and their discussion histories to identify sub-tasks that can be automated. Your goal is to propose these automatable sub-tasks as "AI To-Dos" in a proactive and assertive way.

{{#if contextDocuments}}
You have been provided with context documents. These documents are the primary source of truth for the project. Analyze them to understand the project's goals, scope, and technical details. Use this deep understanding to inform your suggestions and make them highly relevant and specific.

{{#each contextDocuments}}
The document below is named '{{{fileName}}}'. Use it as context.
{{{media url=fileDataUri}}}
{{/each}}
--- CONTEXT DOCUMENTS END ---
{{/if}}

Your analysis must be exhaustive. Process every single task provided in the input.

For each task, perform the following analysis:

1.  **Assess Task Specificity**: Review the task's description and discussion history. Can you generate a specific, concrete, automatable AI To-Do right now?
    *   If **YES**, create a concrete AI To-Do suggestion.
    *   If **NO**, because the task is too vague (e.g., "Deploy app", "Write tests"), proceed to the next step to be proactive.

2.  **Handle Vague Tasks (Be Proactive!)**: When a task lacks detail, your primary goal is to **propose a research task** to gather the necessary information.
    *   **First, try to create an assertive, research-based AI To-Do suggestion.** Frame it as you offering to help. For example, for a vague task like "Deploy app," instead of just asking a question, you should suggest an AI To-Do like: \`[ai-todo|pending] Research and outline deployment options, including recommended cloud providers and environment configurations (Staging, Production).\` Add this to the \`suggestions\` array.
    *   **Only as a last resort**, if the task is so ambiguous that you cannot even formulate a meaningful research task, should you fall back to asking a clarifying question. In this rare case, add a question to the \`informationRequests\` array.

3.  **Output Format**:
    *   For each **suggestion** (whether concrete or research-based), provide:
        1.  \`taskId\`: The ID of the task this suggestion belongs to.
        2.  \`suggestion\`: The AI To-Do formatted as \`[ai-todo|pending] {description of the AI task}\`.
        3.  \`context\`: A brief explanation for why you are making this suggestion.
    *   For each **information request** (used only as a fallback), provide:
        1.  \`taskId\`: The ID of the task.
        2.  \`request\`: A clear, specific question for the user.

**Important Rules:**
- You MUST process every task. Do not stop after a few.
- **Prioritize generating actionable suggestions (including research tasks) over asking questions.** Use \`informationRequests\` sparingly.
- Do not suggest AI To-Dos that are functionally identical to ones already present in that task's discussion history.
- If you find nothing to suggest or ask, return empty arrays for both \`suggestions\` and \`informationRequests\`.

Here is the list of tasks to analyze:
{{#each tasks}}
--- TASK START ---
Task ID: {{{taskId}}}
Task Description: {{{taskDescription}}}
Discussion History:
{{{discussionHistory}}}
--- TASK END ---
{{/each}}
`,
});

const suggestChecklistNextStepsFlow = ai.defineFlow(
  {
    name: 'suggestChecklistNextStepsFlow',
    inputSchema: SuggestChecklistNextStepsInputSchema,
    outputSchema: SuggestChecklistNextStepsOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
