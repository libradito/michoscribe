import { createConsumer, getProducer } from '../config/kafka';
import {
  updateJobStatus,
  updateChunkStatus,
  incrementCompletedChunks,
  incrementTranslatedChunks,
  getJobData,
} from '../config/firebase';
import {
  TOPICS,
  type ChunkDoneEvent,
  type JobEnrichedEvent,
  type ChunkTranslatedEvent,
  type JobCompletedEvent,
} from '../lib/types';

export async function startProjectorWorker(): Promise<void> {
  const consumer = await createConsumer('projector-group');

  // Subscribe to relevant topics
  await consumer.subscribe({
    topics: [TOPICS.CHUNK_DONE, TOPICS.JOB_ENRICHED, TOPICS.CHUNK_TRANSLATED],
    fromBeginning: false,
  });

  console.log('[Projector] Worker started');

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;

      const event = JSON.parse(message.value.toString());

      try {
        switch (topic) {
          case TOPICS.CHUNK_DONE:
            await handleChunkDone(event as ChunkDoneEvent);
            break;

          case TOPICS.JOB_ENRICHED:
            await handleJobEnriched(event as JobEnrichedEvent);
            break;

          case TOPICS.CHUNK_TRANSLATED:
            await handleChunkTranslated(event as ChunkTranslatedEvent);
            break;

          default:
            console.log(`[Projector] Unknown topic: ${topic}`);
        }
      } catch (error) {
        console.error(`[Projector] Error processing ${topic}:`, error);
      }
    },
  });
}

async function handleChunkDone(event: ChunkDoneEvent): Promise<void> {
  const { jobId, userId, index } = event;

  console.log(`[Projector] Chunk ${index} done for job: ${jobId}`);

  // Increment completed chunks counter
  const completedChunks = await incrementCompletedChunks(userId, jobId);

  // Check if all chunks are done
  const jobData = await getJobData(userId, jobId);

  if (jobData && completedChunks >= (jobData.totalChunks as number)) {
    console.log(`[Projector] All chunks complete for job: ${jobId}`);

    // Don't mark as completed yet - wait for enricher
    // Just update that transcription is done
    await updateJobStatus(userId, jobId, {
      transcriptionComplete: true,
    });
  }
}

async function handleJobEnriched(event: JobEnrichedEvent): Promise<void> {
  const { jobId, userId, summary, keywords, keyPoints, topics, translatedSummary, translatedKeywords, translatedKeyPoints, translatedTopics, targetLanguage } = event;

  console.log(`[Projector] Job enriched: ${jobId} (${keyPoints?.length || 0} key points, ${topics?.length || 0} topics)${targetLanguage ? ` (translated to ${targetLanguage})` : ''}`);

  // Get job data to send with completed event
  const jobData = await getJobData(userId, jobId);

  // Mark job as completed with summary, keywords, key points, and topics (including translated versions)
  await updateJobStatus(userId, jobId, {
    status: 'completed',
    summary,
    keywords,
    ...(keyPoints && { keyPoints }),
    ...(topics && { topics }),
    ...(translatedSummary && { translatedSummary }),
    ...(translatedKeywords && { translatedKeywords }),
    ...(translatedKeyPoints && { translatedKeyPoints }),
    ...(translatedTopics && { translatedTopics }),
    completedAt: Date.now(),
  });

  // Produce job.completed event for embedder
  if (jobData) {
    const producer = await getProducer();
    const completedEvent: JobCompletedEvent = {
      jobId,
      userId,
      fileName: jobData.fileName as string,
      totalChunks: jobData.totalChunks as number,
    };

    await producer.send({
      topic: TOPICS.JOB_COMPLETED,
      messages: [{
        key: jobId,
        value: JSON.stringify(completedEvent),
      }],
    });

    console.log(`[Projector] Emitted job.completed for embedder: ${jobId}`);
  }
}

async function handleChunkTranslated(event: ChunkTranslatedEvent): Promise<void> {
  const { jobId, userId, index } = event;

  // Note: The translator worker already increments the counter and updates status
  // This handler is just for logging/monitoring purposes
  console.log(`[Projector] Chunk ${index} translated for job: ${jobId}`);
}
