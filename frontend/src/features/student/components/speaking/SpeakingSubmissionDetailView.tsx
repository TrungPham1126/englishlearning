// src/features/student/components/speaking/SpeakingSubmissionDetailView.tsx
import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Headphones,
  Lock,
  Mic,
  RotateCcw,
  Volume2,
  XCircle,
  Zap,
} from "lucide-react";
import type {
  AttemptResponse,
  DaySpeakingGroup,
  FullSpeakingAiResult,
  QuestionResultDetail,
  ShadowingEvaluationResponse,
} from "@/features/student/types";
import {
  cleanShadowingSentence,
  extractReferenceSentence,
  isMockOrBrokenAudioUrl,
} from "@/utils/sampleAudioPlayer";
import ShadowingEvaluationView from "@/features/student/components/ShadowingEvaluationView";
import { IeltsSpeakingReportCard } from "./IeltsSpeakingReportCard";
import { TeacherFeedbackCard } from "./TeacherFeedbackCard";
import { SpeakingPromptCard } from "./SpeakingPromptCard";
import { SpeakingRecordStudio } from "./SpeakingRecordStudio";
import SpeakingShadowingStudio from "@/features/student/components/SpeakingShadowingStudio";
import {
  getAssignmentScoreSummary,
  getQuestionBestScoreAcrossAttempts,
  isQuestionPassed,
  findNextUnpassedQuestionIndex,
  normalizeScoreTo100,
} from "@/features/student/utils/speakingScoring";

export interface SpeakingSubmissionDetailViewProps {
  currentDay: DaySpeakingGroup;
  currentAttempt: AttemptResponse | null;
  attempts: AttemptResponse[];
  selectedQuestionIndex: number;
  questions: QuestionResultDetail[];
  currentQ: QuestionResultDetail | null;
  activeAudioUrl: string | null;
  activeAudioBlob: Blob | null;
  aiReport: FullSpeakingAiResult | null;
  shadowingReport: ShadowingEvaluationResponse | null;
  reportQuestionId: string | null;
  isEvaluating: boolean;
  isSubmitting: boolean;
  isSubmitted: boolean;
  isShadowingMode: boolean;
  isRecording: boolean;
  recordingSeconds: number;
  isSynthesizingTts: boolean;
  isPlayingRefTts: boolean;
  selectedVoice: string;
  ttsSpeed: number;
  isPlayingStudentRec: boolean;
  onSelectQuestionIndex: (idx: number) => void;
  onSelectAttempt: (att: AttemptResponse) => void;
  onRetake: () => void;
  onStartRecord: () => void;
  onStopRecord: () => void;
  onFileUpload: (e: any) => void;
  onEvaluateAi: () => void;
  onSubmit: () => void;
  onPlayTtsPrompt: () => void;
  onChangeVoice: (voice: string) => void;
  onChangeSpeed: (speed: number) => void;
  onAudioPlay: () => void;
  onAudioPause: () => void;
  onAudioEnded: () => void;
  onAudioSubmittedShadowing?: (audioBlob: Blob, result?: ShadowingEvaluationResponse) => void;
}

/**
 * Cột bên phải: Xem chi tiết bài nộp và lịch sử khảo thí AI của Ngày đang chọn
 * Đúng chuẩn thiết kế:
 * 1. Chỉ cho phép làm tối đa 3 lần nếu < 80 điểm, nếu không tính NOT PASS.
 * 2. Lịch sử hiển thị lần làm có điểm cao nhất.
 * 3. Nếu câu đã PASS (>= 80) thì khóa không cho làm lại, bắt buộc làm câu tiếp theo.
 */
