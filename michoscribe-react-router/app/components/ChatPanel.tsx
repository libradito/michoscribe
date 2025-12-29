import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { useChat, type ChatMessage, type ChatSource } from "~/hooks/useChat";
import type { EmbeddingStatus } from "~/hooks/useTranscription";

interface ChatPanelProps {
  selectedJobId?: string;  // If provided, scope to single job
  selectedJobEmbeddingStatus?: EmbeddingStatus | null;  // Embedding status of selected job
  onSourceClick?: (source: ChatSource) => void;
  // For partial results during processing
  isProcessing?: boolean;
  completedChunks?: number;
  totalChunks?: number;
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
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

function PaperAirplaneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function SourceCard({ source, onClick }: { source: ChatSource; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-full"
    >
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
        <DocumentIcon className="w-3 h-3" />
        <span className="truncate flex-1">{source.fileName}</span>
        <span>{formatTime(source.startTime)}</span>
      </div>
      <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">
        {source.text}
      </p>
    </button>
  );
}

function MessageBubble({
  message,
  onSourceClick,
}: {
  message: ChatMessage;
  onSourceClick?: (source: ChatSource) => void;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2 ${
          isUser
            ? "bg-gray-700 text-white"
            : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Sources ({message.sources.length})
            </p>
            {message.sources.slice(0, 3).map((source, index) => (
              <SourceCard
                key={`${source.chunkId}-${index}`}
                source={source}
                onClick={() => onSourceClick?.(source)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPanel({
  selectedJobId,
  selectedJobEmbeddingStatus,
  onSourceClick,
  isProcessing = false,
  completedChunks = 0,
  totalChunks = 0,
}: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [searchScope, setSearchScope] = useState<"job" | "all">("job");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { messages, isLoading, sendMessage, clearMessages } = useChat();

  // Allow chat when:
  // 1. Searching all transcriptions, OR
  // 2. Job is completed with embeddings, OR
  // 3. Job is processing but has at least 1 completed chunk (embeddings are created per-chunk)
  const hasPartialContent = isProcessing && completedChunks > 0;
  const isChatReady = searchScope === "all" ||
    selectedJobEmbeddingStatus === "completed" ||
    hasPartialContent;

  const embeddingStatusMessage = hasPartialContent
    ? null // No blocking message when we have partial content
    : selectedJobEmbeddingStatus === "processing"
    ? "Preparing chat... (generating embeddings)"
    : selectedJobEmbeddingStatus === "pending" || selectedJobEmbeddingStatus === null
    ? "Chat will be available once transcription starts"
    : selectedJobEmbeddingStatus === "failed"
    ? "Failed to prepare chat for this transcription"
    : null;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      const jobId = searchScope === "job" ? selectedJobId : undefined;
      sendMessage(input.trim(), jobId);
      setInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Floating button (collapsed state)
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-gray-700 to-gray-900 rounded-full shadow-lg shadow-gray-500/30 flex items-center justify-center hover:scale-105 transition-transform z-50"
        title="Chat with your transcriptions"
      >
        <ChatIcon className="w-6 h-6 text-white" />
      </button>
    );
  }

  // Expanded chat panel
  return (
    <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-700 to-gray-900">
        <div className="flex items-center gap-2">
          <ChatIcon className="w-5 h-5 text-white" />
          <h3 className="font-bold text-white">Chat</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearMessages}
            className="text-white/70 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-white/70 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Partial Results Disclaimer */}
      {hasPartialContent && searchScope === "job" && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
            <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <span>
              Chatting with <strong>{completedChunks}/{totalChunks}</strong> chunks. Results may be incomplete.
            </span>
          </div>
        </div>
      )}

      {/* Scope Toggle */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
          <button
            onClick={() => setSearchScope("job")}
            disabled={!selectedJobId}
            className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-all ${
              searchScope === "job"
                ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400"
            } ${!selectedJobId ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            This Transcription
          </button>
          <button
            onClick={() => setSearchScope("all")}
            className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-all ${
              searchScope === "all"
                ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            All Transcriptions
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <ChatIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
            {searchScope === "job" && !isChatReady && embeddingStatusMessage ? (
              <>
                <p className="text-amber-600 dark:text-amber-400 text-sm font-medium">
                  {embeddingStatusMessage}
                </p>
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-2">
                  Switch to "All Transcriptions" to search other completed jobs
                </p>
              </>
            ) : (
              <>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Ask questions about your transcriptions
                </p>
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                  {selectedJobId
                    ? "Searching within the selected transcription"
                    : "Searching across all your transcriptions"}
                </p>
              </>
            )}
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onSourceClick={onSourceClick}
            />
          ))
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isChatReady ? "Ask a question..." : "Chat not available yet..."}
            disabled={!isChatReady}
            rows={1}
            className="flex-1 resize-none px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-gray-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ maxHeight: "100px" }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || !isChatReady}
            className="p-2 bg-gray-700 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
