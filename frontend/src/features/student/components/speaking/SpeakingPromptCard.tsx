import React from "react";
import {
  Volume2,
  Pause,
  Play,
  Loader2,
  Lightbulb,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cleanShadowingSentence } from "@/features/student/components/SpeakingShadowingStudio";

export interface SpeakingPromptCardProps {
  question: any;
  isSynthesizingTts: boolean;
  isPlayingRefTts: boolean;
  selectedVoice: string;
  ttsSpeed: number;
  showGuidelines: boolean;
  onPlayTts: () => void;
  onChangeVoice: (v: string) => void;
  onChangeSpeed: (s: number) => void;
  onToggleGuidelines: () => void;
  activeAudioUrl?: string | null;
  isPlayingStudentRec?: boolean;
  onTogglePlayStudentAudio?: () => void;
}

const VOICES = [
  { id: "af_heart", label: "Heart (US Nữ)" },
  { id: "am_michael", label: "Michael (US Nam)" },
  { id: "bf_emma", label: "Emma (UK Nữ)" },
];

const SPEEDS = [0.75, 1.0, 1.25, 1.5];

export const SpeakingPromptCard: React.FC<SpeakingPromptCardProps> = ({
  question,
  isSynthesizingTts,
  isPlayingRefTts,
  selectedVoice,
  ttsSpeed,
  showGuidelines,
  onPlayTts,
  onChangeVoice,
  onChangeSpeed,
  onToggleGuidelines,
  activeAudioUrl,
  isPlayingStudentRec = false,
  onTogglePlayStudentAudio,
}) => {
  if (!question) return null;

  const promptText =
    cleanShadowingSentence(question.promptText || question.transcript || "") ||
    "No prompt provided";

  return (
    <div className="space-y-2.5">
      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
        Câu hỏi phỏng vấn / Câu mẫu chuẩn (Reference Prompt):
      </span>
      <div className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-100 leading-relaxed bg-slate-50/70 dark:bg-slate-800/60 p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-700">
        "{promptText}"
      </div>

      {/* Cụm nút phát âm mẫu chuẩn, phát lại bản thu, tốc độ và gợi ý */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {/* NÚT 1: NGHE CÂU MẪU CHUẨN */}
        <button
          type="button"
          disabled={isSynthesizingTts}
          onClick={onPlayTts}
          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-blue-800 hover:bg-blue-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg transition shadow-xs cursor-pointer"
        >
          {isSynthesizingTts ? (
            <>
              <Loader2 size={13} className="animate-spin text-blue-200" />
              <span>Đang tải âm mẫu...</span>
            </>
          ) : isPlayingRefTts ? (
            <>
              <Pause size={13} />
              <span>Dừng câu mẫu</span>
            </>
          ) : (
            <>
              <Volume2 size={13} />
              <span>Nghe câu mẫu</span>
            </>
          )}
        </button>

        {/* NÚT 2: NGHE LẠI BẢN THU CỦA BẠN (Tách biệt hoàn toàn state & nguồn audio) */}
        {activeAudioUrl && onTogglePlayStudentAudio && (
          <button
            type="button"
            onClick={onTogglePlayStudentAudio}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition shadow-xs cursor-pointer"
          >
            {isPlayingStudentRec ? (
              <>
                <Pause size={13} />
                <span>Dừng bản thu</span>
              </>
            ) : (
              <>
                <Play size={13} />
                <span>Nghe bản thu</span>
              </>
            )}
          </button>
        )}

        {/* Bộ chọn giọng đọc mẫu */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300">
          {VOICES.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onChangeVoice(v.id)}
              className={`px-2 py-0.5 text-[11px] rounded-md transition ${
                selectedVoice === v.id
                  ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-bold"
                  : "hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Tốc độ đọc */}
        <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300">
          <span className="px-1 text-[11px] text-slate-400">Tốc độ:</span>
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChangeSpeed(s)}
              className={`px-1.5 py-0.5 rounded-md transition ${
                ttsSpeed === s
                  ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-bold"
                  : "hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {(question.explanation || question.correctAnswer) && (
          <button
            type="button"
            onClick={onToggleGuidelines}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white ml-auto cursor-pointer"
          >
            <Lightbulb size={13} className="text-amber-500" />
            <span>Gợi ý trả lời</span>
            {showGuidelines ? (
              <ChevronUp size={13} />
            ) : (
              <ChevronDown size={13} />
            )}
          </button>
        )}
      </div>

      {showGuidelines && (
        <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-1 animate-in fade-in">
          <b className="block text-amber-950 dark:text-amber-300 font-bold">
            💡 Hướng dẫn & Tiêu chí câu trả lời:
          </b>
          {question.explanation && (
            <p className="leading-relaxed">{question.explanation}</p>
          )}
          {question.correctAnswer && (
            <p className="leading-relaxed font-medium text-amber-800 dark:text-amber-300">
              Ý chính gợi ý: {question.correctAnswer}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default SpeakingPromptCard;
