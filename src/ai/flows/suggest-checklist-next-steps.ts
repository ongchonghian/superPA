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

const SuggestChecklistNextStepsInputSchema = z.object({
  tasks: z.array(TaskAnalysisSchema).describe('A list of tasks to analyze for potential AI To-Do items.')
});
export type SuggestChecklistNextStepsInput = z.infer<typeof SuggestChecklistNextStepsInputSchema>;

const ChecklistSuggestionSchema = z.object({
    taskId: z.string().describe('The ID of the task for which the suggestion is being made.'),
    suggestion: z.string().describe('The suggested AI To-Do item, formatted as "[ai-todo|pending] {description}".'),
    context: z.string().describe('A brief explanation of why this suggestion is being made, referencing the source remark(s) or to-do(s).'),
});
export type ChecklistSuggestion = z.infer<typeof ChecklistSuggestionSchema>;

const SuggestChecklistNextStepsOutputSchema = z.object({
  suggestions: z
    .array(ChecklistSuggestionSchema)
    .describe('A list of suggested AI To-Do items for the provided tasks, with context.'),
});
export type SuggestChecklistNextStepsOutput = z.infer<typeof SuggestChecklistNextStepsOutputSchema>;

export async function suggestChecklistNextSteps(input: SuggestChecklistNextStepsInput): Promise<SuggestChecklistNextStepsOutput> {
  return suggestChecklistNextStepsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestChecklistNextStepsPrompt',
  input: {schema: SuggestChecklistNextStepsInputSchema},
  output: {schema: SuggestChecklistNextStepsOutputSchema},
  prompt: `You are an AI assistant that analyzes a list of tasks and their discussion histories to identify sub-tasks that can be automated.
Your goal is to propose these automatable sub-tasks as "AI To-Dos".

For each task provided in the input array, analyze its description and discussion history.
Based on your analysis, generate a list of *new* suggestions for AI To-Dos for that specific task.
Important: Do not suggest any AI To-Dos that are functionally identical to ones already present in that task's discussion history.

For each valid suggestion you generate, provide the following in the output object:
1. taskId: The ID of the task this suggestion belongs to.
2. suggestion: The AI To-Do formatted as a string following this exact syntax: "[ai-todo|pending] {description of the AI task}"
3. context: A short explanation for *why* you are making this suggestion. If it relates to a specific remark, quote part of that remark in your explanation.

If you cannot identify any new automatable tasks for any of the provided inputs, return an empty array for the 'suggestions' field.
Return all suggestions from all analyzed tasks as a single flat array in the JSON object, conforming to the output schema.

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
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
