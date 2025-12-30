import { useState, useRef, useEffect, useCallback } from "react";

interface AudioPlayerProps {
  userId: string;
  jobId: string;
  duration: number;
  audioUrl?: string | null;
  onTimeUpdate?: (currentTime: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
}

const API_BASE_URL = import.meta.env.VITE_BUN_SERVER_URL || "http://localhost:3000";

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function VolumeIcon({ className, muted }: { className?: string; muted?: boolean }) {
  if (muted) {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
    </svg>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function AudioPlayer({
  userId,
  jobId,
  duration,
  audioUrl: providedAudioUrl,
  onTimeUpdate,
  onPlay,
  onPause,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Use Firebase Storage URL if available, fallback to Bun server URL
  const audioUrl = providedAudioUrl || `${API_BASE_URL}/api/audio/${userId}/${jobId}/original`;

  // Handle time updates
  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    }
  }, [onTimeUpdate]);

  // Handle play/pause
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      onPause?.();
    } else {
      audioRef.current.play().catch(console.error);
      onPlay?.();
    }
  }, [isPlaying, onPlay, onPause]);

  // Handle seek
  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  // Handle volume change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
    if (vol > 0) setIsMuted(false);
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  // Change playback speed
  const changeSpeed = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
    setShowSpeedMenu(false);
  }, []);

  // Expose seek function to parent
  useEffect(() => {
    // Allow parent to seek via ref if needed
    (window as any).__audioPlayerSeek = (time: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = time;
        setCurrentTime(time);
      }
    };
    return () => {
      delete (window as any).__audioPlayerSeek;
    };
  }, []);

  // Progress bar percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-4 shadow-lg">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onLoadedMetadata={() => setIsLoading(false)}
        onError={() => {
          setError("Failed to load audio");
          setIsLoading(false);
        }}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
      />

      {error ? (
        <div className="text-red-400 text-sm text-center py-2">{error}</div>
      ) : (
        <div className="flex items-center gap-4">
          {/* Play/Pause Button */}
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="w-12 h-12 flex items-center justify-center bg-gradient-to-r from-gray-600 to-gray-800 rounded-full text-white hover:from-gray-500 hover:to-gray-700 transition-all shadow-lg shadow-gray-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : isPlaying ? (
              <PauseIcon className="w-6 h-6" />
            ) : (
              <PlayIcon className="w-6 h-6 ml-0.5" />
            )}
          </button>

          {/* Time and Progress */}
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 font-mono w-12">
                {formatTime(currentTime)}
              </span>

              {/* Custom progress bar */}
              <div className="flex-1 relative h-2 group">
                <div className="absolute inset-0 bg-gray-700 rounded-full" />
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-gray-600 to-gray-800 rounded-full"
                  style={{ width: `${progress}%` }}
                />
                <input
                  type="range"
                  min="0"
                  max={duration}
                  step="0.1"
                  value={currentTime}
                  onChange={handleSeek}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer"
                />
                {/* Hover indicator */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{ left: `calc(${progress}% - 6px)` }}
                />
              </div>

              <span className="text-xs text-gray-400 font-mono w-12 text-right">
                {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* Speed Control */}
          <div className="relative">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="px-2 py-1 text-xs font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
            >
              {playbackSpeed}x
            </button>

            {showSpeedMenu && (
              <div className="absolute bottom-full mb-2 right-0 bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden z-10">
                {PLAYBACK_SPEEDS.map((speed) => (
                  <button
                    key={speed}
                    onClick={() => changeSpeed(speed)}
                    className={`block w-full px-4 py-2 text-sm text-left hover:bg-gray-700 transition-colors ${
                      playbackSpeed === speed
                        ? "text-gray-300 bg-gray-700/50"
                        : "text-gray-300"
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <VolumeIcon className="w-5 h-5" muted={isMuted} />
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-20 h-1 bg-gray-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Export a function to seek from outside
export function seekAudio(time: number) {
  (window as any).__audioPlayerSeek?.(time);
}
