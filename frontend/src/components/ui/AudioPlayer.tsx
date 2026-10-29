// src/components/ui/AudioPlayer.tsx
import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface AudioPlayerProps {
  src: string;
  title?: string;
  autoPlay?: boolean;
  className?: string;
  onEnded?: () => void;
}

export function AudioPlayer({
  src,
  title,
  autoPlay = false,
  className,
  onEnded,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setIsLoading(true);
    setHasError(false);
    setCurrentTime(0);
    setIsPlaying(false);

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      onEnded?.();
    };

    const handleError = () => {
      setIsLoading(false);
      setHasError(true);
      setIsPlaying(false);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [src, onEnded]);

  const togglePlay = () => {
    if (!audioRef.current || hasError) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(
        () => setIsPlaying(true),
        () => setHasError(true),
      );
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current || hasError) return;
    const nextTime = Number(e.target.value);
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleReplay = () => {
    if (!audioRef.current || hasError) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().then(
      () => setIsPlaying(true),
      () => setHasError(true),
    );
  };

  const cycleSpeed = () => {
    if (!audioRef.current) return;
    const rates = [0.75, 1.0, 1.25, 1.5];
    const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIndex];
    audioRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMuted = !isMuted;
    audioRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e1526] p-3.5 shadow-card transition-all",
        className,
      )}
    >
      <audio ref={audioRef} src={src} autoPlay={autoPlay} preload="metadata" />

      {title && (
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
          <span className="truncate">{title}</span>
          {hasError && (
            <span className="flex items-center gap-1 text-[11px] text-rose-500 font-semibold">
              <AlertCircle size={12} /> Không thể tải file âm thanh
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          disabled={isLoading || hasError}
          aria-label={isPlaying ? "Tạm dừng" : "Phát âm thanh"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-800 text-white shadow-xs hover:bg-blue-700 active:bg-blue-900 border border-blue-900 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : isPlaying ? (
            <Pause size={15} />
          ) : (
            <Play size={15} className="ml-0.5" />
          )}
        </button>

        {/* Replay */}
        <button
          type="button"
          onClick={handleReplay}
          disabled={hasError}
          title="Phát lại từ đầu"
          aria-label="Phát lại từ đầu"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          <RotateCcw size={14} />
        </button>

        {/* Progress Track & Scrubber */}
        <div className="flex flex-1 flex-col justify-center">
          <div className="relative flex items-center w-full">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              disabled={hasError || duration === 0}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-700 focus:outline-none"
              style={{
                background: `linear-gradient(to right, #1d4ed8 ${progressPercent}%, var(--border-default) ${progressPercent}%)`,
              }}
            />
          </div>
          <div className="flex justify-between items-center text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Speed Multiplier Button */}
        <button
          type="button"
          onClick={cycleSpeed}
          title="Tốc độ phát"
          aria-label={`Tốc độ phát hiện tại ${playbackRate}x`}
          className="px-2 py-1 text-[11px] font-bold font-mono rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
        >
          {playbackRate}x
        </button>

        {/* Mute Button */}
        <button
          type="button"
          onClick={toggleMute}
          title={isMuted ? "Bật âm thanh" : "Tắt tiếng"}
          aria-label={isMuted ? "Bật âm thanh" : "Tắt tiếng"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
      </div>
    </div>
  );
}
