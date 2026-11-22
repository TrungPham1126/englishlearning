// src/features/student/pages/AssignmentTakePage.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  Loader2,
  ArrowLeft,
  BookOpen,
  ShieldAlert,
  Award,
  CheckCircle2,
  ArrowRight,
  Lock,
  Send,
} from 'lucide-react';
import type {
  QuestionResultDetail,
  ShadowingEvaluationResponse,
  SpeakingAiEvaluationResult,
  WritingAiEvaluationResult,
} from '@/features/student/types';
import { isQuestionPassed } from '@/features/student/utils/speakingScoring';
import { isGradingRubricOrMetaText } from '@/utils/sampleAudioPlayer';
import useAssignmentTakeSession from '@/features/student/hooks/useAssignmentTakeSession';
import AssignmentTopBar from '@/features/student/components/assignment/AssignmentTopBar';
import QuestionContextView from '@/features/student/components/assignment/QuestionContextView';
import AssignmentResultBanner from '@/features/student/components/assignment/AssignmentResultBanner';
import QuestionRendererPolymorphic from '@/features/student/components/assignment/QuestionRendererPolymorphic';
import AssignmentFooterNav from '@/features/student/components/assignment/AssignmentFooterNav';
import SubmitConfirmModal from '@/features/student/components/assignment/SubmitConfirmModal';
import VocabularyMatchingBoard from '@/features/student/components/VocabularyMatchingBoard';

