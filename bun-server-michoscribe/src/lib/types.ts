export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ChunkStatus = 'pending' | 'transcribing' | 'done' | 'failed';
export type TranslationStatus = 'pending' | 'translating' | 'done' | 'failed';

// Supported target languages for translation
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

// STT Model options
export type SttModel = 'chirp_2' | 'chirp_3';

export interface TranscriptionJob {
  id: string;
  userId: string;
  status: JobStatus;
  fileName: string;
  audioPath: string;
  audioUrl: string | null;  // Firebase Storage download URL
  duration: number;
  totalChunks: number;
  completedChunks: number;
  summary: string | null;
  keywords: string[] | null;
  createdAt: number;
  completedAt: number | null;
  // Translation fields
  targetLanguage: LanguageCode | null;
  translationStatus: TranslationStatus | null;
  translatedChunks: number;
  // STT model
  sttModel: SttModel;
  // Source language for transcription (auto = auto-detect)
  sourceLanguage: LanguageCode | 'auto';
}

export interface TranscriptionChunk {
  id: string;
  index: number;
  status: ChunkStatus;
  text: string | null;
  startTime: number;
  endTime: number;
  // Translation fields
  translatedText: string | null;
  translationStatus: TranslationStatus | null;
}

// Kafka Event Payloads
export interface JobCreatedEvent {
  jobId: string;
  userId: string;
  audioPath: string;
  fileName: string;
  duration: number;
  targetLanguage: LanguageCode | null;
  sttModel: SttModel;
  sourceLanguage: LanguageCode | 'auto';
}

export interface ChunkCreatedEvent {
  jobId: string;
  userId: string;
  chunkId: string;
  chunkPath: string;
  index: number;
  totalChunks: number;
  startTime: number;
  endTime: number;
  targetLanguage: LanguageCode | null;
  sttModel: SttModel;
  sourceLanguage: LanguageCode | 'auto';
}

export interface ChunkTranscribedEvent {
  jobId: string;
  userId: string;
  chunkId: string;
  index: number;
  text: string;
  totalChunks: number;
}

export interface ChunkDoneEvent {
  jobId: string;
  userId: string;
  chunkId: string;
  index: number;
  status: 'done' | 'failed';
  error?: string;
}

// Summary analysis types
export interface SummaryKeyPoint {
  point: string;
  detail: string;
  timestamp: string;
  quote?: string;
}

export interface SummaryTopic {
  name: string;
  description: string;
  timeRange: string;
}

export interface JobEnrichedEvent {
  jobId: string;
  userId: string;
  summary: string;
  keywords: string[];
  keyPoints?: SummaryKeyPoint[];
  topics?: SummaryTopic[];
  // Translated summary fields (when targetLanguage is set)
  translatedSummary?: string;
  translatedKeywords?: string[];
  translatedKeyPoints?: SummaryKeyPoint[];
  translatedTopics?: SummaryTopic[];
  targetLanguage?: LanguageCode;
}

// Translation Events
export interface ChunkTranslateEvent {
  jobId: string;
  userId: string;
  chunkId: string;
  index: number;
  text: string;
  targetLanguage: LanguageCode;
  totalChunks: number;
}

export interface ChunkTranslatedEvent {
  jobId: string;
  userId: string;
  chunkId: string;
  index: number;
  translatedText: string;
  totalChunks: number;
}

// Embedding Events
export interface JobCompletedEvent {
  jobId: string;
  userId: string;
  fileName: string;
  totalChunks: number;
}

export interface JobEmbeddedEvent {
  jobId: string;
  userId: string;
  chunkCount: number;
}

// Kafka Topics
export const TOPICS = {
  JOB_CREATED: 'job.created',
  CHUNK_CREATED: 'chunk.created',
  CHUNK_TRANSCRIBED: 'chunk.transcribed',
  CHUNK_DONE: 'chunk.done',
  JOB_ENRICHED: 'job.enriched',
  // Translation topics
  CHUNK_TRANSLATE: 'chunk.translate',
  CHUNK_TRANSLATED: 'chunk.translated',
  // Embedding topics
  JOB_COMPLETED: 'job.completed',
  JOB_EMBEDDED: 'job.embedded',
} as const;
