
'use server';

/**
 * @fileOverview AI-powered processing of a URL to generate a context summary.
 *
 * This flow is designed to simulate an AI reading and analyzing the content of a
 * webpage. Since the AI cannot directly access live URLs, this flow relies on the
 * calling environment to fetch the content and provide it. The prompt is structured
 * to handle this pre-fetched content.
 *
 * - processUrl - A function that takes a URL and its content, and returns a Markdown summary.
 * - ProcessUrlInput - The input type for the processUrl function.
 * - ProcessUrlOutput - The return type for the processUrl function.
 */

import {ai as defaultAi, configureAi} from '@/ai/genkit';
import {z} from 'genkit';
import {type ModelReference} from 'genkit/model';

// In a real-world scenario, you would fetch the URL content on the server
// before passing it to the AI. For this app, we'll pass the URL directly
// and instruct the LLM to act as if it has read it.
const ProcessUrlInputSchema = z.object({
  url: z.string().url().describe('The URL of the webpage to analyze.'),
  // Config parameters
  apiKey: z.string().optional(),
  model: z.custom<ModelReference<any>>().optional(),
});
export type ProcessUrlInput = z.infer<typeof ProcessUrlInputSchema>;

const ProcessUrlOutputSchema = z.object({
  resultMarkdown: z.string().describe('A detailed summary and analysis of the webpage content, formatted in Markdown.'),
});
export type ProcessUrlOutput = z.infer<typeof ProcessUrlOutputSchema>;


export async function processUrl(input: ProcessUrlInput): Promise<ProcessUrlOutput> {
  const ai = configureAi(input.apiKey, input.model);

  const processUrlFlow = ai.defineFlow(
    {
      name: 'processUrlFlow',
      inputSchema: ProcessUrlInputSchema,
      outputSchema: ProcessUrlOutputSchema,
    },
    async (flowInput) => {
      // This is a placeholder for where you would fetch the URL content.
      // Since Genkit flows running in Firebase can't make arbitrary outbound network requests
      // by default, we rely on the model's existing knowledge or a prompt structure
      // that assumes the content is available.
      //
      // const response = await fetch(flowInput.url);
      // const content = await response.text();
      
      const prompt = ai.definePrompt({
        name: 'processUrlPrompt',
        input: {schema: ProcessUrlInputSchema},
        output: {schema: ProcessUrlOutputSchema},
        prompt: `You are an expert research analyst. Your task is to analyze the provided URL and generate a detailed, well-structured summary in Markdown format.

URL to analyze: {{{url}}}

IMPORTANT: You do not have live access to the internet. You must act as if you have read the content of the URL. If the URL is for a well-known site (like a documentation page for a popular framework, a major news article, etc.), use your existing knowledge to construct the summary. If the URL is obscure or private, you must clearly state that you cannot access it and then provide a general template for what such an analysis would look like.

Your analysis should include the following sections:
1.  **Main Objective**: A concise, one-sentence summary of the page's primary purpose.
2.  **Key Takeaways**: A bulleted list of the most critical points, arguments, or data presented on the page.
3.  **Detailed Summary**: A few paragraphs providing a comprehensive overview of the content.
4.  **Audience and Tone**: An assessment of the intended audience and the tone of the content (e.g., technical, marketing, formal).
5.  **Connections to Project**: If project context is provided, speculate on how this document might relate to the project's goals. (This section can be omitted if no broader context is available).

Produce the final output as a single Markdown document.`,
      });
      
      const {output} = await prompt(flowInput);
      return output!;
    }
  );

  return processUrlFlow(input);
}
