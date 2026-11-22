import React from "react";
import {
  Edit3,
  Plus,
  BookOpen,
  Headphones,
  UploadCloud,
  Loader2,
  Bot,
  Volume2,
  Play,
  Square,
  AlertCircle,
  X,
} from "lucide-react";
import type { QuestionDraft } from "./assignmentModalConfig";
import QuestionEditorItem from "./QuestionEditorItem";

interface QuestionBuilderListProps {
  questions: QuestionDraft[];
  assignmentType: string;
  speakingMode: string;
  readingPassageText: string;
  setReadingPassageText: (val: string) => void;
  mainAudioUrl: string;
  setMainAudioUrl: (val: string) => void;
  mainTranscript: string;
  setMainTranscript: (val: string) => void;
  isUploadingAudio: boolean;
  isPlayingMainAudio: boolean;
  isSynthesizingTts: boolean;
  ttsVoice: string;
  setTtsVoice: (val: string) => void;
  ttsSpeed: number;
  setTtsSpeed: (val: number) => void;
  synthesizeAudioError: string | null;
  setSynthesizeAudioError: (val: string | null) => void;
  playingPreviewId: string | null;
  handleAddBlankQuestion: () => void;
  handleChangeQuestionType: (id: string, type: QuestionDraft["questionType"]) => void;
  handleUpdateQuestion: (id: string, field: keyof QuestionDraft, value: any) => void;
  handleDeleteQuestion: (id: string) => void;
  handleAddOption: (id: string) => void;
  handlePreviewAudio: (q: QuestionDraft) => void;
  handleUploadMainAudio: (file: File) => void;
  togglePlayMainAudio: () => void;
  handleSynthesizeNeuralAudio: () => void;
  handlePreviewTranscriptAi: () => void;
}

