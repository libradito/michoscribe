import { createConsumer } from '../config/kafka';
import { getJobData, getChunkData, incrementEmbeddedChunks, updateJobStatus } from '../config/firebase';
import { storeEmbedding } from '../config/firestore';
import {
  TOPICS,
  type ChunkTranscribedEvent,
} from '../lib/types';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('[Embedder] GEMINI_API_KEY not set');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || '');
const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

// Retry wrapper with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on non-retryable errors (4xx except 429)
      if (error instanceof Error && 'status' in error) {
        const status = (error as any).status;
        if (status >= 400 && status < 500 && status !== 429) {
          throw error; // Client error, don't retry
        }
      }

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`[Embedder] Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// Generate embedding for a text with retry
async function generateEmbedding(text: string): Promise<number[]> {
  return withRetry(async () => {
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
  });
}

export async function startEmbedderWorker(): Promise<void> {
  console.log('[Embedder] Starting embedder worker...');

  const consumer = await createConsumer('embedder-group');
  await consumer.subscribe({ topic: TOPICS.CHUNK_TRANSCRIBED, fromBeginning: false });

  await consumer.run({
    partitionsConsumedConcurrently: 6, // Process up to 3 chunks in parallel
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      const event: ChunkTranscribedEvent = JSON.parse(message.value.toString());
      const { jobId, userId, chunkId, index, text, totalChunks } = event;

      // Skip empty text but still count it
      if (!text || text.trim().length === 0) {
        console.log(`[Embedder] Skipping empty chunk ${index + 1}/${totalChunks} for job ${jobId}`);
        const embeddedCount = await incrementEmbeddedChunks(userId, jobId);
        if (embeddedCount >= totalChunks) {
          await updateJobStatus(userId, jobId, { embeddingStatus: 'completed' });
          console.log(`[Embedder] All embeddings complete for job ${jobId}`);
        }
        return;
      }

      console.log(`[Embedder] Embedding chunk ${index + 1}/${totalChunks} for job ${jobId}`);

      try {
        // Fetch chunk and job data for metadata
        const [chunkData, jobData] = await Promise.all([
          getChunkData(userId, jobId, chunkId),
          getJobData(userId, jobId),
        ]);

        if (!chunkData || !jobData) {
          console.error(`[Embedder] Missing data for chunk ${chunkId}`);
          return;
        }

        // Generate embedding
        const embedding = await generateEmbedding(text);

        // Store embedding immediately
        await storeEmbedding({
          userId,
          jobId,
          chunkId,
          chunkIndex: index,
          text,
          embedding,
          fileName: jobData.fileName as string,
          startTime: chunkData.startTime as number,
          endTime: chunkData.endTime as number,
        });

        // Increment embedded chunks counter
        const embeddedCount = await incrementEmbeddedChunks(userId, jobId);
        console.log(`[Embedder] Embedded chunk ${index + 1}/${totalChunks} for job ${jobId} (${embeddedCount}/${totalChunks} complete)`);

        // If all chunks embedded, update job status
        if (embeddedCount >= totalChunks) {
          await updateJobStatus(userId, jobId, {
            embeddingStatus: 'completed',
          });
          console.log(`[Embedder] All embeddings complete for job ${jobId}`);
        }
      } catch (error) {
        console.error(`[Embedder] Error embedding chunk ${chunkId}:`, error);
      }
    },
  });

  console.log('[Embedder] Embedder worker started');
}
