import type { TranscriptionJob } from "~/hooks/useTranscription";
import { SUPPORTED_LANGUAGES } from "~/hooks/useTranscription";

interface TranscriptionListProps {
  jobs: TranscriptionJob[];
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
  isLoading: boolean;
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
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

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusInfo(status: string, completedChunks: number, totalChunks: number) {
  switch (status) {
    case "pending":
      return {
        icon: <ClockIcon className="w-4 h-4" />,
        label: "Pending",
        color: "text-amber-500",
        bgColor: "bg-amber-100 dark:bg-amber-900/30",
      };
    case "processing":
      return {
        icon: (
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ),
        label: `${completedChunks}/${totalChunks}`,
        color: "text-gray-600",
        bgColor: "bg-gray-200 dark:bg-gray-700",
      };
    case "completed":
      return {
        icon: <CheckCircleIcon className="w-4 h-4" />,
        label: "Complete",
        color: "text-green-500",
        bgColor: "bg-green-100 dark:bg-green-900/30",
      };
    case "failed":
      return {
        icon: <XCircleIcon className="w-4 h-4" />,
        label: "Failed",
        color: "text-red-500",
        bgColor: "bg-red-100 dark:bg-red-900/30",
      };
    default:
      return {
        icon: <ClockIcon className="w-4 h-4" />,
        label: status,
        color: "text-gray-500",
        bgColor: "bg-gray-100 dark:bg-gray-700",
      };
  }
}

export default function TranscriptionList({
  jobs,
  selectedJobId,
  onSelectJob,
  isLoading,
}: TranscriptionListProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Transcriptions</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Transcriptions</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">{jobs.length} total</p>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
            <DocumentTextIcon className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">No transcriptions yet</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Upload an audio file to get started</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {jobs.map((job) => {
            const statusInfo = getStatusInfo(job.status, job.completedChunks, job.totalChunks);
            const isSelected = job.id === selectedJobId;

            return (
              <button
                key={job.id}
                onClick={() => onSelectJob(job.id)}
                className={`w-full text-left p-4 rounded-xl transition-all duration-200 ${
                  isSelected
                    ? "bg-gray-100 dark:bg-gray-700 border-2 border-gray-500"
                    : "bg-gray-50 dark:bg-gray-700/50 border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {job.fileName}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>{formatDuration(job.duration)}</span>
                      <span>•</span>
                      <span>{formatDate(job.createdAt)}</span>
                      {job.targetLanguage && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                            <GlobeIcon className="w-3 h-3" />
                            {SUPPORTED_LANGUAGES.find(l => l.code === job.targetLanguage)?.name || job.targetLanguage}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${statusInfo.color} ${statusInfo.bgColor}`}>
                    {statusInfo.icon}
                    <span>{statusInfo.label}</span>
                  </div>
                </div>

                {/* Progress bar for processing jobs */}
                {job.status === "processing" && (
                  <div className="mt-3">
                    <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-gray-700 to-gray-900 transition-all duration-300"
                        style={{ width: `${(job.completedChunks / job.totalChunks) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