export const SpeakingSubmissionDetailView: React.FC<SpeakingSubmissionDetailViewProps> = ({
  currentDay,
  currentAttempt,
  attempts,
  selectedQuestionIndex,
  questions,
  currentQ,
  activeAudioUrl,
  activeAudioBlob,
  aiReport,
  shadowingReport,
  reportQuestionId,
  isEvaluating,
  isSubmitting,
  isSubmitted,
  isShadowingMode,
  isRecording,
  recordingSeconds,
  isSynthesizingTts,
  isPlayingRefTts,
  selectedVoice,
  ttsSpeed,
  isPlayingStudentRec,
  onSelectQuestionIndex,
  onSelectAttempt,
  onRetake,
  onStartRecord,
  onStopRecord,
  onFileUpload,
  onEvaluateAi,
  onSubmit,
  onPlayTtsPrompt,
  onChangeVoice,
  onChangeSpeed,
  onAudioPlay,
  onAudioPause,
  onAudioEnded,
  onAudioSubmittedShadowing,
}) => {
  // Trạng thái bật/tắt Studio thu âm lại
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);

  // Tổng hợp kết quả đánh giá toàn bộ bài tập (theo cấu hình của giáo viên)
  const {
    completedAttempts,
    highestScore,
    bestAttempt,
    isPassed: isAssignmentPassed,
    passThreshold,
    maxAllowedError,
    maxAttemptsCount,
    isAttemptsExhausted,
    remainingAttempts,
  } = getAssignmentScoreSummary(attempts);

  // Nếu bài chưa nộp (IN_PROGRESS), luôn mở studio để học viên làm bài
  const isStudioActive = !isSubmitted || isStudioOpen;

  const totalQuestions = Math.max(1, questions.length);
  const currentStep = selectedQuestionIndex + 1;

  // Lấy câu mẫu tiếng Anh
  const referenceSentence = currentQ
    ? extractReferenceSentence(currentQ) || "No prompt provided"
    : "";

  // Điểm số & trạng thái câu hỏi hiện tại
  const currentQId = currentQ?.questionId || "";
  const currentQuestionBestScore = getQuestionBestScoreAcrossAttempts(
    currentQId,
    currentQ,
    attempts,
  );
  const isCurrentQPassed = isQuestionPassed(currentQId, currentQ, attempts);
  const nextUnpassedIndex = findNextUnpassedQuestionIndex(
    selectedQuestionIndex,
    questions,
    attempts,
  );

  // Format ngày giờ nộp bài
  const submittedDateFormatted = currentAttempt?.submittedAt
    ? new Date(currentAttempt.submittedAt).toLocaleString("vi-VN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  // Xử lý chuyển câu hỏi qua nút Carousel (< và >)
  const handlePrevQuestion = () => {
    if (selectedQuestionIndex > 0) {
      onSelectQuestionIndex(selectedQuestionIndex - 1);
    }
  };

  const handleNextQuestion = () => {
    if (selectedQuestionIndex < questions.length - 1) {
      onSelectQuestionIndex(selectedQuestionIndex + 1);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Header bài nộp: Tên ngày, loại bài, điểm số & nút luyện tập lại */}
      <div className="elp-card rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {isAssignmentPassed ? (
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                <CheckCircle2 size={11} />
                Đạt
              </span>
            ) : isAttemptsExhausted ? (
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-300 dark:border-rose-800 flex items-center gap-1 tabular-nums">
                <XCircle size={11} />
                Hết lượt ({maxAttemptsCount})
              </span>
            ) : (
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800 flex items-center gap-1 tabular-nums">
                <Clock size={11} />
                Còn {remainingAttempts}/{maxAttemptsCount} lượt
              </span>
            )}
          </div>

          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate mt-1 tabular-nums">
            Ngày {currentDay.dayNumber} • {isShadowingMode ? "Shadowing" : "Hỏi - đáp"}
          </h2>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium flex items-center gap-2 tabular-nums">
            <span>{currentDay.scheduledDate || currentDay.title}</span>
            <span>•</span>
            <span>{attempts.length}/{maxAttemptsCount} lượt</span>
            {highestScore > 0 && (
              <>
                <span>•</span>
                <span className="text-blue-700 dark:text-blue-400 font-bold">
                  {highestScore.toFixed(1)}đ
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Nút bật tắt Studio làm lại bài / Luyện tập lại */}
          {isSubmitted ? (
            isAssignmentPassed ? (
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold opacity-90 cursor-not-allowed"
              >
                <CheckCircle2 size={13} />
                <span>Đã đạt</span>
              </button>
            ) : isAttemptsExhausted ? (
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold opacity-90 cursor-not-allowed tabular-nums"
              >
                <XCircle size={13} />
                <span>Hết lượt</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onRetake}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition cursor-pointer tabular-nums"
              >
                <RotateCcw size={13} />
                <span>Làm lại ({remainingAttempts})</span>
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => setIsStudioOpen(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <Eye size={13} />
              <span>Lịch sử</span>
            </button>
          )}

          {/* Selector Lần nộp bài (Lần làm #1, #2...) */}
          {attempts.length > 1 && (
            <select
              value={currentAttempt?.attemptId || ""}
              onChange={(e) => {
                const target = attempts.find((a) => a.attemptId === e.target.value);
                if (target) onSelectAttempt(target);
              }}
              className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer outline-none"
            >
              {attempts.map((att) => {
                const isBest = att.attemptId === bestAttempt?.attemptId;
                const attScore = att.score ?? att.totalScore ?? null;
                return (
                  <option key={att.attemptId} value={att.attemptId}>
                    Lần #{att.attemptNumber}
                    {attScore !== null
                      ? ` (${normalizeScoreTo100(attScore).toFixed(1)}đ)`
                      : ""}
                    {isBest ? " • Cao nhất" : ""}
                  </option>
                );
              })}
            </select>
          )}
        </div>
      </div>

      {/* 2. KHUNG KẾT QUẢ TỔNG QUAN */}
      {isSubmitted && currentAttempt && !isStudioOpen && (
        <div className="elp-card rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-4 py-3.5 shadow-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`text-base font-black ${
                isAssignmentPassed
                  ? "text-emerald-600 dark:text-emerald-400"
                  : isAttemptsExhausted
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {isAssignmentPassed
                ? "Đạt"
                : isAttemptsExhausted
                ? "Chưa đạt (Hết lượt)"
                : "Chưa đạt"}
            </span>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 tabular-nums">
              • Đúng {questions.filter((q) => isQuestionPassed(q.questionId, q, attempts)).length}/{totalQuestions}
              {" • "}
              <span className="text-blue-700 dark:text-blue-400 font-mono font-black">
                {highestScore.toFixed(1)}đ
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] tabular-nums">
            {currentAttempt.attemptId === bestAttempt?.attemptId ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                <Award size={12} />
                <span>Cao nhất (#{currentAttempt.attemptNumber})</span>
              </span>
            ) : bestAttempt ? (
              <button
                type="button"
                onClick={() => onSelectAttempt(bestAttempt)}
                className="text-blue-700 dark:text-blue-400 font-bold hover:underline cursor-pointer"
              >
                Cao nhất (#{bestAttempt.attemptNumber})
              </button>
            ) : null}
            {submittedDateFormatted && (
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                {submittedDateFormatted}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 3. NỘI DUNG CHÍNH: XEM LỊCH SỬ BÀI NỘP HOẶC MỞ PHÒNG THU ÂM */}
      {!isStudioActive ? (
        /* CHẾ ĐỘ XEM BÀI NỘP VÀ BẢN THU ÂM (IMAGE 2) */
        <div className="elp-card rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 shadow-xs space-y-5">
          {/* A. TRÌNH PHÁT BẢN GHI ÂM CỦA HỌC SINH */}
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-inner space-y-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Mic size={14} className="text-emerald-400" />
              <span>Bản thu</span>
            </span>

            {activeAudioUrl && !isMockOrBrokenAudioUrl(activeAudioUrl) ? (
              <audio
                controls
                src={activeAudioUrl}
                className="w-full max-w-lg rounded-lg shadow-sm"
              />
            ) : (
              <div className="text-center py-3 text-xs text-slate-400">
                Chưa có bản thu
              </div>
            )}
          </div>

          {/* B. BỘ ĐIỀU HƯỚNG CAROUSEL CÂU HỎI (< Câu X/Y >) */}
          <div className="flex items-center justify-between border-y border-slate-100 dark:border-slate-800 py-3">
            <button
              type="button"
              disabled={selectedQuestionIndex === 0}
              onClick={handlePrevQuestion}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
            >
              <ChevronLeft size={16} />
              <span>Trước</span>
            </button>

            <div className="flex items-center justify-center gap-1.5 tabular-nums">
              <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                Câu {currentStep}/{totalQuestions}
              </span>
              {isCurrentQPassed ? (
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                  Đạt
                </span>
              ) : (
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-800">
                  Chưa đạt
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={selectedQuestionIndex >= questions.length - 1}
              onClick={handleNextQuestion}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
            >
              <span>Sau</span>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* C. ĐỀ BÀI CÂU HỎI & CÂU MẪU */}
          <div className="text-center space-y-2 py-2">
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              {currentQ?.promptText ||
                (currentQ as any)?.content ||
                (currentQ as any)?.sampleText ||
                referenceSentence ||
                "Câu hỏi Speaking"}
            </h3>

            {/* Nút nghe lại câu mẫu bản xứ (chỉ hiển thị cho Shadowing) */}
            {isShadowingMode && (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={onPlayTtsPrompt}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold hover:bg-blue-100 transition cursor-pointer"
                >
                  <Volume2 size={13} />
                  <span>Nghe mẫu</span>
                </button>
              </div>
            )}
          </div>

          {/* D. ĐIỂM SỐ & TRẠNG THÁI CÂU HỎI */}
          <div
            className={`px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm font-black border tabular-nums ${
              isCurrentQPassed
                ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300"
                : "bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300"
            }`}
          >
            <span>
              Câu {currentStep}: {currentQuestionBestScore.toFixed(1)}/100
            </span>
            <span>•</span>
            <span>{isCurrentQPassed ? "Đạt" : "Chưa đạt"}</span>
          </div>

          {/* E. BÁO CÁO CHI TIẾT AI */}
          {shadowingReport && reportQuestionId === currentQ?.questionId && (
            <div className="pt-2 animate-in fade-in">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={16} className="text-amber-500" />
                <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white">
                  Phân tích âm vị
                </h4>
              </div>
              <ShadowingEvaluationView data={shadowingReport} />
            </div>
          )}

          {aiReport && reportQuestionId === currentQ?.questionId && (
            <div className="pt-2">
              <IeltsSpeakingReportCard report={aiReport} />
            </div>
          )}

          {/* F. NHẬN XÉT CỦA GIÁO VIÊN */}
          {currentAttempt?.teacherFeedback && (
            <TeacherFeedbackCard
              teacherFeedback={currentAttempt.teacherFeedback}
              score={currentAttempt.score}
              dayNumber={currentDay.dayNumber}
            />
          )}
        </div>
      ) : (
        /* CHẾ ĐỘ THU ÂM & NỘP BÀI (STUDIO) */
        <div className="elp-card rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 shadow-xs space-y-5 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5 tabular-nums">
              <Mic size={14} className="text-blue-700 dark:text-blue-400" />
              <span>Thu âm • Ngày {currentDay.dayNumber}</span>
            </span>
            {isSubmitted && (
              <button
                type="button"
                onClick={() => setIsStudioOpen(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
              >
                Đóng
              </button>
            )}
          </div>

          {/* KIỂM TRA QUY TẮC CÂU ĐÃ PASS HOẶC HẾT LƯỢT */}
          {isCurrentQPassed ? (
            <div className="rounded-xl border border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/80 dark:bg-emerald-950/40 p-6 text-center space-y-3">
              <div className="inline-flex p-2.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                <Lock size={22} />
              </div>

              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums">
                  Câu {currentStep} đã đạt ({currentQuestionBestScore.toFixed(1)}/100)
                </h3>
              </div>

              <div className="pt-1 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                {nextUnpassedIndex !== -1 ? (
                  <button
                    type="button"
                    onClick={() => onSelectQuestionIndex(nextUnpassedIndex)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-sm transition cursor-pointer tabular-nums"
                  >
                    <span>Câu {nextUnpassedIndex + 1}</span>
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs">
                    <CheckCircle2 size={15} />
                    <span>Đã đạt tất cả</span>
                  </div>
                )}

                {isSubmitted && (
                  <button
                    type="button"
                    onClick={() => setIsStudioOpen(false)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <Eye size={14} />
                    <span>Lịch sử</span>
                  </button>
                )}
              </div>
            </div>
          ) : isAttemptsExhausted ? (
            <div className="rounded-xl border border-rose-300 dark:border-rose-700/60 bg-rose-50/80 dark:bg-rose-950/40 p-6 text-center space-y-2">
              <div className="inline-flex p-2.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                <XCircle size={22} />
              </div>
              <h3 className="text-sm sm:text-base font-black text-rose-900 dark:text-rose-200 tabular-nums">
                Hết lượt ({maxAttemptsCount}/{maxAttemptsCount})
              </h3>
            </div>
          ) : isShadowingMode ? (
            <SpeakingShadowingStudio
              questionId={currentQ?.questionId || ""}
              studentAnswerId={currentQ?.studentAnswerId || currentQ?.id || ""}
              referenceSentence={referenceSentence}
              referenceAudioUrl={currentQ?.mediaUrl}
              savedAudioUrl={activeAudioUrl || undefined}
              currentStep={currentStep}
              totalSteps={totalQuestions}
              onBack={() => setIsStudioOpen(false)}
              onAudioSubmitted={onAudioSubmittedShadowing || (() => {})}
            />
          ) : currentQ ? (
            <>
              <SpeakingPromptCard
                question={currentQ}
                isShadowingMode={isShadowingMode}
                isSynthesizingTts={isSynthesizingTts}
                isPlayingRefTts={isPlayingRefTts}
                selectedVoice={selectedVoice}
                ttsSpeed={ttsSpeed}
                showGuidelines={showGuidelines}
                onPlayTts={onPlayTtsPrompt}
                onChangeVoice={onChangeVoice}
                onChangeSpeed={onChangeSpeed}
                onToggleGuidelines={() => setShowGuidelines(!showGuidelines)}
                activeAudioUrl={activeAudioUrl}
                isPlayingStudentRec={isPlayingStudentRec}
                onTogglePlayStudentAudio={onAudioPlay}
              />

              <SpeakingRecordStudio
                activeAudioUrl={activeAudioUrl}
                isRecording={isRecording}
                recordingSeconds={recordingSeconds}
                isEvaluating={isEvaluating}
                isSubmitting={isSubmitting}
                isSubmitted={isSubmitted}
                dayNumber={currentDay.dayNumber}
                transcript={aiReport?.transcript}
                hasAudioBlob={!!activeAudioBlob}
                onStartRecord={onStartRecord}
                onStopRecord={onStopRecord}
                onFileUpload={onFileUpload}
                onEvaluateAi={onEvaluateAi}
                onSubmit={onSubmit}
                onAudioPlay={onAudioPlay}
                onAudioPause={onAudioPause}
                onAudioEnded={onAudioEnded}
              />
            </>
          ) : (
            <div className="p-8 text-center text-xs text-slate-500">
              Chưa có dữ liệu câu hỏi cho bài này.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SpeakingSubmissionDetailView;
