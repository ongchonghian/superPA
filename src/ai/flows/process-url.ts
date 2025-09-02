
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
  maxOutputTokens: z.number().optional(),
});
export type ProcessUrlInput = z.infer<typeof ProcessUrlInputSchema>;

const ProcessUrlOutputSchema = z.object({
  resultMarkdown: z.string().describe('A detailed summary and analysis of the webpage content, formatted in Markdown.'),
});
export type ProcessUrlOutput = z.infer<typeof ProcessUrlOutputSchema>;


export async function processUrl(input: ProcessUrlInput): Promise<ProcessUrlOutput> {
  const ai = configureAi(input.apiKey, input.model);
  const modelName = (input.model as GeminiModel) || 'gemini-1.5-pro-latest';
  const modelConfig = GEMINI_MODEL_CONFIGS[modelName] || GEMINI_MODEL_CONFIGS['gemini-1.5-pro-latest'];

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
        },
        prompt: `<role>
You will act as a committee of the following experts, synthesizing your collective knowledge to solve the problem step-by-step:

- **CTO Consultant (SME Specialist):** Deep expertise in the Singaporean tech landscape, SME operational challenges, and government support schemes. A pragmatic and strategic thinker focused on actionable, cost-effective technology roadmaps.
- **Venture Capital Technical Due Diligence Analyst:** Skilled at rapidly assessing a company's technology stack, architecture, and engineering team from publicly available data. Focuses on scalability, technical debt, and growth potential for investment evaluation.
- **Digital Transformation Strategist:** Focuses on aligning technology with business objectives to drive growth and efficiency. Experienced in change management and building business cases for technology investment within SMEs.
</role>

<audience>
The target audience for your response is the senior leadership team (CEO, Managing Director, Board of Directors) of a Singapore-based SME seeking to leverage technology for business growth and operational improvement.
</audience>

<context>
You have been collectively engaged to perform a rapid, preliminary technical due diligence on a Singapore-based SME, 'InnovateSG Logistics'. The client's leadership is not deeply technical and needs to understand their current technology posture in plain business terms. Your goal is to provide a strategic 'as-is' assessment using only their public digital footprint, pinpointing specific areas for improvement. The final report must be an actionable roadmap that identifies relevant Singapore government grants to de-risk investment and accelerate transformation.
</context>

<instructions>
Follow this step-by-step process to construct your response:
1.  **Analyze the Target:** Thoroughly examine the website for the target company, \`www.innovatesg-logistics.com.sg\`, and any linked public assets (e.g., technical blogs, careers pages, social media profiles).
2.  **Synthesize Expert Viewpoints:** For each piece of information, consider it from the perspective of all three expert roles defined in \`<role>\`.
3.  **Structure the Report:** Sequentially draft the report following the precise structure and requirements outlined in \`<output_format>\` and \`<report_details>\`.
4.  **Evidence-Based Inference:** For every inference you make about their technology, team, or strategy, you must cite the specific evidence (e.g., 'job posting for a React developer', 'website built on WordPress plugin') and assign a confidence score (Low, Medium, High).
5.  **Localize and Contextualize:** Explicitly and consistently integrate the Singaporean SME context. Reference relevant government grants (e.g., PSG, EDG, SFEC), initiatives (e.g., SMEs Go Digital), and common local challenges (e.g., high manpower costs, digital skills gap) in the SWOT and Roadmap sections.
6.  **Final Review:** Before concluding, review the entire report to ensure it meets all constraints, maintains the specified tone, and directly addresses the client's needs as described in the \`<context>\`.
</instructions>

<output_format>
A structured report using Markdown. It must include the following top-level sections in this exact order: 
1. Executive Summary
2. Business & Product Analysis
3. Inferred Technology Stack & Architecture
4. Organisational & Engineering Culture Analysis
5. SWOT Analysis (Singapore Technology-Centric)
6. Strategic Roadmap for Technological Uplift (Singapore SME Context)
7. Key Areas for Further Investigation
</output_format>

<report_details>
You must adhere to the following detailed requirements for each section of the report:

**1. Executive Summary**
- Provide a concise summary (under 150 words) of the company's technological posture and alignment with business goals.
- State your overall confidence level (High, Medium, Low) in their technical strategy.
- List the top 3 most critical findings for technological uplift, referencing Singaporean SME challenges.

**2. Business & Product Analysis**
- **Core Value Proposition:** What problem do they solve, and for whom?
- **Product/Service Offering:** Detail their main products or services.
- **Target Market:** Describe their apparent customer segment.
- **Inferred Business Model:** Identify their likely business model (e.g., B2B SaaS, transactional).

**3. Inferred Technology Stack & Architecture**
- **Frontend:** Infer frameworks/libraries.
- **Backend:** Infer languages/frameworks/databases.
- **Infrastructure & DevOps:** Infer cloud provider, containerization, CI/CD.
- **Third-Party Integrations:** List key services identified (e.g., Stripe, Intercom).
- **Architectural Assessment:** Provide a high-level assessment (e.g., Monolith, Microservices) and visualize the inferred components using a Mermaid diagram (\`graph TD\`).

**4. Organisational & Engineering Culture Analysis**
- **Team Structure & Scale:** Infer the engineering team's size and structure.
- **Engineering Maturity:** Assess their likely SDLC maturity (e.g., Agile, DevOps).
- **Hiring & Talent Strategy:** Analyze their careers page to infer hiring priorities.

**5. SWOT Analysis (Singapore Technology-Centric)**
- Present in a structured table with 'Category' and 'Analysis & Evidence' columns.
- Focus on Strengths, Weaknesses, Opportunities, and Threats from a technology perspective within the Singaporean context.

**6. Strategic Roadmap for Technological Uplift (Singapore SME Context)**
- Provide three clear, actionable recommendations structured under these pillars: \`Fortifying Operational Agility\`, \`Building a Future-Ready Workforce\`, and \`Harnessing Technology for Competitive Advantage\`.
- Explicitly link each recommendation to a relevant Singaporean government grant or support scheme.

**7. Key Areas for Further Investigation**
- List specific, probing questions for the client to uncover deeper insights and opportunities, framed within the Singaporean context.
</report_details>

<tone>
Analytical, Objective, Consultative. Use UK English. Frame all speculations as "inferred" or "suggests."
</tone>

<positive_constraints>
- Base all analysis strictly on publicly available information from the company's digital footprint.
- Explicitly connect all recommendations and analysis to the specific context of the Singaporean SME ecosystem.
- For every inference, you must cite the supporting evidence and assign a confidence score (Low, Medium, High).
</positive_constraints>

<negative_constraints>
- Do not invent any information that cannot be supported by publicly available evidence.
- Do not provide direct financial investment advice.
- Do not make definitive statements where an inference is required; use cautious, consultative language.
</negative_constraints>

<task>
Conduct the comprehensive due diligence analysis on 'InnovateSG Logistics' (www.innovatesg-logistics.com.sg) and generate the full strategic report now, following all provided instructions and formatting requirements.
</task>
`,
      });
      
      const {output} = await prompt(flowInput);
      
      return output!;
    }
  );

  return processUrlFlow(input);
}
