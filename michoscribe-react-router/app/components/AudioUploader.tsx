import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { SUPPORTED_LANGUAGES, type LanguageCode } from "~/hooks/useTranscription";

export type SttModel = "chirp_2" | "chirp_3";

export const STT_MODELS = [
  { value: "chirp_2" as const, name: "Chirp 2 (Faster)", description: "Faster, good for most audio" },
  { value: "chirp_3" as const, name: "Chirp 3 (Newer)", description: "Latest model, better for complex audio" },
] as const;

export type SourceLanguage = LanguageCode | "auto";

interface UploadOptions {
  targetLanguage?: LanguageCode;
  sttModel?: SttModel;
  sourceLanguage?: SourceLanguage;
}

const MAX_TRANSCRIPTIONS = 5;

interface AudioUploaderProps {
  onUpload: (file: File, options?: UploadOptions) => Promise<void>;
  isUploading: boolean;
  uploadProgress: { percent: number } | null;
  transcriptionCount: number;
}

function MicrophoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

const ALLOWED_TYPES = ["audio/wav", "audio/mpeg", "audio/mp3", "audio/webm", "audio/x-wav"];
const MAX_DURATION_MINUTES = 5;
const MAX_SIZE_MB = 100;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  );
}

function CpuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z" />
    </svg>
  );
}

export default function AudioUploader({ onUpload, isUploading, uploadProgress, transcriptionCount }: AudioUploaderProps) {
  const isLimitReached = transcriptionCount >= MAX_TRANSCRIPTIONS;
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode | "">("");
  const [sttModel, setSttModel] = useState<SttModel>("chirp_2");
  const [sourceLanguage, setSourceLanguage] = useState<SourceLanguage>("auto");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = async (file: File): Promise<boolean> => {
    setError(null);

    // Check file type
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(wav|mp3|webm)$/i)) {
      setError("Invalid file type. Please upload WAV, MP3, or WebM audio.");
      return false;
    }

    // Check file size
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File too large. Maximum size is ${MAX_SIZE_MB}MB.`);
      return false;
    }

    // Check duration
    const duration = await getAudioDuration(file);
    if (duration > MAX_DURATION_MINUTES * 60) {
      setError(`Audio too long. Maximum duration is ${MAX_DURATION_MINUTES} minutes.`);
      return false;
    }

    setAudioDuration(duration);
    return true;
  };

  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.onloadedmetadata = () => {
        resolve(audio.duration);
        URL.revokeObjectURL(audio.src);
      };
      audio.onerror = () => {
        resolve(0);
        URL.revokeObjectURL(audio.src);
      };
      audio.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = async (file: File) => {
    const isValid = await validateFile(file);
    if (isValid) {
      setSelectedFile(file);
    } else {
      setSelectedFile(null);
      setAudioDuration(null);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      await handleFileSelect(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileSelect(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      await onUpload(selectedFile, {
        targetLanguage: targetLanguage || undefined,
        sttModel,
        sourceLanguage,
      });
      setSelectedFile(null);
      setAudioDuration(null);
      setTargetLanguage("");
      setSttModel("chirp_2");
      setSourceLanguage("auto");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch {
      // Error is handled by parent
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setAudioDuration(null);
    setError(null);
    setTargetLanguage("");
    setSttModel("chirp_2");
    setSourceLanguage("auto");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
          <MicrophoneIcon className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Upload Audio</h3>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Drop Zone */}
      {isLimitReached ? (
        <div className="relative border-2 border-dashed rounded-xl p-8 text-center border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/20">
          <div className="space-y-3">
            <div className="w-16 h-16 mx-auto rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Transcription Limit Reached
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                You've used all {MAX_TRANSCRIPTIONS} transcriptions in this demo.
              </p>
              <p className="text-xs text-amber-500 dark:text-amber-500 mt-2">
                Delete an existing transcription to upload a new one.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? "border-gray-500 bg-gray-100 dark:bg-gray-800/40"
              : "border-gray-300 dark:border-gray-600 hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".wav,.mp3,.webm,audio/wav,audio/mpeg,audio/webm"
            onChange={handleInputChange}
            className="hidden"
          />

          {selectedFile ? (
            <div className="space-y-3">
              <div className="w-16 h-16 mx-auto rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <DocumentIcon className="w-8 h-8 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white truncate max-w-xs mx-auto">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {formatFileSize(selectedFile.size)}
                  {audioDuration !== null && ` • ${formatDuration(audioDuration)}`}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-16 h-16 mx-auto rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <UploadIcon className="w-8 h-8 text-gray-400" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Drop your audio file here
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  or click to browse
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  WAV, MP3, WebM • Max {MAX_DURATION_MINUTES} minutes • Max {MAX_SIZE_MB}MB
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && uploadProgress && (
        <div className="mt-4">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-gray-700 to-gray-900 transition-all duration-300"
              style={{ width: `${uploadProgress.percent}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            Uploading... {uploadProgress.percent}%
          </p>
        </div>
      )}

      {/* Options */}
      {selectedFile && !isUploading && !isLimitReached && (
        <div className="mt-4 space-y-4">
          {/* Language Selector */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <GlobeIcon className="w-4 h-4" />
              Translate to (optional)
            </label>
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value as LanguageCode | "")}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all"
            >
              <option value="">No translation</option>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
            {targetLanguage && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5">
                Original + {SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage)?.name} translation
              </p>
            )}
          </div>

          {/* Source Language Selector */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <MicrophoneIcon className="w-4 h-4" />
              Audio Language
            </label>
            <select
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value as SourceLanguage)}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all"
            >
              <option value="auto">Auto-detect</option>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
              {sourceLanguage === "auto"
                ? "Automatically detect the spoken language"
                : `Transcribe as ${SUPPORTED_LANGUAGES.find(l => l.code === sourceLanguage)?.name}`}
            </p>
          </div>

          {/* Model Selector */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <CpuIcon className="w-4 h-4" />
              Transcription Model
            </label>
            <select
              value={sttModel}
              onChange={(e) => setSttModel(e.target.value as SttModel)}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all"
            >
              {STT_MODELS.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
              {STT_MODELS.find(m => m.value === sttModel)?.description}
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      {selectedFile && !isUploading && !isLimitReached && (
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleClear}
            className="flex-1 py-2.5 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleUpload}
            className="flex-1 py-2.5 px-4 text-sm font-medium text-white bg-gradient-to-r from-gray-700 to-gray-900 rounded-xl hover:from-gray-800 hover:to-gray-950 transition-all shadow-lg shadow-gray-500/25"
          >
            Transcribe
          </button>
        </div>
      )}
    </div>
  );
}
