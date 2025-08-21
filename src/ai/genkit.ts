
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {ModelReference} from 'genkit/model';

// This function allows creating a configured AI instance on-demand.
export const configureAi = (apiKey?: string, model?: ModelReference<any>) => {
  return genkit({
    plugins: [googleAI({apiKey: apiKey || process.env.GEMINI_API_KEY})],
    model: model || 'googleai/gemini-1.5-pro-latest',
  });
};

// A default instance for cases where no custom config is provided.
export const ai = configureAi();
