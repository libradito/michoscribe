import { GoogleGenerativeAI } from '@google/generative-ai';
import { createConsumer, getProducer } from '../config/kafka';
import { getJobData } from '../config/firebase';
import {
  TOPICS,
  type ChunkTranscribedEvent,
  type JobEnrichedEvent,
  type LanguageCode,
  type SummaryKeyPoint,
  type SummaryTopic,
  SUPPORTED_LANGUAGES,
} from '../lib/types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

// Buffer to collect chunks per job
const jobChunks: Map<string, { texts: Map<number, string>; totalChunks: number }> = new Map();

export async function startEnricherWorker(): Promise<void> {
  const consumer = await createConsumer('enricher-group');
  const producer = await getProducer();

  await consumer.subscribe({ topic: TOPICS.CHUNK_TRANSCRIBED, fromBeginning: false });

  console.log('[Enricher] Worker started');

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      const event: ChunkTranscribedEvent = JSON.parse(message.value.toString());
      const { jobId, userId, index, text, totalChunks } = event;

      console.log(`[Enricher] Received chunk ${index + 1}/${totalChunks} for job: ${jobId}`);

      // Initialize buffer for this job if needed
      if (!jobChunks.has(jobId)) {
        jobChunks.set(jobId, { texts: new Map(), totalChunks });
      }

      const jobBuffer = jobChunks.get(jobId)!;
      jobBuffer.texts.set(index, text);

      // Check if all chunks are collected
      if (jobBuffer.texts.size >= totalChunks) {
        console.log(`[Enricher] All chunks collected for job: ${jobId}, generating summary...`);

        try {
          // Fetch job data with chunks to get timestamps
          const jobData = await getJobData(userId, jobId);
          const targetLanguage = jobData?.targetLanguage as LanguageCode | null;

          // Build chunks array with timestamps from Firebase data
          const chunksWithTimestamps: ChunkWithTimestamp[] = [];
          const firebaseChunks = jobData?.chunks as Record<string, any> || {};

          for (let i = 0; i < totalChunks; i++) {
            const text = jobBuffer.texts.get(i) || '';
            // Find the chunk in Firebase data by index
            const fbChunk = Object.values(firebaseChunks).find((c: any) => c.index === i);
            chunksWithTimestamps.push({
              text,
              startTime: fbChunk?.startTime || i * 30,  // Fallback: 30s per chunk
              endTime: fbChunk?.endTime || (i + 1) * 30,
              index: i,
            });
          }

          // Generate summary with Gemini (now with timestamps)
          const { summary, keywords, keyPoints, topics } = await generateSummary(chunksWithTimestamps);

          console.log(`[Enricher] Summary generated for job: ${jobId} (${keyPoints.length} key points, ${topics.length} topics)`);

          let translatedSummary: string | undefined;
          let translatedKeywords: string[] | undefined;
          let translatedKeyPoints: SummaryKeyPoint[] | undefined;
          let translatedTopics: SummaryTopic[] | undefined;

          if (targetLanguage) {
            console.log(`[Enricher] Translating summary to ${targetLanguage} for job: ${jobId}`);
            const translated = await translateSummaryContent(summary, keywords, keyPoints, topics, targetLanguage);
            translatedSummary = translated.translatedSummary;
            translatedKeywords = translated.translatedKeywords;
            translatedKeyPoints = translated.translatedKeyPoints;
            translatedTopics = translated.translatedTopics;
            console.log(`[Enricher] Summary translated for job: ${jobId}`);
          }

          // Produce job.enriched event
          const enrichedEvent: JobEnrichedEvent = {
            jobId,
            userId,
            summary,
            keywords,
            keyPoints,
            topics,
            ...(targetLanguage && {
              translatedSummary,
              translatedKeywords,
              translatedKeyPoints,
              translatedTopics,
              targetLanguage,
            }),
          };

          await producer.send({
            topic: TOPICS.JOB_ENRICHED,
            messages: [
              {
                key: jobId,
                value: JSON.stringify(enrichedEvent),
              },
            ],
          });

          // Clean up buffer
          jobChunks.delete(jobId);
        } catch (error) {
          console.error(`[Enricher] Error generating summary for job ${jobId}:`, error);

          // Still produce an event with error message
          const enrichedEvent: JobEnrichedEvent = {
            jobId,
            userId,
            summary: 'Summary generation failed',
            keywords: [],
          };

          await producer.send({
            topic: TOPICS.JOB_ENRICHED,
            messages: [
              {
                key: jobId,
                value: JSON.stringify(enrichedEvent),
              },
            ],
          });

          jobChunks.delete(jobId);
        }
      }
    },
  });
}

