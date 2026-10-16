// src/features/student/components/VideoPlayer.tsx
import { useEffect, useRef, useState } from "react";
import { studentApi } from "../api/studentApi";
import { PlayCircle, CheckCircle2 } from "lucide-react";

interface VideoPlayerProps {
  videoId: string;
  streamUrl: string;
  initialSeconds?: number;
}

export default function VideoPlayer({
  videoId,
  streamUrl,
  initialSeconds = 0,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [completed, setCompleted] = useState(false);
  const lastSyncRef = useRef<number>(initialSeconds);

  // Resume lại vị trí đã xem dở
  useEffect(() => {
    if (videoRef.current && initialSeconds > 0) {
      videoRef.current.currentTime = initialSeconds;
    }
  }, [initialSeconds]);

  // Lưu tiến độ ngầm mỗi 10s
  useEffect(() => {
    const interval = setInterval(async () => {
      if (videoRef.current && !videoRef.current.paused) {
        const currentTime = Math.floor(videoRef.current.currentTime);
        const duration = videoRef.current.duration || 1;
        const isFinished = currentTime >= duration * 0.95;

        if (Math.abs(currentTime - lastSyncRef.current) >= 5 || isFinished) {
          lastSyncRef.current = currentTime;
          try {
            await studentApi.updateVideoProgress(
              videoId,
              currentTime,
              isFinished,
            );
            if (isFinished) setCompleted(true);
          } catch (e) {
            console.error("Không thể cập nhật tiến độ video:", e);
          }
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [videoId]);

  return (
    <div className="relative overflow-hidden rounded-xl bg-black shadow-lg">
      <video
        ref={videoRef}
        src={streamUrl}
        controls
        playsInline
        className="h-full w-full max-h-[500px] object-contain"
      />
      {completed && (
        <div className="absolute top-4 right-4 flex items-center gap-1.5 rounded-full bg-emerald-600/90 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
          <CheckCircle2 size={14} /> Hoàn thành bài học
        </div>
      )}
    </div>
  );
}
