// src/features/student/vocabulary/components/VocabularySessionLayout.tsx
import React, { useEffect, useCallback } from 'react';
import {
  X,
  Heart,
  Flame,
  Volume2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Trophy,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useVocabularySessionStore } from '../stores/useVocabularySessionStore';
import { ExercisePolymorphicRenderer } from './renderers/ExercisePolymorphicRenderer';

export interface VocabularySessionLayoutProps {
  readonly onCloseSession?: () => void;
}

export const VocabularySessionLayout: React.FC<VocabularySessionLayoutProps> = ({
  onCloseSession,
}) => {
  const questions = useVocabularySessionStore((s) => s.questions);
  const currentIndex = useVocabularySessionStore((s) => s.currentIndex);
  const selectedAnswer = useVocabularySessionStore((s) => s.selectedAnswer);
  const submissionStatus = useVocabularySessionStore((s) => s.submissionStatus);
  const feedbackExplanation = useVocabularySessionStore((s) => s.feedbackExplanation);
  const streakCount = useVocabularySessionStore((s) => s.streakCount);
  const hearts = useVocabularySessionStore((s) => s.hearts);
  const maxHearts = useVocabularySessionStore((s) => s.maxHearts);
  const isSessionCompleted = useVocabularySessionStore((s) => s.isSessionCompleted);
  const finalMetrics = useVocabularySessionStore((s) => s.finalMetrics);

  const submitAnswer = useVocabularySessionStore((s) => s.submitAnswer);
  const skipQuestion = useVocabularySessionStore((s) => s.skipQuestion);
  const nextQuestion = useVocabularySessionStore((s) => s.nextQuestion);
  const resetSession = useVocabularySessionStore((s) => s.resetSession);

  const currentQ = questions[currentIndex];
  const totalQuestions = questions.length;
  const progressRatio =
    totalQuestions > 0 ? Math.min(100, Math.round(((currentIndex) / totalQuestions) * 100)) : 0;

  // Kiểm tra xem đã có thao tác chọn/nhập đáp án hay chưa để enable nút "Kiểm tra"
  const canCheck = Boolean(
    currentQ &&
      (selectedAnswer.selectedOptionId ||
        (selectedAnswer.typedText && selectedAnswer.typedText.trim().length > 0) ||
        (selectedAnswer.matchedPairs && selectedAnswer.matchedPairs.length > 0) ||
        selectedAnswer.pronunciationScore !== undefined)
  );

  // Phím tắt bàn phím: Enter để Kiểm tra hoặc Qua câu, Escape để thoát
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (submissionStatus === 'IDLE' && canCheck) {
          submitAnswer();
        } else if (submissionStatus !== 'IDLE') {
          nextQuestion();
        }
      }
    },
    [canCheck, nextQuestion, submissionStatus, submitAnswer]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handlePlayVocabAudio = () => {
    if (!currentQ) return;
    const vocab = currentQ.vocabularyItem;
    const url = vocab.audioUrlUs || vocab.audioUrlUk;
    if (url) {
      const audio = new Audio(url);
      audio.play().catch(() => {});
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(vocab.word);
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    }
  };

  // MÀN HÌNH HOÀN THÀNH PHIÊN HỌC (SUMMARY STAGE)
  if (isSessionCompleted && finalMetrics) {
    return (
      <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-elevated text-center space-y-6">
          <div className="inline-flex p-4 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-500 shadow-md">
            <Trophy className="w-16 h-16 animate-pulse" />
          </div>

          <div className="space-y-1">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white">
              Hoàn Thành Phiên Học!
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
              Bạn đã ôn luyện xuất sắc danh sách từ vựng hôm nay.
            </p>
          </div>

          {/* Grid thống kê 4 chỉ số */}
          <div className="grid grid-cols-2 gap-3.5 pt-2">
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-slate-900/50 border border-blue-100 dark:border-blue-900">
              <span className="text-xs font-bold text-slate-500 block">Độ Chính Xác</span>
              <span className="text-2xl font-black text-blue-700 dark:text-blue-400">
                {finalMetrics.accuracyRate}%
              </span>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-800">
              <span className="text-xs font-bold text-slate-500 block">Chuỗi Kỷ Lục</span>
              <span className="text-2xl font-black text-amber-500 flex items-center justify-center gap-1">
                <Flame className="w-5 h-5 fill-current" /> {finalMetrics.maxStreak}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-800">
              <span className="text-xs font-bold text-slate-500 block">Số Câu Đúng</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {finalMetrics.correctCount} / {finalMetrics.totalQuestions}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-500 block">Thời Gian</span>
              <span className="text-2xl font-black text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1">
                <Clock className="w-5 h-5" /> {finalMetrics.timeSpentSeconds}s
              </span>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={resetSession}
              className="flex-1 py-3.5 rounded-xl border-2 border-slate-300 dark:border-slate-700 font-bold text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Học lại phiên này
            </button>
            <button
              type="button"
              onClick={onCloseSession}
              className="flex-1 py-3.5 rounded-xl bg-blue-800 hover:bg-blue-800 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              Tiếp tục hành trình <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between select-none">
      {/* 1. STICKY TOP HEADER */}
      <header className="sticky top-0 z-30 w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 py-3.5 px-4 sm:px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          {/* Nút thoát */}
          <button
            type="button"
            onClick={onCloseSession}
            aria-label="Đóng phiên học"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Animated Progress Bar */}
          <div className="flex-1 max-w-lg mx-2 flex flex-col gap-1">
            <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden relative">
              <div
                className="h-full bg-blue-800 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progressRatio}%` }}
              />
            </div>
          </div>

          {/* Badges: Câu hiện tại & Streak & Hearts */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-black text-slate-500 dark:text-slate-400">
              {currentIndex + 1}/{totalQuestions}
            </span>

            {streakCount > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                <Flame className="w-4 h-4 fill-current text-amber-500" />
                <span>{streakCount}</span>
              </span>
            )}

            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
              <Heart className="w-4 h-4 fill-current text-rose-500" />
              <span>{hearts}/{maxHearts}</span>
            </span>
          </div>
        </div>
      </header>

      {/* 2. CENTER DYNAMIC STAGE (MIN-HEIGHT 420PX + POLYMORPHIC RENDERER) */}
      <main className="flex-1 w-full max-w-4xl mx-auto p-4 sm:p-6 flex items-center justify-center min-h-[420px]">
        {currentQ ? (
          <div className="w-full">
            <ExercisePolymorphicRenderer question={currentQ} />
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400 font-bold">
            Chưa có câu hỏi nào trong phiên học này.
          </div>
        )}
      </main>

      {/* 3. STICKY BOTTOM ACTION & FEEDBACK DRAWER */}
      <footer
        className={`sticky bottom-0 z-30 w-full border-t transition-all duration-300 ${
          submissionStatus === 'IDLE'
            ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 py-4 px-4 sm:px-8'
            : submissionStatus === 'CORRECT'
            ? 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-300 dark:border-emerald-800 py-5 px-4 sm:px-8 shadow-elevated'
            : 'bg-rose-50 dark:bg-rose-950/90 border-rose-300 dark:border-rose-800 py-5 px-4 sm:px-8 shadow-elevated'
        }`}
      >
        <div className="max-w-4xl mx-auto">
          {submissionStatus === 'IDLE' ? (
            /* Trạng thái đang làm bài */
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={skipQuestion}
                className="px-5 py-3 rounded-xl font-bold text-xs sm:text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors uppercase tracking-wider"
              >
                Bỏ qua
              </button>

              <button
                type="button"
                disabled={!canCheck}
                onClick={submitAnswer}
                className="px-8 py-3.5 rounded-xl bg-blue-800 hover:bg-blue-800 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-black text-sm uppercase tracking-wider shadow-md hover:scale-[1.02] active:scale-95 disabled:scale-100 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                Kiểm tra (Enter)
              </button>
            </div>
          ) : (
            /* Trạng thái Feedback Banner trượt lên (Emerald / Rose) */
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-bottom-2">
              <div className="flex items-start gap-3">
                {submissionStatus === 'CORRECT' ? (
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-8 h-8 text-rose-600 shrink-0 mt-0.5" />
                )}

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4
                      className={`text-lg font-black tracking-tight ${
                        submissionStatus === 'CORRECT'
                          ? 'text-emerald-900 dark:text-emerald-200'
                          : 'text-rose-900 dark:text-rose-200'
                      }`}
                    >
                      {submissionStatus === 'CORRECT' ? 'Tuyệt vời!' : 'Chưa chính xác'}
                    </h4>

                    {currentQ && (
                      <button
                        type="button"
                        onClick={handlePlayVocabAudio}
                        aria-label="Nghe lại phát âm"
                        className="p-1 rounded-md bg-white/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 hover:scale-105 transition-all"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <p
                    className={`text-xs sm:text-sm font-medium leading-relaxed ${
                      submissionStatus === 'CORRECT'
                        ? 'text-emerald-800 dark:text-emerald-300'
                        : 'text-rose-800 dark:text-rose-300'
                    }`}
                  >
                    {feedbackExplanation}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={nextQuestion}
                className={`px-8 py-3.5 rounded-xl font-black text-sm uppercase tracking-wider text-white shadow-md hover:scale-[1.02] active:scale-95 transition-all shrink-0 ${
                  submissionStatus === 'CORRECT'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                Tiếp tục (Enter)
              </button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};
