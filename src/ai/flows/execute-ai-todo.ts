
'use server';

/**
 * @fileOverview AI-powered execution of a single AI To-Do item.
 *
 * - executeAiTodo - A function that takes a to-do and its context, and returns a detailed result.
 * - ExecuteAiTodoInput - The input type for the executeAiTodo function.
 * - ExecuteAiTodoOutput - The return type for the executeAiTodo function.
 */

import {ai as defaultAi, configureAi} from '@/ai/genkit';
import {z} from 'genkit';
import {type ModelReference} from 'genkit/model';

const DocumentContextSchema = z.object({
  fileName: z.string(),
  fileDataUri: z.string().describe("A document file, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});

const ExecuteAiTodoInputSchema = z.object({
  aiTodoText: z.string().describe('The specific AI To-Do item to be executed. This is the primary instruction.'),
  taskDescription: z.string().describe('The description of the parent task for broader context.'),
  discussionHistory: z.string().describe('The full discussion history of the task, including all user remarks and other AI To-Dos.'),
  contextDocuments: z.array(DocumentContextSchema).optional().describe('A list of context documents to provide project context.'),
  // Config parameters
  apiKey: z.string().optional(),
  model: z.custom<ModelReference<any>>().optional(),
});
export type ExecuteAiTodoInput = z.infer<typeof ExecuteAiTodoInputSchema>;

const ExecuteAiTodoOutputSchema = z.object({
  resultMarkdown: z.string().describe('The detailed, comprehensive result of the execution, formatted in Markdown.'),
  summary: z.string().describe('A concise, one-sentence summary of the execution result.'),
});
export type ExecuteAiTodoOutput = z.infer<typeof ExecuteAiTodoOutputSchema>;

export async function executeAiTodo(input: ExecuteAiTodoInput): Promise<ExecuteAiTodoOutput> {
  const ai = configureAi(input.apiKey, input.model);

  const executeAiTodoFlow = ai.defineFlow(
    {
      name: 'executeAiTodoFlow',
      inputSchema: ExecuteAiTodoInputSchema,
      outputSchema: ExecuteAiTodoOutputSchema,
    },
    async (flowInput) => {
      const prompt = ai.definePrompt({
        name: 'executeAiTodoPrompt',
        input: {schema: ExecuteAiTodoInputSchema},
        output: {schema: ExecuteAiTodoOutputSchema},
        prompt: `You are an expert-level AI assistant, tasked with executing a specific to-do item for a project.

Your goal is to provide a comprehensive, detailed, and well-structured response in Markdown format that directly fulfills the user's request. You must also provide a brief summary of your output.

{{#if contextDocuments}}
--- START OF CONTEXT DOCUMENTS ---
You have been provided with the following documents. Use them as the primary source of truth for project context, goals, and technical details.

{{#each contextDocuments}}
--- Document: {{{fileName}}} ---
{{{media url=fileDataUri}}}
--- End Document: {{{fileName}}} ---
{{/each}}
--- END OF CONTEXT DOCUMENTS ---
{{/if}}

--- START OF TASK CONTEXT ---
Parent Task: {{{taskDescription}}}

Discussion History (includes user remarks and other AI to-dos):
{{{discussionHistory}}}
--- END OF TASK CONTEXT ---

--- YOUR ASSIGNMENT ---
Execute the following AI To-Do item NOW:
"{{{aiTodoText}}}"

Based on all the provided context, generate a detailed response in Markdown. Your response should be thorough, actionable, and directly address the to-do item. After generating the detailed response, provide a simple, one-sentence summary of what you did.
`,
      });

      const {output} = await prompt(flowInput);
      return output!;
    }
  );
  return executeAiTodoFlow(input);
}
