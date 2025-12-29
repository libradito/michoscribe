import { SpeechClient } from '@google-cloud/speech/build/src/v2';
import { createConsumer, getProducer } from '../config/kafka';
import { updateChunkStatus } from '../config/firebase';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import {
  TOPICS,
  type ChunkCreatedEvent,
  type ChunkTranscribedEvent,
  type ChunkDoneEvent,
  type ChunkTranslateEvent,
  type SttModel,
} from '../lib/types';

// Get service account path (same as Firebase uses)
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;
const keyFilename = serviceAccountPath
  ? (serviceAccountPath.startsWith('/')
      ? serviceAccountPath
      : resolve(process.cwd(), serviceAccountPath))
  : undefined;

// Model configurations for chirp_2 and chirp_3
const MODEL_CONFIG: Record<SttModel, { endpoint: string; location: string; model: string; concurrency: number }> = {
  chirp_2: {
    endpoint: 'us-central1-speech.googleapis.com',
    location: 'us-central1',
    model: 'chirp_2',
    concurrency: 3,
  },
  chirp_3: {
    endpoint: 'us-speech.googleapis.com',
    location: 'us',
    model: 'chirp_3',
    concurrency: 2,
  },
};

// Initialize Google Cloud Speech-to-Text V2 clients for each model
const speechClients: Record<SttModel, SpeechClient> = {
  chirp_2: new SpeechClient({
    keyFilename,
    apiEndpoint: MODEL_CONFIG.chirp_2.endpoint,
  }),
  chirp_3: new SpeechClient({
    keyFilename,
    apiEndpoint: MODEL_CONFIG.chirp_3.endpoint,
  }),
};

const projectId = process.env.GCP_PROJECT_ID;

// Language code mapping for Speech API (short codes to full BCP-47 codes)
const LANGUAGE_CODE_MAP: Record<string, string> = {
  'auto': 'auto',
  'en': 'en-US',
  'es': 'es-ES',
  'fr': 'fr-FR',
  'de': 'de-DE',
  'pt': 'pt-BR',
  'it': 'it-IT',
  'ja': 'ja-JP',
  'zh': 'cmn-Hans-CN',
  'ko': 'ko-KR',
  'ar': 'ar-SA',
};

function mapLanguageCode(code: string): string {
  return LANGUAGE_CODE_MAP[code] || 'auto';
}

export async function startSttWorker(): Promise<void> {
  const consumer = await createConsumer('stt-worker-group');
  const producer = await getProducer();

  await consumer.subscribe({ topic: TOPICS.CHUNK_CREATED, fromBeginning: false });

  console.log('[STT Worker] Worker started (Google Cloud Speech-to-Text V2 - supports chirp_2/chirp_3 with auto language detection)');

  if (!projectId) {
    console.error('[STT Worker] GCP_PROJECT_ID environment variable is not set!');
  }

  await consumer.run({
    partitionsConsumedConcurrently: 3, // Balance between chirp_2 (3) and chirp_3 (2)
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      const event: ChunkCreatedEvent = JSON.parse(message.value.toString());
      const { jobId, userId, chunkId, chunkPath, index, totalChunks, targetLanguage, sttModel = 'chirp_2', sourceLanguage = 'auto' } = event;

      // Get the correct client and config for the selected model
      const config = MODEL_CONFIG[sttModel];
      const client = speechClients[sttModel];

      // Map source language to API format (e.g., 'en' -> 'en-US', 'auto' -> 'auto')
      const languageCode = mapLanguageCode(sourceLanguage);

      console.log(`[STT Worker] Processing chunk ${index + 1}/${totalChunks} for job: ${jobId} (model: ${sttModel}, lang: ${languageCode})${targetLanguage ? ` (will translate to ${targetLanguage})` : ''}`);

      try {
        // Update chunk status to transcribing
        await updateChunkStatus(userId, jobId, chunkId, { status: 'transcribing' });

        // Read the audio chunk file
        const audioBuffer = await readFile(chunkPath);

        // Call Google Cloud Speech-to-Text V2 API with selected model and language
        const [response] = await client.recognize({
          recognizer: `projects/${projectId}/locations/${config.location}/recognizers/_`,
          config: {
            autoDecodingConfig: {},
            languageCodes: [languageCode],  // Use specified language or 'auto' for auto-detect
            model: config.model,
          },
          content: audioBuffer,
        });

        const text = response.results
          ?.map(result => result.alternatives?.[0]?.transcript)
          .filter(Boolean)
          .join(' ') || '';

        console.log(`[STT Worker] Transcribed chunk ${index + 1}/${totalChunks}: "${text.substring(0, 50)}..."`);

        // Update chunk with transcription
        await updateChunkStatus(userId, jobId, chunkId, {
          status: 'done',
          text,
        });

        // Produce chunk.transcribed event
        const transcribedEvent: ChunkTranscribedEvent = {
          jobId,
          userId,
          chunkId,
          index,
          text,
          totalChunks,
        };

        await producer.send({
          topic: TOPICS.CHUNK_TRANSCRIBED,
          messages: [
            {
              key: `${jobId}-${chunkId}`,
              value: JSON.stringify(transcribedEvent),
            },
          ],
        });

        // If targetLanguage is set, produce chunk.translate event
        if (targetLanguage && text) {
          const translateEvent: ChunkTranslateEvent = {
            jobId,
            userId,
            chunkId,
            index,
            text,
            targetLanguage,
            totalChunks,
          };

          await producer.send({
            topic: TOPICS.CHUNK_TRANSLATE,
            messages: [
              {
                key: `${jobId}-${chunkId}`,
                value: JSON.stringify(translateEvent),
              },
            ],
          });
          console.log(`[STT Worker] Queued chunk ${index + 1} for translation to ${targetLanguage}`);
        }

        // Produce chunk.done event
        const doneEvent: ChunkDoneEvent = {
          jobId,
          userId,
          chunkId,
          index,
          status: 'done',
        };

        await producer.send({
          topic: TOPICS.CHUNK_DONE,
          messages: [
            {
              key: `${jobId}-${chunkId}`,
              value: JSON.stringify(doneEvent),
            },
          ],
        });
      } catch (error) {
        console.error(`[STT Worker] Error processing chunk ${chunkId}:`, error);

        await updateChunkStatus(userId, jobId, chunkId, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Transcription failed',
        });

        // Produce chunk.done event with failed status
        const doneEvent: ChunkDoneEvent = {
          jobId,
          userId,
          chunkId,
          index,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Transcription failed',
        };

        await producer.send({
          topic: TOPICS.CHUNK_DONE,
          messages: [
            {
              key: `${jobId}-${chunkId}`,
              value: JSON.stringify(doneEvent),
            },
          ],
        });
      }
    },
  });
}