// Format time from seconds to MM:SS
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface ChunkWithTimestamp {
  text: string;
  startTime: number;
  endTime: number;
  index: number;
}

async function generateSummary(
  chunks: ChunkWithTimestamp[]
): Promise<{
  summary: string;
  keywords: string[];
  keyPoints: SummaryKeyPoint[];
  topics: SummaryTopic[];
}> {
  // Format text with timestamps for context
  const formattedText = chunks
    .map((chunk) => {
      const start = formatTime(chunk.startTime);
      const end = formatTime(chunk.endTime);
      return `[${start}-${end}] ${chunk.text}`;
    })
    .join('\n\n');

  const prompt = `Analyze this transcription briefly.

TRANSCRIPTION:
${formattedText}

Return JSON:
{
  "summary": "1-2 short paragraphs",
  "keyPoints": [{ "point": "...", "detail": "...", "timestamp": "MM:SS", "quote": "..." }],
  "keywords": ["..."],
  "topics": [{ "name": "...", "description": "...", "timeRange": "MM:SS - MM:SS" }]
}

Requirements:
- Summary: 1-2 short paragraphs only
- 2-3 key points with timestamps
- 4-6 keywords
- 2-3 main topics`;

  const result = await model.generateContent(prompt);
  const response = result.response.text();

  // Extract JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse Gemini response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    summary: parsed.summary || 'No summary available',
    keywords: parsed.keywords || [],
    keyPoints: parsed.keyPoints || [],
    topics: parsed.topics || [],
  };
}

// Translate summary content to target language
async function translateSummaryContent(
  summary: string,
  keywords: string[],
  keyPoints: SummaryKeyPoint[],
  topics: SummaryTopic[],
  targetLanguage: LanguageCode
): Promise<{
  translatedSummary: string;
  translatedKeywords: string[];
  translatedKeyPoints: SummaryKeyPoint[];
  translatedTopics: SummaryTopic[];
}> {
  const languageName = SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage)?.name || targetLanguage;

  const prompt = `Translate ALL of the following content to ${languageName}. Maintain the exact same structure and preserve timestamps as-is.

SUMMARY:
${summary}

KEYWORDS:
${keywords.join(', ')}

KEY POINTS:
${JSON.stringify(keyPoints, null, 2)}

TOPICS:
${JSON.stringify(topics, null, 2)}

Respond in JSON format with ALL fields translated:
{
  "translatedSummary": "translated summary here",
  "translatedKeywords": ["translated keyword1", "translated keyword2", ...],
  "translatedKeyPoints": [
    {
      "point": "translated point",
      "detail": "translated detail",
      "timestamp": "keep original timestamp like 2:30",
      "quote": "translated quote"
    }
  ],
  "translatedTopics": [
    {
      "name": "translated topic name",
      "description": "translated description",
      "timeRange": "keep original like 0:00 - 3:00"
    }
  ]
}

IMPORTANT: Keep all timestamps and time ranges exactly as they are (do not translate numbers/times).`;

  const result = await model.generateContent(prompt);
  const response = result.response.text();

  // Extract JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse translation response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    translatedSummary: parsed.translatedSummary || summary,
    translatedKeywords: parsed.translatedKeywords || keywords,
    translatedKeyPoints: parsed.translatedKeyPoints || keyPoints,
    translatedTopics: parsed.translatedTopics || topics,
  };
}
