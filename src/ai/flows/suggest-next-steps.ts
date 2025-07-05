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
    .describe('The historical discussion related to the task.'),
});
export type SuggestNextStepsInput = z.infer<typeof SuggestNextStepsInputSchema>;

const SuggestNextStepsOutputSchema = z.object({
  nextSteps: z
    .array(z.string())
    .describe('A list of suggested AI To-Do items for the task.'),
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

Based on your analysis, generate a list of suggestions for AI To-Dos. Each suggestion must be a clear, single-action instruction for an AI to perform.
Format each suggestion as a string following this exact syntax: "[ai-todo|pending] {description of the AI task}"

If you cannot identify any automatable tasks, return an empty array for the 'nextSteps' field.
Return the suggestions as a JSON object.
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
