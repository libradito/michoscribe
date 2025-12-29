import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getDatabase, Database } from 'firebase-admin/database';
import { getStorage, type Bucket } from 'firebase-admin/storage';
import { resolve } from 'path';

let app: App | null = null;
let database: Database | null = null;
let bucket: Bucket | null = null;

const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://ilustre-apps-default-rtdb.firebaseio.com';
const FIREBASE_STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'michoscribe.firebasestorage.app';

export function initializeFirebase(): App {
  if (getApps().length > 0) {
    app = getApps()[0];
    return app;
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccountPath) {
    // Resolve path relative to project root (cwd)
    const absolutePath = serviceAccountPath.startsWith('/')
      ? serviceAccountPath
      : resolve(process.cwd(), serviceAccountPath);

    const serviceAccount = require(absolutePath);
    app = initializeApp({
      credential: cert(serviceAccount),
      databaseURL: FIREBASE_DATABASE_URL,
      storageBucket: FIREBASE_STORAGE_BUCKET,
    });
  } else {
    // Try to use application default credentials
    app = initializeApp({
      databaseURL: FIREBASE_DATABASE_URL,
      storageBucket: FIREBASE_STORAGE_BUCKET,
    });
  }

  console.log('[Firebase] Admin SDK initialized');
  return app;
}

export function getDb(): Database {
  if (!database) {
    if (!app) {
      initializeFirebase();
    }
    database = getDatabase(app!);
  }
  return database;
}

// Helper functions for transcription data
export async function updateJobStatus(
  userId: string,
  jobId: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const db = getDb();
    const path = `transcriptions/${userId}/${jobId}`;
    await db.ref(path).update(data);
    console.log(`[Firebase] Updated job status: ${path}`, Object.keys(data));
  } catch (error) {
    console.error(`[Firebase] Failed to update job status:`, error);
    throw error;
  }
}

export async function updateChunkStatus(
  userId: string,
  jobId: string,
  chunkId: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const db = getDb();
    const path = `transcriptions/${userId}/${jobId}/chunks/${chunkId}`;
    await db.ref(path).update(data);
    console.log(`[Firebase] Updated chunk: ${path}`, Object.keys(data));
  } catch (error) {
    console.error(`[Firebase] Failed to update chunk:`, error);
    throw error;
  }
}

export async function createJob(
  userId: string,
  jobId: string,
  jobData: Record<string, unknown>
): Promise<void> {
  try {
    const db = getDb();
    const path = `transcriptions/${userId}/${jobId}`;
    await db.ref(path).set(jobData);
    console.log(`[Firebase] Created job: ${path}`);
  } catch (error) {
    console.error(`[Firebase] Failed to create job:`, error);
    throw error;
  }
}

export async function createChunk(
  userId: string,
  jobId: string,
  chunkId: string,
  chunkData: Record<string, unknown>
): Promise<void> {
  try {
    const db = getDb();
    const path = `transcriptions/${userId}/${jobId}/chunks/${chunkId}`;
    await db.ref(path).set(chunkData);
    console.log(`[Firebase] Created chunk: ${path}`);
  } catch (error) {
    console.error(`[Firebase] Failed to create chunk:`, error);
    throw error;
  }
}

export async function incrementCompletedChunks(
  userId: string,
  jobId: string
): Promise<number> {
  try {
    const db = getDb();
    const ref = db.ref(`transcriptions/${userId}/${jobId}/completedChunks`);
    const result = await ref.transaction((current: number | null) => {
      return (current || 0) + 1;
    });
    const value = result.snapshot.val() as number;
    console.log(`[Firebase] Incremented completedChunks to ${value} for job ${jobId}`);
    return value;
  } catch (error) {
    console.error(`[Firebase] Failed to increment completedChunks:`, error);
    throw error;
  }
}

export async function getJobData(
  userId: string,
  jobId: string
): Promise<Record<string, unknown> | null> {
  try {
    const db = getDb();
    const snapshot = await db.ref(`transcriptions/${userId}/${jobId}`).once('value');
    return snapshot.val();
  } catch (error) {
    console.error(`[Firebase] Failed to get job data:`, error);
    throw error;
  }
}

export async function getChunkData(
  userId: string,
  jobId: string,
  chunkId: string
): Promise<Record<string, unknown> | null> {
  try {
    const db = getDb();
    const snapshot = await db.ref(`transcriptions/${userId}/${jobId}/chunks/${chunkId}`).once('value');
    return snapshot.val();
  } catch (error) {
    console.error(`[Firebase] Failed to get chunk data:`, error);
    throw error;
  }
}

