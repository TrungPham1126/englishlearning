import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  ArrowLeft,
  Maximize2,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Mic,
  Square,
  RotateCcw,
  AlertTriangle,
  Volume2,
} from 'lucide-react';
import { studentApi } from '@/features/student/api/studentApi';
import type { AttemptResponse, QuestionResultDetail } from '@/features/student/types';
import { useExamProctoring } from '@/features/student/hooks/useExamProctoring';
import { sortQuestionOptions } from '@/utils/questionOptions';
import {
  resolveRestoredOptionId,
  resolveSubmitAnswerPayload,
} from '@/features/student/utils/questionReviewScoring';

type ExamPhase = 'LOADING' | 'PRE_START' | 'TESTING' | 'RESULT';

function resolveMediaUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    return url;
  }
  const base = import.meta.env.VITE_API_BASE_URL ?? '';
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

export default function ExamTakePage() {
  const { assignmentId, id } = useParams<{ assignmentId?: string; id?: string }>();
  const targetId = assignmentId || id || '';
  const navigate = useNavigate();

  const [phase, setPhase] = useState<ExamPhase>('LOADING');
  const [attempt, setAttempt] = useState<AttemptResponse | null>(null);
  const [history, setHistory] = useState<AttemptResponse[]>([]);
  const [answers, setAnswers] = useState<
    Record<string, { selectedOptionId?: string; textAnswer?: string; audioUrl?: string }>
  >({});

  const [activeSkillFilter, setActiveSkillFilter] = useState<string>('ALL');
  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(45 * 60);

  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Recording state for Speaking questions inside Exam
  const [recordingQId, setRecordingQId] = useState<string | null>(null);
  const [uploadingQId, setUploadingQId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const discardRecordingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const autoSubmitTriggeredRef = useRef<boolean>(false);
  const chunksRef = useRef<Blob[]>([]);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const stopExamRecorder = useCallback((discardPending = false) => {
    if (discardPending) {
      discardRecordingRef.current = true;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        // Ignore already-stopped recorder
      }
    }
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    chunksRef.current = [];
    if (isMountedRef.current) {
      setRecordingQId(null);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopExamRecorder(true);
    };
  }, [stopExamRecorder]);

  const hydrateAttempt = useCallback((detail: AttemptResponse) => {
    setAttempt(detail);
    const restored: Record<
      string,
      { selectedOptionId?: string; textAnswer?: string; audioUrl?: string }
    > = {};
    (detail.questions || []).forEach((q) => {
      restored[q.questionId] = {
        selectedOptionId: resolveRestoredOptionId(q),
        textAnswer: q.studentAnswer,
        audioUrl: q.audioUrl,
      };
    });
    setAnswers(restored);

    const limitMins =
      detail.timeLimitMinutes && detail.timeLimitMinutes > 0 ? detail.timeLimitMinutes : 45;
    if (detail.startedAt) {
      const elapsed = Math.floor((Date.now() - new Date(detail.startedAt).getTime()) / 1000);
      setRemainingSeconds(Math.max(30, limitMins * 60 - elapsed));
    } else {
      setRemainingSeconds(limitMins * 60);
    }
  }, []);

  useEffect(() => {
    if (!targetId) return;
    let mounted = true;
    setPhase('LOADING');
    setErrorBanner(null);

    studentApi
      .getMyAttempts(targetId)
      .then(async (list) => {
        if (!mounted) return;
        setHistory(list || []);

        const flaggedAtt = (list || []).find((a) => Boolean(a.isCheatingFlagged));
        if (flaggedAtt) {
          const detail = await studentApi.getAttemptDetail(flaggedAtt.attemptId);
          if (!mounted) return;
          hydrateAttempt(detail);
          setPhase('RESULT');
          return;
        }

        const inProgress = (list || []).find((a) => a.status === 'IN_PROGRESS');
        if (inProgress) {
          const detail = await studentApi.getAttemptDetail(inProgress.attemptId);
          if (!mounted) return;
          hydrateAttempt(detail);
          setPhase('PRE_START');
          return;
        }

        if (list && list.length > 0) {
          const latest = list[0];
          const detail = await studentApi.getAttemptDetail(latest.attemptId);
          if (!mounted) return;
          hydrateAttempt(detail);
          setPhase('RESULT');
          return;
        }

        setPhase('PRE_START');
      })
      .catch((err) => {
        console.error('Lỗi tải trạng thái bài thi:', err);
        if (mounted) setPhase('PRE_START');
      });

    return () => {
      mounted = false;
    };
  }, [targetId, hydrateAttempt]);

  const buildPayloadAnswers = useCallback(() => {
    const questions = attempt?.questions || [];
    const current = answersRef.current;
    return questions.map((q) => {
      const payload = resolveSubmitAnswerPayload(q, current[q.questionId]);
      return {
        questionId: payload.questionId,
        selectedOptionId: payload.selectedOptionId,
        textAnswer: payload.textAnswer,
      };
    });
  }, [attempt?.questions]);

  const {
    violationCount,
    warningModal,
    enterFullscreen,
    exitFullscreenSafely,
    dismissWarningAndResume,
  } = useExamProctoring({
    attemptId: attempt?.attemptId,
    active: phase === 'TESTING',
    strictFullscreen: attempt?.strictFullscreen !== false,
    maxViolations: attempt?.maxViolations || 3,
    initialViolationCount: attempt?.violationCount || 0,
    onGetCurrentAnswers: buildPayloadAnswers,
    onAttemptSynced: (updated) => {
      setAttempt((prev) => (prev ? { ...prev, ...updated } : updated));
    },
    onCheatingLockout: (flaggedAttempt) => {
      hydrateAttempt(flaggedAttempt);
      setPhase('RESULT');
    },
  });

  const handleSubmitExam = useCallback(
    async (isAutoTimeout = false) => {
      if (!attempt || !targetId || isSubmitting) return;
      if (!isAutoTimeout && !window.confirm('Bạn chắc chắn muốn nộp bài thi ngay bây giờ?')) {
        return;
      }
      setIsSubmitting(true);
      try {
        const res = await studentApi.submitAssignment(
          targetId,
          attempt.attemptId,
          buildPayloadAnswers(),
        );
        window.dispatchEvent(
          new CustomEvent("student-progress-updated", {
            detail: { assignmentId: targetId, attemptId: attempt.attemptId },
          }),
        );
        const detail = await studentApi.getAttemptDetail(res.attemptId || attempt.attemptId);
        await exitFullscreenSafely();
        hydrateAttempt(detail);
        setPhase('RESULT');
      } catch (err: any) {
        console.error('Lỗi nộp bài thi:', err);
        setErrorBanner(
          err?.response?.data?.message || 'Không thể nộp bài thi. Vui lòng thử lại.',
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [attempt, targetId, isSubmitting, buildPayloadAnswers, exitFullscreenSafely, hydrateAttempt],
  );

  // Countdown timer during TESTING
  useEffect(() => {
    if (phase !== 'TESTING') {
      autoSubmitTriggeredRef.current = false;
      stopExamRecorder(true);
      return;
    }
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, stopExamRecorder]);

  useEffect(() => {
    if (phase === 'TESTING' && remainingSeconds <= 0 && !autoSubmitTriggeredRef.current) {
      autoSubmitTriggeredRef.current = true;
      void handleSubmitExam(true);
    }
  }, [phase, remainingSeconds, handleSubmitExam]);

  const handleEnterFullscreenAndStart = async (forceNewAttempt = false) => {
    if (!targetId) return;
    setErrorBanner(null);
    setIsStarting(true);
    try {
      let currentDetail = attempt;
      if (forceNewAttempt || !currentDetail || currentDetail.status !== 'IN_PROGRESS') {
        const started = await studentApi.startAssignment(targetId);
        currentDetail = await studentApi.getAttemptDetail(started.attemptId);
      }
      hydrateAttempt(currentDetail);
      await enterFullscreen();
      setActiveQuestionIdx(0);
      setPhase('TESTING');
    } catch (err: any) {
      setErrorBanner(
        err?.response?.data?.message || 'Không thể khởi tạo phiên thi toàn màn hình.',
      );
    } finally {
      setIsStarting(false);
    }
  };

  const handleToggleRecording = async (qId: string) => {
    if (!attempt) return;
    if (recordingQId === qId && mediaRecorderRef.current) {
      discardRecordingRef.current = false;
      mediaRecorderRef.current.stop();
      setRecordingQId(null);
      return;
    }
    stopExamRecorder(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isMountedRef.current || phase !== 'TESTING') {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      mediaStreamRef.current = stream;
      discardRecordingRef.current = false;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (mediaStreamRef.current === stream) {
          mediaStreamRef.current = null;
        }
        if (mediaRecorderRef.current === recorder) {
          mediaRecorderRef.current = null;
        }
        if (discardRecordingRef.current || !isMountedRef.current) {
          discardRecordingRef.current = false;
          chunksRef.current = [];
          return;
        }
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        chunksRef.current = [];
        setUploadingQId(qId);
        try {
          const updated = await studentApi.uploadSpeakingAudio(attempt.attemptId, qId, blob);
          if (!isMountedRef.current) return;
          const matchedQ = updated.questions?.find((x) => x.questionId === qId);
          setAnswers((prev) => ({
            ...prev,
            [qId]: { ...prev[qId], audioUrl: matchedQ?.audioUrl || prev[qId]?.audioUrl },
          }));
        } catch (err: any) {
          if (isMountedRef.current) {
            setErrorBanner(err?.response?.data?.message || 'Tải lên file ghi âm thất bại.');
          }
        } finally {
          if (isMountedRef.current) {
            setUploadingQId(null);
          }
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingQId(qId);
    } catch {
      if (isMountedRef.current) {
        setErrorBanner('Không thể truy cập micro để ghi âm.');
      }
    }
  };

  const questions = attempt?.questions || [];
  const availableSkills = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => {
      if (q.skillType) set.add(q.skillType.toUpperCase());
    });
    return Array.from(set);
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    if (activeSkillFilter === 'ALL') return questions;
    return questions.filter((q) => String(q.skillType || '').toUpperCase() === activeSkillFilter);
  }, [questions, activeSkillFilter]);

  const activeQuestion: QuestionResultDetail | undefined =
    filteredQuestions[activeQuestionIdx] || filteredQuestions[0];

  const parsedViolations = useMemo(() => {
    if (!attempt?.violationLogJson) return [];
    try {
      const arr = JSON.parse(attempt.violationLogJson);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }, [attempt?.violationLogJson]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (phase === 'LOADING') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-2.5 text-slate-500">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
        <p className="text-sm font-medium">Đang tải bài thi...</p>
      </div>
    );
  }

  // ==================== 1. PRE-START GATE ====================
  if (phase === 'PRE_START') {
    const examTitle = attempt?.assignmentTitle || 'Bài thi';
    const maxLimit = attempt?.maxViolations || 3;
    const isResuming = attempt?.status === 'IN_PROGRESS';

    return (
      <div className="max-w-xl mx-auto py-8 px-4 space-y-5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại
        </button>

        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/70 bg-white dark:bg-[#111827] p-6 space-y-5 shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-700 text-white shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white truncate">
                {examTitle}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Toàn màn hình • Lưu bài làm
              </p>
            </div>
          </div>

          {errorBanner && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-bold text-rose-700 dark:text-rose-300">
              {errorBanner}
            </div>
          )}

          <div className="rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 p-3.5 space-y-1.5 text-xs text-amber-950 dark:text-amber-200">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Quy định phòng thi</span>
            </div>
            <ul className="list-disc pl-5 space-y-0.5 font-medium">
              <li>Không thoát toàn màn hình hoặc chuyển tab.</li>
              <li>
                Cảnh báo 2 lần; vi phạm lần {maxLimit} sẽ tự khóa bài.
              </li>
            </ul>
          </div>

          <div className="flex items-center justify-end pt-1">
            <button
              type="button"
              disabled={isStarting}
              onClick={() => void handleEnterFullscreenAndStart(!isResuming)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-extrabold text-white shadow-sm hover:bg-indigo-600 disabled:opacity-50 cursor-pointer"
            >
              {isStarting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang mở...</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4" />
                  <span>{isResuming ? 'Tiếp tục thi' : 'Bắt đầu thi'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== 2. ACTIVE PROCTORED TESTING MODE ====================
  if (phase === 'TESTING' && attempt) {
    const maxLimit = attempt.maxViolations || 3;
    const currentAns = activeQuestion ? answers[activeQuestion.questionId] : undefined;

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col select-none">
        {/* Warning Strike Overlay (Strike 1 & 2) */}
        {warningModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
            <div className="max-w-md w-full rounded-2xl border-2 border-amber-500 bg-slate-900 p-6 text-center space-y-4 shadow-2xl">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <div className="space-y-1.5">
                <span className="inline-block rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-black text-amber-300 tabular-nums">
                  Cảnh báo {warningModal.count}/{warningModal.max - 1}
                </span>
                <h2 className="text-lg font-black text-white">
                  Rời khỏi màn hình thi
                </h2>
                <p className="text-xs text-slate-300">
                  {warningModal.reason}
                </p>
                <p className="text-xs font-bold text-rose-400 tabular-nums">
                  Còn {Math.max(1, warningModal.max - warningModal.count)} lần trước khi tự động khóa bài.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void dismissWarningAndResume()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-black text-slate-950 hover:bg-amber-400 cursor-pointer"
              >
                <Maximize2 className="h-4 w-4" />
                <span>Tiếp tục thi</span>
              </button>
            </div>
          </div>
        )}

        {/* Top Sticky Proctoring Header */}
        <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/95 backdrop-blur px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-extrabold text-white truncate">
              {attempt.assignmentTitle}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-extrabold border tabular-nums ${
                violationCount > 0
                  ? 'border-rose-500/50 bg-rose-500/15 text-rose-300'
                  : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>
                Vi phạm {violationCount}/{maxLimit}
              </span>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-mono font-black text-amber-300 tabular-nums">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatTimer(remainingSeconds)}</span>
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleSubmitExam(false)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-extrabold text-white hover:bg-blue-500 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span>Nộp bài</span>
            </button>
          </div>
        </header>

        {/* Body Grid */}
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Main Question Workspace */}
          <div className="lg:col-span-8 space-y-4">
            {errorBanner && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 p-3 text-xs text-rose-200">
                {errorBanner}
              </div>
            )}

            {/* Filter by skill if multi-skill */}
            {availableSkills.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {(['ALL', ...availableSkills] as const).map((sk) => (
                  <button
                    key={sk}
                    type="button"
                    onClick={() => {
                      setActiveSkillFilter(sk);
                      setActiveQuestionIdx(0);
                    }}
                    className={`rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer ${
                      activeSkillFilter === sk
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {sk === 'ALL' ? `Tất cả (${questions.length})` : sk}
                  </button>
                ))}
              </div>
            )}

            {attempt.audioUrl && (
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 flex items-center gap-3">
                <Volume2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-slate-300 shrink-0">Audio</span>
                <audio controls src={resolveMediaUrl(attempt.audioUrl)} className="h-8 w-full" />
              </div>
            )}

            {activeQuestion && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded-md bg-blue-600 px-2.5 py-0.5 text-xs font-extrabold text-white tabular-nums">
                        Câu {activeQuestionIdx + 1}/{filteredQuestions.length}
                      </span>
                      {activeQuestion.skillType && (
                        <span className="rounded-md bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 text-[11px] font-bold text-indigo-300">
                          {activeQuestion.skillType}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        {activeQuestion.maxPoints || 1}đ
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-sm sm:text-base font-semibold text-white whitespace-pre-wrap leading-relaxed">
                  {activeQuestion.promptText}
                </p>

                {activeQuestion.mediaUrl && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                    <audio controls src={resolveMediaUrl(activeQuestion.mediaUrl)} className="h-9 w-full" />
                  </div>
                )}

                {/* Question Type Controls */}
                {activeQuestion.options && activeQuestion.options.length > 0 ? (
                  activeQuestion.questionType === 'MATCHING' ? (
                    <div className="space-y-2.5">
                      <input
                        type="text"
                        value={currentAns?.textAnswer || ''}
                        onChange={(e) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [activeQuestion.questionId]: {
                              ...prev[activeQuestion.questionId],
                              textAnswer: e.target.value,
                            },
                          }))
                        }
                        placeholder="Nhập đáp án..."
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 grid-flow-row gap-2.5">
                      {sortQuestionOptions(activeQuestion.options).map((opt, optIdx) => {
                        const chosen = currentAns?.selectedOptionId === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                              setAnswers((prev) => ({
                                ...prev,
                                [activeQuestion.questionId]: {
                                  ...prev[activeQuestion.questionId],
                                  selectedOptionId: opt.id,
                                  textAnswer: opt.optionText,
                                },
                              }))
                            }
                            className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition cursor-pointer flex items-center gap-3 ${
                              chosen
                                ? 'border-blue-500 bg-blue-600/20 text-white font-bold'
                                : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-extrabold ${
                                chosen
                                  ? 'border-blue-400 bg-blue-600 text-white'
                                  : 'border-slate-700 text-slate-400'
                              }`}
                            >
                              {opt.optionLabel || String.fromCharCode(65 + optIdx)}
                            </span>
                            <span>{opt.optionText}</span>
                          </button>
                        );
                      })}
                    </div>
                  )
                ) : activeQuestion.questionType === 'AUDIO_RESPONSE' ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-300">
                        Ghi âm
                      </span>
                      <button
                        type="button"
                        disabled={uploadingQId === activeQuestion.questionId}
                        onClick={() => void handleToggleRecording(activeQuestion.questionId)}
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold text-white cursor-pointer ${
                          recordingQId === activeQuestion.questionId
                            ? 'bg-rose-600 hover:bg-rose-500'
                            : 'bg-emerald-600 hover:bg-emerald-500'
                        }`}
                      >
                        {uploadingQId === activeQuestion.questionId ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Đang lưu...</span>
                          </>
                        ) : recordingQId === activeQuestion.questionId ? (
                          <>
                            <Square className="h-4 w-4" />
                            <span>Dừng</span>
                          </>
                        ) : (
                          <>
                            <Mic className="h-4 w-4" />
                            <span>Ghi âm</span>
                          </>
                        )}
                      </button>
                    </div>
                    {currentAns?.audioUrl && (
                      <audio controls src={resolveMediaUrl(currentAns.audioUrl)} className="h-9 w-full" />
                    )}
                  </div>
                ) : activeQuestion.questionType === 'ESSAY' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Bài viết</span>
                      <span className="font-mono tabular-nums">
                        {currentAns?.textAnswer?.trim()
                          ? currentAns.textAnswer.trim().split(/\s+/).filter(Boolean).length
                          : 0}{' '}
                        từ
                      </span>
                    </div>
                    <textarea
                      rows={8}
                      value={currentAns?.textAnswer || ''}
                      onChange={(e) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [activeQuestion.questionId]: {
                            ...prev[activeQuestion.questionId],
                            textAnswer: e.target.value,
                          },
                        }))
                      }
                      placeholder="Viết bài..."
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3.5 text-sm text-white outline-none focus:border-blue-500 select-text"
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={currentAns?.textAnswer || ''}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [activeQuestion.questionId]: {
                          ...prev[activeQuestion.questionId],
                          textAnswer: e.target.value,
                        },
                      }))
                    }
                    placeholder="Nhập đáp án..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-blue-500 select-text"
                  />
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    disabled={activeQuestionIdx === 0}
                    onClick={() => setActiveQuestionIdx((i) => Math.max(0, i - 1))}
                    className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                  >
                    Trước
                  </button>
                  <button
                    type="button"
                    disabled={activeQuestionIdx >= filteredQuestions.length - 1}
                    onClick={() =>
                      setActiveQuestionIdx((i) => Math.min(filteredQuestions.length - 1, i + 1))
                    }
                    className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Question Palette */}
          <aside className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                  Câu hỏi ({filteredQuestions.length})
                </h3>
                <span className="text-xs text-slate-400 tabular-nums">
                  {
                    filteredQuestions.filter((q) => {
                      const a = answers[q.questionId];
                      return Boolean(a?.selectedOptionId || a?.textAnswer?.trim() || a?.audioUrl);
                    }).length
                  }
                  /{filteredQuestions.length}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {filteredQuestions.map((q, idx) => {
                  const a = answers[q.questionId];
                  const isDone = Boolean(
                    a?.selectedOptionId || a?.textAnswer?.trim() || a?.audioUrl,
                  );
                  const isCurr = idx === activeQuestionIdx;
                  return (
                    <button
                      key={q.questionId}
                      type="button"
                      onClick={() => setActiveQuestionIdx(idx)}
                      className={`h-9 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                        isCurr
                          ? 'ring-2 ring-blue-400 bg-blue-600 text-white'
                          : isDone
                            ? 'bg-emerald-600/25 border border-emerald-500/40 text-emerald-300'
                            : 'bg-slate-950 border border-slate-800 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // ==================== 3. RESULT / CHEATING LOCKOUT / FULL REVIEW ====================
  const isCheating = Boolean(attempt?.isCheatingFlagged);
  const maxAttempts = attempt?.maxAttempts || 1;
  const canRetakeExam = !isCheating && history.length < maxAttempts;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại
        </button>

        {canRetakeExam && (
          <button
            type="button"
            disabled={isStarting}
            onClick={() => void handleEnterFullscreenAndStart(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-indigo-600 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Thi lại</span>
          </button>
        )}
      </div>

      {/* Cheating Lockout or Submission Summary */}
      <div
        className={`rounded-2xl border p-6 space-y-4 shadow-sm ${
          isCheating
            ? 'border-rose-500/50 bg-rose-50 dark:bg-rose-950/30'
            : 'border-emerald-500/40 bg-emerald-50/70 dark:bg-emerald-950/20'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {isCheating ? (
              <ShieldAlert className="h-8 w-8 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="h-8 w-8 text-emerald-600 shrink-0" />
            )}
            <div className="space-y-1">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                {attempt?.assignmentTitle || 'Kết quả'}
              </h1>
              {isCheating ? (
                <p className="text-xs sm:text-sm font-bold text-rose-700 dark:text-rose-300 tabular-nums">
                  Bài thi bị khóa do vi phạm ({attempt?.violationCount ?? 3}/
                  {attempt?.maxViolations ?? 3})
                </p>
              ) : (
                <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">
                  {attempt?.status === 'COMPLETED'
                    ? 'Đã chấm điểm.'
                    : 'Đã nộp, đang chờ chấm.'}
                </p>
              )}
              {attempt?.cheatingReason && (
                <p className="text-xs text-rose-600 dark:text-rose-300 font-medium">
                  Lý do: {attempt.cheatingReason}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-right">
            <span className="block text-[10px] font-bold uppercase text-slate-400">
              Điểm
            </span>
            <span className="text-2xl font-black tabular-nums text-blue-700 dark:text-blue-400">
              {attempt?.score ?? 0}/10
            </span>
          </div>
        </div>

        {attempt?.teacherFeedback && (
          <div className="rounded-xl border border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-900 p-4 space-y-1">
            <span className="text-[11px] font-extrabold uppercase text-blue-700 dark:text-blue-400">
              Nhận xét:
            </span>
            <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
              {attempt.teacherFeedback}
            </p>
          </div>
        )}

        {parsedViolations.length > 0 && (
          <div className="rounded-xl border border-rose-300/60 dark:border-rose-800/60 bg-white/80 dark:bg-slate-900/80 p-3.5 space-y-1.5">
            <span className="text-[11px] font-extrabold uppercase text-rose-700 dark:text-rose-300">
              Vi phạm màn hình:
            </span>
            <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
              {parsedViolations.map((v: any, idx: number) => (
                <li key={idx}>
                  Lần {v.count ?? idx + 1} ({v.eventType || 'FOCUS_LOST'}):{' '}
                  {v.reason || 'Rời khỏi màn hình thi'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Full Persisted Answers Review */}
      <div className="space-y-3">
        <h2 className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
          Bài làm ({questions.length})
        </h2>

        {questions.map((q, idx) => (
          <div
            key={q.questionId || idx}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                <span className="text-blue-600 mr-1">Câu {idx + 1}:</span>
                {q.promptText}
              </p>
              <div className="flex items-center gap-1.5 shrink-0">
                {q.skillType && (
                  <span className="rounded bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                    {q.skillType}
                  </span>
                )}
                {q.isCorrect ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-slate-400" />
                )}
              </div>
            </div>

            {q.studentAnswer && (
              <div className="rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                <strong>Bài làm:</strong> {q.studentAnswer}
              </div>
            )}

            {q.audioUrl && (
              <audio controls src={resolveMediaUrl(q.audioUrl)} className="h-8 w-full" />
            )}

            {q.correctAnswer && (
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                Đáp án: {q.correctAnswer}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
