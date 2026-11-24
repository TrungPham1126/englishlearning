import React, { useState, useRef, useEffect } from 'react';
import {
  Flag,
  Volume2,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Check,
  Loader2,
  Lock,
  ArrowRight,
} from 'lucide-react';
import type {
  QuestionResultDetail,
  AttemptResponse,
  ShadowingEvaluationResponse,
  SpeakingAiEvaluationResult,
  WritingAiEvaluationResult,
} from '@/features/student/types';
import WordUnscrambleInteractive from './WordUnscrambleInteractive';
import WritingScaffoldingStudio, {
  classifyWritingQuestion,
  detectChartMediaUrl,
} from './WritingScaffoldingStudio';
import ParagraphWritingStudio from './ParagraphWritingStudio';
import SpeakingShadowingStudio, { cleanShadowingSentence } from '@/features/student/components/SpeakingShadowingStudio';
import SpeakingQAStudio from '@/features/student/components/SpeakingQAStudio';
import AssignmentExplanationSection from './AssignmentExplanationSection';
import {
  buildQuestionHintText,
  stripInlinePromptHint,
} from '@/features/student/utils/hintHelper';
import { isGradingRubricOrMetaText } from '@/utils/sampleAudioPlayer';
import { sortQuestionOptions } from '@/utils/questionOptions';
import {
  evaluateQuestionReviewOutcome,
  formatQuestionPoints,
  normalizeAnswerText,
  normalizeTrueFalseValue,
} from '@/features/student/utils/questionReviewScoring';
import {
  isQuestionPassed,
  getQuestionBestScoreAcrossAttempts,
} from '@/features/student/utils/speakingScoring';

export interface QuestionRendererPolymorphicProps {
  question: QuestionResultDetail;
  index: number;
  totalQuestions: number;
  answers: Record<string, { selectedOptionId?: string; textAnswer?: string; audioUrl?: string }>;
  onUpdateAnswer: (
    questionId: string,
    partial: { selectedOptionId?: string; textAnswer?: string; audioUrl?: string },
  ) => void;
  isFlagged: boolean;
  onToggleFlag: (questionId: string) => void;
  checkedState?: any;
  onCheckInstant: (questionId: string) => void;
  isHintExpanded: boolean;
  onToggleHint: (questionId: string) => void;
  studyMode: 'PRACTICE' | 'TEST';
  phase: 'CHECKING' | 'INTRO' | 'TESTING' | 'REVIEW' | 'EXHAUSTED';
  isSubmitting?: boolean;
  resolveAudioUrl: (url?: string) => string;
  speakText: (text: string, onEnd?: () => void) => void;
  attempt?: AttemptResponse | null;
  onUploadAudio?: (
    questionId: string,
    blob: Blob,
    result?: ShadowingEvaluationResponse | SpeakingAiEvaluationResult,
  ) => void;
  onWritingEvaluated?: (
    questionId: string,
    result: WritingAiEvaluationResult,
    text: string,
    isPassed: boolean,
  ) => void;
  failCount?: number;
  isListening?: boolean;
  isVocab?: boolean;
}

