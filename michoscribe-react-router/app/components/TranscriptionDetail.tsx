import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import type { TranscriptionJob, TranscriptionChunk, SummaryKeyPoint, SummaryTopic } from "~/hooks/useTranscription";
import { SUPPORTED_LANGUAGES } from "~/hooks/useTranscription";
import AudioPlayer, { seekAudio } from "./AudioPlayer";
import { exportTranscription, type ExportFormat } from "~/utils/exportFormats";

interface TranscriptionDetailProps {
  job: TranscriptionJob | null;
  onDelete: (jobId: string) => Promise<void>;
  isDeleting?: boolean;
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
  );
}

function DocumentTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Parse timestamp like "2:30" or "12:45" to seconds
function parseTimestamp(timestamp: string): number | null {
  const match = timestamp.match(/^(\d+):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

function XMarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

export default function TranscriptionDetail({ job, onDelete, isDeleting }: TranscriptionDetailProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<"chunks" | "full">("chunks");
  const [languageMode, setLanguageMode] = useState<"original" | "translated">("original");
  const [displayMode, setDisplayMode] = useState<"tabs" | "side-by-side">("tabs");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const chunkRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-enable side-by-side mode when processing with translation
  useEffect(() => {
    if (job?.targetLanguage && job?.status === "processing") {
      setDisplayMode("side-by-side");
    }
  }, [job?.targetLanguage, job?.status]);

  // Combine chunk texts in order
  const fullText = useMemo(() => {
    if (!job?.chunks) return "";

    const chunks = Object.values(job.chunks) as TranscriptionChunk[];
    return chunks
      .sort((a, b) => a.index - b.index)
      .map((chunk) => chunk.text || "")
      .filter(Boolean)
      .join(" ");
  }, [job?.chunks]);

  // Combine translated chunk texts in order
  const fullTranslatedText = useMemo(() => {
    if (!job?.chunks || !job?.targetLanguage) return "";

    const chunks = Object.values(job.chunks) as TranscriptionChunk[];
    return chunks
      .sort((a, b) => a.index - b.index)
      .map((chunk) => chunk.translatedText || "")
      .filter(Boolean)
      .join(" ");
  }, [job?.chunks, job?.targetLanguage]);

  // Get target language name
  const targetLanguageName = useMemo(() => {
    if (!job?.targetLanguage) return null;
    return SUPPORTED_LANGUAGES.find((l) => l.code === job.targetLanguage)?.name || job.targetLanguage;
  }, [job?.targetLanguage]);

  // Get sorted chunks for display
  const sortedChunks = useMemo(() => {
    if (!job?.chunks) return [];

    return (Object.values(job.chunks) as TranscriptionChunk[]).sort(
      (a, b) => a.index - b.index
    );
  }, [job?.chunks]);

  // Filter chunks based on search query
  const filteredChunks = useMemo(() => {
    if (!searchQuery.trim()) return sortedChunks;

    const query = searchQuery.toLowerCase();
    return sortedChunks.filter((chunk) => {
      // Only search in completed chunks
      if (chunk.status !== "done") return false;
      const text = languageMode === "translated" && chunk.translatedText
        ? chunk.translatedText
        : chunk.text;
      return text?.toLowerCase().includes(query);
    });
  }, [sortedChunks, searchQuery, languageMode]);

  // Check if we have any completed chunks for partial features
  const hasCompletedChunks = useMemo(() => {
    return sortedChunks.some(chunk => chunk.status === "done" && chunk.text);
  }, [sortedChunks]);

  // Find current chunk based on audio time
  const currentChunkIndex = useMemo(() => {
    if (!sortedChunks.length) return -1;
    return sortedChunks.findIndex(
      (chunk) => currentTime >= chunk.startTime && currentTime < chunk.endTime
    );
  }, [sortedChunks, currentTime]);

  // Auto-scroll to current chunk when playing
  useEffect(() => {
    if (!isPlaying || currentChunkIndex < 0 || viewMode !== "chunks") return;

    const currentChunk = sortedChunks[currentChunkIndex];
    if (!currentChunk) return;

    const element = chunkRefs.current.get(currentChunk.id);
    if (element && containerRef.current) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentChunkIndex, isPlaying, sortedChunks, viewMode]);

  // Handle chunk click to seek
  const handleChunkClick = useCallback((chunk: TranscriptionChunk) => {
    seekAudio(chunk.startTime);
    setCurrentTime(chunk.startTime);
  }, []);

  // Set chunk ref
  const setChunkRef = useCallback((id: string, element: HTMLDivElement | null) => {
    if (element) {
      chunkRefs.current.set(id, element);
    } else {
      chunkRefs.current.delete(id);
    }
  }, []);

  const handleCopy = async () => {
    // Use full text if available, otherwise build from completed chunks
    let textToCopy = languageMode === "translated" && fullTranslatedText
      ? fullTranslatedText
      : fullText;

    // If no full text but we have completed chunks, build partial text
    if (!textToCopy && hasCompletedChunks) {
      textToCopy = sortedChunks
        .filter(chunk => chunk.status === "done" && chunk.text)
        .map(chunk => languageMode === "translated" && chunk.translatedText ? chunk.translatedText : chunk.text)
        .filter(Boolean)
        .join(" ");
    }

    if (textToCopy) {
      await navigator.clipboard.writeText(textToCopy);
      // Could add toast notification here
    }
  };

  const handleExport = (format: ExportFormat) => {
    if (!job) return;
    const isTranslated = languageMode === "translated" && !!fullTranslatedText;

    // For partial exports, modify the job filename to indicate partial
    const exportJob = isProcessing
      ? { ...job, fileName: `${job.fileName.replace(/\.[^.]+$/, "")}_${job.completedChunks}of${job.totalChunks}_partial` }
      : job;

    exportTranscription(exportJob, format, isTranslated);
    setShowExportMenu(false);
  };

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDelete = async () => {
    if (!job) return;

    if (window.confirm("Are you sure you want to delete this transcription?")) {
      await onDelete(job.id);
    }
  };

  if (!job) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
            <DocumentTextIcon className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 dark:text-gray-400">Select a transcription to view details</p>
        </div>
      </div>
    );
  }

  const isProcessing = job.status === "processing" || job.status === "pending";
  const isCompleted = job.status === "completed";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white truncate max-w-xs">
              {job.fileName}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatTime(job.duration)} • {job.totalChunks} chunks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            disabled={!hasCompletedChunks && !fullText}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={hasCompletedChunks && !fullText ? "Copy partial transcript" : "Copy to clipboard"}
          >
            <ClipboardIcon className="w-5 h-5" />
          </button>
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={!hasCompletedChunks && !fullText}
              className="flex items-center gap-1 px-2 py-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={isProcessing && hasCompletedChunks ? "Export partial transcription" : "Export transcription"}
            >
              <DownloadIcon className="w-5 h-5" />
              <ChevronDownIcon className="w-3 h-3" />
              {isProcessing && hasCompletedChunks && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full" />
              )}
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                {/* Partial warning */}
                {isProcessing && hasCompletedChunks && (
                  <div className="px-3 py-2 text-xs text-amber-600 dark:text-amber-400 border-b border-gray-200 dark:border-gray-700 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                    </svg>
                    Partial ({job.completedChunks}/{job.totalChunks})
                  </div>
                )}
                <button
                  onClick={() => handleExport("text")}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <span className="w-8 text-xs font-mono text-gray-400">.txt</span>
                  Plain Text
                </button>
                <button
                  onClick={() => handleExport("srt")}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <span className="w-8 text-xs font-mono text-gray-400">.srt</span>
                  Subtitles (SRT)
                </button>
                <button
                  onClick={() => handleExport("pdf")}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <span className="w-8 text-xs font-mono text-gray-400">.pdf</span>
                  PDF Document
                </button>
                <button
                  onClick={() => handleExport("markdown")}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <span className="w-8 text-xs font-mono text-gray-400">.md</span>
                  Markdown
                </button>
              </div>
            )}
          </div>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
            title="Delete transcription"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Audio Player (available when audioUrl exists - even during processing) */}
      {job.audioUrl && (
        <div className="mb-4">
          <AudioPlayer
            userId={job.userId}
            jobId={job.id}
            duration={job.duration}
            audioUrl={job.audioUrl}
            onTimeUpdate={setCurrentTime}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
          {/* Processing timeline overlay */}
          {isProcessing && (
            <div className="mt-2 relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-green-500 transition-all duration-300"
                style={{ width: `${(job.completedChunks / job.totalChunks) * 100}%` }}
              />
              <div className="absolute inset-0 flex">
                {sortedChunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className={`h-full transition-colors ${
                      chunk.status === "done"
                        ? "bg-green-500/80"
                        : chunk.status === "transcribing"
                        ? "bg-amber-400 animate-pulse"
                        : "bg-gray-300 dark:bg-gray-600"
                    }`}
                    style={{ width: `${100 / job.totalChunks}%` }}
                    title={`Chunk ${chunk.index + 1}: ${chunk.status}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Language Tabs and Display Mode (when translation is available) */}
      {job.targetLanguage && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <GlobeIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Language</span>
              {job.translationStatus && job.translationStatus !== "done" && (
                <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                  <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Translating... {job.translatedChunks}/{job.totalChunks}
                </span>
              )}
            </div>
            {/* Display Mode Toggle - Side by Side or Tabs */}
            <div className="flex gap-1 p-0.5 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
              <button
                onClick={() => setDisplayMode("tabs")}
                className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                  displayMode === "tabs"
                    ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
                title="Toggle between languages"
              >
                Tabs
              </button>
              <button
                onClick={() => setDisplayMode("side-by-side")}
                className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                  displayMode === "side-by-side"
                    ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
                title="Show both languages side by side"
              >
                Side by Side
              </button>
            </div>
          </div>
          {/* Language selector (only in tabs mode) */}
          {displayMode === "tabs" && (
            <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-700/50 rounded-xl">
              <button
                onClick={() => setLanguageMode("original")}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  languageMode === "original"
                    ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                Original
              </button>
              <button
                onClick={() => setLanguageMode("translated")}
                disabled={!fullTranslatedText}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  languageMode === "translated"
                    ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                } ${!fullTranslatedText ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {targetLanguageName}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Search and View Mode Toggle */}
      {(hasCompletedChunks || fullText) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-xs">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search transcript..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-gray-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* View Mode Toggle (only for completed) */}
          {isCompleted && fullText && (
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("chunks")}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  viewMode === "chunks"
                    ? "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                    : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                Chunks View
              </button>
              <button
                onClick={() => setViewMode("full")}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  viewMode === "full"
                    ? "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                    : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                Full Text
              </button>
            </div>
          )}

          {/* Search Results Count */}
          {searchQuery && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {filteredChunks.length} result{filteredChunks.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Enhanced Summary Section (if available) */}
      {job.summary && (() => {
        // Handle click on timestamp to seek audio
        const handleTimestampClick = (timestamp: string) => {
          const seconds = parseTimestamp(timestamp);
          if (seconds !== null) {
            seekAudio(seconds);
            setCurrentTime(seconds);
          }
        };

        // Helper component to render a single summary column
        const renderSummaryContent = (
          summary: string,
          keywords: string[] | null,
          keyPoints: SummaryKeyPoint[] | null,
          topics: SummaryTopic[] | null,
          label?: string
        ) => (
          <div className="space-y-3">
            {label && (
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                {label}
              </div>
            )}
            {/* Summary Text */}
            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {summary}
            </div>

            {/* Key Points */}
            {keyPoints && keyPoints.length > 0 && (
              <div className="pt-2 border-t border-gray-200/50 dark:border-gray-600/50">
                <div className="flex items-center gap-1.5 mb-2">
                  <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
                  </svg>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Key Points</span>
                </div>
                <div className="space-y-2">
                  {keyPoints.map((keyPoint, i) => (
                    <div key={i} className="bg-white/60 dark:bg-gray-800/40 rounded-lg p-2 border border-gray-100 dark:border-gray-700">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                          {keyPoint.point}
                        </p>
                        <button
                          onClick={() => handleTimestampClick(keyPoint.timestamp)}
                          className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-mono bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                          title="Jump to this timestamp"
                        >
                          {keyPoint.timestamp}
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1">
                        {keyPoint.detail}
                      </p>
                      {keyPoint.quote && (
                        <p className="text-[10px] italic text-gray-500 mt-1 pl-2 border-l-2 border-gray-300 dark:border-gray-600">
                          "{keyPoint.quote}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Topics */}
            {topics && topics.length > 0 && (
              <div className="pt-2 border-t border-gray-200/50 dark:border-gray-600/50">
                <div className="flex items-center gap-1.5 mb-2">
                  <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
                  </svg>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Topics</span>
                </div>
                <div className="space-y-1.5">
                  {topics.map((topic, i) => (
                    <div key={i} className="flex items-start gap-2 bg-white/60 dark:bg-gray-800/40 rounded p-1.5 border border-gray-100 dark:border-gray-700">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{topic.name}</p>
                        <p className="text-[10px] text-gray-600 dark:text-gray-400">{topic.description}</p>
                      </div>
                      <span className="text-[10px] font-mono text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                        {topic.timeRange}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Keywords */}
            {keywords && keywords.length > 0 && (
              <div className="pt-2 border-t border-gray-200/50 dark:border-gray-600/50">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                  </svg>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Keywords</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {keywords.map((keyword, i) => (
                    <span key={i} className="px-1.5 py-0.5 text-[10px] bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full border border-gray-200 dark:border-gray-700">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

        // Side-by-side mode for summary when translation is available
        if (job.targetLanguage && displayMode === "side-by-side") {
          return (
            <div className="mb-4 p-4 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800/50 dark:to-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <SparklesIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">AI Summary</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* Original Column */}
                <div className="border-r border-gray-200 dark:border-gray-700 pr-4">
                  {renderSummaryContent(job.summary, job.keywords, job.keyPoints, job.topics, "Original")}
                </div>
                {/* Translated Column */}
                <div className="pl-1">
                  {job.translatedSummary ? (
                    renderSummaryContent(
                      job.translatedSummary,
                      job.translatedKeywords,
                      job.translatedKeyPoints,
                      job.translatedTopics,
                      targetLanguageName || "Translated"
                    )
                  ) : (
                    <div className="text-sm text-gray-400 dark:text-gray-500 italic">
                      Translation pending...
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        }

        // Tabs mode (single column) - use translated content when in translated mode
        const displaySummary = languageMode === "translated" && job.translatedSummary
          ? job.translatedSummary
          : job.summary;
        const displayKeywords = languageMode === "translated" && job.translatedKeywords
          ? job.translatedKeywords
          : job.keywords;
        const displayKeyPoints = languageMode === "translated" && job.translatedKeyPoints
          ? job.translatedKeyPoints
          : job.keyPoints;
        const displayTopics = languageMode === "translated" && job.translatedTopics
          ? job.translatedTopics
          : job.topics;

        return (
          <div className="mb-4 p-4 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800/50 dark:to-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
            {/* Summary Header */}
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                AI Summary {languageMode === "translated" && job.translatedSummary && `(${targetLanguageName})`}
              </span>
            </div>

            {/* Main Summary Text */}
            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {displaySummary}
            </div>

            {/* Key Points Section */}
            {displayKeyPoints && displayKeyPoints.length > 0 && (
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Key Points</span>
                </div>
                <div className="space-y-3">
                  {displayKeyPoints.map((keyPoint, i) => (
                    <div key={i} className="bg-white/60 dark:bg-gray-800/40 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {keyPoint.point}
                        </p>
                        <button
                          onClick={() => handleTimestampClick(keyPoint.timestamp)}
                          className="flex-shrink-0 px-2 py-0.5 text-xs font-mono bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                          title="Jump to this timestamp"
                        >
                          {keyPoint.timestamp}
                        </button>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {keyPoint.detail}
                      </p>
                      {keyPoint.quote && (
                        <p className="text-xs italic text-gray-500 dark:text-gray-500 mt-2 pl-2 border-l-2 border-gray-300 dark:border-gray-600">
                          "{keyPoint.quote}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Topics Section */}
            {displayTopics && displayTopics.length > 0 && (
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Topics Covered</span>
                </div>
                <div className="grid gap-2">
                  {displayTopics.map((topic, i) => (
                    <div key={i} className="flex items-start gap-3 bg-white/60 dark:bg-gray-800/40 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {topic.name}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                          {topic.description}
                        </p>
                      </div>
                      <span className="flex-shrink-0 text-xs font-mono text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                        {topic.timeRange}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Keywords Section */}
            {displayKeywords && displayKeywords.length > 0 && (
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Keywords</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {displayKeywords.map((keyword, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 text-xs bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full border border-gray-200 dark:border-gray-700"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Transcription Content */}
      <div ref={containerRef} className="flex-1 overflow-y-auto">
        {isProcessing ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Transcribing... {job.completedChunks}/{job.totalChunks} chunks
              {job.targetLanguage && job.translatedChunks > 0 && (
                <span className="ml-2">
                  • Translating... {job.translatedChunks}/{job.totalChunks}
                </span>
              )}
            </p>

            {/* Side-by-Side Processing View */}
            {job.targetLanguage && displayMode === "side-by-side" ? (
              <div className="grid grid-cols-2 gap-4">
                {/* Original Column */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide sticky top-0 bg-white dark:bg-gray-800 py-1">
                    Original
                  </h4>
                  {sortedChunks.map((chunk) => (
                    <div
                      key={`orig-${chunk.id}`}
                      className={`p-2.5 rounded-lg text-sm ${
                        chunk.status === "done"
                          ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                          : chunk.status === "transcribing"
                          ? "bg-gray-100 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-600"
                          : "bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          {formatTime(chunk.startTime)}
                        </span>
                        <span className={`text-xs ${
                          chunk.status === "done" ? "text-green-600 dark:text-green-400" :
                          chunk.status === "transcribing" ? "text-gray-600 dark:text-gray-400" : "text-gray-500"
                        }`}>
                          {chunk.status === "transcribing" ? (
                            <span className="inline-flex items-center gap-1">
                              <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            </span>
                          ) : chunk.status === "done" ? "✓" : "⏳"}
                        </span>
                      </div>
                      {chunk.text ? (
                        <p className="text-gray-700 dark:text-gray-300 text-xs">{chunk.text}</p>
                      ) : (
                        <p className="text-gray-400 dark:text-gray-500 text-xs italic">Waiting...</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Translated Column */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide sticky top-0 bg-white dark:bg-gray-800 py-1">
                    {targetLanguageName}
                  </h4>
                  {sortedChunks.map((chunk) => (
                    <div
                      key={`trans-${chunk.id}`}
                      className={`p-2.5 rounded-lg text-sm ${
                        chunk.translatedText
                          ? "bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
                          : chunk.translationStatus === "translating"
                          ? "bg-gray-100 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-600"
                          : "bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          {formatTime(chunk.startTime)}
                        </span>
                        <span className={`text-xs ${
                          chunk.translatedText ? "text-gray-600 dark:text-gray-400" :
                          chunk.translationStatus === "translating" ? "text-gray-600 dark:text-gray-400" : "text-gray-500"
                        }`}>
                          {chunk.translationStatus === "translating" ? (
                            <span className="inline-flex items-center gap-1">
                              <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            </span>
                          ) : chunk.translatedText ? "✓" : chunk.status === "done" ? "⏳" : "—"}
                        </span>
                      </div>
                      {chunk.translatedText ? (
                        <p className="text-gray-700 dark:text-gray-300 text-xs">{chunk.translatedText}</p>
                      ) : chunk.translationStatus === "translating" ? (
                        <p className="text-gray-400 dark:text-gray-500 text-xs italic">Translating...</p>
                      ) : chunk.status === "done" ? (
                        <p className="text-gray-400 dark:text-gray-500 text-xs italic">Pending translation...</p>
                      ) : (
                        <p className="text-gray-400 dark:text-gray-500 text-xs italic">—</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Single Column Processing View */
              sortedChunks.map((chunk) => (
                <div
                  key={chunk.id}
                  className={`p-3 rounded-lg text-sm ${
                    chunk.status === "done"
                      ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                      : chunk.status === "transcribing"
                      ? "bg-gray-100 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-600"
                      : "bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {formatTime(chunk.startTime)} - {formatTime(chunk.endTime)}
                    </span>
                    <span className={`text-xs ${
                      chunk.status === "done"
                        ? "text-green-600 dark:text-green-400"
                        : chunk.status === "transcribing"
                        ? "text-gray-600 dark:text-gray-400"
                        : "text-gray-500"
                    }`}>
                      {chunk.status === "transcribing" && (
                        <span className="inline-flex items-center gap-1">
                          <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Processing
                        </span>
                      )}
                      {chunk.status === "done" && "Done"}
                      {chunk.status === "pending" && "Waiting"}
                    </span>
                  </div>
                  {chunk.text && (
                    <p className="text-gray-700 dark:text-gray-300">{chunk.text}</p>
                  )}
                </div>
              ))
            )}
          </div>
        ) : fullText ? (
          viewMode === "chunks" ? (
            // Chunks view with highlighting - check for side-by-side mode
            job.targetLanguage && displayMode === "side-by-side" ? (
              // Side-by-side completed view
              <div className="grid grid-cols-2 gap-4">
                {/* Original Column */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide sticky top-0 bg-white dark:bg-gray-800 py-1 z-10">
                    Original
                  </h4>
                  {sortedChunks.map((chunk, index) => {
                    const isCurrent = index === currentChunkIndex;
                    return (
                      <div
                        key={`orig-${chunk.id}`}
                        ref={(el) => setChunkRef(chunk.id, el)}
                        onClick={() => handleChunkClick(chunk)}
                        className={`p-2.5 rounded-lg text-sm cursor-pointer transition-all duration-300 ${
                          isCurrent
                            ? "bg-gray-200 dark:bg-gray-700 border-2 border-gray-500 shadow-lg shadow-gray-500/20"
                            : "bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-medium ${
                            isCurrent ? "text-gray-700 dark:text-gray-300" : "text-gray-500 dark:text-gray-400"
                          }`}>
                            {formatTime(chunk.startTime)}
                          </span>
                          {isCurrent && (
                            <span className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" />
                          )}
                        </div>
                        <p className={`text-xs ${isCurrent ? "text-gray-900 dark:text-white font-medium" : "text-gray-700 dark:text-gray-300"}`}>
                          {chunk.text}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Translated Column */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide sticky top-0 bg-white dark:bg-gray-800 py-1 z-10">
                    {targetLanguageName}
                  </h4>
                  {sortedChunks.map((chunk, index) => {
                    const isCurrent = index === currentChunkIndex;
                    return (
                      <div
                        key={`trans-${chunk.id}`}
                        onClick={() => handleChunkClick(chunk)}
                        className={`p-2.5 rounded-lg text-sm cursor-pointer transition-all duration-300 ${
                          isCurrent
                            ? "bg-gray-200 dark:bg-gray-700 border-2 border-gray-500 shadow-lg shadow-gray-500/20"
                            : "bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-medium ${
                            isCurrent ? "text-gray-700 dark:text-gray-300" : "text-gray-500 dark:text-gray-400"
                          }`}>
                            {formatTime(chunk.startTime)}
                          </span>
                          {isCurrent && (
                            <span className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" />
                          )}
                        </div>
                        <p className={`text-xs ${isCurrent ? "text-gray-900 dark:text-white font-medium" : "text-gray-700 dark:text-gray-300"}`}>
                          {chunk.translatedText || <span className="italic text-gray-400">No translation</span>}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              // Single column chunks view (tabs mode)
              <div className="space-y-2">
                {sortedChunks.map((chunk, index) => {
                  const isCurrent = index === currentChunkIndex;
                  return (
                    <div
                      key={chunk.id}
                      ref={(el) => setChunkRef(chunk.id, el)}
                      onClick={() => handleChunkClick(chunk)}
                      className={`p-3 rounded-lg text-sm cursor-pointer transition-all duration-300 ${
                        isCurrent
                          ? "bg-gray-200 dark:bg-gray-700 border-2 border-gray-500 shadow-lg shadow-gray-500/20"
                          : "bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-medium ${
                          isCurrent
                            ? "text-gray-700 dark:text-gray-300"
                            : "text-gray-500 dark:text-gray-400"
                        }`}>
                          {formatTime(chunk.startTime)} - {formatTime(chunk.endTime)}
                        </span>
                        {isCurrent && (
                          <span className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300">
                            <span className="w-2 h-2 bg-gray-600 rounded-full animate-pulse" />
                            Playing
                          </span>
                        )}
                      </div>
                      {/* Show text based on language mode */}
                      {(() => {
                        const displayText = languageMode === "translated" && chunk.translatedText
                          ? chunk.translatedText
                          : chunk.text;
                        const isTranslating = languageMode === "translated" &&
                          !chunk.translatedText &&
                          chunk.translationStatus === "translating";

                        if (isTranslating) {
                          return (
                            <p className="text-gray-400 dark:text-gray-500 italic flex items-center gap-2">
                              <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Translating...
                            </p>
                          );
                        }

                        if (displayText) {
                          return (
                            <p className={`${
                              isCurrent
                                ? "text-gray-900 dark:text-white font-medium"
                                : "text-gray-700 dark:text-gray-300"
                            }`}>
                              {displayText}
                            </p>
                          );
                        }

                        if (languageMode === "translated" && !chunk.translatedText) {
                          return (
                            <p className="text-gray-400 dark:text-gray-500 italic">
                              Translation pending...
                            </p>
                          );
                        }

                        return null;
                      })()}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            // Full text view
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {languageMode === "translated" && fullTranslatedText ? fullTranslatedText : fullText}
              </p>
            </div>
          )
        ) : job.status === "failed" ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <p className="text-red-600 dark:text-red-400 font-medium">Transcription failed</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              There was an error processing this audio file
            </p>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">No transcription available</p>
          </div>
        )}
      </div>
    </div>
  );
}
