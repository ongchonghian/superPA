
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
    context: z.string().describe("A brief explanation of why this suggestion is being made, citing the specific remark, to-do, or context document (by name) that informed the suggestion."),
});

const InformationRequestSchema = z.object({
  taskId: z.string().describe('The ID of the task this information request relates to.'),
  request: z.string().describe('A clear, specific question for the user to provide more context, which will enable the generation of a better AI To-Do.'),
});
export type InformationRequest = z.infer<typeof InformationRequestSchema>;

const CapabilityWarningSchema = z.object({
  taskId: z.string().describe('The ID of the task for which the warning is being made.'),
  warning: z.string().describe('A note explaining that the task is beyond AI capabilities and suggesting a human role.'),
});
export type CapabilityWarning = z.infer<typeof CapabilityWarningSchema>;


const SuggestChecklistNextStepsOutputSchema = z.object({
  suggestions: z
    .array(ChecklistSuggestionSchema)
    .describe('A list of suggested AI To-Do items for the provided tasks, with context.'),
  informationRequests: z.array(InformationRequestSchema).optional().describe('A list of questions to ask the user to get more context for generating better suggestions. This should be used when a task is too vague to create a concrete AI To-Do.'),
  capabilityWarnings: z.array(CapabilityWarningSchema).optional().describe("A list of warnings for tasks that are beyond the AI's capabilities."),
});
export type SuggestChecklistNextStepsOutput = z.infer<typeof SuggestChecklistNextStepsOutputSchema>;

