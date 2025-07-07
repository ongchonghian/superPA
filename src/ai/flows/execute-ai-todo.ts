'use server';

/**
 * @fileOverview AI-powered execution of a single AI To-Do item.
 *
 * - executeAiTodo - A function that takes a to-do and its context, and returns a detailed result.
 * - ExecuteAiTodoInput - The input type for the executeAiTodo function.
 * - ExecuteAiTodoOutput - The return type for the executeAiTodo function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DocumentContextSchema = z.object({
  fileName: z.string(),
  fileDataUri: z.string().describe("A document file, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});

const ExecuteAiTodoInputSchema = z.object({
  aiTodoText: z.string().describe('The specific AI To-Do item to be executed. This is the primary instruction.'),
  taskDescription: z.string().describe('The description of the parent task for broader context.'),
  discussionHistory: z.string().describe('The full discussion history of the task, including all user remarks and other AI To-Dos.'),
  contextDocuments: z.array(DocumentContextSchema).optional().describe('A list of context documents to provide project context.'),
});
export type ExecuteAiTodoInput = z.infer<typeof ExecuteAiTodoInputSchema>;

const ExecuteAiTodoOutputSchema = z.object({
  resultMarkdown: z.string().describe('The detailed, comprehensive result of the execution, formatted in Markdown.'),
  summary: z.string().describe('A concise, one-sentence summary of the execution result.'),
});
export type ExecuteAiTodoOutput = z.infer<typeof ExecuteAiTodoOutputSchema>;

export async function executeAiTodo(input: ExecuteAiTodoInput): Promise<ExecuteAiTodoOutput> {
  return executeAiTodoFlow(input);
}

// New schema for prompt generation
const RefinedPromptOutputSchema = z.object({
  refinedPrompt: z.string().describe("The complete, optimized prompt for the target LLM."),
  improvementSummary: z.string().describe("A brief, markdown-formatted explanation of the primary improvements made and why they enhance the prompt's effectiveness."),
  keyPrinciplesApplied: z.array(z.string()).describe("A bulleted list of the core prompt engineering principles applied."),
});

// New prompt for prompt generation
const generateRefinedPrompt = ai.definePrompt({
    name: 'generateRefinedPrompt',
    input: {
        schema: z.object({
            problem: z.string(),
            topic: z.string(),
        }),
    },
    output: {
        schema: RefinedPromptOutputSchema,
    },
    prompt: `
<role>You are a world-class AI Prompt Architect, Research Analyst, and Metacognitive Prompt Optimizer.</role>
<context>
Your goal is to generate a maximally effective, highly refined prompt for a Large Language Model (LLM) to solve a specific business problem. You will leverage advanced prompt engineering principles, including but not limited to:
- Structured reasoning (Chain-of-Thought, Tree-of-Thoughts)
- Iterative self-refinement and metacognition (e.g., Self-Refine, Chain-of-Verification, Recursive Self-Improvement)
- Agentic prompting and tool integration (ReAct, Tool/Function Prompting, ART)
- Multi-stage prompting and task decomposition
- Confidence calibration and uncertainty quantification
- Retrieval Augmented Generation (RAG) best practices, if external context is implied.

You must internalize the research process, persona generation, and prompt evaluation. Your output should be the *final, optimized prompt* ready for use, accompanied by a brief explanation of your design choices.

Here is the user's input:
Problem: "{{problem}}"
Topic for Research: "{{topic}}"
</context>

<instructions>
You will perform the following steps internally, without explicitly showing them in your final output, to construct the refined prompt:

1.  **Research and Analysis:** Act as an expert research analyst. Analyze the "Topic for Research" to identify:
    * Key concepts, technologies, or ideas.
    * The most suitable reasoning technique (CoT, ToT, or a hybrid), providing a brief justification. Consider the complexity and potential for multiple paths.
    * 2-3 distinct and relevant expert roles/personas that the *target LLM* should embody when solving the problem.
    * A suitable target audience for the *target LLM*'s output.
    * A single, suitable output format (e.g., "A structured report in Markdown," "A JSON object with schema," "A bulleted list").
    * 3-4 relevant section headings for a final report (if applicable).
    * 2-3 appropriate tones.
    * 1-2 clear negative constraints.

2.  **Initial Prompt Construction:** Based on your research and analysis from step 1, construct an initial version of the prompt for the *target LLM*. This prompt should:
    * Clearly define the target LLM's role using the suggested personas.
    * Provide essential context derived from the topic.
    * State the core task clearly.
    * Incorporate the recommended reasoning technique (CoT/ToT) with appropriate trigger phrases or structural guidance.
    * Suggest the output format, tone, and any initial constraints.

3.  **Self-Refinement and Optimization:** Critically evaluate and refine the prompt constructed in step 2. Apply the principles of a 'hyper-critical prompt engineering auditor' and 'world-class AI Prompt Architect' to:
    * **Enhance Clarity and Specificity:** Ensure the task is crystal clear and unambiguous.
    * **Strengthen Role Definition:** Ensure the persona is detailed and explicitly instructs the target LLM to *embody* it.
    * **Refine Context and Constraints:** Add rich background context and clear, non-trivial positive and negative constraints. Consider adding instructions for confidence calibration (e.g., "Provide a confidence score for each major claim (0-100%)") if the problem implies high-stakes or factual accuracy is paramount.
    * **Detail Format Specification:** Provide a highly detailed output structure. If JSON, suggest a basic schema.
    * **Manage Task Complexity:** If the problem is complex, add a detailed, multi-step guide within the instructions for the target LLM, breaking down the problem into logical stages. Consider if tool use (e.g., search, API calls) is beneficial and, if so, instruct the target LLM on how to use them (e.g., ReAct pattern).
    * **Integrate RAG Best Practices (if applicable):** If the problem implies the need for external information or a RAG setup, include explicit instructions for the target LLM to *only* use provided context and to state if information is insufficient.

4.  **Final Output Generation:** Present the refined prompt and a concise rationale.
    * **'refinedPrompt'**: The complete, optimized prompt for the *target LLM*. It should replace all bracketed placeholders with concrete, high-quality examples derived from your internal research and refinement.
    * **'improvementSummary'**: A brief, markdown-formatted explanation (2-3 sentences) of the primary improvements made and *why* they enhance the prompt's effectiveness (e.g., "Integrated multi-stage reasoning for complex tasks, reducing cognitive load on the LLM and improving output structure.").
    * **'keyPrinciplesApplied'**: A bulleted list (2-3 items) of the core prompt engineering principles you applied (e.g., "Agentic Orchestration," "Confidence Calibration," "Proactive Hallucination Mitigation").

</instructions>

<task>
Generate the refined prompt and its summary now, in JSON format.
</task>
`
});

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

const executeAiTodoFlow = ai.defineFlow(
  {
    name: 'executeAiTodoFlow',
    inputSchema: ExecuteAiTodoInputSchema,
    outputSchema: ExecuteAiTodoOutputSchema,
  },
  async (input) => {
    const isPromptGeneration = /generate a( refined)? prompt|design a prompt/i.test(input.aiTodoText);

    if (isPromptGeneration) {
        // Corrected a typo here from aiTodotext to aiTodoText
        const topicMatch = input.aiTodoText.match(/to (.*)/i);
        const topic = topicMatch ? topicMatch[1] : input.aiTodoText;

        const { output } = await generateRefinedPrompt({
            problem: input.taskDescription,
            topic: topic,
        });

        if (!output) {
            throw new Error("Failed to generate refined prompt.");
        }
        
        // Corrected the string termination error here
        const keyPrinciplesString = output.keyPrinciplesApplied.map(p => `- ${p}`).join('');
        
        const resultMarkdown = [
            '### Refined Prompt',
            '```',
            output.refinedPrompt,
            '```',
            '',
            '### Improvement Summary',
            output.improvementSummary,
            '',
            '### Key Principles Applied',
            keyPrinciplesString,
        ].join('');
        
        const summary = `Generated a refined prompt for: ${topic}`;

        return {
            resultMarkdown,
            summary,
        };
    } else {
      const {output} = await prompt(input);
      return output!;
    }
  }
);
