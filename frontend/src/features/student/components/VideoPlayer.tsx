// src/features/student/components/VideoPlayer.tsx
import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { studentApi } from "../api/studentApi";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  CheckCircle2,
  Loader2,
  Settings,
} from "lucide-react";

interface VideoPlayerProps {
  videoId: string;
  streamUrl: string;
  initialSeconds?: number;
  enableProgressSync?: boolean;
}

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

export default function VideoPlayer({
  videoId,
  streamUrl,
  initialSeconds = 0,
  enableProgressSync = true,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const scrubberRef = useRef<HTMLDivElement | null>(null);

  // Video State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [completed, setCompleted] = useState(false);

  // UI Control states
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const hideControlsTimerRef = useRef<number | null>(null);
  const lastSyncRef = useRef<number>(initialSeconds);

  // ==========================================
  // SYNC FOREGROUND & BACKGROUND VIDEO PLAYBACK
  // ==========================================
  const syncVideos = useCallback(
    (action: "play" | "pause" | "seek" | "rate", val?: number) => {
      const main = videoRef.current;
      const bg = bgVideoRef.current;
      if (!main) return;

      if (action === "play") {
        main.play().catch(() => {});
        if (bg) {
          bg.currentTime = main.currentTime;
          bg.play().catch(() => {});
        }
      } else if (action === "pause") {
        main.pause();
        if (bg) bg.pause();
      } else if (action === "seek" && typeof val === "number") {
        main.currentTime = val;
        if (bg) bg.currentTime = val;
      } else if (action === "rate" && typeof val === "number") {
        main.playbackRate = val;
        if (bg) bg.playbackRate = val;
      }
    },
    [],
  );

  // Initial resume position
  useEffect(() => {
    if (videoRef.current && initialSeconds > 0) {
      videoRef.current.currentTime = initialSeconds;
      if (bgVideoRef.current) {
        bgVideoRef.current.currentTime = initialSeconds;
      }
    }
  }, [initialSeconds]);

  // Sync background drift on timeupdate
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    setCurrentTime(curr);

    // Update buffered progress
    if (videoRef.current.buffered.length > 0) {
      const buffEnd =
        videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      setBufferedEnd(buffEnd);
    }

    // Keep background video synced without drift
    if (bgVideoRef.current) {
      const drift = Math.abs(bgVideoRef.current.currentTime - curr);
      if (drift > 0.3) {
        bgVideoRef.current.currentTime = curr;
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration || 0;
    setDuration(dur);
    if (initialSeconds > 0) {
      videoRef.current.currentTime = initialSeconds;
      if (bgVideoRef.current) bgVideoRef.current.currentTime = initialSeconds;
    }
  };

  // ==========================================
  // STUDENT PROGRESS PERSISTENCE (Every 10s)
  // ==========================================
  useEffect(() => {
    if (!enableProgressSync) return;

    const interval = setInterval(async () => {
      if (videoRef.current && !videoRef.current.paused) {
        const current = Math.floor(videoRef.current.currentTime);
        const dur = videoRef.current.duration || 1;
        const isFinished = current >= dur * 0.95;

        if (Math.abs(current - lastSyncRef.current) >= 5 || isFinished) {
          lastSyncRef.current = current;
          try {
            await studentApi.updateVideoProgress(videoId, current, isFinished);
            if (isFinished) setCompleted(true);
          } catch (e) {
            console.error("Không thể cập nhật tiến độ video:", e);
          }
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [videoId, enableProgressSync]);

  // ==========================================
  // PLAY / PAUSE / SEEK CONTROLS
  // ==========================================
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      syncVideos("play");
      setIsPlaying(true);
    } else {
      syncVideos("pause");
      setIsPlaying(false);
    }
    resetHideControlsTimer();
  };

  const seekRelative = (seconds: number) => {
    if (!videoRef.current) return;
    const target = Math.max(
      0,
      Math.min(videoRef.current.currentTime + seconds, duration),
    );
    syncVideos("seek", target);
    setCurrentTime(target);
    resetHideControlsTimer();
  };

  const handleVolumeChange = (newVol: number) => {
    if (!videoRef.current) return;
    const clamped = Math.max(0, Math.min(newVol, 1));
    videoRef.current.volume = clamped;
    setVolume(clamped);
    if (clamped === 0) {
      setIsMuted(true);
      videoRef.current.muted = true;
    } else if (isMuted) {
      setIsMuted(false);
      videoRef.current.muted = false;
    }
    resetHideControlsTimer();
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
      if (volume === 0) {
        setVolume(0.5);
        videoRef.current.volume = 0.5;
      }
    } else {
      videoRef.current.muted = true;
      setIsMuted(true);
    }
    resetHideControlsTimer();
  };

  const changePlaybackSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    syncVideos("rate", speed);
    setIsSpeedMenuOpen(false);
    resetHideControlsTimer();
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen request failed:", err);
    }
    resetHideControlsTimer();
  };

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // ==========================================
  // AUTO-HIDE CONTROLS (Netflix / YouTube style)
  // ==========================================
  const resetHideControlsTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimerRef.current) {
      window.clearTimeout(hideControlsTimerRef.current);
    }
    // Only auto-hide if playing and speed menu is not open
    if (isPlaying && !isSpeedMenuOpen) {
      hideControlsTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, 2500);
    }
  }, [isPlaying, isSpeedMenuOpen]);

  const handleMouseMove = () => {
    resetHideControlsTimer();
  };

  const handleMouseLeave = () => {
    if (isPlaying && !isSpeedMenuOpen) {
      setControlsVisible(false);
    }
  };

  useEffect(() => {
    if (!isPlaying) {
      setControlsVisible(true);
      if (hideControlsTimerRef.current) {
        window.clearTimeout(hideControlsTimerRef.current);
      }
    } else {
      resetHideControlsTimer();
    }
  }, [isPlaying, resetHideControlsTimer]);

  // ==========================================
  // SCRUBBER / SEEK BAR INTERACTION
  // ==========================================
  const calculateScrubPosition = (e: ReactMouseEvent | MouseEvent) => {
    if (!scrubberRef.current || duration <= 0) return 0;
    const rect = scrubberRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
    return pos * duration;
  };

  const handleScrubberMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault();
    setIsScrubbing(true);
    const target = calculateScrubPosition(e);
    syncVideos("seek", target);
    setCurrentTime(target);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const nextTarget = calculateScrubPosition(moveEvent);
      syncVideos("seek", nextTarget);
      setCurrentTime(nextTarget);
    };

    const onMouseUp = () => {
      setIsScrubbing(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleScrubberHover = (e: ReactMouseEvent) => {
    if (!scrubberRef.current || duration <= 0) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
    setHoverPosition(ratio * 100);
    setHoverTime(ratio * duration);
  };

  const handleScrubberLeave = () => {
    setHoverPosition(null);
    setHoverTime(null);
  };

  // ==========================================
  // KEYBOARD SHORTCUTS
  // ==========================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in form inputs
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (
        activeTag === "input" ||
        activeTag === "textarea" ||
        activeTag === "select" ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      // Check if container or child has focus or mouse is over it
      if (!containerRef.current?.contains(document.activeElement)) {
        return;
      }

      switch (e.key) {
        case " ":
        case "k":
        case "K":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekRelative(-10);
          break;
        case "ArrowRight":
          e.preventDefault();
          seekRelative(10);
          break;
        case "ArrowUp":
          e.preventDefault();
          handleVolumeChange(volume + 0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          handleVolumeChange(volume - 0.1);
          break;
        case "m":
        case "M":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, volume, isMuted, duration]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`aspect-video relative w-full rounded-xl overflow-hidden bg-black select-none outline-none group/player shadow-elevated transition-all ${
        !controlsVisible && isPlaying ? "cursor-none" : "cursor-default"
      }`}
    >
      {/* 1. BACKGROUND VIDEO: Fill mờ nền (Pillarbox/Letterbox blurred fill) */}
      <video
        ref={bgVideoRef}
        src={streamUrl}
        muted
        playsInline
        aria-hidden="true"
        tabIndex={-1}
        className="absolute inset-0 w-full h-full object-cover scale-125 blur-3xl opacity-50 pointer-events-none"
      />

      {/* 2. FOREGROUND VIDEO: Video phát chính */}
      <video
        ref={videoRef}
        src={streamUrl}
        playsInline
        controls={false}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCompleted(true);
        }}
        className="relative z-10 w-full h-full object-contain cursor-pointer"
      />

      {/* 3. CENTER PLAY / PAUSE / BUFFERING OVERLAY */}
      <div
        onClick={togglePlay}
        className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
      >
        {isBuffering ? (
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-elevated animate-in zoom-in-75 duration-200">
            <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 animate-spin text-white" />
          </div>
        ) : !isPlaying ? (
          <button
            type="button"
            aria-label="Phát video"
            className="pointer-events-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/60 hover:bg-rose-600/90 text-white backdrop-blur-md border border-white/20 flex items-center justify-center shadow-elevated transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer group"
          >
            <Play className="w-8 h-8 sm:w-9 sm:h-9 fill-white translate-x-1 group-hover:scale-105 transition-transform" />
          </button>
        ) : null}
      </div>

      {/* 4. COMPLETED BADGE (Top right) */}
      {completed && (
        <div className="absolute top-4 right-4 z-30 flex items-center gap-1.5 rounded-full bg-emerald-600/90 px-3.5 py-1.5 text-xs font-bold text-white backdrop-blur-md shadow-lg border border-emerald-400/40 animate-in fade-in duration-300">
          <CheckCircle2 size={15} className="text-emerald-200" />
          <span>Hoàn thành bài học</span>
        </div>
      )}

      {/* 5. NETFLIX / YOUTUBE CUSTOM CONTROLS OVERLAY */}
      <div
        className={`absolute bottom-0 inset-x-0 z-30 pt-16 pb-3 sm:pb-4 px-4 sm:px-6 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-all duration-300 flex flex-col justify-end gap-2.5 ${
          controlsVisible || !isPlaying
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-3 pointer-events-none"
        }`}
      >
        {/* A. SCRUBBER / SEEK BAR */}
        <div
          ref={scrubberRef}
          onMouseDown={handleScrubberMouseDown}
          onMouseMove={handleScrubberHover}
          onMouseLeave={handleScrubberLeave}
          className="relative w-full h-4 flex items-center cursor-pointer group/scrubber select-none"
        >
          {/* Rail Background */}
          <div className="w-full h-1.5 group-hover/scrubber:h-2 bg-white/25 rounded-full overflow-hidden transition-all duration-150 relative">
            {/* Buffered Bar */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-white/40 rounded-full transition-all duration-200"
              style={{ width: `${Math.min(bufferedPercent, 100)}%` }}
            />
            {/* Played Bar */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-rose-600 rounded-full transition-all"
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>

          {/* Scrubber Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-rose-600 border-2 border-white rounded-full shadow-lg scale-0 group-hover/scrubber:scale-100 transition-transform -translate-x-1/2 pointer-events-none"
            style={{ left: `${Math.min(progressPercent, 100)}%` }}
          />

          {/* Hover Time Tooltip */}
          {hoverPosition !== null && hoverTime !== null && (
            <div
              className="absolute -top-8 -translate-x-1/2 px-2 py-0.5 rounded-md bg-black/90 border border-white/10 text-[11px] font-mono font-semibold text-white pointer-events-none shadow-card backdrop-blur-sm"
              style={{ left: `${hoverPosition}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* B. TOOLBAR BUTTONS */}
        <div className="flex items-center justify-between text-white select-none">
          {/* Left Controls: Play, 10s skip, Volume, Timestamp */}
          <div className="flex items-center gap-2 sm:gap-3.5">
            {/* Play / Pause Toggle */}
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? "Tạm dừng" : "Phát"}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-white/15 text-white transition-colors cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-white" />
              ) : (
                <Play className="w-5 h-5 fill-white translate-x-0.5" />
              )}
            </button>

            {/* Rewind 10s */}
            <button
              type="button"
              onClick={() => seekRelative(-10)}
              title="Lùi 10 giây (←)"
              aria-label="Lùi 10 giây"
              className="p-1.5 sm:p-2 rounded-lg hover:bg-white/15 text-white/90 hover:text-white transition-colors cursor-pointer relative group/btn"
            >
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="absolute -bottom-1 -right-0.5 text-[8px] font-extrabold text-white/80 pointer-events-none">
                10
              </span>
            </button>

            {/* Forward 10s */}
            <button
              type="button"
              onClick={() => seekRelative(10)}
              title="Tiến 10 giây (→)"
              aria-label="Tiến 10 giây"
              className="p-1.5 sm:p-2 rounded-lg hover:bg-white/15 text-white/90 hover:text-white transition-colors cursor-pointer relative group/btn"
            >
              <RotateCw className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="absolute -bottom-1 -right-0.5 text-[8px] font-extrabold text-white/80 pointer-events-none">
                10
              </span>
            </button>

            {/* Volume Control with hover-expanding slider */}
            <div className="flex items-center group/volume">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-white/15 text-white/90 hover:text-white transition-colors cursor-pointer"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5 text-rose-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>

              <div className="overflow-hidden transition-all duration-300 w-0 group-hover/volume:w-16 sm:group-hover/volume:w-20 group-hover/volume:ml-1 flex items-center">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-rose-600 focus:outline-none"
                  aria-label="Thanh âm lượng"
                />
              </div>
            </div>

            {/* Timestamp Display */}
            <div className="text-xs sm:text-sm font-medium text-white/90 font-mono tracking-tight ml-1">
              <span>{formatTime(currentTime)}</span>
              <span className="text-white/40 mx-1">/</span>
              <span className="text-white/60">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls: Playback Speed, Fullscreen */}
          <div className="flex items-center gap-1.5 sm:gap-2 relative">
            {/* Playback Speed Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSpeedMenuOpen((prev) => !prev)}
                className="px-2.5 py-1 rounded-lg hover:bg-white/15 text-xs font-bold text-white/90 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                title="Tốc độ phát"
                aria-label="Tốc độ phát"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>{playbackSpeed === 1 ? "1x" : `${playbackSpeed}x`}</span>
              </button>

              {/* Speed Popover */}
              {isSpeedMenuOpen && (
                <div className="absolute bottom-full right-0 mb-2 py-1.5 bg-zinc-900/95 border border-white/15 rounded-xl shadow-elevated backdrop-blur-md min-w-[110px] z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white/40 border-b border-white/10 mb-1">
                    Tốc độ phát
                  </div>
                  {SPEED_OPTIONS.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => changePlaybackSpeed(rate)}
                      className={`w-full px-3 py-1.5 text-left text-xs font-medium flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer ${
                        playbackSpeed === rate
                          ? "text-rose-400 font-bold"
                          : "text-white/80"
                      }`}
                    >
                      <span>{rate === 1 ? "Chuẩn (1.0x)" : `${rate}x`}</span>
                      {playbackSpeed === rate && (
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Thu nhỏ (f)" : "Toàn màn hình (f)"}
              aria-label={isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-white/15 text-white/90 hover:text-white transition-colors cursor-pointer"
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5" />
              ) : (
                <Maximize className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
