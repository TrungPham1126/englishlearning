import React from "react";
import { Plus, Trash2, Volume2, Lightbulb, Target } from "lucide-react";
import type { QuestionDraft } from "./assignmentModalConfig";

interface QuestionEditorItemProps {
  q: QuestionDraft;
  idx: number;
  assignmentType: string;
  speakingMode: string;
  playingPreviewId: string | null;
  handleChangeQuestionType: (id: string, type: QuestionDraft["questionType"]) => void;
  handleUpdateQuestion: (id: string, field: keyof QuestionDraft, value: any) => void;
  handleDeleteQuestion: (id: string) => void;
  handleAddOption: (id: string) => void;
  handlePreviewAudio: (q: QuestionDraft) => void;
}

export const QuestionEditorItem: React.FC<QuestionEditorItemProps> = ({
  q,
  idx,
  assignmentType,
  speakingMode,
  playingPreviewId,
  handleChangeQuestionType,
  handleUpdateQuestion,
  handleDeleteQuestion,
  handleAddOption,
  handlePreviewAudio,
}) => {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-3 relative group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
            Câu {idx + 1}
          </span>
          <select
            value={q.questionType}
            onChange={(e) =>
              handleChangeQuestionType(
                q.id,
                e.target.value as QuestionDraft["questionType"],
              )
            }
            className="text-[11px] font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5 text-blue-700 dark:text-blue-400 outline-none cursor-pointer"
            title="Thay đổi dạng câu hỏi"
          >
            <option value="MULTIPLE_CHOICE">Trắc nghiệm (MULTIPLE_CHOICE)</option>
            <option value="FILL_IN_BLANK">Điền từ (FILL_IN_BLANK)</option>
            <option value="MATCHING">Ghép cặp từ vựng (MATCHING)</option>
            <option value="TRUE_FALSE">Đúng / Sai (TRUE_FALSE)</option>
            <option value="ESSAY">Tự luận / Luận (ESSAY)</option>
            <option value="AUDIO_RESPONSE">Nói / Ghi âm (AUDIO_RESPONSE)</option>
          </select>

          {q.targetWord && (
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] border border-emerald-500/20">
              Từ: {q.targetWord}
            </span>
          )}
          {q.ipa && (
            <span className="px-2 py-0.5 rounded bg-blue-600/10 text-blue-800 dark:text-blue-300 font-mono text-[11px] font-bold border border-blue-600/20">
              IPA: {q.ipa}
            </span>
          )}
          {assignmentType !== "LISTENING" && (assignmentType === "SPEAKING" || q.referenceAudioUrl || q.targetWord) && (
            <button
              type="button"
              onClick={() => handlePreviewAudio(q)}
              className={`px-2.5 py-0.5 rounded font-bold text-[11px] border flex items-center gap-1 transition cursor-pointer ${
                playingPreviewId === q.id
                  ? "bg-amber-400 text-slate-950 border-amber-400"
                  : q.referenceAudioUrl
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 hover:bg-amber-500/20"
                  : "bg-blue-600/10 text-blue-800 dark:text-blue-300 border-blue-600/20 hover:bg-blue-600/20"
              }`}
              title="Nghe thử phát âm mẫu"
            >
              <Volume2 className="h-3 w-3" />
              {playingPreviewId === q.id
                ? "Đang phát..."
                : q.referenceAudioUrl
                ? "Nghe phát âm mẫu"
                : "Tạo & Nghe thử"}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => handleDeleteQuestion(q.id)}
          className="text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 p-1 transition"
          title="Xóa câu này"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
          {assignmentType === "SPEAKING"
            ? speakingMode === "QA"
              ? "Câu hỏi phỏng vấn Speaking (Question Prompt in English):"
              : "Câu văn mẫu luyện Shadowing (Target Sentence to Shadow):"
            : assignmentType === "WRITING"
            ? q.questionType === "FILL_IN_BLANK"
              ? "Đề bài sắp xếp từ / hoàn thành câu (Writing Prompt):"
              : "Đề bài viết đoạn văn / bài luận (Writing Prompt):"
            : "Nội dung câu hỏi (Question Prompt):"}
        </label>
        <textarea
          rows={2}
          value={q.prompt}
          onChange={(e) =>
            handleUpdateQuestion(q.id, "prompt", e.target.value)
          }
          placeholder={
            assignmentType === "SPEAKING" && speakingMode === "QA"
              ? "Vd: What are the main benefits of learning foreign languages?"
              : assignmentType === "WRITING" && q.questionType === "FILL_IN_BLANK"
              ? "Vd: Sắp xếp các từ sau thành câu hoàn chỉnh: always / to school / by bus / She / goes"
              : "Nhập nội dung câu hỏi..."
          }
          className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
        />
      </div>

      {/* SPEAKING Q&A: Khung cấu hình Task Response */}
      {assignmentType === "SPEAKING" && speakingMode === "QA" && (
        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
              Ý chính cần trả lời (AI đối chiếu chấm Task Response):
            </label>
            <textarea
              rows={2}
              value={q.correctAnswer}
              onChange={(e) =>
                handleUpdateQuestion(q.id, "correctAnswer", e.target.value)
              }
              placeholder="Vd: Nêu ít nhất 2 lợi ích: mở rộng cơ hội việc làm, hiểu biết văn hóa thế giới..."
              className="w-full rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-400 placeholder:text-slate-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-blue-700 dark:text-blue-400 mb-1">
              Gợi ý trả lời & Dàn ý / Từ vựng cho học sinh (Hint & Vocabulary):
            </label>
            <textarea
              rows={2}
              value={q.explanation || ""}
              onChange={(e) =>
                handleUpdateQuestion(q.id, "explanation", e.target.value)
              }
              placeholder="Vd: Từ vựng gợi ý: cognitive skills, global perspective, career advancement..."
              className="w-full rounded-lg border border-blue-600/30 bg-blue-600/5 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-400 placeholder:text-slate-500"
            />
          </div>
        </div>
      )}

      {/* SPEAKING SHADOWING: Dịch nghĩa & hướng dẫn phát âm */}
      {assignmentType === "SPEAKING" && speakingMode === "SHADOWING" && (
        <div className="space-y-2 pt-1">
          <label className="block text-[11px] font-semibold text-blue-800 dark:text-blue-300 mb-1">
            Dịch nghĩa tiếng Việt & Ghi chú phát âm (Linking / Stress notes):
          </label>
          <textarea
            rows={2}
            value={q.explanation || ""}
            onChange={(e) =>
              handleUpdateQuestion(q.id, "explanation", e.target.value)
            }
            placeholder="Vd: Dịch nghĩa và lưu ý nối âm..."
            className="w-full rounded-lg border border-blue-600/30 bg-blue-50 dark:bg-slate-900/30 p-2.5 text-xs text-blue-900 dark:text-blue-200 outline-none focus:border-blue-400"
          />
        </div>
      )}

      {/* WRITING: Bài mẫu & Tiêu chí chấm */}
      {assignmentType === "WRITING" && q.questionType === "ESSAY" && (
        <div className="space-y-2 pt-1">
          <label className="block text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-1">
            Bài mẫu tham khảo / Dàn ý & Tiêu chí chấm (AI đối chiếu chấm Task Response):
          </label>
          <textarea
            rows={3}
            value={q.correctAnswer}
            onChange={(e) =>
              handleUpdateQuestion(q.id, "correctAnswer", e.target.value)
            }
            placeholder="Vd: Đoạn văn mẫu, luận điểm 1, luận điểm 2, kết luận..."
            className="w-full rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-400 placeholder:text-slate-500"
          />
        </div>
      )}

      {/* MULTIPLE CHOICE */}
      {q.questionType === "MULTIPLE_CHOICE" && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              Các lựa chọn đáp án (nhấn nút chữ cái để đánh dấu đáp án đúng):
            </label>
            {q.options.length < 6 && (
              <button
                type="button"
                onClick={() => handleAddOption(q.id)}
                className="text-[11px] font-bold text-blue-700 dark:text-blue-400 hover:text-blue-600 flex items-center gap-1 cursor-pointer transition"
              >
                <Plus className="h-3 w-3" /> Thêm lựa chọn
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {q.options.map((opt, oIdx) => {
              const letter = String.fromCharCode(65 + oIdx);
              const isCorrect =
                (q.correctAnswer || "").trim().toLowerCase() === opt.trim().toLowerCase() ||
                (q.correctAnswer || "").trim().toUpperCase() === letter;
              return (
                <div
                  key={oIdx}
                  className={`flex items-center space-x-2 rounded-lg border p-1.5 transition ${
                    isCorrect
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : "border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateQuestion(q.id, "correctAnswer", opt)
                    }
                    title="Đặt làm đáp án đúng"
                    className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold transition shrink-0 cursor-pointer ${
                      isCorrect
                        ? "bg-emerald-500 text-slate-950 shadow-sm"
                        : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700"
                    }`}
                  >
                    {letter}
                  </button>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...q.options];
                      const oldVal = newOpts[oIdx];
                      newOpts[oIdx] = e.target.value;
                      handleUpdateQuestion(q.id, "options", newOpts);
                      if (
                        (q.correctAnswer || "").trim().toLowerCase() === oldVal.trim().toLowerCase() ||
                        (q.correctAnswer || "").trim().toUpperCase() === letter
                      ) {
                        handleUpdateQuestion(
                          q.id,
                          "correctAnswer",
                          e.target.value,
                        );
                      }
                    }}
                    className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-200 outline-none"
                    placeholder={`Lựa chọn ${letter}...`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MATCHING */}
      {q.questionType === "MATCHING" && (
        <div className="space-y-1.5 pt-1">
          <label className="block text-[11px] font-semibold text-purple-600 dark:text-purple-400">
            Nghĩa tiếng Việt hoặc cặp ghép tương ứng (Matching Target):
          </label>
          <input
            type="text"
            value={q.correctAnswer}
            onChange={(e) =>
              handleUpdateQuestion(q.id, "correctAnswer", e.target.value)
            }
            placeholder="Nhập nghĩa tiếng Việt hoặc cặp ghép tương ứng..."
            className="w-full rounded-lg border border-purple-500/30 bg-purple-500/10 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-purple-500 placeholder:text-slate-500"
          />
        </div>
      )}

      {/* FILL_IN_BLANK */}
      {q.questionType === "FILL_IN_BLANK" && (
        <div className="space-y-1.5 pt-1">
          <label className="block text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            {assignmentType === "WRITING"
              ? "Câu hoàn chỉnh mẫu / Đáp án chính xác (Model Sentence):"
              : "Đáp án chính xác cần điền (Correct word / phrase):"}
          </label>
          <input
            type="text"
            value={q.correctAnswer}
            onChange={(e) =>
              handleUpdateQuestion(q.id, "correctAnswer", e.target.value)
            }
            placeholder={
              assignmentType === "WRITING"
                ? "Nhập câu tiếng Anh hoàn chỉnh mẫu (Vd: She always goes to school by bus.)..."
                : "Nhập từ hoặc cụm từ đáp án chính xác..."
            }
            className="w-full rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 placeholder:text-slate-500"
          />
        </div>
      )}

      {/* TRUE_FALSE */}
      {q.questionType === "TRUE_FALSE" && (
        <div className="space-y-1.5 pt-1">
          <label className="block text-[11px] font-semibold text-sky-600 dark:text-sky-400">
            Đáp án đúng (TRUE / FALSE / NOT GIVEN):
          </label>
          <div className="flex gap-2">
            {["TRUE", "FALSE", "NOT GIVEN"].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleUpdateQuestion(q.id, "correctAnswer", val)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  (q.correctAnswer || "").toUpperCase() === val
                    ? "bg-sky-500 text-slate-950 border-sky-400 shadow-sm"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700"
                }`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Explanation */}
      {assignmentType !== "SPEAKING" && (
        <div className="space-y-1 pt-1">
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            Giải thích chi tiết &amp; Gợi ý làm bài (Explanation):
          </label>
          <textarea
            rows={2}
            value={q.explanation || ""}
            onChange={(e) =>
              handleUpdateQuestion(q.id, "explanation", e.target.value)
            }
            placeholder="Nhập giải thích chi tiết đáp án hoặc mẹo ghi nhớ cho học sinh..."
            className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600 placeholder:text-slate-500 leading-relaxed"
          />
        </div>
      )}
    </div>
  );
};

export default QuestionEditorItem;
