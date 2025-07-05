'use server';

/**
 * @fileOverview An AI flow to process an uploaded document, convert it to Markdown, and update its status.
 *
 * - processDocument - A function that handles the document processing.
 * - ProcessDocumentInput - The input type for the processDocument function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { doc, updateDoc } from 'firebase/firestore';
import { getBytes, ref } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';

const ProcessDocumentInputSchema = z.object({
  documentId: z.string().describe("The ID of the document in Firestore."),
  storagePath: z.string().describe("The full path to the file in Firebase Storage."),
});
export type ProcessDocumentInput = z.infer<typeof ProcessDocumentInputSchema>;

export async function processDocument(input: ProcessDocumentInput): Promise<void> {
  return processDocumentFlow(input);
}

const processDocumentFlow = ai.defineFlow(
  {
    name: 'processDocumentFlow',
    inputSchema: ProcessDocumentInputSchema,
    outputSchema: z.void(),
  },
  async ({ documentId, storagePath }) => {
    const docRef = doc(db, 'documents', documentId);

    try {
      // 1. Download file from Firebase Storage
      const fileRef = ref(storage, storagePath);
      const fileBytes = await getBytes(fileRef);
      // Let Gemini infer mime type from bytes
      const dataUri = `data:application/octet-stream;base64,${Buffer.from(fileBytes).toString('base64')}`;

      // 2. Use Gemini to convert to Markdown
      const { text } = await ai.generate({
        prompt: [
          { text: `You are an expert document processor. Your task is to analyze the content of the provided file and convert it into well-structured, clean Markdown.

- Retain all important information, including text, headings, lists, and tables.
- Preserve the document's structure as much as possible.
- Do not add any commentary or extra text that was not in the original document.` },
          { media: { url: dataUri } }
        ],
      });

      // 3. Update Firestore with Markdown and 'ready' status
      await updateDoc(docRef, {
        markdownContent: text,
        status: 'ready',
      });
    } catch (error) {
      console.error(`Failed to process document ${documentId}:`, error);
      // 4. Update Firestore with 'failed' status on error
      await updateDoc(docRef, {
        status: 'failed',
      });
    }
  }
);
