// src/features/student/components/shadowing/ShadowingControlDock.tsx
import { memo } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Award,
  Send,
  Square,
} from "lucide-react";
import { useAudioStore } from "@/store/useAudioStore";
import { usePracticeStore } from "@/store/usePracticeStore";

export interface ShadowingControlDockProps {
  readonly onPlayNative: () => void;
  readonly onToggleRecord: () => void;
  readonly onResetRecord: () => void;
  readonly onSubmitEvaluation: () => void;
}

export const ShadowingControlDock = memo<ShadowingControlDockProps>(
  function ShadowingControlDock({
    onPlayNative,
    onToggleRecord,
    onResetRecord,
    onSubmitEvaluation,
  }) {
    const recordingState = useAudioStore((s) => s.recordingState);
    const isPlayingNative = useAudioStore((s) => s.isPlayingNative);
    const isSynthesizingNative = useAudioStore((s) => s.isSynthesizingNative);
    const recordingSeconds = useAudioStore((s) => s.recordingSeconds);
    const recordingDuration = useAudioStore((s) => s.recordingDuration);
    const recordedAudioUrl = useAudioStore((s) => s.recordedAudioUrl);
    const errorMessage = useAudioStore((s) => s.errorMessage);

    const evaluationResult = usePracticeStore((s) => s.evaluationResult);
    const setFeedbackDrawerOpen = usePracticeStore(
      (s) => s.setFeedbackDrawerOpen,
    );

    const isRecording = recordingState === "recording";
    const isEvaluating = recordingState === "evaluating";

    const formatTimer = (sec: number): string => {
      const mins = Math.floor(sec / 60);
      const secs = sec % 60;
      return `${mins.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    };

    return (
      <section
        aria-label=" Cụm điều khiển thu âm, nghe mẫu và nộp bài"
        className="w-full flex flex-col items-center gap-3 p-3 sm:p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80"
      >
        {/* Cảnh báo lỗi nếu có */}
        {errorMessage && !isEvaluating && (
          <div
            role="alert"
            className="w-full rounded-lg border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/30 p-2.5 text-rose-800 dark:text-rose-200 text-[11px] flex items-start gap-2"
          >
            <AlertCircle
              className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="space-y-0.5">
              <p className="font-bold">Thông báo âm thanh / chấm điểm</p>
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Hàng nút chính: Nghe mẫu (Trái) — Record Pulse (Giữa) — Nộp & Chấm AI (Phải) */}
        <div className="w-full flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          {/* 1. Nút Nghe lại mẫu (Phím tắt R) */}
          <button
            type="button"
            onClick={onPlayNative}
            disabled={isSynthesizingNative || isEvaluating}
            aria-label={
              isPlayingNative
                ? "Dừng phát âm thanh mẫu (Phím tắt R)"
                : "Nghe lại âm thanh mẫu (Phím tắt R)"
            }
            aria-keyshortcuts="r"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-[11px] font-bold shadow-2xs transition cursor-pointer disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            {isSynthesizingNative ? (
              <Loader2
                className="w-3.5 h-3.5 animate-spin text-blue-700 dark:text-blue-400"
                aria-hidden="true"
              />
            ) : isPlayingNative ? (
              <Pause
                className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400"
                aria-hidden="true"
              />
            ) : (
              <Play
                className="w-3.5 h-3.5 fill-blue-600 text-blue-700 dark:fill-blue-400 dark:text-blue-400"
                aria-hidden="true"
              />
            )}
            <span>{isPlayingNative ? "Dừng mẫu" : "Nghe lại mẫu"}</span>
            <kbd className="hidden sm:inline-block px-1 py-0.2 text-[9px] font-mono bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded border border-slate-300 dark:border-slate-600">
              R
            </kbd>
          </button>

          {/* 2. Nút Record To Bản Trung Tâm với hiệu ứng Pulse */}
          <div className="relative flex items-center justify-center">
            {isRecording && (
              <>
                <span
                  aria-hidden="true"
                  className="absolute inline-flex w-14 h-14 rounded-full bg-rose-500/30 animate-ping"
                />
                <span
                  aria-hidden="true"
                  className="absolute inline-flex w-16 h-16 rounded-full bg-rose-500/15 animate-pulse"
                />
              </>
            )}

            <button
              type="button"
              onClick={onToggleRecord}
              disabled={isEvaluating}
              aria-label={
                isRecording
                  ? "Dừng thu âm (Phím tắt Space)"
                  : "Bắt đầu thu âm giọng đọc (Phím tắt Space)"
              }
              aria-pressed={isRecording}
              aria-keyshortcuts="Space"
              className={`relative z-10 h-11 w-11 sm:h-12 sm:w-12 rounded-full flex items-center justify-center shadow-xs transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600 dark:focus-visible:ring-offset-slate-900 ${
                isRecording
                  ? "bg-rose-600 hover:bg-rose-700 text-white scale-105"
                  : recordedAudioUrl
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "bg-blue-800 hover:bg-blue-600 text-white"
              } disabled:opacity-50`}
            >
              {isRecording ? (
                <Square className="h-4 w-4 fill-current" aria-hidden="true" />
              ) : (
                <Mic className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* 3. Nút Nộp bài & Chấm điểm AI */}
          <button
            type="button"
            onClick={onSubmitEvaluation}
            disabled={isEvaluating || isRecording || !recordedAudioUrl}
            aria-label="Nộp bài thu âm và chấm điểm phát âm"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 font-bold text-[11px] shadow-2xs transition cursor-pointer disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            {isEvaluating ? (
              <>
                <Loader2
                  className="h-3.5 w-3.5 animate-spin text-white"
                  aria-hidden="true"
                />
                <span>Đang chấm...</span>
              </>
            ) : (
              <>
                <Send
                  className="h-3.5 w-3.5 text-white"
                  aria-hidden="true"
                />
                <span>Nộp & Chấm Điểm</span>
              </>
            )}
          </button>
        </div>

        {/* Trạng thái thời gian thu & Hành động phụ */}
        <div
          aria-live="polite"
          className="flex flex-wrap items-center justify-center gap-3 text-[11px]"
        >
          {isRecording ? (
            <div className="flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-rose-500 animate-pulse"
              />
              <span className="font-mono text-xs font-bold">
                {formatTimer(recordingSeconds)}
              </span>
              <span>— Đang thu âm (Nhấn Space để dừng)</span>
            </div>
          ) : recordedAudioUrl ? (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  Đã thu âm xong
                  {recordingDuration > 0
                    ? ` (${recordingDuration.toFixed(1)}s)`
                    : ""}
                </span>
              </span>

              <button
                type="button"
                onClick={onResetRecord}
                disabled={isEvaluating}
                aria-label="Xóa bản ghi hiện tại và thu âm lại"
                className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 hover:underline font-bold cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>Thu âm lại</span>
              </button>

              {evaluationResult && (
                <button
                  type="button"
                  onClick={() => setFeedbackDrawerOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-600/20 text-blue-800 dark:text-blue-300 font-bold hover:bg-blue-200 dark:hover:bg-blue-600/30 transition cursor-pointer text-[10px]"
                >
                  <Award className="w-3 h-3" aria-hidden="true" />
                  <span>
                    Bảng Điểm & Khẩu Hình ({evaluationResult.overallScore}/100)
                  </span>
                </button>
              )}
            </div>
          ) : (
            <span className="text-slate-600 dark:text-slate-400 font-medium text-[10px]">
              Nhấn Micro hoặc phím{" "}
              <kbd className="px-1 py-0.2 font-mono font-bold bg-white dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700">
                Space
              </kbd>{" "}
              để bắt đầu thu âm
            </span>
          )}
        </div>
      </section>
    );
  },
);
