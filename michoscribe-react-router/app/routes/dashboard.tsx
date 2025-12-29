import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "~/hooks/useAuth";
import { useTheme } from "~/context/ThemeContext";
import { useTranscription } from "~/hooks/useTranscription";
import AudioUploader from "~/components/AudioUploader";
import TranscriptionList from "~/components/TranscriptionList";
import TranscriptionDetail from "~/components/TranscriptionDetail";
import ChatPanel from "~/components/ChatPanel";
import { seekAudio } from "~/components/AudioPlayer";
import type { ChatSource } from "~/hooks/useChat";
import type { Route } from "./+types/dashboard";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "MichoScribe - Dashboard" },
    { name: "description", content: "Your transcription dashboard" },
  ];
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
      />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
      />
    </svg>
  );
}

function MicrophoneIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
      />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
      />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
      />
    </svg>
  );
}

export default function Dashboard() {
  const { user, logout, isAuthenticated } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const hasLoggedOut = useRef(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    jobs,
    isLoading: isLoadingJobs,
    error: transcriptionError,
    uploadAudio,
    deleteJob,
    uploadProgress,
    isUploading,
    lifetimeCount,
  } = useTranscription();

  // Navigate to login when user becomes null after logout
  useEffect(() => {
    if (hasLoggedOut.current && !isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Auto-select first job when jobs load
  useEffect(() => {
    if (jobs.length > 0 && !selectedJobId) {
      setSelectedJobId(jobs[0].id);
    }
  }, [jobs, selectedJobId]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    hasLoggedOut.current = true;
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
      navigate("/login", { replace: true });
    }
  };

  const handleUpload = async (file: File, options?: { targetLanguage?: string; enableDiarization?: boolean }) => {
    try {
      const jobId = await uploadAudio(file, options);
      setSelectedJobId(jobId);
    } catch (error) {
      console.error("Upload error:", error);
    }
  };

  // Handle click on chat source - navigate to job and seek to chunk
  const handleChatSourceClick = useCallback((source: ChatSource) => {
    // Select the job
    setSelectedJobId(source.jobId);
    // Seek to the chunk's start time
    setTimeout(() => {
      seekAudio(source.startTime);
    }, 100);
  }, []);

  const handleDelete = async (jobId: string) => {
    setIsDeleting(true);
    try {
      await deleteJob(jobId);
      if (selectedJobId === jobId) {
        setSelectedJobId(jobs.length > 1 ? jobs.find((j) => j.id !== jobId)?.id || null : null);
      }
    } catch (error) {
      console.error("Delete error:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedJob = jobs.find((j) => j.id === selectedJobId) || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Navigation */}
      <nav className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg shadow-sm sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <img
                src="https://res.cloudinary.com/dao7jyvnn/image/upload/v1766881077/hackaton/transparent_black-Photoroom_qqyfyk.png"
                alt="MichoScribe"
                className="w-16 h-16 rounded-xl object-cover dark:hidden"
              />
              <img
                src="https://res.cloudinary.com/dao7jyvnn/image/upload/v1766881959/hackaton/michologosquare-Photoroom_aawg4l.png"
                alt="MichoScribe"
                className="w-16 h-16 rounded-xl object-cover hidden dark:block"
              />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                MichoScribe
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={toggleTheme}
                className="p-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
                title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {resolvedTheme === "dark" ? (
                  <SunIcon className="w-5 h-5" />
                ) : (
                  <MoonIcon className="w-5 h-5" />
                )}
              </button>
              <Link
                to="/profile"
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
              >
                <UserIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Profile</span>
              </Link>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-rose-500 rounded-xl hover:from-red-600 hover:to-rose-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 shadow-lg shadow-red-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingOut ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="hidden sm:inline">Logging out...</span>
                  </>
                ) : (
                  <>
                    <LogoutIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Logout</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-screen-2xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Demo Banner */}
        <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="px-2 py-1 bg-amber-500 text-white text-xs font-bold rounded">DEMO</span>
            <p className="text-amber-800 dark:text-amber-200 text-sm">
              This is a demo product with a limit of <strong>5 transcriptions</strong> per user.
              You have used <strong>{lifetimeCount}/5</strong>.
            </p>
          </div>
        </div>

        {/* Welcome Banner */}
        {(() => {
          const totalMinutes = Math.round(jobs.reduce((acc, job) => acc + job.duration, 0) / 60);
          const completedCount = jobs.filter(j => j.status === "completed").length;
          return (
            <div className="bg-gradient-to-r from-gray-700 to-gray-900 rounded-2xl shadow-lg p-4 mb-6 text-white">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">
                    Welcome{user?.isAnonymous ? ", Guest" : ""}!
                  </h2>
                  <p className="text-sm text-white/70">
                    Upload audio and get AI-powered transcriptions.
                  </p>
                </div>
                <div className="flex gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{jobs.length}</p>
                    <p className="text-xs text-white/60">Transcriptions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{totalMinutes}</p>
                    <p className="text-xs text-white/60">Minutes</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{completedCount}</p>
                    <p className="text-xs text-white/60">Completed</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Error Display */}
        {transcriptionError && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl">
            {transcriptionError}
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column - Upload + List */}
          <div className="lg:col-span-4 space-y-6">
            <AudioUploader
              onUpload={handleUpload}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              transcriptionCount={lifetimeCount}
            />
            <TranscriptionList
              jobs={jobs}
              selectedJobId={selectedJobId}
              onSelectJob={setSelectedJobId}
              isLoading={isLoadingJobs}
            />
          </div>

          {/* Right Column - Detail View */}
          <div className="lg:col-span-8">
            <TranscriptionDetail
              job={selectedJob}
              onDelete={handleDelete}
              isDeleting={isDeleting}
            />
          </div>
        </div>
      </main>

      {/* Chat Panel */}
      <ChatPanel
        selectedJobId={selectedJobId || undefined}
        selectedJobEmbeddingStatus={selectedJob?.embeddingStatus}
        onSourceClick={handleChatSourceClick}
        isProcessing={selectedJob?.status === "processing" || selectedJob?.status === "pending"}
        completedChunks={selectedJob?.completedChunks || 0}
        totalChunks={selectedJob?.totalChunks || 0}
      />
    </div>
  );
}
