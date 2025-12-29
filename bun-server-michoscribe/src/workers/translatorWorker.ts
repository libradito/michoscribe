import { createConsumer, getProducer } from '../config/kafka';
import { updateChunkStatus, updateJobStatus, incrementTranslatedChunks } from '../config/firebase';
import { TOPICS, type ChunkTranslateEvent, type ChunkTranslatedEvent, SUPPORTED_LANGUAGES } from '../lib/types';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('[Translator] GEMINI_API_KEY not set');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

function getLanguageName(code: string): string {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
  return lang?.name || code;
}

async function translateText(text: string, targetLanguage: string): Promise<string> {
  const languageName = getLanguageName(targetLanguage);

  const prompt = `Translate the following text to ${languageName}.
Only provide the translation, no explanations or additional text.
Maintain the original tone and meaning.

Text to translate:
${text}`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const translatedText = response.text().trim();

    return translatedText;
  } catch (error) {
    console.error('[Translator] Translation error:', error);
    throw error;
  }
}

export async function startTranslatorWorker(): Promise<void> {
  console.log('[Translator] Starting translator worker...');

  const consumer = await createConsumer('translator-group');
  await consumer.subscribe({ topic: TOPICS.CHUNK_TRANSLATE, fromBeginning: false });

  await consumer.run({
    partitionsConsumedConcurrently: 6, // Process up to 3 translations in parallel
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      const event: ChunkTranslateEvent = JSON.parse(message.value.toString());
      const { jobId, userId, chunkId, index, text, targetLanguage, totalChunks } = event;

      console.log(`[Translator] Translating chunk ${index + 1}/${totalChunks} for job ${jobId} to ${targetLanguage}`);

      try {
        // Update chunk status to translating
        await updateChunkStatus(userId, jobId, chunkId, {
          translationStatus: 'translating',
        });

        // Translate the text
        const translatedText = await translateText(text, targetLanguage);

        // Update chunk with translated text
        await updateChunkStatus(userId, jobId, chunkId, {
          translatedText,
          translationStatus: 'done',
        });

        // Increment translated chunks counter
        const completedCount = await incrementTranslatedChunks(userId, jobId);
        console.log(`[Translator] Translated ${completedCount}/${totalChunks} chunks for job ${jobId}`);

        // If all chunks translated, update job status
        if (completedCount >= totalChunks) {
          await updateJobStatus(userId, jobId, {
            translationStatus: 'done',
          });
          console.log(`[Translator] Translation complete for job ${jobId}`);
        }

        // Produce chunk.translated event
        const producer = await getProducer();
        const translatedEvent: ChunkTranslatedEvent = {
          jobId,
          userId,
          chunkId,
          index,
          translatedText,
          totalChunks,
        };

        await producer.send({
          topic: TOPICS.CHUNK_TRANSLATED,
          messages: [{
            key: `${jobId}-${chunkId}`,
            value: JSON.stringify(translatedEvent),
          }],
        });

        console.log(`[Translator] Chunk ${index + 1} translated successfully`);
      } catch (error) {
        console.error(`[Translator] Error translating chunk ${chunkId}:`, error);

        // Update chunk with error status
        await updateChunkStatus(userId, jobId, chunkId, {
          translationStatus: 'failed',
        });

        // Update job translation status to failed
        await updateJobStatus(userId, jobId, {
          translationStatus: 'failed',
        });
      }
    },
  });

  console.log('[Translator] Translator worker started');
}
