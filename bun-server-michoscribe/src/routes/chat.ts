import { Hono } from 'hono';
import { vectorSearch } from '../config/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('[Chat] GEMINI_API_KEY not set');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || '');
const chatModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

const chat = new Hono();

// Generate embedding for a query
async function generateQueryEmbedding(query: string): Promise<number[]> {
  const result = await embeddingModel.embedContent(query);
  return result.embedding.values;
}

// Format time for display
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface ChatRequest {
  userId: string;
  question: string;
  jobId?: string;  // If provided, search only within this job
  limit?: number;  // Max chunks to retrieve (default: 5)
}

interface SearchRequest {
  userId: string;
  query: string;
  jobId?: string;
  limit?: number;
}

// POST /api/chat - Main chat endpoint with RAG
chat.post('/', async (c) => {
  try {
    const body = await c.req.json<ChatRequest>();
    const { userId, question, jobId, limit = 5 } = body;

    if (!userId) {
      return c.json({ error: 'userId is required' }, 400);
    }

    if (!question || question.trim().length === 0) {
      return c.json({ error: 'question is required' }, 400);
    }

    console.log(`[Chat] Processing question for user ${userId}${jobId ? ` (job: ${jobId})` : ''}`);

    // Generate embedding for the question
    const queryEmbedding = await generateQueryEmbedding(question);

    // Search for relevant chunks
    const searchResults = await vectorSearch(userId, queryEmbedding, {
      jobId,
      limit,
    });

    if (searchResults.length === 0) {
      return c.json({
        answer: "I couldn't find any relevant information in your transcriptions to answer this question. Please make sure you have uploaded and transcribed some audio files.",
        sources: [],
      });
    }

    // Build context from search results
    const contextParts = searchResults.map((result, index) => {
      const timeRange = `[${formatTime(result.startTime)} - ${formatTime(result.endTime)}]`;
      return `[Source ${index + 1} - ${result.fileName} ${timeRange}]\n${result.text}`;
    });

    const context = contextParts.join('\n\n');

    // Generate answer using Gemini
    const prompt = `You are a helpful assistant that answers questions based on transcribed audio content.
Use the following transcription excerpts to answer the user's question.
If the answer cannot be found in the excerpts, say so clearly.
Be concise but thorough. Reference specific sources when applicable.

TRANSCRIPTION EXCERPTS:
${context}

USER QUESTION: ${question}

ANSWER:`;

    const result = await chatModel.generateContent(prompt);
    const answer = result.response.text().trim();

    // Format sources for response
    const sources = searchResults.map((result) => ({
      jobId: result.jobId,
      chunkId: result.chunkId,
      fileName: result.fileName,
      text: result.text,
      startTime: result.startTime,
      endTime: result.endTime,
      score: result.score,
    }));

    console.log(`[Chat] Generated answer with ${sources.length} sources`);

    return c.json({
      answer,
      sources,
    });
  } catch (error: any) {
    console.error('[Chat] Error processing chat request:', error);

    // Provide helpful message for missing index errors
    if (error.code === 9 || error.message?.includes('index')) {
      return c.json({
        error: 'Vector search index not configured. Check server logs for the gcloud command to create the required index.',
        details: 'If searching "All Transcriptions", you need a second index with just userId + embedding (without jobId).',
      }, 500);
    }

    return c.json(
      { error: error instanceof Error ? error.message : 'Chat request failed' },
      500
    );
  }
});

// POST /api/chat/search - Vector search only
chat.post('/search', async (c) => {
  try {
    const body = await c.req.json<SearchRequest>();
    const { userId, query, jobId, limit = 10 } = body;

    if (!userId) {
      return c.json({ error: 'userId is required' }, 400);
    }

    if (!query || query.trim().length === 0) {
      return c.json({ error: 'query is required' }, 400);
    }

    console.log(`[Chat] Search query for user ${userId}${jobId ? ` (job: ${jobId})` : ''}`);

    // Generate embedding for the query
    const queryEmbedding = await generateQueryEmbedding(query);

    // Search for relevant chunks
    const searchResults = await vectorSearch(userId, queryEmbedding, {
      jobId,
      limit,
    });

    const results = searchResults.map((result) => ({
      jobId: result.jobId,
      chunkId: result.chunkId,
      chunkIndex: result.chunkIndex,
      fileName: result.fileName,
      text: result.text,
      startTime: result.startTime,
      endTime: result.endTime,
      score: result.score,
    }));

    console.log(`[Chat] Found ${results.length} matching chunks`);

    return c.json({
      results,
      total: results.length,
    });
  } catch (error) {
    console.error('[Chat] Error processing search request:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Search request failed' },
      500
    );
  }
});

// GET /api/chat/health - Health check
chat.get('/health', async (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

export default chat;
