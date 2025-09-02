
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {ModelReference} from 'genkit/model';

// This function allows creating a configured AI instance on-demand.
export const configureAi = (apiKey?: string, model?: ModelReference<any> | string) => {
  
  let modelRef: ModelReference<any> | undefined = undefined;

  if (typeof model === 'string') {
    // Prepend 'googleai/' if it's not already there. This standardizes the model name for Genkit.
    modelRef = model.startsWith('googleai/') ? model as ModelReference<any> : `googleai/${model}` as ModelReference<any>;
  } else if (model) {
    modelRef = model;
  } else {
    modelRef = 'googleai/gemini-1.5-pro-latest';
  }

  return genkit({
    plugins: [googleAI({apiKey: apiKey || process.env.GEMINI_API_KEY})],
    model: modelRef,
  });
};

// A default instance for cases where no custom config is provided.
export const ai = configureAi();
