import React, { useMemo } from "react";
import {
  BookOpen,
  Loader2,
  Bot,
  Volume2,
  Mic,
  CheckCircle2,
  Award,
  Send,
  FileText,
  ShieldAlert,
  Info,
} from "lucide-react";
import type {
  GradingSubmission,
  GradingSubmissionDetail,
} from "./gradingTypes";
import { AiEvaluationCard } from "./AiEvaluationCard";

interface GradingWorkspacePanelProps {
  selectedSub: GradingSubmission | null;
  submissionDetail: GradingSubmissionDetail | null;
  loadingDetail: boolean;
  inputScore: string;
  setInputScore: (v: string) => void;
  feedback: string;
  setFeedback: React.Dispatch<React.SetStateAction<string>>;
  savingGrade: boolean;
  saveSuccess: string | null;
  onSaveGrade: (e: React.FormEvent) => void;
  answerScores?: Record<string, number>;
  onUpdateQuestionScore?: (questionKey: string, score: number) => void;
}

export const GradingWorkspacePanel: React.FC<GradingWorkspacePanelProps> = ({
  selectedSub,
  submissionDetail,
  loadingDetail,
  inputScore,
  setInputScore,
  feedback,
  setFeedback,
  savingGrade,
  saveSuccess,
  onSaveGrade,
  answerScores,
  onUpdateQuestionScore,
}) => {
  const isExam = Boolean(submissionDetail?.isExam);

  // Với Bài thi: giữ toàn bộ câu hỏi ở mọi kỹ năng để GV xem & chấm lại; bài thường giữ Viết/Speaking
  const gradableQuestions = useMemo(() => {
    if (!submissionDetail?.questions) return [];
    if (submissionDetail.isExam) {
      return submissionDetail.questions;
    }
    return submissionDetail.questions.filter((q: any) => {
      const type = String(q.questionType || "").toUpperCase();
      if (type === "ESSAY" || type === "AUDIO_RESPONSE") return true;
      if (q.audioUrl) return true;
      const skill = String(submissionDetail.skillType || "").toUpperCase();
      if (skill === "WRITING" && (q.studentAnswer || !q.options || q.options.length === 0)) return true;
      if (skill === "SPEAKING") return true;
      return false;
    });
  }, [submissionDetail]);

  const parsedViolations = useMemo(() => {
    if (!submissionDetail?.violationLogJson) return [];
    try {
      const arr = JSON.parse(submissionDetail.violationLogJson);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }, [submissionDetail?.violationLogJson]);

  if (!selectedSub) {
    return (
      <div className="lg:col-span-7">
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-12 text-center text-slate-500 flex flex-col items-center justify-center min-h-[450px]">
          <BookOpen className="h-12 w-12 mb-3 opacity-30 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Chưa chọn bài nộp
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            Chọn một học viên từ danh sách bên trái để xem nội dung bài Viết hoặc Luyện nói, kết quả
            gợi ý từ AI và nhập điểm số.
          </p>
        </div>
      </div>
    );
  }

  if (loadingDetail) {
    return (
      <div className="lg:col-span-7">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-12 text-center text-slate-400 flex flex-col items-center justify-center min-h-[450px]">
          <Loader2 className="animate-spin h-8 w-8 text-blue-600 mb-3" />
          <p className="text-xs">Đang tải chi tiết bài làm của học sinh...</p>
        </div>
      </div>
    );
  }

  if (!submissionDetail) return null;

  const isWritingSkill =
    String(submissionDetail.skillType || "").toUpperCase() === "WRITING";
  const isSpeakingSkill =
    String(submissionDetail.skillType || "").toUpperCase() === "SPEAKING";

  return (
    <div className="lg:col-span-7">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-6 shadow-sm">
        {/* Header chi tiết bài làm */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {submissionDetail.assignmentTitle}
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {isExam
                  ? "BÀI THI CHÍNH THỨC (LƯU TOÀN BỘ BÀI LÀM)"
                  : isWritingSkill
                    ? "Viết đoạn văn (Writing)"
                    : isSpeakingSkill
                      ? "Luyện nói (Speaking)"
                      : "Chấm Tự luận / Nói"}
              </span>
              {submissionDetail.isCheatingFlagged && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/40">
                  <ShieldAlert className="h-3 w-3" />
                  ĐÁNH DẤU GIAN LẬN ({submissionDetail.violationCount ?? 3} lần vi phạm)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Học sinh:{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                {selectedSub.studentName}
              </strong>{" "}
              ({selectedSub.studentEmail})
            </p>
          </div>

          <div className="flex items-center gap-2">
            {submissionDetail.score !== null &&
              submissionDetail.score !== undefined && (
                <div className="rounded-xl border border-blue-600/30 bg-blue-600/10 px-3 py-1.5 text-right">
                  <span className="block text-[10px] uppercase tracking-wider text-blue-700 dark:text-blue-400 font-bold">
                    Điểm hiện tại
                  </span>
                  <span className="text-lg font-black text-blue-800 dark:text-blue-300">
                    {submissionDetail.score} / 10
                  </span>
                </div>
              )}
          </div>
        </div>

        {/* Cảnh báo vi phạm phòng thi nếu có */}
        {(submissionDetail.isCheatingFlagged || (submissionDetail.violationCount ?? 0) > 0) && (
          <div
            className={`rounded-xl border p-4 space-y-2 ${
              submissionDetail.isCheatingFlagged
                ? "border-rose-500/40 bg-rose-500/10"
                : "border-amber-500/40 bg-amber-500/10"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`flex items-center text-xs font-bold ${
                  submissionDetail.isCheatingFlagged
                    ? "text-rose-700 dark:text-rose-300"
                    : "text-amber-700 dark:text-amber-300"
                }`}
              >
                <ShieldAlert className="mr-1.5 h-4 w-4 shrink-0" />
                {submissionDetail.isCheatingFlagged
                  ? `Cảnh báo gian lận: Vi phạm ${submissionDetail.violationCount ?? 3}/${submissionDetail.maxViolations ?? 3} lần`
                  : `Nhắc nhở rời màn hình: ${submissionDetail.violationCount ?? 0}/${submissionDetail.maxViolations ?? 3} lần`}
              </span>
            </div>
            {submissionDetail.cheatingReason && (
              <p className="text-xs text-rose-700 dark:text-rose-200 font-medium">
                {submissionDetail.cheatingReason}
              </p>
            )}
            {parsedViolations.length > 0 && (
              <ul className="space-y-1 pt-1 border-t border-rose-500/20 text-[11px] text-slate-700 dark:text-slate-300">
                {parsedViolations.map((v: any, idx: number) => (
                  <li key={idx}>
                    • Lần {v.count ?? idx + 1} [{v.eventType || "FOCUS_LOST"}]:{" "}
                    {v.reason || "Rời khỏi chế độ toàn màn hình"}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Thông báo không lưu chi tiết với bài thường không phải Writing/Speaking */}
        {!isExam && submissionDetail.answersPersisted === false && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3.5 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <span>
              Bài luyện tập thường (Đọc/Nghe/Ngữ pháp/Từ vựng) chỉ lưu trạng thái{" "}
              <strong>Đã hoàn thành</strong> và điểm tổng, không lưu từng đáp án chi tiết.
            </span>
          </div>
        )}

        {/* Overall AI Feedback Banner (nếu có) */}
        {submissionDetail.aiFeedback && (
          <div className="rounded-xl border border-blue-500/30 bg-blue-600/10 p-4 space-y-1.5">
            <div className="flex items-center text-xs font-bold text-blue-800 dark:text-blue-300">
              <Bot className="mr-1.5 h-4 w-4 text-blue-700 dark:text-blue-400" />
              Đánh Giá Tổng Quan Từ AI (AI Evaluator)
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {submissionDetail.aiFeedback}
            </p>
          </div>
        )}

        {/* Danh sách câu hỏi và bài làm: Chỉ hiển thị Viết đoạn văn & Speaking */}
        <div className="space-y-4 max-h-[460px] overflow-y-auto pr-2">
          {gradableQuestions.length > 0 ? (
            gradableQuestions.map((q: any, i: number) => {
              const qType = String(q.questionType || "").toUpperCase();
              const isAudio = qType === "AUDIO_RESPONSE" || !!q.audioUrl;
              const isEssay =
                qType === "ESSAY" ||
                (!isAudio && (!q.options || q.options.length === 0) && Boolean(q.studentAnswer));
              const hasOptions = Array.isArray(q.options) && q.options.length > 0;
              const qKey = q.questionId || q.id;
              const maxPts = q.maxPoints ?? q.points ?? 10;
              const currentQScore =
                qKey && answerScores && answerScores[qKey] !== undefined
                  ? answerScores[qKey]
                  : (q.earnedPoints ?? 0);
              const wordCount = q.studentAnswer?.trim()
                ? q.studentAnswer.trim().split(/\s+/).filter(Boolean).length
                : 0;

              return (
                <div
                  key={q.id || i}
                  className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-slate-50 dark:bg-[#162033] p-4 space-y-3 transition hover:border-slate-300 dark:hover:border-slate-700"
                >
                  {/* Tiêu đề câu hỏi & loại bài nộp */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                      <span className="text-blue-700 dark:text-blue-400 font-bold mr-1">
                        Câu {i + 1}:
                      </span>
                      {q.promptText}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {q.skillType && (
                        <span className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {q.skillType}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-md bg-white dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {isEssay ? (
                          <>
                            <FileText className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                            VIẾT ĐOẠN VĂN
                          </>
                        ) : isAudio ? (
                          <>
                            <Mic className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            LUYỆN NÓI
                          </>
                        ) : (
                          q.questionType || "CÂU HỎI"
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Media đề bài (nếu có audio mẫu/đề bài nghe tham khảo) */}
                  {q.mediaUrl && (
                    <div className="rounded-lg bg-white dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-800">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center mb-1">
                        <Volume2 className="h-3.5 w-3.5 mr-1 text-emerald-500 dark:text-emerald-400" />
                        Audio đề bài:
                      </span>
                      <audio src={q.mediaUrl} controls className="h-8 w-full" />
                    </div>
                  )}

                  {/* Bài làm của học sinh */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <span>Bài làm của học viên:</span>
                      {isEssay && q.studentAnswer && (
                        <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md font-mono">
                          {wordCount} từ
                        </span>
                      )}
                    </div>

                    {hasOptions ? (
                      <div className="space-y-1.5">
                        {q.options.map((opt: any) => {
                          const isChosen =
                            q.selectedOptionId === opt.id ||
                            q.studentAnswer === opt.id;
                          return (
                            <div
                              key={opt.id}
                              className={`rounded-lg border px-3 py-1.5 text-xs flex items-center justify-between gap-2 ${
                                isChosen
                                  ? opt.isCorrect
                                    ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-semibold"
                                    : "border-rose-400 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 font-semibold"
                                  : opt.isCorrect
                                    ? "border-emerald-300/70 bg-emerald-50/40 dark:bg-emerald-950/10 text-emerald-700 dark:text-emerald-400"
                                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              <span>
                                {opt.optionLabel ? `${opt.optionLabel}. ` : ""}
                                {opt.optionText}
                                {opt.matchText ? ` → ${opt.matchText}` : ""}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-bold">
                                {opt.isCorrect && <span className="text-emerald-600">Đáp án đúng</span>}
                                {isChosen && <span className="uppercase">• HV chọn</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : q.studentAnswer ? (
                      <div className="space-y-1.5">
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-3.5 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed font-sans shadow-2xs">
                          {q.studentAnswer}
                        </div>
                        {q.correctAnswer && !isEssay && (
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                            Đáp án tham khảo: <strong>{q.correctAnswer}</strong>
                          </p>
                        )}
                      </div>
                    ) : q.audioUrl ? (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-3 space-y-2 shadow-2xs">
                        <div className="flex items-center text-xs text-blue-700 dark:text-blue-400 font-semibold">
                          <Mic className="h-4 w-4 mr-1 text-blue-700 dark:text-blue-400" />
                          File âm thanh bài nói của học viên:
                        </div>
                        <audio src={q.audioUrl} controls className="h-9 w-full" />
                        {q.transcript && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg">
                            <strong className="text-slate-600 dark:text-slate-300 mr-1">
                              Transcript / Gợi ý nói:
                            </strong>
                            {q.transcript}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-xs text-rose-600 dark:text-rose-400 italic">
                        Học sinh bỏ trống hoặc chưa hoàn thành phần này.
                      </div>
                    )}
                  </div>

                  {/* Điều chỉnh điểm từng câu (dành cho Bài thi) */}
                  {isExam && qKey && onUpdateQuestionScore && (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        Chấm lại điểm câu này (tối đa {maxPts}):
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          max={maxPts}
                          value={currentQScore}
                          onChange={(e) =>
                            onUpdateQuestionScore(
                              qKey,
                              Math.max(0, Math.min(maxPts, Number(e.target.value) || 0)),
                            )
                          }
                          className="w-20 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-bold text-slate-900 dark:text-white text-right outline-none focus:border-blue-600"
                        />
                        <span className="text-[11px] text-slate-400">/ {maxPts}</span>
                      </div>
                    </div>
                  )}

                  {/* AI Feedback Box cho bài viết / bài nói */}
                  {(isEssay || isAudio || q.aiEvaluation || q.evalFeedback) && (
                    <AiEvaluationCard
                      question={q}
                      onApplyAiScore={(scoreVal) => setInputScore(String(scoreVal))}
                    />
                  )}
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-slate-500 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Không có câu hỏi Viết đoạn văn hoặc Luyện nói nào cần chấm điểm trong bài nộp này.
              </p>
              <p className="text-[11px] text-slate-500">
                Khu vực này chỉ hiển thị bài làm của phần Viết đoạn văn (Essay) và Luyện nói (Speaking). Các câu hỏi trắc nghiệm hoặc điền từ đã được hệ thống chấm điểm tự động.
              </p>
            </div>
          )}
        </div>

        {/* Thông báo lưu thành công */}
        {saveSuccess && (
          <div className="flex items-center space-x-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {/* FORM CHẤM ĐIỂM VÀ LƯU NHẬN XÉT */}
        <form
          onSubmit={onSaveGrade}
          className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center">
                <Award className="h-4 w-4 mr-1.5 text-amber-500 dark:text-amber-400" />
                Điểm chính thức (Thang 10):
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400">Gợi ý nhanh:</span>
                {[10, 9, 8.5, 8, 7, 6].map((scorePreset) => (
                  <button
                    key={scorePreset}
                    type="button"
                    onClick={() => setInputScore(String(scorePreset))}
                    className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:border-blue-600 hover:text-blue-700 dark:hover:text-white transition"
                  >
                    {scorePreset}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="number"
              step="0.1"
              min="0"
              max="10"
              placeholder="Nhập điểm từ 0.0 đến 10.0..."
              value={inputScore}
              onChange={(e) => setInputScore(e.target.value)}
              className="w-full max-w-xs rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#0b1120] px-3.5 py-2 text-sm text-slate-900 dark:text-white font-bold outline-none focus:border-blue-600 transition"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Nhận xét & Hướng dẫn sửa bài cho học sinh:
              </label>
              <div className="flex items-center gap-1.5">
                {[
                  "Làm bài rất tốt!",
                  "Cần chú ý thì động từ",
                  "Phát âm rõ ràng hơn",
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() =>
                      setFeedback((prev) => (prev ? `${prev}. ${chip}` : chip))
                    }
                    className="rounded-md bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 px-2 py-0.5 text-[10px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={3}
              placeholder="Ghi chú chi tiết cho học sinh về điểm mạnh, lỗi sai và cách khắc phục..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#0b1120] p-3 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600 transition placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={savingGrade}
              className="inline-flex items-center space-x-2 rounded-xl bg-blue-800 px-6 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-600 transition disabled:opacity-50"
            >
              {savingGrade ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang lưu kết quả...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>
                    {submissionDetail.status === "COMPLETED"
                      ? "Cập Nhật Điểm & Nhận Xét (Chấm Lại)"
                      : "Lưu Kết Quả & Gửi Nhận Xét"}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