export const QuestionBuilderList: React.FC<QuestionBuilderListProps> = ({
  questions,
  assignmentType,
  speakingMode,
  readingPassageText,
  setReadingPassageText,
  mainAudioUrl,
  setMainAudioUrl,
  mainTranscript,
  setMainTranscript,
  isUploadingAudio,
  isPlayingMainAudio,
  isSynthesizingTts,
  ttsVoice,
  setTtsVoice,
  ttsSpeed,
  setTtsSpeed,
  synthesizeAudioError,
  setSynthesizeAudioError,
  playingPreviewId,
  handleAddBlankQuestion,
  handleChangeQuestionType,
  handleUpdateQuestion,
  handleDeleteQuestion,
  handleAddOption,
  handlePreviewAudio,
  handleUploadMainAudio,
  togglePlayMainAudio,
  handleSynthesizeNeuralAudio,
  handlePreviewTranscriptAi,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Edit3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          Câu hỏi ({questions.length})
        </h3>
        <button
          type="button"
          onClick={handleAddBlankQuestion}
          className="flex items-center px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-400 text-xs font-bold border border-slate-300 dark:border-slate-700 transition cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-1" /> Thêm câu hỏi
        </button>
      </div>

      {/* READING PASSAGE */}
      {(assignmentType === "READING" || Boolean(readingPassageText)) && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-600/30 bg-blue-50/40 dark:bg-slate-900 p-4 space-y-3.5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-600/20 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-800/30 text-blue-300">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-300">
                  Đoạn văn bài đọc
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Dùng chung cho các câu hỏi dưới
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                {readingPassageText.trim()
                  ? `${readingPassageText.trim().split(/\s+/).length} từ`
                  : "0 từ"}
              </span>
              {readingPassageText && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Xóa đoạn văn bài đọc?")) {
                      setReadingPassageText("");
                    }
                  }}
                  className="text-[11px] text-rose-500 hover:text-rose-400 px-2 py-1 rounded hover:bg-rose-950/40 transition cursor-pointer"
                >
                  Xóa
                </button>
              )}
            </div>
          </div>

          <div>
            <textarea
              rows={6}
              value={readingPassageText}
              onChange={(e) => setReadingPassageText(e.target.value)}
              placeholder="Nhập hoặc dán bài đọc..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-600 focus:outline-hidden font-serif leading-relaxed"
            />
          </div>
        </div>
      )}

      {/* LISTENING PASSAGE & AUDIO TRACK */}
      {assignmentType === "LISTENING" && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-600/30 bg-blue-50/40 dark:bg-slate-900 p-4 space-y-3.5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-600/20 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-800/30 text-amber-300">
                <Headphones className="h-5 w-5" />
              </div>
              <h4 className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-300">
                Audio &amp; Kịch bản nghe
              </h4>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold transition cursor-pointer shadow-xs">
                {isUploadingAudio ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="h-3.5 w-3.5" />
                )}
                <span>{mainAudioUrl ? "Đổi audio" : "Tải audio (.mp3, .wav)"}</span>
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  disabled={isUploadingAudio}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadMainAudio(f);
                  }}
                />
              </label>

              {mainAudioUrl && (
                <button
                  type="button"
                  onClick={togglePlayMainAudio}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  {isPlayingMainAudio ? (
                    <>
                      <Square className="h-3.5 w-3.5 fill-current" /> Dừng
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" /> Nghe thử
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Kịch bản (Transcript):
              </label>
              <button
                type="button"
                onClick={handlePreviewTranscriptAi}
                title="Tự tổng hợp kịch bản từ câu hỏi"
                className="text-[11px] font-bold text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Bot className="h-3 w-3" /> Gom từ câu hỏi
              </button>
            </div>
            <textarea
              rows={4}
              value={mainTranscript}
              onChange={(e) => setMainTranscript(e.target.value)}
              placeholder="Nhập hoặc dán kịch bản bài nghe..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-600 focus:outline-hidden font-serif leading-relaxed"
            />
          </div>

          {/* Kokoro TTS config */}
          <div className="rounded-xl border border-blue-600/30 bg-slate-50 dark:bg-slate-900/40 p-3.5 space-y-2.5">
            <div className="flex items-center gap-2 border-b border-blue-600/20 pb-2">
              <Volume2 className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                Tạo giọng đọc (Kokoro TTS)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Giọng đọc:
                </label>
                <select
                  value={ttsVoice}
                  onChange={(e) => setTtsVoice(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-400"
                >
                  <option value="af_heart">Mỹ - Nữ (Heart)</option>
                  <option value="am_michael">Mỹ - Nam (Michael)</option>
                  <option value="bf_emma">Anh - Nữ (Emma)</option>
                  <option value="bm_george">Anh - Nam (George)</option>
                  <option value="af_bella">Mỹ - Nữ (Bella)</option>
                  <option value="am_adam">Mỹ - Nam (Adam)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Tốc độ: {ttsSpeed}x
                </label>
                <input
                  type="range"
                  min="0.75"
                  max="1.25"
                  step="0.05"
                  value={ttsSpeed}
                  onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 h-2 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <button
                  type="button"
                  disabled={isSynthesizingTts}
                  onClick={handleSynthesizeNeuralAudio}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold text-xs transition disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSynthesizingTts ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Đang tạo...</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-3.5 w-3.5" />
                      <span>Tạo Audio TTS</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {synthesizeAudioError && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{synthesizeAudioError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSynthesizeAudioError(null)}
                  className="text-rose-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QUESTIONS LIST */}
      <div className="space-y-4">
        {questions.map((q, idx) => (
          <QuestionEditorItem
            key={q.id}
            q={q}
            idx={idx}
            assignmentType={assignmentType}
            speakingMode={speakingMode}
            playingPreviewId={playingPreviewId}
            handleChangeQuestionType={handleChangeQuestionType}
            handleUpdateQuestion={handleUpdateQuestion}
            handleDeleteQuestion={handleDeleteQuestion}
            handleAddOption={handleAddOption}
            handlePreviewAudio={handlePreviewAudio}
          />
        ))}

        {questions.length === 0 && (
          <div className="text-center py-10 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
            <p className="text-xs text-slate-500 dark:text-slate-400">Chưa có câu hỏi.</p>
            <button
              type="button"
              onClick={handleAddBlankQuestion}
              className="mt-3 inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Thêm câu hỏi
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionBuilderList;
