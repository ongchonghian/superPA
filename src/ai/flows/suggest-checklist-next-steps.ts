
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
  prompt: `You are an expert AI assistant that helps users break down project tasks into actionable steps. Your goal is to analyze a list of tasks and suggest a SINGLE, high-impact "AI To-Do" for tasks that are blocked or unclear, or ask for more information if necessary.

{{#if contextDocuments}}
You have been provided with context documents. These documents are the primary source of truth for the project. Analyze them to understand the project's goals, scope, and technical details. Use this deep understanding to inform your suggestions and make them highly relevant and specific.

{{#each contextDocuments}}
The document below is named '{{{fileName}}}'. Use it as context.
{{{media url=fileDataUri}}}
{{/each}}
--- CONTEXT DOCUMENTS END ---
{{/if}}

Your analysis must be exhaustive. For each task provided, perform the following analysis:

1.  **Analyze the Task and its History:** Read the task's description and its entire discussion history, which includes user remarks and any existing AI To-Dos.

2.  **Check for Existing AI To-Dos:** Does the task's discussion history already contain a remark starting with \`[ai-todo|pending]\` or \`[ai-todo|running]\`?
    *   If **YES**, you MUST skip this task completely. Do not generate a suggestion or an information request for it. This is the most important rule.
    *   If **NO**, proceed to the next step.

3.  **Assess Task Specificity**: Can you formulate a concrete, automatable AI To-Do right now that is **directly relevant** to the task's description?
    *   If **YES**, create a concrete AI To-Do suggestion. Example: For a task "Create social media graphics," a good suggestion is \`[ai-todo|pending] Generate 3-5 banner image options for a Twitter promotion.\` Add this to the \`suggestions\` array.
    *   If **NO**, because the task is too vague (e.g., "Deploy app," "Write tests"), proceed to the next step to be proactive.

4.  **Handle Vague Tasks (Be Proactive!)**: When a task is vague, your first goal is to propose a research task.
    *   **Attempt to create an assertive, research-based AI To-Do suggestion.** This suggestion must be a logical first step to clarify the vague task. It MUST be relevant. For example, for "Deploy app," a good suggestion is \`[ai-todo|pending] Research and outline deployment options...\`. For "Write tests," a good suggestion is \`[ai-todo|pending] Analyze the codebase and suggest a unit testing strategy, including recommended frameworks.\`. Add this to the \`suggestions\` array.
    *   **If and only if** you cannot formulate a relevant research task, ask a clarifying question. Add this question to the \`informationRequests\` array.

5.  **Output Format**:
    *   For each **suggestion**, provide:
        1.  \`taskId\`: The ID of the task.
        2.  \`suggestion\`: The AI To-Do formatted as \`[ai-todo|pending] {description}\`.
        3.  \`context\`: A brief explanation for why you are making this suggestion.
    *   For each **information request**, provide:
        1.  \`taskId\`: The ID of the task.
        2.  \`request\`: A clear, specific question for the user.

**MANDATORY RULES:**
- **PRIMARY RULE: If a task's discussion history already contains \`[ai-todo|pending]\` or \`[ai-todo|running]\`, YOU MUST NOT generate any output for that \`taskId\`.**
- Your suggestions MUST be relevant to the \`taskDescription\`. Do not just repeat examples from this prompt.
- You MUST process every task according to these rules.
- Prioritize suggestions over questions. Use \`informationRequests\` sparingly.

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