export default function AssignmentTakePage() {
  const session = useAssignmentTakeSession();

  const {
    assignmentId,
    phase,
    previousAttempts,
    attempt,
    questions,
    studyMode,
    setStudyMode,
    checkedQuestions,
    expandedHints,
    setExpandedHints,
    flaggedQuestions,
    toggleFlagQuestion,
    activeQuestionIdx,
    setActiveQuestionIdx,
    remainingSeconds,
    readingMobileTab,
    setReadingMobileTab,
    showMobilePalette,
    setShowMobilePalette,
    isSubmitModalOpen,
    setIsSubmitModalOpen,
    fontSizeLevel,
    setFontSizeLevel,
    passageContainerRef,
    answers,
    updateAnswer,
    handleMatchingAnswers,
    isStarting,
    isSubmitting,
    isUploadingAudio,
    isReadingTest,
    isListeningTest,
    isSpeakingTest,
    isVocabTest,
    isVocabMatching,
    readingPassageText,
    answeredQuestionsCount,
    streakCount,
    reviewStats,
    retakeEvaluation,
    scrollToQuestion,
    resolveAudioUrl,
    speakText,
    audioRef,
    mainAudioUrl,
    isPlayingAudio,
    toggleAudioPlay,
    audioCurrentTime,
    audioDuration,
    handleSeekAudio,
    handleSkipAudio,
    playbackRate,
    handleRateChange,
    isMuted,
    toggleMute,
    showListeningScript,
    setShowListeningScript,
    isPlayingAiVoice,
    toggleAiVoiceStream,
    listeningSegments,
    isRepairingListeningAudio,
    handleRepairListeningAudio,
    handleCheckInstantAnswer,
    handleStartNewAttempt,
    handleSubmitTest,
    applyHighlight,
    removeAllHighlights,
    handleUploadSpeaking,
    navigate,
  } = session;

  // Trạng thái cho chế độ làm bài tuần tự (Speaking / Writing)
  const [passedQuestionIds, setPassedQuestionIds] = useState<Record<string, boolean>>({});
  const [questionFailCounts, setQuestionFailCounts] = useState<Record<string, number>>({});
  const [skippedQuestionIds, setSkippedQuestionIds] = useState<Record<string, boolean>>({});
  const [markedNotPassedQuestionIds, setMarkedNotPassedQuestionIds] = useState<Record<string, boolean>>({});

  const isWritingQuestion = useCallback((q: QuestionResultDetail) => {
    const t = String(q.questionType || '').toUpperCase();
    const skill = String(q.skillType || '').toUpperCase();
    if (skill === 'SPEAKING' || t === 'AUDIO_RESPONSE' || t.includes('SPEAKING')) {
      return false;
    }
    const promptLower = (q.promptText || '').toLowerCase();
    return (
      t === 'ESSAY' ||
      t === 'WRITING' ||
      t === 'PARAGRAPH' ||
      promptLower.includes('viết đoạn') ||
      promptLower.includes('write a paragraph') ||
      promptLower.includes('ielts')
    );
  }, []);

  const isSpeakingNonShadowingQuestion = useCallback(
    (q: QuestionResultDetail) => {
      const t = String(q.questionType || '').toUpperCase();
      const skill = String(q.skillType || '').toUpperCase();
      if (skill !== 'SPEAKING' && t !== 'AUDIO_RESPONSE' && !t.includes('SPEAKING')) {
        return false;
      }
      const meta = `${t} ${attempt?.assignmentTitle || ''} ${(attempt as any)?.assignmentDescription || ''} ${(attempt as any)?.description || ''} ${attempt?.passage || ''}`.toLowerCase();
      const hasQaSignal =
        t.includes('QA') ||
        t.includes('PART_2') ||
        t.includes('PART_3') ||
        meta.includes('q&a') ||
        meta.includes('hỏi - đáp') ||
        meta.includes('hỏi đáp') ||
        meta.includes('part 2') ||
        meta.includes('part_2') ||
        meta.includes('part 3') ||
        meta.includes('part_3') ||
        meta.includes('cue card') ||
        isGradingRubricOrMetaText(q.correctAnswer) ||
        isGradingRubricOrMetaText(q.promptText);
      if (hasQaSignal) return true;
      const hasShadowSignal =
        meta.includes('shadow') || meta.includes('nhại') || meta.includes('đọc đuổi');
      return !hasShadowSignal;
    },
    [attempt],
  );

  const isSpeakingShadowingSession = useMemo(() => {
    return (
      Boolean(isSpeakingTest) ||
      questions.some((q) => {
        const t = String(q.questionType || '').toUpperCase();
        return t === 'SPEAKING' || t === 'AUDIO_RESPONSE';
      })
    );
  }, [isSpeakingTest, questions]);

  const isWritingSession = useMemo(() => {
    return questions.some((q) => isWritingQuestion(q));
  }, [questions, isWritingQuestion]);

  const isSequentialSession = useMemo(() => {
    return isSpeakingShadowingSession || isWritingSession;
  }, [isSpeakingShadowingSession, isWritingSession]);

  const targetPassBand = useMemo(() => {
    if (!attempt?.passScore) return 6.0;
    const ps = Number(attempt.passScore);
    if (ps > 0 && ps <= 9.0) return ps;
    if (ps > 9.0 && ps <= 10.0) return ps;
    if (ps > 10.0) return Number((ps / 10).toFixed(1));
    return 6.0;
  }, [attempt?.passScore]);

  const handleSpeakingAudioUpload = useCallback(
    (
      questionId: string,
      blob: Blob,
      result?: ShadowingEvaluationResponse | SpeakingAiEvaluationResult,
    ) => {
      void handleUploadSpeaking(questionId, blob, result);
      if (result) {
        const isPassed =
          typeof (result as any).isPassed === 'boolean'
            ? (result as any).isPassed
            : typeof (result as any).overallBand === 'number'
            ? Number((result as any).overallBand) >= 5.0
            : Number((result as any).overallScore ?? (result as any).score ?? 0) >=
              Number((result as any).passScore ?? 80);
        if (isPassed) {
          setPassedQuestionIds((prev) => ({ ...prev, [questionId]: true }));
        } else {
          setQuestionFailCounts((prev) => ({
            ...prev,
            [questionId]: (prev[questionId] || 0) + 1,
          }));
        }
      }
    },
    [handleUploadSpeaking],
  );

  const handleWritingEvaluated = useCallback(
    (
      questionId: string,
      result: WritingAiEvaluationResult,
      text: string,
      isPassed: boolean,
    ) => {
      updateAnswer(questionId, { textAnswer: text });
      if (isPassed) {
        setPassedQuestionIds((prev) => ({ ...prev, [questionId]: true }));
      } else {
        setQuestionFailCounts((prev) => {
          const nextCount = (prev[questionId] || 0) + 1;
          if (nextCount >= 3) {
            setMarkedNotPassedQuestionIds((p) => ({ ...p, [questionId]: true }));
          }
          return { ...prev, [questionId]: nextCount };
        });
      }
    },
    [updateAnswer],
  );

  const isQuestionCompletedOrSkipped = useCallback(
    (qId: string, qDetail: QuestionResultDetail) => {
      if (
        passedQuestionIds[qId] ||
        skippedQuestionIds[qId] ||
        markedNotPassedQuestionIds[qId]
      ) {
        return true;
      }
      return isQuestionPassed(qId, qDetail, attempt ? [attempt] : []);
    },
    [passedQuestionIds, skippedQuestionIds, markedNotPassedQuestionIds, attempt],
  );

  // Memoized callbacks để ngăn re-render toàn bộ cây component phòng thi
  const handleToggleHint = useCallback(
    (id: string) => setExpandedHints((prev) => ({ ...prev, [id]: !prev[id] })),
    [setExpandedHints]
  );

  const handleToggleListeningScript = useCallback(
    () => setShowListeningScript((prev) => !prev),
    [setShowListeningScript]
  );

  const handleSelectQuestion = useCallback(
    (idx: number, qId: string) => {
      setActiveQuestionIdx(idx);
      scrollToQuestion(qId);
      setShowMobilePalette(false);
    },
    [setActiveQuestionIdx, scrollToQuestion, setShowMobilePalette]
  );

  const handleOpenSubmitModal = useCallback(
    () => setIsSubmitModalOpen(true),
    [setIsSubmitModalOpen]
  );

  const handleCloseMobilePalette = useCallback(
    () => setShowMobilePalette(false),
    [setShowMobilePalette]
  );

  const handleChangeFontSize = useCallback(() => {
    setFontSizeLevel((prev) =>
      prev === 'normal' ? 'large' : prev === 'large' ? 'xlarge' : 'normal'
    );
  }, [setFontSizeLevel]);

  if (phase === 'CHECKING') {
    return (
      <div className="p-20 text-center text-xs font-medium text-slate-500 flex flex-col items-center justify-center gap-2.5 min-h-[50vh]">
        <Loader2 className="animate-spin text-blue-700" size={24} />
        <span>Đang tải...</span>
      </div>
    );
  }

  if (phase === 'EXHAUSTED' || phase === 'INTRO') {
    const completedList = previousAttempts.filter((a) => a.status !== 'IN_PROGRESS');
    const isExhausted = phase === 'EXHAUSTED';

    return (
      <div className="max-w-lg mx-auto my-10 space-y-4 px-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Quay lại"
          className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 text-center space-y-5">
          <div className="h-14 w-14 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 flex items-center justify-center mx-auto">
            {isExhausted ? (
              <ShieldAlert size={28} className="text-amber-500" />
            ) : (
              <BookOpen size={28} />
            )}
          </div>

          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-950 dark:text-white">
              {isExhausted
                ? 'Hết lượt làm bài'
                : previousAttempts[0]?.assignmentTitle || 'Bài tập'}
            </h1>
            {isExhausted && (
              <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
                Bạn đã dùng hết số lượt cho phép.
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {completedList.length > 0 && (
              <button
                type="button"
                onClick={() => navigate(`/student/assignments/${assignmentId}/submissions/latest`)}
                className="w-full sm:w-auto min-h-[42px] px-5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                Lịch sử nộp bài
              </button>
            )}

            {!isExhausted && (
              <button
                type="button"
                disabled={isStarting}
                onClick={handleStartNewAttempt}
                className="w-full sm:w-auto min-h-[42px] flex items-center justify-center gap-2 px-6 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm transition cursor-pointer disabled:opacity-50"
              >
                {isStarting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Đang mở...</span>
                  </>
                ) : (
                  <>
                    <Award size={16} />
                    <span>Bắt đầu</span>
                  </>
                )}
              </button>
            )}
          </div>

          {completedList.length > 0 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-left space-y-2">
              <h4 className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                Lịch sử ({completedList.length})
              </h4>
              <div className="space-y-1.5">
                {completedList.map((att, idx) => (
                  <div
                    key={att.attemptId}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-bold tabular-nums"
                  >
                    <span className="text-slate-700 dark:text-slate-300">
                      Lượt #{att.attemptNumber || idx + 1}
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {att.score != null ? `${Number(att.score).toFixed(1)}đ` : 'Đã nộp'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. GIAI ĐOẠN LÀM BÀI HOẶC XEM LẠI (TESTING / REVIEW PHASES)
  return (
    <div className="max-w-[1550px] mx-auto space-y-4 pb-24 px-3 sm:px-4">
      {/* 1. TOPBAR CỐ ĐỊNH CHUẨN CBT SHELL */}
      <AssignmentTopBar
        attempt={attempt}
        phase={phase}
        questionsCount={questions.length}
        answeredCount={answeredQuestionsCount}
        remainingSeconds={remainingSeconds}
        streakCount={streakCount}
        hasPassage={Boolean(readingPassageText)}
        studyMode={studyMode}
        onToggleStudyMode={setStudyMode}
        fontSizeLevel={fontSizeLevel}
        onChangeFontSize={handleChangeFontSize}
        onApplyHighlight={applyHighlight}
        onRemoveAllHighlights={removeAllHighlights}
        reviewStats={reviewStats}
        retakeEvaluation={retakeEvaluation}
        onRetake={handleStartNewAttempt}
        onSubmit={handleOpenSubmitModal}
        onBack={() => {
          if (phase === 'REVIEW' || window.confirm('Bạn có muốn tạm dừng làm bài thi này?')) {
            navigate(-1);
          }
        }}
        isStarting={isStarting}
        isSubmitting={isSubmitting}
        isUploadingAudio={isUploadingAudio}
      />

      {/* 2. CONTEXT VIEW: AUDIO PLAYER BAR (LISTENING) HOẶC MOBILE TABS (READING) */}
      <QuestionContextView
        isListening={isListeningTest}
        isReading={isReadingTest}
        isVocab={isVocabTest}
        passageText={readingPassageText}
        audioUrl={mainAudioUrl}
        listeningScript={attempt?.listeningScript}
        phase={phase}
        audioRef={audioRef}
        isPlayingAudio={isPlayingAudio}
        onTogglePlayAudio={toggleAudioPlay}
        audioCurrentTime={audioCurrentTime}
        audioDuration={audioDuration}
        onSeekAudio={handleSeekAudio}
        onSkipAudio={handleSkipAudio}
        playbackRate={playbackRate}
        onChangePlaybackRate={handleRateChange}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        showListeningScript={showListeningScript}
        onToggleListeningScript={handleToggleListeningScript}
        isPlayingAiVoice={isPlayingAiVoice}
        onToggleAiVoice={toggleAiVoiceStream}
        isRepairingAudio={isRepairingListeningAudio}
        onRepairAudio={handleRepairListeningAudio}
        listeningSegments={listeningSegments}
        fontSizeLevel={fontSizeLevel}
        passageContainerRef={passageContainerRef}
        readingMobileTab={readingMobileTab}
        onToggleMobileTab={setReadingMobileTab}
      />

      {/* 3. THÂN TRANG: CỘT BÀI ĐỌC (NẾU CÓ) + NỘI DUNG CÂU HỎI */}
      <div
        className={
          isSequentialSession
            ? 'w-full max-w-4xl mx-auto space-y-4'
            : readingPassageText
            ? 'grid grid-cols-1 lg:grid-cols-12 gap-5 items-start'
            : 'w-full max-w-4xl mx-auto space-y-4'
        }
      >
        {/* CỘT BÀI ĐỌC DÀI (READING PASSAGE) */}
        {!isSequentialSession && Boolean(readingPassageText) && (
          <div
            className={`${
              readingMobileTab === 'PASSAGE' ? 'flex' : 'hidden lg:flex'
            } lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs flex-col h-[70vh] lg:h-[calc(100vh-140px)] lg:sticky lg:top-20`}
          >
            <div className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 flex items-center justify-between rounded-t-xl">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <BookOpen size={15} className="text-blue-700 dark:text-blue-400" />
                Bài đọc
              </span>
            </div>

            <div
              ref={passageContainerRef}
              className={`p-4 sm:p-6 overflow-y-auto leading-relaxed text-slate-800 dark:text-slate-200 font-serif select-text ${
                fontSizeLevel === 'normal' ? 'text-[14px] sm:text-[15px]' : fontSizeLevel === 'large' ? 'text-base' : 'text-[17px]'
              }`}
            >
              {readingPassageText?.split(/\n\s*\n/).map((para: string, pIdx: number) => (
                <p key={pIdx} className="mb-4 text-justify leading-relaxed">
                  {para}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* CỘT CHÍNH: HIỂN THỊ CÂU HỎI */}
        <div
          className={`${
            isSequentialSession
              ? 'w-full'
              : readingPassageText
              ? readingMobileTab === 'QUESTIONS'
                ? 'col-span-1 lg:col-span-6'
                : 'hidden lg:block lg:col-span-6'
              : 'w-full'
          } space-y-4`}
        >
          {/* Banner kết quả sau khi nộp (Phase REVIEW) */}
          {phase === 'REVIEW' && (
            <AssignmentResultBanner
              retakeEvaluation={retakeEvaluation}
              reviewStats={reviewStats}
              attempt={attempt}
              onRetake={handleStartNewAttempt}
              isStarting={isStarting}
            />
          )}

          {/* Dạng bài NỐI TỪ VỰNG TƯƠNG TÁC (MATCHING STUDIO BOARD) */}
          {isVocabMatching ? (
            <VocabularyMatchingBoard
              questions={questions}
              answers={answers}
              onAnswersChange={handleMatchingAnswers}
              disabled={isSubmitting || phase === 'REVIEW'}
              isReview={phase === 'REVIEW'}
              resolveAudioUrl={resolveAudioUrl}
            />
          ) : isSequentialSession && phase !== 'REVIEW' ? (
            /* =========================================================================
               CHẾ ĐỘ TỐI GIẢN (SPEAKING / WRITING): HIỂN THỊ 1 CÂU 1 & TUẦN TỰ
               ========================================================================= */
            (() => {
              const currentQ = questions[activeQuestionIdx];
              if (!currentQ) return null;
              const isCurrentDone = isQuestionCompletedOrSkipped(currentQ.questionId, currentQ);
              const failCount = questionFailCounts[currentQ.questionId] || 0;
              const canSkip = failCount >= 3;
              const isWritingCurrent = isWritingQuestion(currentQ);
              const isSpeakingBandCurrent = isSpeakingNonShadowingQuestion(currentQ);
              const isMarkedNotPassed = markedNotPassedQuestionIds[currentQ.questionId];

              return (
                <div className="space-y-4">
                  <QuestionRendererPolymorphic
                    key={currentQ.questionId}
                    question={currentQ}
                    index={activeQuestionIdx}
                    totalQuestions={questions.length}
                    answers={answers}
                    onUpdateAnswer={updateAnswer}
                    isFlagged={Boolean(flaggedQuestions[currentQ.questionId])}
                    onToggleFlag={toggleFlagQuestion}
                    checkedState={checkedQuestions[currentQ.questionId]}
                    onCheckInstant={handleCheckInstantAnswer}
                    isHintExpanded={Boolean(expandedHints[currentQ.questionId])}
                    onToggleHint={handleToggleHint}
                    studyMode={studyMode}
                    phase={phase}
                    isSubmitting={isSubmitting}
                    resolveAudioUrl={resolveAudioUrl}
                    speakText={speakText}
                    attempt={attempt}
                    onUploadAudio={handleSpeakingAudioUpload}
                    onWritingEvaluated={handleWritingEvaluated}
                    failCount={failCount}
                    isListening={isListeningTest}
                    isVocab={isVocabTest}
                  />

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2">
                    {isCurrentDone ? (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 px-3 py-2.5 rounded-lg text-emerald-900 dark:text-emerald-200">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="text-xs font-bold">
                            {isMarkedNotPassed
                              ? 'Đã ghi nhận.'
                              : skippedQuestionIds[currentQ.questionId]
                              ? 'Đã bỏ qua.'
                              : isWritingCurrent
                              ? `Đạt Band ${targetPassBand.toFixed(1)}.`
                              : isSpeakingBandCurrent
                              ? 'Đạt Band 5.0.'
                              : 'Hoàn thành.'}
                          </span>
                        </div>

                        {activeQuestionIdx < questions.length - 1 ? (
                          <button
                            type="button"
                            onClick={() => {
                              const nextIdx = activeQuestionIdx + 1;
                              setActiveQuestionIdx(nextIdx);
                              const nextQ = questions[nextIdx];
                              if (nextQ) scrollToQuestion(nextQ.questionId);
                            }}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer shrink-0"
                          >
                            <span>Câu {activeQuestionIdx + 2}</span>
                            <ArrowRight size={14} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleOpenSubmitModal}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs transition cursor-pointer shrink-0"
                          >
                            <span>Nộp bài</span>
                            <Send size={14} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div>
                        {canSkip ? (
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 px-3 py-2.5 rounded-lg text-amber-900 dark:text-amber-200">
                            <div className="flex items-center gap-2 text-xs font-bold">
                              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span>
                                {failCount}/3 lần chưa đạt.
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setSkippedQuestionIds((prev) => ({
                                  ...prev,
                                  [currentQ.questionId]: true,
                                }));
                                setMarkedNotPassedQuestionIds((prev) => ({
                                  ...prev,
                                  [currentQ.questionId]: true,
                                }));
                                if (activeQuestionIdx < questions.length - 1) {
                                  const nextIdx = activeQuestionIdx + 1;
                                  setActiveQuestionIdx(nextIdx);
                                  const nextQ = questions[nextIdx];
                                  if (nextQ) scrollToQuestion(nextQ.questionId);
                                } else {
                                  handleOpenSubmitModal();
                                }
                              }}
                              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer shrink-0"
                            >
                              <span>Bỏ qua câu này</span>
                              <ArrowRight size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
                            <span className="flex items-center gap-1.5 font-medium">
                              <Lock size={13} className="text-slate-400 shrink-0" />
                              <span>
                                {isWritingCurrent
                                  ? `Cần đạt Band ${targetPassBand.toFixed(1)} để qua câu`
                                  : isSpeakingBandCurrent
                                  ? 'Cần đạt Band 5.0 để qua câu'
                                  : 'Cần đạt ≥ 80 điểm để qua câu'}
                              </span>
                            </span>
                            {failCount > 0 && (
                              <span className="text-[11px] font-bold tabular-nums text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800 shrink-0">
                                {failCount}/3
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()
          ) : (
            questions.map((q, idx) => (
              <QuestionRendererPolymorphic
                key={q.questionId}
                question={q}
                index={idx}
                totalQuestions={questions.length}
                answers={answers}
                onUpdateAnswer={updateAnswer}
                isFlagged={Boolean(flaggedQuestions[q.questionId])}
                onToggleFlag={toggleFlagQuestion}
                checkedState={checkedQuestions[q.questionId]}
                onCheckInstant={handleCheckInstantAnswer}
                isHintExpanded={Boolean(expandedHints[q.questionId])}
                onToggleHint={handleToggleHint}
                studyMode={studyMode}
                phase={phase}
                isSubmitting={isSubmitting}
                resolveAudioUrl={resolveAudioUrl}
                speakText={speakText}
                attempt={attempt}
                onUploadAudio={handleSpeakingAudioUpload}
                isListening={isListeningTest}
                isVocab={isVocabTest}
              />
            ))
          )}
        </div>
      </div>

      {/* 4. FOOTER ĐIỀU HƯỚNG NHANH & NỘP BÀI */}
      <AssignmentFooterNav
        activeQuestionIdx={activeQuestionIdx}
        totalQuestions={questions.length}
        answeredCount={answeredQuestionsCount}
        isFlagged={Boolean(questions[activeQuestionIdx] && flaggedQuestions[questions[activeQuestionIdx].questionId])}
        onToggleFlag={() => {
          const curQ = questions[activeQuestionIdx];
          if (curQ) toggleFlagQuestion(curQ.questionId);
        }}
        onPrev={() => {
          const prevIdx = Math.max(0, activeQuestionIdx - 1);
          const prevQ = questions[prevIdx];
          if (prevQ) {
            setActiveQuestionIdx(prevIdx);
            scrollToQuestion(prevQ.questionId);
          }
        }}
        onNext={() => {
          const nextIdx = Math.min(questions.length - 1, activeQuestionIdx + 1);
          const nextQ = questions[nextIdx];
          if (nextQ) {
            setActiveQuestionIdx(nextIdx);
            scrollToQuestion(nextQ.questionId);
          }
        }}
        onSubmit={() => setIsSubmitModalOpen(true)}
        onToggleMobilePalette={() => setShowMobilePalette((prev) => !prev)}
        phase={phase}
        isSubmitting={isSubmitting}
        isUploadingAudio={isUploadingAudio}
        isNextDisabled={Boolean(
          isSequentialSession &&
            phase !== 'REVIEW' &&
            questions[activeQuestionIdx] &&
            !isQuestionCompletedOrSkipped(
              questions[activeQuestionIdx].questionId,
              questions[activeQuestionIdx],
            ),
        )}
        hidePaletteToggle={true}
      />

      {/* 5. MODAL XÁC NHẬN NỘP BÀI (SUBMIT CONFIRM MODAL) */}
      <SubmitConfirmModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onConfirm={handleSubmitTest}
        answeredCount={answeredQuestionsCount}
        totalQuestions={questions.length}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
