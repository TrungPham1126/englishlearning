import React from "react";
import {
  Mic,
  CheckCircle2,
  Square,
  Upload,
  Loader2,
  Award,
} from "lucide-react";

export interface SpeakingRecordStudioProps {
  activeAudioUrl: string | null;
  isRecording: boolean;
  recordingSeconds: number;
  isEvaluating: boolean;
  isSubmitting: boolean;
  isSubmitted: boolean;
  dayNumber: number;
  transcript?: string;
  hasAudioBlob?: boolean;
  onStartRecord: () => void;
  onStopRecord: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEvaluateAi: () => void;
  onSubmit: () => void;
  onAudioPlay?: () => void;
  onAudioPause?: () => void;
  onAudioEnded?: () => void;
}

export const SpeakingRecordStudio: React.FC<SpeakingRecordStudioProps> = ({
  activeAudioUrl,
  isRecording,
  recordingSeconds,
  isEvaluating,
  isSubmitting,
  isSubmitted,
  dayNumber,
  transcript,
  hasAudioBlob = false,
  onStartRecord,
  onStopRecord,
  onFileUpload,
  onEvaluateAi,
  onSubmit,
  onAudioPlay,
  onAudioPause,
  onAudioEnded,
}) => {
  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
          <Mic size={15} className="text-emerald-600 dark:text-emerald-400" />
          Bản thu của bạn (Student Recorded Submission):
        </span>
        {isSubmitted && (
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 size={13} /> Đã nộp thành công
          </span>
        )}
      </div>

      {activeAudioUrl ? (
        <div className="space-y-1.5">
          <audio
            controls
            src={activeAudioUrl}
            onPlay={onAudioPlay}
            onPause={onAudioPause}
            onEnded={onAudioEnded}
            className="w-full h-10 rounded-lg"
          />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4 text-center text-xs text-slate-500 dark:text-slate-400">
          {transcript
            ? `Bản ghi âm đã được chấm điểm (Bản ghi: "${transcript}"). Bấm nút Thu âm lại bên dưới nếu bạn muốn ghi âm bản mới.`
            : `Chưa có bản ghi âm. Hãy bấm nút thu âm micro bên dưới để trả lời bài tập Ngày ${dayNumber}.`}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        {isRecording ? (
          <button
            type="button"
            onClick={onStopRecord}
            className="flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-semibold text-white shadow-xs transition animate-pulse cursor-pointer"
          >
            <Square size={14} /> Dừng ghi âm ({formatTimer(recordingSeconds)})
          </button>
        ) : (
          <button
            type="button"
            onClick={onStartRecord}
            className="flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-600/40 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-blue-800 dark:text-blue-300 transition cursor-pointer shadow-2xs"
          >
            <Mic size={14} className="text-rose-600" />
            <span>{activeAudioUrl ? "Thu âm lại" : "Thu âm trực tiếp"}</span>
          </button>
        )}

        <label className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 transition cursor-pointer shadow-2xs">
          <Upload size={14} className="text-blue-700 dark:text-blue-400" />
          <span>Tải file ghi âm</span>
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={onFileUpload}
          />
        </label>

        <button
          type="button"
          disabled={isEvaluating || (!activeAudioUrl && !hasAudioBlob)}
          onClick={onEvaluateAi}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-blue-800 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 text-xs font-semibold transition cursor-pointer shadow-xs"
        >
          {isEvaluating ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Award size={14} />
          )}
          <span>Chấm Điểm Phỏng Vấn (IELTS)</span>
        </button>
      </div>

      {!isSubmitted && (
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onSubmit}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-2.5 px-4 text-xs sm:text-sm font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle2 size={16} />
            )}
            <span>Nộp Bài Hoàn Thành Ngày {dayNumber}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default SpeakingRecordStudio;