const QuestionRendererPolymorphicComponent: React.FC<QuestionRendererPolymorphicProps> = ({
  question,
  index,
  totalQuestions,
  answers,
  onUpdateAnswer,
  isFlagged,
  onToggleFlag,
  checkedState,
  onCheckInstant,
  isHintExpanded,
  onToggleHint,
  studyMode,
  phase,
  isSubmitting = false,
  resolveAudioUrl,
  speakText,
  attempt,
  onUploadAudio,
  onWritingEvaluated,
  failCount = 0,
  isListening = false,
  isVocab = false,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<0.75 | 1.0>(1.0);
  const wordAudioRef = useRef<HTMLAudioElement | null>(null);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (wordAudioRef.current) {
        wordAudioRef.current.onended = null;
        wordAudioRef.current.onerror = null;
        wordAudioRef.current.pause();
        wordAudioRef.current = null;
      }
    };
  }, []);

  const passBand = React.useMemo(() => {
    if (!attempt?.passScore) return 6.0;
    const ps = Number(attempt.passScore);
    if (ps > 0 && ps <= 9.0) return ps;
    if (ps > 9.0 && ps <= 10.0) return ps;
    if (ps > 10.0) return Number((ps / 10).toFixed(1));
    return 6.0;
  }, [attempt?.passScore]);

  const rawType = String(question.questionType || '').toUpperCase();
  const prompt = question.promptText || '';
  const promptLower = prompt.toLowerCase();
  const cleanPrompt = prompt
    .replace(/\[LISTEN_WORD\]\s*/gi, '')
    .replace(/\[LISTEN_SPELL\]\s*/gi, '')
    .trim();

  // Phân loại dạng bài Speaking chính xác (tránh đẩy nhầm Q&A / Part 2 / Part 3 sang Shadowing)
  const attemptTitleLower = String(attempt?.assignmentTitle || '').toLowerCase();
  const attemptDescLower = String(
    (attempt as any)?.assignmentDescription ||
      (attempt as any)?.description ||
      attempt?.passage ||
      '',
  ).toLowerCase();
  const combinedMeta = `${rawType} ${attemptTitleLower} ${attemptDescLower}`;

  const isPart2Speaking =
    rawType.includes('PART_2') ||
    combinedMeta.includes('part 2') ||
    combinedMeta.includes('part_2') ||
    combinedMeta.includes('cue card') ||
    combinedMeta.includes('độc thoại') ||
    promptLower.includes('you should say:') ||
    /^\s*describe\b/i.test(cleanPrompt);

  const isPart3Speaking =
    !isPart2Speaking &&
    (rawType.includes('PART_3') ||
      combinedMeta.includes('part 3') ||
      combinedMeta.includes('part_3') ||
      combinedMeta.includes('thảo luận chuyên sâu') ||
      combinedMeta.includes('two-way discussion'));

  const speakingMode: 'QA' | 'PART_2' | 'PART_3' = isPart2Speaking
    ? 'PART_2'
    : isPart3Speaking
    ? 'PART_3'
    : 'QA';

  const hasExplicitQaSignal =
    isPart2Speaking ||
    isPart3Speaking ||
    rawType === 'SPEAKING' ||
    rawType === 'SPEAKING_QA' ||
    rawType.includes('QA') ||
    combinedMeta.includes('q&a') ||
    combinedMeta.includes('hỏi - đáp') ||
    combinedMeta.includes('hỏi đáp') ||
    combinedMeta.includes('phỏng vấn') ||
    combinedMeta.includes('speaking_qa') ||
    cleanPrompt.endsWith('?') ||
    isGradingRubricOrMetaText(question.promptText) ||
    ((!question.transcript || isGradingRubricOrMetaText(question.transcript)) &&
      isGradingRubricOrMetaText(question.correctAnswer));

  const hasExplicitShadowingSignal =
    combinedMeta.includes('shadow') ||
    combinedMeta.includes('nhại') ||
    combinedMeta.includes('đọc đuổi') ||
    promptLower.includes('shadow') ||
    promptLower.includes('repeat after') ||
    promptLower.includes('nhại lại') ||
    promptLower.includes('read aloud') ||
    (rawType === 'AUDIO_RESPONSE' &&
      !cleanPrompt.endsWith('?') &&
      !isPart2Speaking &&
      !isPart3Speaking &&
      (!isGradingRubricOrMetaText(question.transcript) ||
        !isGradingRubricOrMetaText(question.correctAnswer)));

  const isSpeakingShadowing =
    (rawType === 'AUDIO_RESPONSE' || rawType === 'SPEAKING' || rawType.includes('SPEAKING')) &&
    hasExplicitShadowingSignal &&
    !hasExplicitQaSignal;
  const isSpeakingQA =
    (rawType === 'AUDIO_RESPONSE' || rawType === 'SPEAKING' || rawType.includes('SPEAKING')) &&
    !isSpeakingShadowing;
  const isSpeaking = isSpeakingQA || isSpeakingShadowing;

  const isWordUnscramble =
    rawType === 'UNSCRAMBLE' ||
    rawType.includes('WORD_ORDER') ||
    promptLower.includes('sắp xếp') ||
    promptLower.includes('unscramble');

  const writingClassification = React.useMemo(
    () =>
      classifyWritingQuestion({
        questionType: rawType,
        assignmentTitle: attempt?.assignmentTitle,
        assignmentDescription:
          (attempt as any)?.assignmentDescription ||
          (attempt as any)?.description ||
          attempt?.passage,
        promptText: prompt,
        explanation: question.explanation,
        mediaUrl: question.mediaUrl,
        hasOptions: Array.isArray(question.options) && question.options.length > 0,
        isSpeaking,
        isWordUnscramble,
      }),
    [
      rawType,
      attempt,
      prompt,
      question.explanation,
      question.mediaUrl,
      question.options,
      isSpeaking,
      isWordUnscramble,
    ],
  );

  const isParagraphWriting = writingClassification.kind === 'PARAGRAPH';
  const isIeltsEssay = writingClassification.kind === 'ESSAY';
  const isTask1Writing =
    writingClassification.kind === 'ESSAY' &&
    writingClassification.writingTask === 'TASK_1';
  const isTask2Writing =
    writingClassification.kind === 'ESSAY' &&
    writingClassification.writingTask === 'TASK_2';
  const writingTaskMode: 'TASK_1' | 'TASK_2' = isTask1Writing ? 'TASK_1' : 'TASK_2';

  const questionMediaUrl = String(question.mediaUrl || '').trim();
  const hasTask1ChartImage = isTask1Writing && detectChartMediaUrl(questionMediaUrl);

  const isTrueFalse =
    rawType === 'TRUE_FALSE' ||
    (Array.isArray(question.options) &&
      question.options.length <= 3 &&
      question.options.some((o: any) => String(o.optionText || o.text || o).toUpperCase() === 'TRUE'));

  const isFillInBlank =
    rawType === 'FILL_IN_BLANK' ||
    (!isTrueFalse &&
      !isSpeaking &&
      !isIeltsEssay &&
      !isParagraphWriting &&
      !isWordUnscramble &&
      (!question.options || question.options.length === 0));

  const isMultipleChoice = !isSpeaking && !isWordUnscramble && !isIeltsEssay && !isParagraphWriting && !isTrueFalse && !isFillInBlank;

  const supportsQuestionHint =
    (isFillInBlank || isWordUnscramble) &&
    !isSpeaking &&
    !isParagraphWriting &&
    !isIeltsEssay &&
    !isMultipleChoice &&
    !isTrueFalse;

  const displayPrompt = supportsQuestionHint
    ? stripInlinePromptHint(cleanPrompt)
    : cleanPrompt;

  const hintText = supportsQuestionHint
    ? buildQuestionHintText({
        promptText: prompt,
        hint: question.hint,
        correctAnswer: question.correctAnswer,
        isWordUnscramble,
      })
    : null;

  const canShowHintControl =
    phase === 'TESTING' && !attempt?.isExam && Boolean(hintText);

  const sortedOptions = React.useMemo(
    () => sortQuestionOptions(question.options),
    [question.options],
  );

  // Nhận diện bài thi/bài tập Listening tổng thể (Nghe toàn bài qua track âm thanh chung)
  const isListeningAssignment = Boolean(
    isListening || (attempt?.skillType || '').toUpperCase() === 'LISTENING',
  );

  // Nhận diện bài tập nghe từ vựng riêng biệt (Chỉ dành cho Vocabulary / Chọn từ, KHÔNG áp dụng cho bài thi Listening hoặc Writing chart mediaUrl)
  const isListeningWord =
    !isListeningAssignment &&
    !isIeltsEssay &&
    !isParagraphWriting &&
    (Boolean(isVocab) ||
      Boolean(question.mediaUrl || (question as any).audioUrl) ||
      prompt.includes('[LISTEN_WORD]') ||
      prompt.includes('[LISTEN_SPELL]') ||
      promptLower.includes('nghe phát âm') ||
      promptLower.includes('chọn từ') ||
      (attempt?.assignmentTitle || '').toLowerCase().includes('nghe & chọn'));

  // Hàm trích xuất từ vựng tiếng Anh cần phát âm chuẩn xác
  const getTargetEnglishWord = (): string => {
    if (question.correctAnswer && !question.correctAnswer.includes(' ')) {
      return question.correctAnswer.trim();
    }
    const media = question.mediaUrl || (question as any).audioUrl;
    if (media) {
      const match = media.match(/[?&]audio=([^&]+)/i);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    }
    const bracketMatch = prompt.match(/\[([a-zA-Z\s'-]+)\]/);
    if (
      bracketMatch &&
      !['LISTEN_WORD', 'LISTEN_SPELL', 'SHADOWING', 'SPEAKING'].includes(
        bracketMatch[1].toUpperCase(),
      )
    ) {
      return bracketMatch[1].trim();
    }
    return question.correctAnswer || '';
  };

  // Hàm phát âm từ vựng cho từng câu hỏi nhỏ
  const handlePlayWordAudio = () => {
    if (isPlayingAudio) return;
    setIsPlayingAudio(true);

    const targetWord = getTargetEnglishWord();
    const media = question.mediaUrl || (question as any).audioUrl;
    if (media) {
      try {
        if (wordAudioRef.current) {
          wordAudioRef.current.onended = null;
          wordAudioRef.current.onerror = null;
          wordAudioRef.current.pause();
        }
        const audio = new Audio(resolveAudioUrl(media));
        wordAudioRef.current = audio;
        audio.playbackRate = playbackSpeed;
        audio.onended = () => {
          if (isMountedRef.current) setIsPlayingAudio(false);
        };
        audio.onerror = () => {
          if (!isMountedRef.current) return;
          if (targetWord) {
            speakText(targetWord, () => {
              if (isMountedRef.current) setIsPlayingAudio(false);
            });
          } else {
            setIsPlayingAudio(false);
          }
        };
        audio.play().catch(() => {
          if (!isMountedRef.current) return;
          if (targetWord) {
            speakText(targetWord, () => {
              if (isMountedRef.current) setIsPlayingAudio(false);
            });
          } else {
            setIsPlayingAudio(false);
          }
        });
        return;
      } catch {
        // Fallback
      }
    }

    if (targetWord) {
      speakText(targetWord, () => {
        if (isMountedRef.current) setIsPlayingAudio(false);
      });
    } else {
      setIsPlayingAudio(false);
    }
  };

  const studentAns = answers[question.questionId];

  // Trạng thái đúng sai và điểm đạt được trong Review
  const reviewOutcome =
    phase === 'REVIEW' ? evaluateQuestionReviewOutcome(question, studentAns) : null;
  const isCorrectInReview = Boolean(reviewOutcome?.isCorrect);
  const earnedPointsInReview = reviewOutcome?.earnedPoints ?? 0;

  return (
    <div
      id={`question-${question.questionId}`}
      className="p-2.5 sm:p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2.5 transition-all"
    >
      {/* 1. HEADER CÂU HỎI */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-slate-800 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 tabular-nums">
            Câu {index + 1}
          </span>

          {phase === 'REVIEW' && (
            isCorrectInReview ? (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1 tabular-nums">
                <CheckCircle2 size={11} />
                Đúng (+{formatQuestionPoints(earnedPointsInReview)})
              </span>
            ) : (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center gap-1">
                <XCircle size={11} />
                Sai
              </span>
            )
          )}

          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
            {isSpeakingQA
              ? speakingMode === 'PART_2'
                ? 'IELTS Part 2'
                : speakingMode === 'PART_3'
                ? 'IELTS Part 3'
                : 'Nói Q&A'
              : isSpeakingShadowing
              ? 'Shadowing'
              : isWordUnscramble
              ? 'Sắp xếp từ'
              : isFillInBlank
              ? 'Điền từ'
              : isParagraphWriting
              ? 'Viết đoạn'
              : isTask1Writing
              ? 'IELTS Writing Task 1'
              : isTask2Writing
              ? 'IELTS Writing Task 2'
              : isTrueFalse
              ? 'Đúng / Sai'
              : 'Trắc nghiệm'}
          </span>

          {isFlagged && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
              Đã đánh dấu
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {canShowHintControl && (
            <button
              type="button"
              aria-expanded={isHintExpanded}
              onClick={() => onToggleHint(question.questionId)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition cursor-pointer active:scale-95 touch-manipulation ${
                isHintExpanded
                  ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 text-amber-800 dark:text-amber-300'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:border-amber-300 hover:text-amber-700 dark:hover:text-amber-300'
              }`}
            >
              <Lightbulb size={11} className={isHintExpanded ? 'fill-amber-500 text-amber-500' : 'text-amber-500'} />
              <span>{isHintExpanded ? 'Ẩn gợi ý' : 'Gợi ý'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onToggleFlag(question.questionId)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition cursor-pointer active:scale-95 touch-manipulation ${
              isFlagged
                ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 text-amber-800 dark:text-amber-300'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <Flag size={11} className={isFlagged ? 'fill-amber-500 text-amber-500' : ''} />
            <span>{isFlagged ? 'Bỏ dấu' : 'Đánh dấu'}</span>
          </button>
        </div>
      </div>

      {/* 2. NỘI DUNG CÂU HỎI & NÚT PHÁT ÂM RIÊNG BIỆT TỪNG CÂU */}
      {!isSpeaking && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm md:text-[15px] font-semibold text-slate-800 dark:text-slate-100 leading-normal">
              {displayPrompt}
            </h3>

            {isListeningWord && (
              <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handlePlayWordAudio}
                  className={`min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white font-semibold text-xs shadow-xs transition cursor-pointer active:scale-95 touch-manipulation ${
                    isPlayingAudio
                      ? 'bg-amber-600 ring-2 ring-amber-400'
                      : 'bg-amber-500 hover:bg-amber-600'
                  }`}
                >
                  <Volume2 size={15} className={isPlayingAudio ? 'animate-pulse' : ''} />
                  <span>{isPlayingAudio ? 'Đang phát...' : 'Nghe'}</span>
                </button>
              </div>
            )}
          </div>

          {hasTask1ChartImage && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 p-2.5 flex justify-center">
              <img
                src={resolveAudioUrl(questionMediaUrl)}
                alt="IELTS Task 1 visual"
                className="max-h-80 w-auto rounded-lg object-contain"
              />
            </div>
          )}
        </div>
      )}

      {/* 3. SUB-EXERCISE RENDERER */}
      {/* 3A. Sắp xếp từ thành câu */}
      {isWordUnscramble && (
        <WordUnscrambleInteractive
          promptText={prompt}
          currentAnswer={studentAns?.textAnswer || ''}
          onAnswerChange={(ans) => onUpdateAnswer(question.questionId, { textAnswer: ans })}
          disabled={isSubmitting || phase === 'REVIEW'}
        />
      )}

      {/* 3B. Điền từ vào chỗ trống / Hoàn thành câu */}
      {isFillInBlank && (
        <div className="space-y-2 pt-1">
          <div className="relative">
            <input
              type="text"
              value={studentAns?.textAnswer || ''}
              onChange={(e) => onUpdateAnswer(question.questionId, { textAnswer: e.target.value })}
              disabled={isSubmitting || phase === 'REVIEW'}
              placeholder="Nhập đáp án..."
              className="w-full min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>
        </div>
      )}

      {/* 3C. Trắc nghiệm (MULTIPLE CHOICE) */}
      {isMultipleChoice && sortedOptions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 grid-flow-row gap-2.5 pt-1">
          {sortedOptions.map((opt: any, optIdx: number) => {
            const optId = String(opt.id || opt.optionLabel || opt.text || opt.optionText);
            const normOptText = normalizeAnswerText(opt.optionText ?? opt.text);
            const normOptLabel = normalizeAnswerText(opt.optionLabel);
            const normCorrect = normalizeAnswerText(question.correctAnswer);
            const normStudentText = normalizeAnswerText(studentAns?.textAnswer);
            const isChecked =
              studentAns?.selectedOptionId === optId ||
              (!studentAns?.selectedOptionId &&
                Boolean(normStudentText) &&
                (normStudentText === normOptText || normStudentText === normOptLabel));

            const isOptionRevealedCorrect =
              phase === 'REVIEW' &&
              (opt.isCorrect === true ||
                optId === question.correctAnswer ||
                (Boolean(normOptLabel) && normOptLabel === normCorrect) ||
                (Boolean(normOptText) && normOptText === normCorrect));

            const isOptionRevealedWrong =
              phase === 'REVIEW' && isChecked && !isOptionRevealedCorrect;

            return (
              <div
                key={optId}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (phase === 'REVIEW' || isSubmitting) return;
                  onUpdateAnswer(question.questionId, { selectedOptionId: optId });
                }}
                onKeyDown={(e) => {
                  if (phase === 'REVIEW' || isSubmitting) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onUpdateAnswer(question.questionId, { selectedOptionId: optId });
                  }
                }}
                className={`min-h-[42px] flex items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-lg border transition-all cursor-pointer active:scale-[0.99] touch-manipulation select-none ${
                  isOptionRevealedCorrect
                    ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 shadow-xs ring-2 ring-emerald-500/20'
                    : isOptionRevealedWrong
                    ? 'border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 shadow-xs ring-2 ring-rose-500/20'
                    : isChecked
                    ? 'border-blue-700 bg-blue-50/80 dark:bg-slate-800 dark:border-blue-600 shadow-xs ring-2 ring-blue-600/15'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-blue-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`h-6 w-6 rounded-md flex items-center justify-center font-bold text-xs border shrink-0 transition ${
                      isOptionRevealedCorrect
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : isOptionRevealedWrong
                        ? 'border-rose-600 bg-rose-600 text-white'
                        : isChecked
                        ? 'border-blue-700 bg-blue-700 text-white'
                        : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {opt.optionLabel || String.fromCharCode(65 + optIdx)}
                  </span>
                  <span className="text-xs sm:text-[13px] font-medium text-slate-800 dark:text-slate-100 leading-snug">
                    {opt.optionText || opt.text}
                  </span>
                </div>

                {isOptionRevealedCorrect && (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0 flex items-center gap-1">
                    <CheckCircle2 size={14} /> Đúng
                  </span>
                )}
                {isOptionRevealedWrong && (
                  <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 shrink-0 flex items-center gap-1">
                    <XCircle size={14} /> Đã chọn
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 3D. True / False / Not Given */}
      {isTrueFalse && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {['TRUE', 'FALSE', 'NOT GIVEN'].map((val) => {
            const matchedOpt = Array.isArray(question.options)
              ? question.options.find(
                  (o: any) =>
                    normalizeTrueFalseValue(o?.optionText ?? o?.text) === val ||
                    normalizeTrueFalseValue(o?.optionLabel) === val,
                )
              : undefined;
            const selectedByText = normalizeTrueFalseValue(studentAns?.textAnswer);
            const selectedByOptId = (() => {
              const sid = String(studentAns?.selectedOptionId || '').trim();
              if (!sid) return '';
              const byId = Array.isArray(question.options)
                ? question.options.find((o: any) => String(o?.id ?? '').trim() === sid)
                : undefined;
              if (byId) {
                return (
                  normalizeTrueFalseValue(byId.optionText ?? byId.text) ||
                  normalizeTrueFalseValue(byId.optionLabel)
                );
              }
              return normalizeTrueFalseValue(sid);
            })();
            const selectedTfValue = selectedByText || selectedByOptId;
            const isSelected = selectedTfValue === val;
            const isCorrectVal = normalizeTrueFalseValue(question.correctAnswer) === val;
            const isRevealedCorrect = phase === 'REVIEW' && isCorrectVal;
            const isRevealedWrong = phase === 'REVIEW' && isSelected && !isCorrectVal;

            return (
              <button
                key={val}
                type="button"
                disabled={isSubmitting || phase === 'REVIEW'}
                onClick={() =>
                  onUpdateAnswer(question.questionId, {
                    selectedOptionId: matchedOpt?.id ? String(matchedOpt.id) : val,
                    textAnswer: val,
                  })
                }
                className={`min-h-[38px] py-2 rounded-lg border font-semibold text-xs transition active:scale-[0.98] cursor-pointer touch-manipulation ${
                  isRevealedCorrect
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200'
                    : isRevealedWrong
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-950 text-rose-800 dark:text-rose-200'
                    : isSelected
                    ? 'border-blue-700 bg-blue-50 dark:bg-slate-800 text-blue-800 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                {val}
              </button>
            );
          })}
        </div>
      )}

      {/* 3E. Speaking Studio */}
      {isSpeaking && isQuestionPassed(question.questionId, question, attempt ? [attempt] : []) && phase !== 'REVIEW' ? (
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/80 dark:bg-emerald-950/40 p-4 text-center space-y-2.5 my-2">
          <div className="inline-flex p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
            <Lock size={18} />
          </div>

          <div>
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-700 tabular-nums">
              Đã đạt ({getQuestionBestScoreAcrossAttempts(question.questionId, question, attempt ? [attempt] : []).toFixed(1)}/100)
            </span>
          </div>

          {index + 1 < totalQuestions && (
            <div>
              <button
                type="button"
                onClick={() => {
                  const nextQ = attempt?.questions?.[index + 1];
                  if (nextQ) {
                    const el = document.getElementById(`question-${nextQ.questionId}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs transition cursor-pointer"
              >
                <span>Câu {index + 2}</span>
                <ArrowRight size={13} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {isSpeakingShadowing && (
            <SpeakingShadowingStudio
              questionId={question.questionId}
              studentAnswerId={question.studentAnswerId || question.id}
              currentStep={index + 1}
              totalSteps={totalQuestions}
              referenceSentence={cleanShadowingSentence(
                question.transcript || question.correctAnswer || cleanPrompt
              )}
              referenceAudioUrl={question.mediaUrl ? resolveAudioUrl(question.mediaUrl) : undefined}
              savedAudioUrl={studentAns?.audioUrl || question.audioUrl}
              onAudioSubmitted={(blob: Blob, result?: ShadowingEvaluationResponse) => {
                if (onUploadAudio) onUploadAudio(question.questionId, blob, result);
              }}
            />
          )}
          {isSpeakingQA && (
            <SpeakingQAStudio
              questionId={question.questionId}
              studentAnswerId={question.studentAnswerId || question.id}
              currentStep={index + 1}
              totalSteps={totalQuestions}
              speakingMode={speakingMode}
              promptQuestion={cleanPrompt || 'Please answer the interview question.'}
              guidelines={question.explanation}
              keyPoints={question.correctAnswer}
              savedAudioUrl={studentAns?.audioUrl}
              onAudioSubmitted={(blob: Blob, result?: SpeakingAiEvaluationResult) => {
                if (onUploadAudio) onUploadAudio(question.questionId, blob, result);
              }}
            />
          )}
        </>
      )}

      {/* 3F. Writing Studios */}
      {isParagraphWriting && (
        <ParagraphWritingStudio
          key={question.questionId}
          promptText={prompt}
          explanation={question.explanation || ''}
          currentParagraph={studentAns?.textAnswer || ''}
          onParagraphChange={(text) => onUpdateAnswer(question.questionId, { textAnswer: text })}
          studentAnswerId={question.studentAnswerId || question.id || question.questionId}
          passBand={passBand}
          failCount={failCount}
          onWritingEvaluated={(res, text, isPassed) =>
            onWritingEvaluated?.(question.questionId, res, text, isPassed)
          }
          disabled={isSubmitting || phase === 'REVIEW'}
        />
      )}
      {isIeltsEssay && (
        <WritingScaffoldingStudio
          key={question.questionId}
          promptText={prompt}
          explanation={question.explanation || ''}
          currentEssay={studentAns?.textAnswer || ''}
          onEssayChange={(text) => onUpdateAnswer(question.questionId, { textAnswer: text })}
          studentAnswerId={question.studentAnswerId || question.id || question.questionId}
          writingTask={writingTaskMode}
          passBand={passBand}
          failCount={failCount}
          onWritingEvaluated={(res, text, isPassed) =>
            onWritingEvaluated?.(question.questionId, res, text, isPassed)
          }
          disabled={isSubmitting || phase === 'REVIEW'}
        />
      )}

      {/* 4. KHỐI GỢI Ý RIÊNG BIỆT (CHỈ HIỆN KHI ĐANG LÀM BÀI VÀ BẤM NÚT GỢI Ý) */}
      {canShowHintControl && isHintExpanded && hintText && (
        <div
          role="note"
          className="rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2"
        >
          <Lightbulb size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Gợi ý: </span>
            <span className="font-mono font-semibold">{hintText}</span>
          </div>
        </div>
      )}

      {/* 5. KHỐI GIẢI THÍCH & PHẢN HỒI SƯ PHẠM */}
      <AssignmentExplanationSection
        question={question}
        checkedState={checkedState}
        studentAnswer={studentAns}
        isCorrectOverride={isCorrectInReview}
        earnedPointsOverride={earnedPointsInReview}
        phase={phase}
        studyMode={studyMode}
      />
    </div>
  );
};

export const QuestionRendererPolymorphic = React.memo(
  QuestionRendererPolymorphicComponent,
  (prev, next) => {
    return (
      prev.question === next.question &&
      prev.index === next.index &&
      prev.totalQuestions === next.totalQuestions &&
      prev.isFlagged === next.isFlagged &&
      prev.checkedState === next.checkedState &&
      prev.isHintExpanded === next.isHintExpanded &&
      prev.studyMode === next.studyMode &&
      prev.phase === next.phase &&
      prev.isSubmitting === next.isSubmitting &&
      prev.attempt === next.attempt &&
      prev.isListening === next.isListening &&
      prev.isVocab === next.isVocab &&
      prev.answers[prev.question.questionId] === next.answers[next.question.questionId] &&
      prev.onUpdateAnswer === next.onUpdateAnswer &&
      prev.onToggleFlag === next.onToggleFlag &&
      prev.onCheckInstant === next.onCheckInstant &&
      prev.onToggleHint === next.onToggleHint &&
      prev.resolveAudioUrl === next.resolveAudioUrl &&
      prev.speakText === next.speakText &&
      prev.onUploadAudio === next.onUploadAudio &&
      prev.onWritingEvaluated === next.onWritingEvaluated &&
      prev.failCount === next.failCount
    );
  }
);

export default QuestionRendererPolymorphic;
