import React, { useState } from 'react';
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
} from '@/features/student/types';
import WordUnscrambleInteractive from './WordUnscrambleInteractive';
import WritingScaffoldingStudio from './WritingScaffoldingStudio';
import ParagraphWritingStudio from './ParagraphWritingStudio';
import SpeakingShadowingStudio, { cleanShadowingSentence } from '@/features/student/components/SpeakingShadowingStudio';
import SpeakingQAStudio from '@/features/student/components/SpeakingQAStudio';
import AssignmentExplanationSection from './AssignmentExplanationSection';
import { getFirstLetterHint } from '@/features/student/utils/hintHelper';
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
  isListening = false,
  isVocab = false,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<0.75 | 1.0>(1.0);

  const rawType = String(question.questionType || '').toUpperCase();
  const prompt = question.promptText || '';
  const promptLower = prompt.toLowerCase();
  const cleanPrompt = prompt
    .replace(/\[LISTEN_WORD\]\s*/gi, '')
    .replace(/\[LISTEN_SPELL\]\s*/gi, '')
    .trim();

  // Phân loại dạng bài
  const isSpeakingQA = rawType === 'SPEAKING' || (rawType === 'AUDIO_RESPONSE' && promptLower.includes('q&a'));
  const isSpeakingShadowing = (rawType === 'AUDIO_RESPONSE' || rawType === 'SPEAKING') && !isSpeakingQA;
  const isSpeaking = isSpeakingQA || isSpeakingShadowing;

  const isWordUnscramble =
    rawType === 'UNSCRAMBLE' ||
    rawType.includes('WORD_ORDER') ||
    promptLower.includes('sắp xếp') ||
    promptLower.includes('unscramble');

  const isIeltsEssay =
    rawType === 'ESSAY' ||
    rawType.includes('IELTS_TASK') ||
    promptLower.includes('bài luận') ||
    promptLower.includes('ielts task');

  const isParagraphWriting =
    !isIeltsEssay &&
    (rawType.includes('PARAGRAPH') ||
      promptLower.includes('đoạn văn') ||
      promptLower.includes('opinion paragraph'));

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

  // Nhận diện bài thi/bài tập Listening tổng thể (Nghe toàn bài qua track âm thanh chung)
  const isListeningAssignment = Boolean(
    isListening || (attempt?.skillType || '').toUpperCase() === 'LISTENING',
  );

  // Nhận diện bài tập nghe từ vựng riêng biệt (Chỉ dành cho Vocabulary / Chọn từ, KHÔNG áp dụng cho bài thi Listening)
  const isListeningWord =
    !isListeningAssignment &&
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
        const audio = new Audio(resolveAudioUrl(media));
        audio.playbackRate = playbackSpeed;
        audio.onended = () => setIsPlayingAudio(false);
        audio.onerror = () => {
          if (targetWord) {
            speakText(targetWord, () => setIsPlayingAudio(false));
          } else {
            setIsPlayingAudio(false);
          }
        };
        audio.play().catch(() => {
          if (targetWord) {
            speakText(targetWord, () => setIsPlayingAudio(false));
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
      speakText(targetWord, () => setIsPlayingAudio(false));
    } else {
      setIsPlayingAudio(false);
    }
  };

  const studentAns = answers[question.questionId];

  // Trạng thái đúng sai trong Review
  const isCorrectInReview =
    phase === 'REVIEW' &&
    ((question as any).isCorrect === true ||
      ((question as any).earnedPoints != null && (question as any).earnedPoints > 0) ||
      (Array.isArray(question.options) &&
        question.options.some(
          (o: any) =>
            (o.id === studentAns?.selectedOptionId || o.optionLabel === studentAns?.selectedOptionId) &&
            o.isCorrect === true,
        )));

  return (
    <div
      id={`question-${question.questionId}`}
      className="p-2.5 sm:p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2.5 transition-all"
    >
      {/* 1. HEADER CÂU HỎI */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-800">
            CÂU HỎI {index + 1}
          </span>

          {phase === 'REVIEW' && (
            isCorrectInReview ? (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                <CheckCircle2 size={11} />
                CHÍNH XÁC (+{(question as any).earnedPoints ?? 1} pt)
              </span>
            ) : (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center gap-1">
                <XCircle size={11} />
                CHƯA ĐÚNG (0 pt)
              </span>
            )
          )}

          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
            ({isSpeakingQA
              ? 'SPEAKING Q&A'
              : isSpeakingShadowing
              ? 'SHADOWING'
              : isWordUnscramble
              ? 'SẮP XẾP TỪ'
              : isFillInBlank
              ? 'ĐIỀN TỪ'
              : isParagraphWriting
              ? 'VIẾT ĐOẠN VĂN'
              : isIeltsEssay
              ? 'BÀI LUẬN IELTS'
              : isTrueFalse
              ? 'ĐÚNG / SAI'
              : 'TRẮC NGHIỆM'})
          </span>

          {isFlagged && (
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
              ★ Đã đánh dấu xem lại
            </span>
          )}
        </div>

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
          <span>{isFlagged ? 'Bỏ đánh dấu' : 'Đánh dấu'}</span>
        </button>
      </div>

      {/* 2. NỘI DUNG CÂU HỎI & NÚT PHÁT ÂM RIÊNG BIỆT TỪNG CÂU */}
      {!isSpeaking && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm md:text-[15px] font-semibold text-slate-800 dark:text-slate-100 leading-normal">
              {cleanPrompt}
            </h3>

            {/* Nút phát âm âm thanh câu hỏi nhỏ (Dành cho Nghe & Chọn từ / Vocabulary) */}
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
                  title="Nghe phát âm từ vựng này"
                >
                  <Volume2 size={15} className={isPlayingAudio ? 'animate-pulse' : ''} />
                  <span>{isPlayingAudio ? 'Đang phát âm...' : 'Nghe phát âm'}</span>
                </button>
              </div>
            )}
          </div>
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
        <div className="space-y-2.5 pt-1">
          <div className="relative">
            <input
              type="text"
              value={studentAns?.textAnswer || ''}
              onChange={(e) => onUpdateAnswer(question.questionId, { textAnswer: e.target.value })}
              disabled={isSubmitting || phase === 'REVIEW'}
              placeholder="Nhập câu trả lời của bạn..."
              className="w-full min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>
          {phase === 'REVIEW' && question.correctAnswer && (
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Gợi ý chữ cái đầu: <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{getFirstLetterHint(question.correctAnswer)}...</span>
            </div>
          )}
        </div>
      )}

      {/* 3C. Trắc nghiệm (MULTIPLE CHOICE) */}
      {isMultipleChoice && Array.isArray(question.options) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {question.options.map((opt: any, optIdx: number) => {
            const optId = String(opt.id || opt.optionLabel || opt.text || opt.optionText);
            const isChecked = studentAns?.selectedOptionId === optId;

            const isOptionRevealedCorrect =
              phase === 'REVIEW' &&
              (opt.isCorrect === true ||
                optId === question.correctAnswer ||
                (opt.optionText && opt.optionText === question.correctAnswer));

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
                    <CheckCircle2 size={15} /> Đáp án đúng
                  </span>
                )}
                {isOptionRevealedWrong && (
                  <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 shrink-0 flex items-center gap-1">
                    <XCircle size={15} /> Bạn đã chọn
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
            const isSelected = studentAns?.selectedOptionId === val || studentAns?.textAnswer === val;
            const isCorrectVal = question.correctAnswer?.toUpperCase() === val;
            const isRevealedCorrect = phase === 'REVIEW' && isCorrectVal;
            const isRevealedWrong = phase === 'REVIEW' && isSelected && !isCorrectVal;

            return (
              <button
                key={val}
                type="button"
                disabled={isSubmitting || phase === 'REVIEW'}
                onClick={() => onUpdateAnswer(question.questionId, { selectedOptionId: val, textAnswer: val })}
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
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/80 dark:bg-emerald-950/40 p-4 sm:p-5 text-center space-y-2.5 my-2">
          <div className="inline-flex p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
            <Lock size={20} />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-700">
              ✓ ĐÃ ĐẠT CHUẨN ({getQuestionBestScoreAcrossAttempts(question.questionId, question, attempt ? [attempt] : []).toFixed(1)}/100 PTS ≥ 80)
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-300 max-w-md mx-auto pt-1 font-medium">
              Câu hỏi này đã đạt chuẩn nên được khóa để bảo toàn điểm số. Bạn bắt buộc phải chuyển sang câu hỏi tiếp theo chưa đạt.
            </p>
          </div>

          {index + 1 < totalQuestions && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  const nextQ = attempt?.questions?.[index + 1];
                  if (nextQ) {
                    const el = document.getElementById(`question-${nextQ.questionId}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                <span>Bắt buộc làm câu tiếp theo (Câu {index + 2})</span>
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
          promptText={prompt}
          explanation={question.explanation || ''}
          currentParagraph={studentAns?.textAnswer || ''}
          onParagraphChange={(text) => onUpdateAnswer(question.questionId, { textAnswer: text })}
          disabled={isSubmitting || phase === 'REVIEW'}
        />
      )}
      {isIeltsEssay && (
        <WritingScaffoldingStudio
          promptText={prompt}
          explanation={question.explanation || ''}
          currentEssay={studentAns?.textAnswer || ''}
          onEssayChange={(text) => onUpdateAnswer(question.questionId, { textAnswer: text })}
          disabled={isSubmitting || phase === 'REVIEW'}
        />
      )}

      {/* 5. KHỐI GIẢI THÍCH & PHẢN HỒI SƯ PHẠM */}
      <AssignmentExplanationSection
        question={question}
        checkedState={checkedState}
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
      prev.onUploadAudio === next.onUploadAudio
    );
  }
);

export default QuestionRendererPolymorphic;
