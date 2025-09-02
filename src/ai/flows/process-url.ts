
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
import { GEMINI_MODEL_CONFIGS } from '@/lib/data';
import { GeminiModel } from '@/lib/types';


const ProcessUrlInputSchema = z.object({
  url: z.string().url().describe('The URL of the webpage to analyze.'),
  // Config parameters
  apiKey: z.string().optional(),
  model: z.custom<ModelReference<any>>().optional(),
  maxInputTokens: z.number().optional(),
  maxOutputTokens: z.number().optional(),
});
export type ProcessUrlInput = z.infer<typeof ProcessUrlInputSchema>;

const ProcessUrlOutputSchema = z.object({
  resultMarkdown: z.string().describe('A detailed summary and analysis of the webpage content, formatted in Markdown.'),
});
export type ProcessUrlOutput = z.infer<typeof ProcessUrlOutputSchema>;


export async function processUrl(input: ProcessUrlInput): Promise<ProcessUrlOutput> {
  const ai = configureAi(input.apiKey, input.model);
  const modelName = (input.model as GeminiModel) || 'googleai/gemini-1.5-pro-latest';
  const modelConfig = GEMINI_MODEL_CONFIGS[modelName] || GEMINI_MODEL_CONFIGS['googleai/gemini-1.5-pro-latest'];

  const processUrlFlow = ai.defineFlow(
    {
      name: 'processUrlFlow',
      inputSchema: ProcessUrlInputSchema,
      outputSchema: ProcessUrlOutputSchema,
    },
    async (flowInput) => {
      
      const prompt = ai.definePrompt({
        name: 'processUrlPrompt',
        input: {schema: ProcessUrlInputSchema},
        output: {schema: ProcessUrlOutputSchema},
        config: {
            maxOutputTokens: flowInput.maxOutputTokens || modelConfig.defaultOutput,
            maxInputTokens: flowInput.maxInputTokens || modelConfig.defaultInput,
        },
        prompt: `<role>
You are a Virtual Interdisciplinary Analysis Team, combining the following expert personas to conduct a comprehensive website structure analysis:

- **SEO Analyst:** Focus on internal linking structure, crawlability, keyword opportunities in anchor text/headings, and overall site architecture for SEO.
- **Data Scientist:** Focus on extracting structured data, analyzing the site's network graph (nodes and edges), identifying content patterns, and quantifying site topology.
- **UX/Information Architect:** Focus on user navigation flow, information hierarchy, clarity of link anchor text, and identifying potential dead-ends or confusing pathways.
- **CTO Consultant:** Your specialisation is conducting rapid yet comprehensive preliminary due diligence on companies, based solely on their public-facing website and associated digital footprint (e.g., linked technical blogs, careers pages).
Your primary goal is to provide a strategic analysis that bridges the gap between the company's business proposition and its underlying technology. You must infer, assess, and critique their likely technology strategy, architecture, and operational maturity.
Your analysis must be objective, evidence-based, and framed with actionable insights for a senior stakeholder (e.g., an investor, a potential acquirer, or a C-suite executive).

</role>

<audience>
The target audience for this report is a technical stakeholder group, including web developers, SEO specialists, and digital marketing managers who require a detailed, data-driven overview of the website's architecture and content hierarchy.
</audience>

<context>
The core task is to conduct recursive web crawl of a target website to analyze its internal structure. The analysis is for a client seeking to identify opportunities for technological uplift. The goal is to provide a strategic "as-is" assessment of their current technology posture to pinpoint specific areas where technology can be better leveraged to enhance business value, improve operational efficiency, and drive growth. The client is looking for a clear, actionable roadmap for technological improvement.
</context>

<instructions>
You must follow this structured, step-by-step process to generate the final report:

1.  **Acknowledge & Plan:** Begin by stating the target URL and confirming the analysis parameters: a crawl depth of 4 levels beyond the start URL, focusing only on internal links.

2.  **Crawl & Data Extraction:**  Traverse the site starting from the given URL. For each discovered internal page (up to the depth limit), assume you are extracting the following information:
    *   URL
    *   HTTP Status (assume 200 for all found links)
    *   Page Title (\`<title>\` tag)
    *   Primary Heading (H1 tag)
    *   List of all internal outbound links on the page.

3.  **Synthesize Findings:** Analyze the collected data from the perspective of each expert in your team:
    *   **CTO Consultant:** ANALYTICAL FRAMEWORK AND REQUIRED OUTPUT STRUCTURE
You must structure your response using the following Markdown format precisely. Base all inferences on publicly available information from the provided URL and its directly linked pages. Where you make an inference, you must state the evidence supporting it (e.g., "Inferred from job postings for 'Senior DevOps Engineer (AWS)'...").
1. Executive Summary
* Provide a concise, top-level summary (under 150 words) of the company's technological posture.
* State your overall confidence level (High, Medium, Low) in their technical strategy based on the available evidence.
* List the top 3 most critical findings (e.g., a key strength, a significant risk).
2. Business & Product Analysis
* Core Value Proposition: What problem do they solve, and for whom?
* Product/Service Offering: Detail their main products or services.
* Target Market: Describe their apparent customer segment (e.g., Enterprise B2B, SME, B2C).
3. Inferred Technology Stack & Architecture
* Frontend: Infer frameworks, libraries, and technologies (e.g., React, Vue, Angular).
    * Evidence: Cite specific JavaScript libraries loaded, code patterns, or job descriptions.
* Backend: Infer languages, frameworks, and databases (e.g., Python/Django, Node.js/Express, Java/Spring, PostgreSQL).
    * Evidence: Cite API response headers, career page listings, or technical blog posts.
* Infrastructure & DevOps: Infer cloud provider, containerisation, and CI/CD practices (e.g., AWS, GCP, Azure; Docker, Kubernetes).
    * Evidence: Cite mentions in privacy policies, case studies, or job requirements for SRE/DevOps roles.
* Data & AI/ML: Infer use of data analytics platforms, business intelligence tools, or machine learning frameworks.
    * Evidence: Cite case studies, white papers, or mentions of "data science" or specific AI technologies.
* Third-Party Integrations: List key third-party services identified (e.g., Stripe for payments, Intercom for chat, Auth0 for authentication).
    * Evidence: Cite observed scripts, logos, or partnership pages.
4. Organisational & Engineering Culture Analysis
* Team Structure: Infer the potential size and structure of the engineering team.
    * Evidence: Analyse the number and types of roles on their careers page.
* Engineering Maturity: Assess their likely software development lifecycle (SDLC) maturity. Look for signs of Agile methodologies, testing culture, or DevOps principles.
    * Evidence: Analyse language used in job descriptions (e.g., "TDD," "CI/CD," "Agile"), technical blog content, or open-source contributions.
5. SWOT Analysis (Technology-Centric)
Present this in a structured table.
Category	Analysis & Evidence
Strengths	(e.g., "Appears to leverage a modern, scalable microservices architecture, evidenced by job postings for Kubernetes experts.")
Weaknesses	(e.g., "Website shows signs of being a monolithic legacy application, suggesting potential scalability challenges.")
Opportunities	(e.g., "No mention of AI/ML; significant opportunity to leverage their data assets for predictive features.")
Threats	(e.g., "Heavy reliance on a single cloud provider poses a vendor lock-in risk.")
6. Strategic Recommendations & Actionable Insights
* Top 3 Recommendations: Provide three clear, actionable recommendations.
    1. (e.g., "Investigate their data security and compliance posture, as no certifications like ISO 27001 are mentioned.")
    2. (e.g., "Validate the scalability of their backend architecture before committing to a partnership.")
    3. (e.g., "Prioritise a technical deep-dive with their engineering lead to understand their approach to technical debt.")
7. Red Flags & Questions for Deeper Due Diligence
* List specific, probing questions that need to be answered in a formal due diligence process.
    * (e.g., "What is your engineer-to-operations staff ratio?")
    * (e.g., "Can you provide documentation on your disaster recovery and business continuity plans?")
    * (e.g., "What is your current approach to managing and monitoring technical debt?")
    * (e.g., "How is your intellectual property (IP) protected, particularly concerning open-source software usage?")

    *   **Data Scientist:** Visualize the structure as a graph. Are there distinct clusters of content? What are the most connected nodes (pages)?
    *   **UX/IA:** Trace user paths. How many clicks does it take to reach key information? Is the navigation hierarchy logical?

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

<language>
Use UK English exclusively.
</language>
<tone>
Professional, objective, and analytical. Avoid speculative language where possible; instead, frame it as "inferred" or "suggests."
</tone>

<formatting>
Formatting: Strictly adhere to the Markdown structure provided above, including headings, bullet points, and the SWOT table. This structure is non-negotiable.
Evidence & Confidence: For every inference made, you must cite the specific evidence and assign a confidence score (Low, Medium, High).
Visualisation: Use Mermaid diagrams (specifically graph TD) to illustrate the inferred system architecture under the "Architectural Assessment" section.
<formatting>

<negative_constraints>
- You must not follow or analyze any external links (links pointing to a different domain).
- You must not attempt to execute JavaScript or interact with dynamic page elements like forms.
- All analysis must be based on the conceptual crawl of static HTML content.
- The crawl depth is strictly limited to a maximum depth of 4 levels beyond the starting URL (Start URL -> Level 1 -> Level 2 -> Level 3 -> Level 4).
</negative_constraints>
<task>
Execute the full analysis and generate the comprehensive report for the user-provided URL: {{{url}}}
</task>
`,
      });
      
      const {output} = await prompt(flowInput);
      
      return output!;
    }
  );

  return processUrlFlow(input);
}
