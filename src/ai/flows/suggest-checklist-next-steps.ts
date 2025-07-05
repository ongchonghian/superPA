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
  storagePath: z.string().describe('The path to the document in Firebase Storage.'),
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


const PromptInputSchema = SuggestChecklistNextStepsInputSchema.extend({
    documentsWithUris: z.array(z.object({
        fileName: z.string(),
        uri: z.string()
    })).optional()
});


const prompt = ai.definePrompt({
  name: 'suggestChecklistNextStepsPrompt',
  input: {schema: PromptInputSchema},
  output: {schema: SuggestChecklistNextStepsOutputSchema},
  prompt: `You are an AI assistant that analyzes a list of tasks and their discussion histories to identify sub-tasks that can be automated. Your goal is to propose these automatable sub-tasks as "AI To-Dos".

{{#if documentsWithUris}}
You have been provided with context documents. These documents are the primary source of truth for the project. Analyze them to understand the project's goals, scope, and technical details. Use this deep understanding to inform your suggestions and make them highly relevant and specific.

--- CONTEXT DOCUMENTS START ---
{{#each documentsWithUris}}
## Document: {{{fileName}}}
{{{media url=uri}}}

---
{{/each}}
--- CONTEXT DOCUMENTS END ---
{{/if}}

Your analysis must be exhaustive. Process every single task provided in the input.

For each task, you will perform a two-step analysis:

Step 1: Context Assessment
- Review the task's description and discussion history.
- Determine if you have enough specific information to create a concrete, actionable AI To-Do.
- If the information is too vague or general (e.g., "Deploy app", "Write tests"), you MUST request more information. Create a specific question that, if answered, would allow you to generate a better suggestion. Add this to the 'informationRequests' array in the output. For example, for "Deploy app", you might ask "What is the deployment environment (e.g., Staging, Production) and cloud provider?".

Step 2: Suggestion Generation
- If and only if you have enough context from Step 1, identify potential automatable actions.
- For each valid suggestion you generate, provide the following in the 'suggestions' array:
  1.  taskId: The ID of the task this suggestion belongs to.
  2.  suggestion: The AI To-Do formatted as a string following this exact syntax: "[ai-todo|pending] {description of the AI task}"
  3.  context: A short explanation for *why* you are making this suggestion. If it relates to a specific remark, quote part of that remark in your explanation.

Important Rules:
- You MUST process every task. Do not stop after a few.
- If a task is vague, prioritize asking for more information over creating a superficial suggestion.
- Do not suggest AI To-Dos that are functionally identical to ones already present in that task's discussion history.
- If you generate both suggestions and information requests, include both in the output. If you find nothing, return empty arrays for both.

Here is the list of tasks to analyze:
{{#each tasks}}
---
Task ID: {{{taskId}}}
Task Description: {{{taskDescription}}}
Discussion History:
{{{discussionHistory}}}
---
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
    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (input.contextDocuments && !bucket) {
        throw new Error("Firebase Storage bucket name is not configured in environment variables. Cannot process documents.");
    }

    const documentsWithUris = input.contextDocuments?.map(doc => ({
        ...doc,
        uri: `gs://${bucket}/${doc.storagePath}`
    }));

    const promptInput = {
        ...input,
        documentsWithUris: documentsWithUris,
    };
    
    const {output} = await prompt(promptInput);
    return output!;
  }
);
