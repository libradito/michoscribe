import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { subscribeToData, deleteData } from "~/lib/firebase/database";

const API_BASE_URL = import.meta.env.VITE_BUN_SERVER_URL || "http://localhost:3000";

export type JobStatus = "pending" | "processing" | "completed" | "failed";
export type ChunkStatus = "pending" | "transcribing" | "done" | "failed";
export type TranslationStatus = "pending" | "translating" | "done" | "failed";

export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "pt", name: "Portuguese" },
  { code: "it", name: "Italian" },
  { code: "ja", name: "Japanese" },
  { code: "zh", name: "Chinese" },
  { code: "ko", name: "Korean" },
  { code: "ar", name: "Arabic" },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]["code"];

export type SttModel = "chirp_2" | "chirp_3";

export type SourceLanguage = LanguageCode | "auto";

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

export type EmbeddingStatus = "pending" | "processing" | "completed" | "failed";

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

export interface TranscriptionJob {
  id: string;
  userId: string;
  status: JobStatus;
  fileName: string;
  audioUrl?: string | null;
  duration: number;
  totalChunks: number;
  completedChunks: number;
  summary: string | null;
  keywords: string[] | null;
  createdAt: number;
  completedAt: number | null;
  chunks?: Record<string, TranscriptionChunk>;
  // Translation fields
  targetLanguage: LanguageCode | null;
  translationStatus: TranslationStatus | null;
  translatedChunks: number;
  // Translated summary fields
  translatedSummary: string | null;
  translatedKeywords: string[] | null;
  // Enhanced summary analysis
  keyPoints: SummaryKeyPoint[] | null;
  topics: SummaryTopic[] | null;
  // Translated enhanced summary analysis
  translatedKeyPoints: SummaryKeyPoint[] | null;
  translatedTopics: SummaryTopic[] | null;
  // Embedding status for chat
  embeddingStatus: EmbeddingStatus | null;
  // STT model used
  sttModel?: SttModel;
  // Source language for transcription
  sourceLanguage?: SourceLanguage;
}

interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

interface UploadOptions {
  targetLanguage?: LanguageCode;
  sttModel?: SttModel;
  sourceLanguage?: SourceLanguage;
}

interface UserStats {
  totalTranscriptions: number;
  updatedAt?: number;
}

interface UseTranscriptionReturn {
  jobs: TranscriptionJob[];
  isLoading: boolean;
  error: string | null;
  uploadAudio: (file: File, options?: UploadOptions) => Promise<string>;
  deleteJob: (jobId: string) => Promise<void>;
  uploadProgress: UploadProgress | null;
  isUploading: boolean;
  lifetimeCount: number;
}

export function useTranscription(): UseTranscriptionReturn {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<TranscriptionJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [lifetimeCount, setLifetimeCount] = useState(0);

  // Fetch user stats from API (works even if Firebase subscription fails due to rules)
  useEffect(() => {
    if (!user?.uid) {
      setLifetimeCount(0);
      return;
    }

    const fetchUserStats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/transcription/user-stats?userId=${user.uid}`);
        if (response.ok) {
          const data = await response.json();
          console.log(`[useTranscription] User stats from API:`, data);
          setLifetimeCount(data.totalTranscriptions || 0);
        }
      } catch (error) {
        console.error('[useTranscription] Failed to fetch user stats:', error);
      }
    };

    fetchUserStats();
  }, [user?.uid]);

  // Subscribe to user's transcription jobs
  useEffect(() => {
    console.log('[useTranscription] User state:', user ? { uid: user.uid, isAnonymous: user.isAnonymous } : 'null');

    if (!user?.uid) {
      console.log('[useTranscription] No user, clearing jobs');
      setJobs([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    console.log(`[useTranscription] Subscribing to transcriptions/${user.uid}`);

    const unsubscribe = subscribeToData<Record<string, TranscriptionJob>>(
      `transcriptions/${user.uid}`,
      (data) => {
        console.log('[useTranscription] Data received:', data ? Object.keys(data).length + ' jobs' : 'null');
        if (data) {
          // Convert object to array and sort by createdAt descending
          const jobsArray = Object.values(data).sort(
            (a, b) => b.createdAt - a.createdAt
          );
          setJobs(jobsArray);
        } else {
          setJobs([]);
        }
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // Upload audio file
  const uploadAudio = useCallback(
    async (file: File, options?: UploadOptions): Promise<string> => {
      if (!user?.uid) {
        throw new Error("User must be authenticated to upload");
      }

      setIsUploading(true);
      setUploadProgress({ loaded: 0, total: file.size, percent: 0 });
      setError(null);

      try {
        const formData = new FormData();
        formData.append("audio", file);
        formData.append("userId", user.uid);
        if (options?.targetLanguage) {
          formData.append("targetLanguage", options.targetLanguage);
        }
        if (options?.sttModel) {
          formData.append("sttModel", options.sttModel);
        }
        if (options?.sourceLanguage) {
          formData.append("sourceLanguage", options.sourceLanguage);
        }

        const response = await fetch(`${API_BASE_URL}/api/transcription/upload`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Upload failed");
        }

        const result = await response.json();
        setUploadProgress({ loaded: file.size, total: file.size, percent: 100 });

        // Update lifetime count from response (fallback if subscription doesn't work)
        if (result.transcriptionCount !== undefined) {
          setLifetimeCount(result.transcriptionCount);
        }

        return result.jobId;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setError(message);
        throw err;
      } finally {
        setIsUploading(false);
        // Clear progress after a delay
        setTimeout(() => setUploadProgress(null), 1000);
      }
    },
    [user?.uid]
  );

  // Delete a job
  const deleteJob = useCallback(
    async (jobId: string): Promise<void> => {
      if (!user?.uid) {
        throw new Error("User must be authenticated");
      }

      setError(null);

      try {
        // Delete from server (cleans up files)
        const response = await fetch(
          `${API_BASE_URL}/api/transcription/${jobId}?userId=${user.uid}`,
          { method: "DELETE" }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Delete failed");
        }

        // Delete from Firebase
        await deleteData(`transcriptions/${user.uid}/${jobId}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Delete failed";
        setError(message);
        throw err;
      }
    },
    [user?.uid]
  );

  return {
    jobs,
    isLoading,
    error,
    uploadAudio,
    deleteJob,
    uploadProgress,
    isUploading,
    lifetimeCount,
  };
}