export async function incrementTranslatedChunks(
  userId: string,
  jobId: string
): Promise<number> {
  try {
    const db = getDb();
    const ref = db.ref(`transcriptions/${userId}/${jobId}/translatedChunks`);
    const result = await ref.transaction((current: number | null) => {
      return (current || 0) + 1;
    });
    const value = result.snapshot.val() as number;
    console.log(`[Firebase] Incremented translatedChunks to ${value} for job ${jobId}`);
    return value;
  } catch (error) {
    console.error(`[Firebase] Failed to increment translatedChunks:`, error);
    throw error;
  }
}

export async function incrementEmbeddedChunks(
  userId: string,
  jobId: string
): Promise<number> {
  try {
    const db = getDb();
    const ref = db.ref(`transcriptions/${userId}/${jobId}/embeddedChunks`);
    const result = await ref.transaction((current: number | null) => {
      return (current || 0) + 1;
    });
    const value = result.snapshot.val() as number;
    console.log(`[Firebase] Incremented embeddedChunks to ${value} for job ${jobId}`);
    return value;
  } catch (error) {
    console.error(`[Firebase] Failed to increment embeddedChunks:`, error);
    throw error;
  }
}

// User quota functions for demo limits
const MAX_TRANSCRIPTIONS = 5;

export async function getUserTranscriptionCount(userId: string): Promise<number> {
  try {
    const db = getDb();
    const snapshot = await db.ref(`userStats/${userId}/totalTranscriptions`).once('value');
    return snapshot.val() || 0;
  } catch (error) {
    console.error(`[Firebase] Failed to get user transcription count:`, error);
    throw error;
  }
}

export async function checkUserQuota(userId: string): Promise<{ allowed: boolean; count: number; limit: number }> {
  const count = await getUserTranscriptionCount(userId);
  return {
    allowed: count < MAX_TRANSCRIPTIONS,
    count,
    limit: MAX_TRANSCRIPTIONS,
  };
}

export async function incrementUserTranscriptionCount(userId: string): Promise<number> {
  try {
    const db = getDb();
    const ref = db.ref(`userStats/${userId}/totalTranscriptions`);
    const result = await ref.transaction((current: number | null) => {
      return (current || 0) + 1;
    });
    const value = result.snapshot.val() as number;

    // Also update the timestamp
    await db.ref(`userStats/${userId}/updatedAt`).set(Date.now());

    console.log(`[Firebase] Incremented user transcription count to ${value} for user ${userId}`);
    return value;
  } catch (error) {
    console.error(`[Firebase] Failed to increment user transcription count:`, error);
    throw error;
  }
}

// Firebase Storage functions
export function getStorageBucket(): Bucket {
  if (!bucket) {
    if (!app) {
      initializeFirebase();
    }
    bucket = getStorage(app!).bucket();
  }
  return bucket;
}

function getMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    webm: 'audio/webm',
    m4a: 'audio/mp4',
    ogg: 'audio/ogg',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

export async function uploadAudioToStorage(
  userId: string,
  jobId: string,
  localFilePath: string,
  fileName: string
): Promise<string> {
  try {
    const storageBucket = getStorageBucket();
    const ext = fileName.slice(fileName.lastIndexOf('.'));
    const storagePath = `audio/${userId}/${jobId}/original${ext}`;

    await storageBucket.upload(localFilePath, {
      destination: storagePath,
      metadata: {
        contentType: getMimeType(fileName),
        metadata: {
          userId,
          jobId,
          originalFileName: fileName,
        },
      },
    });

    // Get signed URL with 1 year expiration
    const file = storageBucket.file(storagePath);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
    });

    console.log(`[Firebase Storage] Uploaded audio: ${storagePath}`);
    return url;
  } catch (error) {
    console.error(`[Firebase Storage] Failed to upload audio:`, error);
    throw error;
  }
}

export async function deleteAudioFromStorage(
  userId: string,
  jobId: string
): Promise<void> {
  try {
    const storageBucket = getStorageBucket();
    const prefix = `audio/${userId}/${jobId}/`;
    await storageBucket.deleteFiles({ prefix });
    console.log(`[Firebase Storage] Deleted files with prefix: ${prefix}`);
  } catch (error) {
    console.error(`[Firebase Storage] Failed to delete audio:`, error);
    // Don't throw - this is cleanup, so we log but continue
  }
}
