import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';
import { getApp } from 'firebase-admin/app';

let db: Firestore | null = null;

export function getFirestoreDb(): Firestore {
  if (!db) {
    try {
      const app = getApp();
      db = getFirestore(app);
      console.log('[Firestore] Initialized');
    } catch (error) {
      console.error('[Firestore] Failed to initialize:', error);
      throw error;
    }
  }
  return db;
}

// Embedding document interface
export interface EmbeddingDocument {
  userId: string;
  jobId: string;
  chunkId: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
  fileName: string;
  startTime: number;
  endTime: number;
  createdAt: FirebaseFirestore.Timestamp;
}

// Store embedding for a chunk
export async function storeEmbedding(data: Omit<EmbeddingDocument, 'createdAt'>): Promise<string> {
  const firestore = getFirestoreDb();

  const docRef = await firestore.collection('embeddings').add({
    ...data,
    embedding: FieldValue.vector(data.embedding),  // Convert to Firestore Vector type for vector search
    createdAt: FieldValue.serverTimestamp(),
  });

  return docRef.id;
}

// Store multiple embeddings in batch
export async function storeEmbeddingsBatch(
  embeddings: Omit<EmbeddingDocument, 'createdAt'>[]
): Promise<void> {
  const firestore = getFirestoreDb();
  const batch = firestore.batch();

  for (const embedding of embeddings) {
    const docRef = firestore.collection('embeddings').doc();
    batch.set(docRef, {
      ...embedding,
      embedding: FieldValue.vector(embedding.embedding),  // Convert to Firestore Vector type for vector search
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  console.log(`[Firestore] Stored ${embeddings.length} embeddings`);
}

// Vector search for similar embeddings
export async function vectorSearch(
  userId: string,
  queryEmbedding: number[],
  options: {
    jobId?: string;  // If provided, search only within this job
    limit?: number;
  } = {}
): Promise<Array<EmbeddingDocument & { score: number; id: string }>> {
  const firestore = getFirestoreDb();
  const { jobId, limit = 5 } = options;

  console.log(`[Firestore] Vector search - userId: ${userId}, jobId: ${jobId || 'ALL'}, limit: ${limit}`);

  // Build the query
  let query = firestore.collection('embeddings')
    .where('userId', '==', userId);

  if (jobId) {
    query = query.where('jobId', '==', jobId);
  }

  try {
    // Use Firestore's vector search (requires index to be set up)
    const results = await query
      .findNearest('embedding', queryEmbedding, {
        limit,
        distanceMeasure: 'COSINE',
      })
      .get();

    console.log(`[Firestore] Vector search returned ${results.docs.length} results`);

    return results.docs.map((doc) => {
      const data = doc.data() as EmbeddingDocument;
      // Firestore returns distance, convert to similarity score
      // For cosine distance: similarity = 1 - distance
      const distance = (doc as any).distance || 0;
      return {
        ...data,
        id: doc.id,
        score: 1 - distance,
      };
    });
  } catch (error: any) {
    // Check if this is a missing index error
    if (error.code === 9 || error.message?.includes('index')) {
      console.error('[Firestore] Missing vector index. Create it using the gcloud command in the error below:');
      console.error(error.message);

      // Provide guidance based on whether jobId was used
      if (!jobId) {
        console.error('[Firestore] TIP: You need a SECOND index for "All Transcriptions" search (userId + embedding only).');
        console.error('[Firestore] The existing index with userId + jobId + embedding only works when filtering by a specific job.');
      }
    }
    throw error;
  }
}

// Delete embeddings for a job (when job is deleted)
export async function deleteJobEmbeddings(userId: string, jobId: string): Promise<number> {
  const firestore = getFirestoreDb();

  const query = firestore.collection('embeddings')
    .where('userId', '==', userId)
    .where('jobId', '==', jobId);

  const snapshot = await query.get();

  if (snapshot.empty) {
    return 0;
  }

  const batch = firestore.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log(`[Firestore] Deleted ${snapshot.size} embeddings for job ${jobId}`);

  return snapshot.size;
}

// Get all embeddings for a user (for debugging/admin)
export async function getUserEmbeddings(
  userId: string,
  limit: number = 100
): Promise<Array<EmbeddingDocument & { id: string }>> {
  const firestore = getFirestoreDb();

  const snapshot = await firestore.collection('embeddings')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data() as EmbeddingDocument,
  }));
}
