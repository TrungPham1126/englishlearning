// src/features/student/components/shadowing/DualWaveformVisualizer.tsx
import { memo, useEffect, useMemo, useRef } from "react";
import { Play, Pause } from "lucide-react";
import { useAudioStore } from "@/store/useAudioStore";
import {
  buildDeterministicNativePeaks,
  usePracticeStore,
} from "@/store/usePracticeStore";

export interface DualWaveformVisualizerProps {
  readonly targetSentence?: string;
  readonly onTogglePlayNative: () => void;
  readonly onTogglePlayLearner: () => void;
}

/**
 * Vùng 3 (Waveform & Player):
 * Hiển thị sóng âm song song (Native Speaker Wave vs Learner Wave).
 *
 * KIẾN TRÚC ZERO RE-RENDER:
 * - Sử dụng `useAudioStore.subscribe(s => s.liveLearnerPeaks, ...)` trực tiếp trong `useEffect`
 *   để vẽ lên HTML5 Canvas ở 60fps.
 * - Tuyệt đối không gây re-render lên component cha hay thanh điều hướng.
 */
export const DualWaveformVisualizer = memo<DualWaveformVisualizerProps>(
  function DualWaveformVisualizer({
    targetSentence,
    onTogglePlayNative,
    onTogglePlayLearner,
  }) {
    const nativeCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const learnerCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const storeNativeStaticPeaks = usePracticeStore((s) => s.nativeStaticPeaks);
    const nativeStaticPeaks = useMemo(
      () =>
        targetSentence
          ? buildDeterministicNativePeaks(targetSentence)
          : storeNativeStaticPeaks,
      [targetSentence, storeNativeStaticPeaks],
    );
    const isPlayingNative = useAudioStore((s) => s.isPlayingNative);
    const isPlayingLearner = useAudioStore((s) => s.isPlayingLearner);
    const recordingState = useAudioStore((s) => s.recordingState);
    const recordedAudioUrl = useAudioStore((s) => s.recordedAudioUrl);

    const renderBarsOnCanvas = (
      canvas: HTMLCanvasElement | null,
      peaks: readonly number[],
      progressRatio: number,
      activeHex: string,
      inactiveHex: string,
    ) => {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const count = peaks.length;
      const gap = 3;
      const barWidth = Math.max(2, (width - gap * (count - 1)) / count);

      for (let i = 0; i < count; i++) {
        const val = peaks[i] ?? 0.06;
        const barHeight = Math.max(4, val * (height - 6));
        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;

        ctx.fillStyle = i / count <= progressRatio ? activeHex : inactiveHex;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2.5);
        ctx.fill();
      }
    };

    // Vẽ và cập nhật tiến trình sóng âm bản xứ (Native Speaker)
    useEffect(() => {
      const activeColor = "#4f46e5"; // Indigo-600
      const inactiveColor = "#94a3b8"; // Slate-400

      renderBarsOnCanvas(
        nativeCanvasRef.current,
        nativeStaticPeaks,
        useAudioStore.getState().nativeProgress,
        activeColor,
        inactiveColor,
      );

      const unsubNative = useAudioStore.subscribe(
        (state) => state.nativeProgress,
        (progress) => {
          renderBarsOnCanvas(
            nativeCanvasRef.current,
            nativeStaticPeaks,
            progress,
            activeColor,
            inactiveColor,
          );
        },
      );

      return () => unsubNative();
    }, [nativeStaticPeaks]);

    // Vẽ và cập nhật sóng âm học viên trực tiếp ở 60fps qua Zustand subscription
    useEffect(() => {
      const liveColor = "#10b981"; // Emerald-500
      const recordedColor = "#059669"; // Emerald-600
      const idleColor = "#94a3b8"; // Slate-400

      renderBarsOnCanvas(
        learnerCanvasRef.current,
        useAudioStore.getState().liveLearnerPeaks,
        useAudioStore.getState().learnerProgress,
        liveColor,
        idleColor,
      );

      const unsubPeaks = useAudioStore.subscribe(
        (state) => state.liveLearnerPeaks,
        (peaks) => {
          const isRec = useAudioStore.getState().recordingState === "recording";
          renderBarsOnCanvas(
            learnerCanvasRef.current,
            peaks,
            isRec ? 1 : useAudioStore.getState().learnerProgress,
            isRec ? liveColor : recordedColor,
            idleColor,
          );
        },
      );

      const unsubLearnerProgress = useAudioStore.subscribe(
        (state) => state.learnerProgress,
        (progress) => {
          renderBarsOnCanvas(
            learnerCanvasRef.current,
            useAudioStore.getState().liveLearnerPeaks,
            progress,
            recordedColor,
            idleColor,
          );
        },
      );

      return () => {
        unsubPeaks();
        unsubLearnerProgress();
      };
    }, []);

    return (
      <section
        aria-label="Khung hiển thị sóng âm song song giữa người bản xứ và người học"
        className="w-full grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {/* Sóng âm người bản xứ (Native Speaker Wave) */}
        <div className="flex flex-col gap-2.5 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onTogglePlayNative}
                aria-label={
                  isPlayingNative
                    ? "Tạm dừng âm thanh mẫu"
                    : "Phát âm thanh mẫu bản xứ"
                }
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-800 hover:bg-blue-600 text-white transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                {isPlayingNative ? (
                  <Pause className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                )}
              </button>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 block">
                  Native Speaker Wave
                </span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Sóng âm chuẩn bản xứ
                </span>
              </div>
            </div>

            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-600/15 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-600/30">
              {isPlayingNative ? "Đang phát..." : "16kHz Neural"}
            </span>
          </div>

          <canvas
            ref={nativeCanvasRef}
            width={440}
            height={60}
            role="img"
            aria-label="Biểu đồ sóng âm của giọng mẫu bản xứ"
            className="w-full h-14"
          />
        </div>

        {/* Sóng âm học viên (Learner Real-time Wave) */}
        <div className="flex flex-col gap-2.5 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onTogglePlayLearner}
                disabled={!recordedAudioUrl || recordingState === "recording"}
                aria-label={
                  isPlayingLearner
                    ? "Tạm dừng bản ghi âm của bạn"
                    : "Nghe lại bản ghi âm của bạn"
                }
                className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                  !recordedAudioUrl || recordingState === "recording"
                    ? "bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                }`}
              >
                {isPlayingLearner ? (
                  <Pause className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                )}
              </button>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 block">
                  Learner Wave (Bạn)
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {recordingState === "recording"
                    ? "Đang thu trực tiếp 60 FPS"
                    : recordedAudioUrl
                      ? "Đã lưu bản thu âm"
                      : "Chờ tín hiệu Micro"}
                </span>
              </div>
            </div>

            <span
              aria-live="polite"
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                recordingState === "recording"
                  ? "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30 animate-pulse"
                  : "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
              }`}
            >
              {recordingState === "recording" ? "● LIVE" : "PCM Stream"}
            </span>
          </div>

          <canvas
            ref={learnerCanvasRef}
            width={440}
            height={60}
            role="img"
            aria-label="Biểu đồ sóng âm giọng đọc của bạn"
            className="w-full h-14"
          />
        </div>
      </section>
    );
  },
);
