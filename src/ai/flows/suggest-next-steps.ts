// This file is machine-generated - edit at your own risk!

'use server';

/**
 * @fileOverview AI-powered suggestion of AI To-Do items for a given task.
 *
 * - suggestNextSteps - A function that suggests automatable sub-tasks for a given task.
 * - SuggestNextStepsInput - The input type for the suggestNextSteps function.
 * - SuggestNextStepsOutput - The return type for the suggestNextSteps function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestNextStepsInputSchema = z.object({
  taskDescription: z.string().describe('The detailed description of the task.'),
  discussionHistory: z
    .string()
    .describe('The historical discussion related to the task, including existing remarks and AI To-Dos.'),
});
export type SuggestNextStepsInput = z.infer<typeof SuggestNextStepsInputSchema>;

const SuggestionSchema = z.object({
    suggestion: z.string().describe('The suggested AI To-Do item, formatted as "[ai-todo|pending] {description}".'),
    context: z.string().describe('A brief explanation of why this suggestion is being made, referencing the source remark(s) or to-do(s).'),
});

const SuggestNextStepsOutputSchema = z.object({
  nextSteps: z
    .array(SuggestionSchema)
    .describe('A list of suggested AI To-Do items for the task, with context.'),
});
export type SuggestNextStepsOutput = z.infer<typeof SuggestNextStepsOutputSchema>;

export async function suggestNextSteps(input: SuggestNextStepsInput): Promise<SuggestNextStepsOutput> {
  return suggestNextStepsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestNextStepsPrompt',
  input: {schema: SuggestNextStepsInputSchema},
  output: {schema: SuggestNextStepsOutputSchema},
  prompt: `You are an AI assistant that analyzes a task and its discussion history to identify sub-tasks that can be automated.
Your goal is to propose these automatable sub-tasks as "AI To-Dos".

Analyze the following information:
Task Description: {{{taskDescription}}}
Discussion History: {{{discussionHistory}}}

Based on your analysis, generate a list of *new* suggestions for AI To-Dos. Do not suggest any AI To-Dos that are functionally identical to ones already present in the discussion history.

For each suggestion, provide the following in the output object:
1. suggestion: The AI To-Do formatted as a string following this exact syntax: "[ai-todo|pending] {description of the AI task}"
2. context: A short explanation for *why* you are making this suggestion. If it relates to a specific remark, quote part of that remark in your explanation.

If you cannot identify any new automatable tasks, return an empty array for the 'nextSteps' field.
Return the suggestions as a JSON object conforming to the output schema.
  `,
});

const suggestNextStepsFlow = ai.defineFlow(
  {
    name: 'suggestNextStepsFlow',
    inputSchema: SuggestNextStepsInputSchema,
    outputSchema: SuggestNextStepsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