export async function suggestChecklistNextSteps(input: SuggestChecklistNextStepsInput): Promise<SuggestChecklistNextStepsOutput> {
  return suggestChecklistNextStepsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestChecklistNextStepsPrompt',
  input: {schema: SuggestChecklistNextStepsInputSchema},
  output: {schema: SuggestChecklistNextStepsOutputSchema},
  prompt: `You are an expert AI assistant that helps users break down project tasks into actionable steps. Your goal is to analyze a list of tasks, assess your own capabilities, and suggest a SINGLE, high-impact "AI To-Do" for tasks you can perform, or provide a warning for tasks you cannot.

--- YOUR CAPABILITIES ---
*   **I CAN:** Research, analyze, write, summarize, generate text-based content (like code, documentation, outlines), and plan. I can also generate world-class, optimized prompts for other AI models and then execute those prompts to get a final result.
*   **I CANNOT:** Generate images, UI mockups, logos, videos, or any other visual/binary assets. I also cannot access external websites or APIs unless a specific tool is provided for it.

{{#if contextDocuments}}
--- CONTEXT DOCUMENTS ---
You have been provided with context documents. These documents are the primary source of truth for the project. Analyze them to understand the project's goals, scope, and technical details. Use this deep understanding to inform your suggestions and make them highly relevant and specific.

{{#each contextDocuments}}
The document below is named '{{{fileName}}}'. Use it as context.
{{{media url=fileDataUri}}}
{{/each}}
--- CONTEXT DOCUMENTS END ---
{{/if}}

Your analysis must be exhaustive. For each task provided, perform the following analysis in order:

1.  **Check for Existing AI To-Dos:** Does the task's discussion history already contain a remark starting with \`[ai-todo|pending]\` or \`[ai-todo|running]\`?
    *   If **YES**, you MUST skip this task completely. Do not generate any output for it. This is the most important rule.
    *   If **NO**, proceed to the next step.

2.  **Check for Completed Prompt Generation:** Does the discussion history contain a remark starting with \`[ai-todo|completed] Generate a refined prompt to...\`?
    *   If **YES**, your goal is to suggest executing it.
    *   First, check if there is ALREADY a remark in the history that suggests executing this prompt (e.g., starts with \`[ai-todo|pending] Execute the refined prompt...\`). If so, do nothing and skip this task to avoid duplicate suggestions.
    *   Otherwise, extract the topic from the completed to-do. For example, from "\`[ai-todo|completed] Generate a refined prompt to analyze customer feedback sentiment, ...\`", the topic is "analyze customer feedback sentiment".
    *   Then, generate a new suggestion. The new suggestion MUST start with \`[ai-todo|pending] Execute the refined prompt to \` followed by the extracted topic.
    *   Add this to the \`suggestions\` array and **do not process this task further**.
    *   If **NO**, proceed to the next step.

3.  **Capability Self-Assessment**: Based on the task description and my stated capabilities, can I perform this task?
    *   If the core request is something I **CANNOT** do (e.g., "Generate UI mockups," "Create a logo"), proceed to Step 4.
    *   If the task's description includes keywords like "design a prompt", "create a prompt", "engineer a prompt", or "deep research", you **MUST** proceed to Step 5 (Prompt Engineering).
    *   If the core request is something else I **CAN** do (e.g., "Write tests," "Deploy app"), proceed to Step 6.

4.  **Handle Incapable Tasks**: The task is beyond my capabilities.
    *   You **MUST NOT** generate an AI To-Do suggestion.
    *   Instead, add a warning to the \`capabilityWarnings\` array.
    *   The warning text should clearly state the limitation and suggest a human role. Example: "Generating visual UI mockups is beyond my capabilities. This task should be assigned to a UI/UX Designer."

5.  **Handle Prompt Engineering Tasks**: The task is about prompt engineering or requires deep research.
    *   You **MUST** suggest the specialized prompt generation to-do.
    *   Example 1: For a task "Design a prompt to get customer feedback sentiment", your suggestion **MUST** be \`[ai-todo|pending] Generate a refined prompt to analyze customer feedback for sentiment, including an improvement summary and key principles applied.\`.
    *   Example 2: For a task "Perform deep research on market trends for AI-powered widgets", your suggestion **MUST** be \`[ai-todo|pending] Generate a refined prompt to conduct deep research on market trends for AI-powered widgets, including an improvement summary and key principles applied.\`.
    *   Add this suggestion to the \`suggestions\` array and **do not process this task further**.

6.  **Assess Task Specificity (For Other Capable Tasks)**: Can you formulate a concrete, automatable AI To-Do right now that is **directly relevant** to the task's description?
    *   If **YES**, create a concrete AI To-Do suggestion. Example: For a task "Create social media graphics," a good suggestion is \`[ai-todo|pending] Write 5 taglines and descriptions for a Twitter promotion.\`. Add this to the \`suggestions\` array.
    *   If **NO**, because the task is too vague (e.g., "Deploy app," "Write tests"), proceed to the next step to be proactive.

7.  **Handle Vague Tasks (Be Proactive!)**: When a task is vague but within my capabilities, your goal is to propose a research task.
    *   **Attempt to create an assertive, research-based AI To-Do suggestion.** This suggestion must be a logical first step to clarify the vague task. It MUST be relevant. For example, for "Deploy app," a good suggestion is \`[ai-todo|pending] Research and outline deployment options for a Next.js app on Firebase.\`. For "Write tests," a good suggestion is \`[ai-todo|pending] Analyze the codebase and suggest a unit testing strategy, including recommended frameworks.\`. Add this to the \`suggestions\` array.
    *   **If and only if** you cannot formulate a relevant research task, ask a clarifying question. Add this question to the \`informationRequests\` array.

**MANDATORY RULES:**
- **PRIMARY RULE: If a task's discussion history already contains \`[ai-todo|pending]\` or \`[ai-todo|running]\`, YOU MUST NOT generate any output for that \`taskId\`.**
- **CITE YOUR SOURCES: In the 'context' field for every suggestion, you MUST cite your source. If based on a context document, name the file (e.g., 'Based on the "Project_Brief.md" document...'). If based on the task description or a user remark, state that.**
- Your suggestions MUST be relevant to the \`taskDescription\` and within your stated capabilities. Do not just repeat examples from this prompt.
- Your suggestions must not be functionally identical to any other AI-todo in the discussion history.
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
