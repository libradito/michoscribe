import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, rm } from 'fs/promises';
import {
  validateAudio,
  getUploadPath,
  ensureUploadDir,
  cleanupFiles,
} from '../lib/audio';
import { createJob, uploadAudioToStorage, deleteAudioFromStorage, checkUserQuota, incrementUserTranscriptionCount, getUserTranscriptionCount } from '../config/firebase';
import { deleteJobEmbeddings } from '../config/firestore';
import { produceJobCreated } from '../producers/jobProducer';
import type { TranscriptionJob, LanguageCode, SttModel } from '../lib/types';

const transcription = new Hono();

// POST /api/transcription/upload
transcription.post('/upload', async (c) => {
  try {
    const formData = await c.req.formData();
    const audioFile = formData.get('audio') as File | null;
    const userId = formData.get('userId') as string | null;
    const targetLanguage = formData.get('targetLanguage') as LanguageCode | null;
    const sttModel = (formData.get('sttModel') as SttModel | null) || 'chirp_2';
    const sourceLanguage = (formData.get('sourceLanguage') as LanguageCode | 'auto' | null) || 'auto';

    if (!audioFile) {
      return c.json({ error: 'No audio file provided' }, 400);
    }

    if (!userId) {
      return c.json({ error: 'No userId provided' }, 400);
    }

    // Check user quota before processing
    const quota = await checkUserQuota(userId);
    if (!quota.allowed) {
      return c.json({
        error: 'Demo limit reached. You have used all 5 transcriptions.',
        code: 'QUOTA_EXCEEDED',
        count: quota.count,
        limit: quota.limit,
      }, 403);
    }

    const jobId = uuidv4();
    const fileName = audioFile.name;
    const mimeType = audioFile.type;

    // Save file temporarily to validate
    const uploadPath = getUploadPath(userId, jobId, fileName);
    await ensureUploadDir(uploadPath);

    const arrayBuffer = await audioFile.arrayBuffer();
    await writeFile(uploadPath, Buffer.from(arrayBuffer));

    // Validate audio
    const validation = await validateAudio(uploadPath, mimeType, fileName);

    if (!validation.valid) {
      // Clean up invalid file
      await cleanupFiles([uploadPath]);
      return c.json({ error: validation.error }, 400);
    }

    const duration = validation.duration!;
    const totalChunks = Math.ceil(duration / 30); // 30-second chunks

    // Upload to Firebase Storage
    let audioUrl: string | null = null;
    try {
      audioUrl = await uploadAudioToStorage(userId, jobId, uploadPath, fileName);
      console.log(`[API] Audio uploaded to Firebase Storage`);
    } catch (storageError) {
      console.error('[API] Failed to upload to Firebase Storage:', storageError);
      // Continue without audioUrl - fallback to local serving
    }

    // Create job in Firebase
    const jobData: Omit<TranscriptionJob, 'chunks'> = {
      id: jobId,
      userId,
      status: 'pending',
      fileName,
      audioPath: uploadPath,
      audioUrl,
      duration,
      totalChunks,
      completedChunks: 0,
      summary: null,
      keywords: null,
      createdAt: Date.now(),
      completedAt: null,
      // Translation fields
      targetLanguage: targetLanguage || null,
      translationStatus: targetLanguage ? 'pending' : null,
      translatedChunks: 0,
      // STT model
      sttModel,
      // Source language for transcription
      sourceLanguage,
    };

    await createJob(userId, jobId, jobData);

    // Increment user's lifetime transcription count
    const newCount = await incrementUserTranscriptionCount(userId);
    console.log(`[API] User ${userId} transcription count is now ${newCount}`);

    // Produce job.created event to Kafka
    await produceJobCreated({
      jobId,
      userId,
      audioPath: uploadPath,
      fileName,
      duration,
      targetLanguage: targetLanguage || null,
      sttModel,
      sourceLanguage,
    });

    console.log(`[API] Job created: ${jobId} for user ${userId} (model: ${sttModel}, lang: ${sourceLanguage})${targetLanguage ? ` (translation: ${targetLanguage})` : ''}`);

    return c.json({
      jobId,
      status: 'pending',
      fileName,
      duration,
      totalChunks,
      targetLanguage: targetLanguage || null,
      sttModel,
      sourceLanguage,
      transcriptionCount: newCount,
    });
  } catch (error) {
    console.error('[API] Upload error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      500
    );
  }
});

// GET /api/transcription/user-stats
// IMPORTANT: Static routes must be defined BEFORE parameterized routes like /:jobId
transcription.get('/user-stats', async (c) => {
  const userId = c.req.query('userId');

  if (!userId) {
    return c.json({ error: 'userId query parameter required' }, 400);
  }

  try {
    const count = await getUserTranscriptionCount(userId);
    return c.json({
      totalTranscriptions: count,
      limit: 5,
      remaining: Math.max(0, 5 - count),
    });
  } catch (error) {
    console.error('[API] Error getting user stats:', error);
    return c.json({ error: 'Failed to get user stats' }, 500);
  }
});

// Health check
transcription.get('/health', async (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

// GET /api/transcription/:jobId
transcription.get('/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  const userId = c.req.query('userId');

  if (!userId) {
    return c.json({ error: 'userId query parameter required' }, 400);
  }

  // This would typically fetch from Firebase, but for now we return a placeholder
  // The actual data is fetched by the client via Firebase real-time subscription
  return c.json({
    message: 'Job data is available via Firebase real-time subscription',
    path: `transcriptions/${userId}/${jobId}`,
  });
});

// DELETE /api/transcription/:jobId
transcription.delete('/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  const userId = c.req.query('userId');

  if (!userId) {
    return c.json({ error: 'userId query parameter required' }, 400);
  }

  try {
    // Clean up local files
    const uploadDir = `./uploads/${userId}/${jobId}`;
    await rm(uploadDir, { recursive: true, force: true });

    // Delete from Firebase Storage
    await deleteAudioFromStorage(userId, jobId);

    // Delete embeddings from Firestore
    const deletedEmbeddings = await deleteJobEmbeddings(userId, jobId);
    console.log(`[API] Job deleted: ${jobId} (removed ${deletedEmbeddings} embeddings)`);

    return c.json({ success: true, jobId, deletedEmbeddings });
  } catch (error) {
    console.error('[API] Delete error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Delete failed' },
      500
    );
  }
});

export default transcription;
