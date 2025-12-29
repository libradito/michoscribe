import { createConsumer, getProducer } from '../config/kafka';
import { splitAudioIntoChunks, getChunksDir } from '../lib/audio';
import { updateJobStatus, createChunk } from '../config/firebase';
import { v4 as uuidv4 } from 'uuid';
import {
  TOPICS,
  type JobCreatedEvent,
  type ChunkCreatedEvent,
} from '../lib/types';

export async function startChunkerWorker(): Promise<void> {
  const consumer = await createConsumer('chunker-group');
  const producer = await getProducer();

  await consumer.subscribe({ topic: TOPICS.JOB_CREATED, fromBeginning: false });

  console.log('[Chunker] Worker started');

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      const event: JobCreatedEvent = JSON.parse(message.value.toString());
      const { jobId, userId, audioPath, duration, targetLanguage, sttModel, sourceLanguage } = event;

      console.log(`[Chunker] Processing job: ${jobId} (model: ${sttModel}, lang: ${sourceLanguage})${targetLanguage ? ` (translation: ${targetLanguage})` : ''}`);

      try {
        // Update job status to processing
        await updateJobStatus(userId, jobId, { status: 'processing' });

        // Split audio into chunks
        const chunksDir = getChunksDir(userId, jobId);
        const chunks = await splitAudioIntoChunks(audioPath, chunksDir, duration);

        console.log(`[Chunker] Created ${chunks.length} chunks for job: ${jobId}`);

        // Create chunk records in Firebase and collect messages for batch publish
        const kafkaMessages: { key: string; value: string }[] = [];

        for (const chunk of chunks) {
          const chunkId = uuidv4();

          // Create chunk in Firebase
          await createChunk(userId, jobId, chunkId, {
            id: chunkId,
            index: chunk.index,
            status: 'pending',
            text: null,
            startTime: chunk.startTime,
            endTime: chunk.endTime,
            // Translation fields
            translatedText: null,
            translationStatus: targetLanguage ? 'pending' : null,
          });

          // Prepare chunk.created event for batch publish
          const chunkEvent: ChunkCreatedEvent = {
            jobId,
            userId,
            chunkId,
            chunkPath: chunk.path,
            index: chunk.index,
            totalChunks: chunks.length,
            startTime: chunk.startTime,
            endTime: chunk.endTime,
            targetLanguage,
            sttModel,
            sourceLanguage,
          };

          kafkaMessages.push({
            key: `${jobId}-${chunkId}`,
            value: JSON.stringify(chunkEvent),
          });
        }

        // Batch publish all chunk.created events at once
        await producer.send({
          topic: TOPICS.CHUNK_CREATED,
          messages: kafkaMessages,
        });

        console.log(`[Chunker] All chunks created for job: ${jobId}`);
      } catch (error) {
        console.error(`[Chunker] Error processing job ${jobId}:`, error);

        await updateJobStatus(userId, jobId, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Chunking failed',
        });
      }
    },
  });
}
