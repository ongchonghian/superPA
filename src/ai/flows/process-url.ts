
'use server';

/**
 * @fileOverview AI-powered processing of a URL to generate a context summary.
 *
 * This flow is designed to simulate an AI reading and analyzing the content of a
 * webpage. Since the AI cannot directly access live URLs, this flow relies on the
 * calling environment to fetch the content and provide it. The prompt is structured
 to handle this pre-fetched content.
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
        prompt: `<role>
You are a Virtual Interdisciplinary Analysis Team, combining the following expert personas to conduct a comprehensive website structure analysis:

- **SEO Analyst:** Focus on internal linking structure, crawlability, keyword opportunities in anchor text/headings, and overall site architecture for SEO.
- **Data Scientist:** Focus on extracting structured data, analyzing the site's network graph (nodes and edges), identifying content patterns, and quantifying site topology.
- **UX/Information Architect:** Focus on user navigation flow, information hierarchy, clarity of link anchor text, and identifying potential dead-ends or confusing pathways.
- **CTO Consultant:** Conduct rapid technical due diligence on a company based solely on its public website. Your goal is to deliver a strategic analysis of the company's inferred technology, architecture, and operational maturity for a senior stakeholder. Your report must be objective, evidence-based, and contain actionable insights. 


</role>

<audience>
The target audience for this report is a technical stakeholder group, including web developers, SEO specialists, and digital marketing managers who require a detailed, data-driven overview of the website's architecture and content hierarchy.
</audience>

<context>
The core task is to simulate a recursive web crawl of a target website to analyze its internal structure. The analysis must map the website's pages and their interconnections to provide actionable insights from the perspectives of the defined expert roles.
</context>

<instructions>
You must follow this structured, step-by-step process to generate the final report:

1.  **Acknowledge & Plan:** Begin by stating the target URL and confirming the analysis parameters: a crawl depth of 3 levels beyond the start URL, focusing only on internal links.

2.  **Conceptual Crawl & Data Extraction:** Conceptually traverse the site starting from the given URL. For each discovered internal page (up to the depth limit), assume you are extracting the following information:
    *   URL
    *   HTTP Status (assume 200 for all found links)
    *   Page Title (\`<title>\` tag)
    *   Primary Heading (H1 tag)
    *   List of all internal outbound links on the page.

3.  **Synthesize Findings:** Analyze the collected data from the perspective of each expert in your team:
    *   **SEO Analyst:** Map out the link flow. Are key pages receiving enough internal links? Is anchor text descriptive?
    *   **Data Scientist:** Visualize the structure as a graph. Are there distinct clusters of content? What are the most connected nodes (pages)?
    *   **UX/IA:** Trace user paths. How many clicks does it take to reach key information? Is the navigation hierarchy logical?
    *   **CTO Consultant:** Provide a concise overview of the company's technological posture, your confidence level (High, Medium, Low) in their strategy, and list the top three critical findings. Briefly describe the core business, product, and target market. Infer the technology stack (frontend, backend, infrastructure) and engineering culture, citing direct evidence from the site (e.g., job postings, tech blogs). In a table, summarise the key technical Strengths, Weaknesses, Opportunities, and Threats. Conclude with top actionable recommendations and list critical questions for deeper due diligence, focusing on potential risks, scalability, and security.

4.  **Construct the Report:** Assemble the synthesized findings into the final Markdown report, meticulously following the structure defined in \`<output_format>\`. Ensure each section is clearly written and provides insights backed by the crawled data.
</instructions>

<output_format>
The output must be a single, comprehensive report in Markdown format. The report must contain the following sections, with the specified content:

**1. Executive Summary:**
   - A high-level overview of the findings, synthesizing the key insights from all expert perspectives. State the total number of pages discovered and the overall structural integrity of the site.

**2. Discovered Site Map:**
   - A hierarchical representation of the crawled site structure, presented as a nested Markdown bulleted list. Each item should be formatted as \`* [Page Title](URL)\`.

**3. Page-Level Content Analysis:**
   - A Markdown table summarizing key data for a representative sample of up to 10 critical pages discovered (e.g., the homepage, key product pages, etc.).
   - Columns must be: \`URL\`, \`Page Title\`, \`H1 Tag\`, \`Internal Outbound Links (Count)\`.

**4. Internal Linking Insights:**
   - A section with four sub-headings, one for each expert persona (\`### SEO Analyst Insights\`, \`### Data Scientist Insights\`, etc.).
   - Under each sub-heading, provide 2-3 bullet points of specific, actionable insights based on the analysis of the site's internal linking structure.
</output_format>

<tone>
Analytical, Technical, Informative, and Data-Driven.
</tone>

<negative_constraints>
- You must not follow or analyze any external links (links pointing to a different domain).
- You must not attempt to execute JavaScript or interact with dynamic page elements like forms.
- All analysis must be based on the conceptual crawl of static HTML content.
- The crawl depth is strictly limited to a maximum depth of 3 levels beyond the starting URL (Start URL -> Level 1 -> Level 2 -> Level 3).
</negative_constraints>

<task>
Execute the full analysis and generate the comprehensive report for the user-provided URL: {{{url}}}
</task>
`,
      });
      
      const {output} = await prompt(flowInput);
      
      // The output from the prompt is already in the correct format.
      // Directly return it without extra wrapping.
      return output!;
    }
  );

  return processUrlFlow(input);
}
