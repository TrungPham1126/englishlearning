// src/features/student/pages/SpeakingAiEvaluationPage.tsx
import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  cleanShadowingSentence,
  isMockOrBrokenAudioUrl,
  resolveFullAudioUrl,
} from "@/utils/sampleAudioPlayer";
import type {
  DaySpeakingGroup,
  FullSpeakingAiResult,
  SpeakingAssignmentItem,
} from "@/features/student/types";
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Video,
  Calendar,
  Mic,
} from "lucide-react";
import { useSpeakingDailyPlans } from "@/features/student/hooks/useSpeakingDailyPlans";
import { useSpeakingAudioRecorder } from "@/features/student/hooks/useSpeakingAudioRecorder";
import {
  SpeakingSubmissionDaysList,
  SpeakingSubmissionDetailView,
} from "@/features/student/components/speaking";

export type { DaySpeakingGroup, SpeakingAssignmentItem, FullSpeakingAiResult };

export default function SpeakingAiEvaluationPage() {
  const { assignmentId: routeAssignmentId, attemptId: routeAttemptId } =
    useParams<{ assignmentId?: string; attemptId?: string }>();
  const navigate = useNavigate();

  // 1. Quản lý Daily Plan, bài tập, lượt nộp bài & đánh giá AI
  const {
    courses,
    selectedClassId,
    setSelectedClassId,
    daysList,
    selectedDayId,
    selectedAssignmentId,
    attempts,
    currentAttempt,
    selectedQuestionIndex,
    setSelectedQuestionIndex,
    aiReport,
    shadowingReport,
    setShadowingReport,
    reportQuestionId,
    setReportQuestionId,
    loading,
    switching,
    isEvaluating,
    isSubmitting,
    actionMessage,
    setActionMessage,
    errorMessage,
    setErrorMessage,
    questions,
    currentQ,
    currentSelectedDay,
    isShadowingMode,
    isSubmitted,
    fetchDailyPlansAndSpeaking,
    extractAndSetAiReportForQuestion,
    handleSelectDay,
    handleSelectAssignment,
    handleSelectAttempt,
    handleStartNewAttempt,
    ensureStudentAnswerAudioUploaded,
    handleTriggerAiEvaluation,
    handleSubmitAssignment,
  } = useSpeakingDailyPlans({ routeAssignmentId, routeAttemptId });

  // 2. Quản lý thu âm học sinh & phát audio độc lập
  const [mobileTab, setMobileTab] = React.useState<"list" | "detail">("detail");
  const {
    isRecording,
    recordingSeconds,
    activeAudioUrl,
    setActiveAudioUrl,
    activeAudioBlob,
    setActiveAudioBlob,
    startRecording,
    stopRecording,
    handleFileUpload,
    resetAudioState,
    isPlayingRefTts,
    ttsSpeed,
    setTtsSpeed,
    selectedVoice,
    setSelectedVoice,
    isSynthesizingTts,
    handlePlayTtsPrompt,
    isPlayingStudentRec,
    setIsPlayingStudentRec,
  } = useSpeakingAudioRecorder();

  // Đồng bộ âm thanh bài nộp và báo cáo AI khi chuyển câu hỏi / lượt nộp
  useEffect(() => {
    resetAudioState();

    if (!currentQ) return;

    const rawStudentUrl =
      (currentQ as any)?.audioUrl ||
      (currentQ?.studentAnswer &&
      (currentQ.studentAnswer.startsWith("http") ||
        currentQ.studentAnswer.startsWith("blob:") ||
        currentQ.studentAnswer.startsWith("/uploads/"))
        ? currentQ.studentAnswer
        : null);

    if (rawStudentUrl && !isMockOrBrokenAudioUrl(rawStudentUrl)) {
      setActiveAudioUrl(resolveFullAudioUrl(rawStudentUrl));
    }

    extractAndSetAiReportForQuestion(currentQ, currentAttempt);
  }, [
    selectedQuestionIndex,
    currentAttempt?.attemptId,
    currentQ?.questionId,
    extractAndSetAiReportForQuestion,
    resetAudioState,
    setActiveAudioUrl,
  ]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-500 font-medium gap-3">
        <Loader2 className="animate-spin text-blue-700" size={32} />
        <span className="text-xs font-semibold">
          Đang tải danh sách bài nộp Speaking &amp; Shadowing...
        </span>
      </div>
    );
  }

  return (
    <div className="elp-page max-w-[1400px] mx-auto space-y-4 pb-16 font-sans">
      {/* 1. Header & Course Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800/80 bg-transparent">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/student/courses")}
            aria-label="Quay lại khóa học"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-2xs cursor-pointer touch-manipulation active:scale-95 shrink-0"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-950 dark:text-white">
              Lịch Sử Bài Nộp &amp; Đánh Giá
            </h1>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold mt-0.5">
              Theo dõi kết quả luyện nói, nghe lại bản thu âm và phân tích âm vị theo từng ngày học
            </p>
          </div>
        </div>

        {courses.length > 1 && (
          <div className="flex items-center gap-2 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg shadow-2xs">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">Lớp:</span>
            <select
              value={selectedClassId || ""}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedClassId(newId);
                fetchDailyPlansAndSpeaking(newId);
              }}
              className="bg-transparent text-xs font-semibold text-slate-900 dark:text-white outline-none cursor-pointer"
            >
              {courses.map((c) => (
                <option
                  key={c.classId}
                  value={c.classId}
                  className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  {c.className} ({c.level || "General"})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Chuyển đổi tab trên di động: Danh sách vs Chi tiết */}
      <div className="lg:hidden flex items-center p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setMobileTab("list")}
          className={`flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all touch-manipulation cursor-pointer ${
            mobileTab === "list"
              ? "bg-white dark:bg-[#111827] text-blue-700 dark:text-blue-400 shadow-sm font-extrabold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          <Calendar size={14} />
          <span>Danh Sách Ngày ({daysList.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("detail")}
          className={`flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all touch-manipulation cursor-pointer ${
            mobileTab === "detail"
              ? "bg-white dark:bg-[#111827] text-blue-700 dark:text-blue-400 shadow-sm font-extrabold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          <Mic size={14} />
          <span>Chi Tiết &amp; Luyện Âm AI</span>
        </button>
      </div>

      {/* Thông báo lỗi & kết quả */}
      {errorMessage && (
        <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-900 dark:text-rose-300 px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-700 dark:text-rose-300 hover:text-rose-900 font-bold ml-4 cursor-pointer text-sm"
          >
            ×
          </button>
        </div>
      )}

      {actionMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-300 px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 font-bold ml-4 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* 2. BỐ CỤC 2 CỘT CHUẨN MẪU: CỘT TRÁI (THEO NGÀY) & CỘT PHẢI (LỊCH SỬ BÀI NỘP) */}
      <div
        className={`grid grid-cols-1 lg:grid-cols-12 gap-5 items-start transition-opacity ${
          switching ? "opacity-60 pointer-events-none" : ""
        }`}
      >
        {/* Cột trái (4 cột): Danh sách Ngày có bài nộp AI */}
        <div className={`${mobileTab === "list" ? "block" : "hidden"} lg:block lg:col-span-4`}>
          <SpeakingSubmissionDaysList
            daysList={daysList}
            selectedDayId={selectedDayId}
            selectedAssignmentId={selectedAssignmentId}
            onSelectDay={(day) => {
              handleSelectDay(day);
              setMobileTab("detail");
            }}
            onSelectAssignment={(asgId) => {
              handleSelectAssignment(asgId);
              setMobileTab("detail");
            }}
          />
        </div>

        {/* Cột phải (8 cột): Xem chi tiết bài nộp & lịch sử */}
        <div className={`${mobileTab === "detail" ? "block" : "hidden"} lg:block lg:col-span-8 space-y-4`}>
          {currentSelectedDay ? (
            <SpeakingSubmissionDetailView
              currentDay={currentSelectedDay}
              currentAttempt={currentAttempt}
              attempts={attempts}
              selectedQuestionIndex={selectedQuestionIndex}
              questions={questions}
              currentQ={currentQ}
              activeAudioUrl={activeAudioUrl}
              activeAudioBlob={activeAudioBlob}
              aiReport={aiReport}
              shadowingReport={shadowingReport}
              reportQuestionId={reportQuestionId}
              isEvaluating={isEvaluating}
              isSubmitting={isSubmitting}
              isSubmitted={isSubmitted}
              isShadowingMode={isShadowingMode}
              isRecording={isRecording}
              recordingSeconds={recordingSeconds}
              isSynthesizingTts={isSynthesizingTts}
              isPlayingRefTts={isPlayingRefTts}
              selectedVoice={selectedVoice}
              ttsSpeed={ttsSpeed}
              isPlayingStudentRec={isPlayingStudentRec}
              onSelectQuestionIndex={setSelectedQuestionIndex}
              onSelectAttempt={handleSelectAttempt}
              onRetake={handleStartNewAttempt}
              onStartRecord={startRecording}
              onStopRecord={stopRecording}
              onFileUpload={handleFileUpload}
              onEvaluateAi={() => void handleTriggerAiEvaluation(activeAudioBlob, activeAudioUrl)}
              onSubmit={() => void handleSubmitAssignment(activeAudioBlob, activeAudioUrl)}
              onPlayTtsPrompt={() =>
                void handlePlayTtsPrompt(
                  cleanShadowingSentence(
                    currentQ?.promptText || currentQ?.transcript || "",
                  ),
                  currentQ,
                )
              }
              onChangeVoice={(voice) => setSelectedVoice(voice)}
              onChangeSpeed={(speed) => setTtsSpeed(speed)}
              onAudioPlay={() => setIsPlayingStudentRec(true)}
              onAudioPause={() => setIsPlayingStudentRec(false)}
              onAudioEnded={() => setIsPlayingStudentRec(false)}
              onAudioSubmittedShadowing={(blob, result) => {
                setActiveAudioBlob(blob);
                setActiveAudioUrl(URL.createObjectURL(blob));
                void ensureStudentAnswerAudioUploaded(blob);
                if (result) {
                  setShadowingReport(result);
                  setReportQuestionId(currentQ?.questionId || null);
                }
              }}
            />
          ) : (
            <div className="elp-card rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-12 text-center shadow-xs flex flex-col items-center justify-center min-h-[300px]">
              <AlertTriangle className="mb-2 text-amber-500" size={32} />
              <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                Vui lòng chọn một ngày học
              </h3>
              <p className="text-xs mt-1 max-w-md text-slate-500 dark:text-slate-400">
                Chọn một ngày ở cột bên trái để xem chi tiết lịch sử bài nộp.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
