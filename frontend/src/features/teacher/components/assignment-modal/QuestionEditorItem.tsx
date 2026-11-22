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
            title="Đổi loại câu hỏi"
          >
            <option value="MULTIPLE_CHOICE">Trắc nghiệm</option>
            <option value="FILL_IN_BLANK">Điền từ</option>
            <option value="MATCHING">Ghép cặp</option>
            <option value="TRUE_FALSE">Đúng / Sai</option>
            <option value="ESSAY">Tự luận</option>
            <option value="AUDIO_RESPONSE">Nói / Ghi âm</option>
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
          {assignmentType !== "LISTENING" &&
            ((assignmentType === "SPEAKING" && speakingMode === "SHADOWING") ||
              (assignmentType !== "SPEAKING" && (q.referenceAudioUrl || q.targetWord))) && (
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
              title="Nghe thử"
            >
              <Volume2 className="h-3 w-3" />
              {playingPreviewId === q.id
                ? "Đang phát..."
                : q.referenceAudioUrl
                ? "Nghe mẫu"
                : "Tạo & Nghe thử"}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => handleDeleteQuestion(q.id)}
          className="text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 p-1 transition"
          title="Xóa câu"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
          {assignmentType === "SPEAKING"
            ? speakingMode === "PART_2"
              ? "Cue Card (IELTS Part 2):"
              : speakingMode === "PART_3"
              ? "Câu hỏi thảo luận (Part 3):"
              : speakingMode === "QA"
              ? "Câu hỏi phỏng vấn (Part 1 / Q&A):"
              : "Câu mẫu Shadowing:"
            : assignmentType === "WRITING"
            ? q.questionType === "FILL_IN_BLANK"
              ? "Đề bài sắp xếp / hoàn thành câu:"
              : "Đề bài viết:"
            : "Câu hỏi:"}
        </label>
        <textarea
          rows={assignmentType === "SPEAKING" && speakingMode === "PART_2" ? 4 : 2}
          value={q.prompt}
          onChange={(e) =>
            handleUpdateQuestion(q.id, "prompt", e.target.value)
          }
          placeholder={
            assignmentType === "SPEAKING" && speakingMode === "PART_2"
              ? "Vd: Describe a useful skill...\nYou should say:\n- ...\n- ..."
              : assignmentType === "SPEAKING" && speakingMode === "PART_3"
              ? "Vd: How has technology changed communication?"
              : assignmentType === "SPEAKING" && speakingMode === "QA"
              ? "Vd: What are the benefits of learning languages?"
              : assignmentType === "WRITING" && q.questionType === "FILL_IN_BLANK"
              ? "Vd: Sắp xếp: always / to school / by bus / She / goes"
              : "Nhập câu hỏi..."
          }
          className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
        />
      </div>

      {/* SPEAKING Q&A / PART 2 / PART 3: Khung cấu hình Task Response (không cần audio mẫu) */}
      {assignmentType === "SPEAKING" && speakingMode !== "SHADOWING" && (
        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
              {speakingMode === "PART_2"
                ? "Ý bắt buộc (Cue Card) & Tiêu chí AI:"
                : speakingMode === "PART_3"
                ? "Luận điểm (PEEL) & Tiêu chí AI:"
                : "Ý chính cần trả lời (AI chấm):"}
            </label>
            <textarea
              rows={2}
              value={q.correctAnswer}
              onChange={(e) =>
                handleUpdateQuestion(q.id, "correctAnswer", e.target.value)
              }
              placeholder={
                speakingMode === "PART_2"
                  ? "Vd: Đủ 4 ý Cue Card; nói 1.5–2 phút..."
                  : speakingMode === "PART_3"
                  ? "Vd: Quan điểm rõ, so sánh, ví dụ cụ thể..."
                  : "Vd: Nêu ít nhất 2 lợi ích: việc làm, văn hóa..."
              }
              className="w-full rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-400 placeholder:text-slate-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-blue-700 dark:text-blue-400 mb-1">
              {speakingMode === "PART_2"
                ? "Gợi ý cấu trúc & Từ vựng C1/C2:"
                : speakingMode === "PART_3"
                ? "Gợi ý phản biện & Từ vựng:"
                : "Gợi ý & Từ vựng:"}
            </label>
            <textarea
              rows={2}
              value={q.explanation || ""}
              onChange={(e) =>
                handleUpdateQuestion(q.id, "explanation", e.target.value)
              }
              placeholder="Vd: cognitive skills, global perspective..."
              className="w-full rounded-lg border border-blue-600/30 bg-blue-600/5 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-400 placeholder:text-slate-500"
            />
          </div>
        </div>
      )}

      {/* SPEAKING SHADOWING: Dịch nghĩa & hướng dẫn phát âm */}
      {assignmentType === "SPEAKING" && speakingMode === "SHADOWING" && (
        <div className="space-y-2 pt-1">
          <label className="block text-[11px] font-semibold text-blue-800 dark:text-blue-300 mb-1">
            Dịch nghĩa &amp; Ghi chú phát âm:
          </label>
          <textarea
            rows={2}
            value={q.explanation || ""}
            onChange={(e) =>
              handleUpdateQuestion(q.id, "explanation", e.target.value)
            }
            placeholder="Dịch nghĩa, nối âm, trọng âm..."
            className="w-full rounded-lg border border-blue-600/30 bg-blue-50 dark:bg-slate-900/30 p-2.5 text-xs text-blue-900 dark:text-blue-200 outline-none focus:border-blue-400"
          />
        </div>
      )}

      {/* WRITING: Bài mẫu & Tiêu chí chấm */}
      {assignmentType === "WRITING" && q.questionType === "ESSAY" && (
        <div className="space-y-2 pt-1">
          <label className="block text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-1">
            Bài mẫu / Dàn ý &amp; Tiêu chí AI:
          </label>
          <textarea
            rows={3}
            value={q.correctAnswer}
            onChange={(e) =>
              handleUpdateQuestion(q.id, "correctAnswer", e.target.value)
            }
            placeholder="Dàn ý, luận điểm, đoạn mẫu..."
            className="w-full rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-400 placeholder:text-slate-500"
          />
        </div>
      )}

      {/* MULTIPLE CHOICE */}
      {q.questionType === "MULTIPLE_CHOICE" && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              Lựa chọn (bấm chữ cái để chọn đáp án đúng):
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
                    title="Chọn làm đáp án đúng"
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
                    placeholder={`Phương án ${letter}`}
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
            Nghĩa / cặp ghép đúng:
          </label>
          <input
            type="text"
            value={q.correctAnswer}
            onChange={(e) =>
              handleUpdateQuestion(q.id, "correctAnswer", e.target.value)
            }
            placeholder="Nhập nghĩa hoặc cặp ghép..."
            className="w-full rounded-lg border border-purple-500/30 bg-purple-500/10 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-purple-500 placeholder:text-slate-500"
          />
        </div>
      )}

      {/* FILL_IN_BLANK */}
      {q.questionType === "FILL_IN_BLANK" && (
        <div className="space-y-1.5 pt-1">
          <label className="block text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            {assignmentType === "WRITING"
              ? "Câu hoàn chỉnh mẫu:"
              : "Đáp án đúng:"}
          </label>
          <input
            type="text"
            value={q.correctAnswer}
            onChange={(e) =>
              handleUpdateQuestion(q.id, "correctAnswer", e.target.value)
            }
            placeholder={
              assignmentType === "WRITING"
                ? "Vd: She always goes to school by bus."
                : "Nhập đáp án đúng..."
            }
            className="w-full rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 placeholder:text-slate-500"
          />
        </div>
      )}

      {/* TRUE_FALSE */}
      {q.questionType === "TRUE_FALSE" && (
        <div className="space-y-1.5 pt-1">
          <label className="block text-[11px] font-semibold text-sky-600 dark:text-sky-400">
            Đáp án đúng:
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
            Giải thích / Gợi ý:
          </label>
          <textarea
            rows={2}
            value={q.explanation || ""}
            onChange={(e) =>
              handleUpdateQuestion(q.id, "explanation", e.target.value)
            }
            placeholder="Nhập giải thích (tùy chọn)..."
            className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600 placeholder:text-slate-500 leading-relaxed"
          />
        </div>
      )}
    </div>
  );
};

export default QuestionEditorItem;
