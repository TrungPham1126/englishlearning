// src/features/student/vocabulary/stores/useVocabularySessionStore.ts
import { create } from 'zustand';
import type {
  ExerciseQuestion,
  SessionResultMetrics,
  SubmissionStatus,
} from '../types/vocabulary';

export interface AnswerPayload {
  selectedOptionId?: string;
  typedText?: string;
  matchedPairs?: ReadonlyArray<{ leftId: string; rightId: string }>;
  pronunciationScore?: number;
}

export interface VocabularySessionState {
  readonly questions: readonly ExerciseQuestion[];
  readonly currentIndex: number;
  readonly selectedAnswer: AnswerPayload;
  readonly submissionStatus: SubmissionStatus;
  readonly feedbackExplanation: string | null;
  readonly streakCount: number;
  readonly maxStreak: number;
  readonly hearts: number;
  readonly maxHearts: number;
  readonly correctCount: number;
  readonly wrongCount: number;
  readonly sessionStartTime: number;
  readonly isSessionCompleted: boolean;
  readonly finalMetrics: SessionResultMetrics | null;

  // Actions
  readonly initSession: (questions: readonly ExerciseQuestion[], startingHearts?: number) => void;
  readonly setAnswerPayload: (partialAnswer: Partial<AnswerPayload>) => void;
  readonly submitAnswer: () => void;
  readonly skipQuestion: () => void;
  readonly nextQuestion: () => void;
  readonly resetSession: () => void;
}

export const useVocabularySessionStore = create<VocabularySessionState>((set, get) => ({
  questions: [],
  currentIndex: 0,
  selectedAnswer: {},
  submissionStatus: 'IDLE',
  feedbackExplanation: null,
  streakCount: 0,
  maxStreak: 0,
  hearts: 5,
  maxHearts: 5,
  correctCount: 0,
  wrongCount: 0,
  sessionStartTime: Date.now(),
  isSessionCompleted: false,
  finalMetrics: null,

  initSession: (questions, startingHearts = 5) => {
    set({
      questions,
      currentIndex: 0,
      selectedAnswer: {},
      submissionStatus: 'IDLE',
      feedbackExplanation: null,
      streakCount: 0,
      maxStreak: 0,
      hearts: startingHearts,
      maxHearts: startingHearts,
      correctCount: 0,
      wrongCount: 0,
      sessionStartTime: Date.now(),
      isSessionCompleted: false,
      finalMetrics: null,
    });
  },

  setAnswerPayload: (partialAnswer) => {
    // Không cho phép chỉnh sửa đáp án khi đang ở màn hình kết quả câu
    if (get().submissionStatus !== 'IDLE') return;
    set((state) => ({
      selectedAnswer: { ...state.selectedAnswer, ...partialAnswer },
    }));
  },

  submitAnswer: () => {
    const state = get();
    if (state.submissionStatus !== 'IDLE') return;
    const currentQ = state.questions[state.currentIndex];
    if (!currentQ) return;

    let isCorrect = false;
    let explanation = '';

    switch (currentQ.type) {
      case 'MULTIPLE_CHOICE': {
        const selectedId = state.selectedAnswer.selectedOptionId;
        const correctOpt = currentQ.options.find((opt) => opt.isCorrect);
        isCorrect = Boolean(selectedId && correctOpt && selectedId === correctOpt.id);
        explanation = isCorrect
          ? `Chính xác! ${currentQ.vocabularyItem.word}: ${currentQ.vocabularyItem.meaningVi}`
          : `Đáp án đúng là: "${correctOpt?.text}". Nghĩa: ${currentQ.vocabularyItem.meaningVi}`;
        break;
      }
      case 'LISTEN_AND_TYPE': {
        const userTyped = (state.selectedAnswer.typedText || '').trim().toLowerCase();
        const expected = currentQ.expectedWord.trim().toLowerCase();
        const alternates = (currentQ.acceptableAlternates || []).map((a) => a.trim().toLowerCase());
        isCorrect = userTyped === expected || alternates.includes(userTyped);
        explanation = isCorrect
          ? `Chính xác! "${currentQ.expectedWord}" [${currentQ.vocabularyItem.ipa}]`
          : `Từ cần gõ đúng là: "${currentQ.expectedWord}". Phiên âm: [${currentQ.vocabularyItem.ipa}]`;
        break;
      }
      case 'FILL_IN_BLANK': {
        const userTyped = (state.selectedAnswer.typedText || '').trim().toLowerCase();
        const expected = currentQ.expectedWord.trim().toLowerCase();
        isCorrect = userTyped === expected;
        explanation = isCorrect
          ? `Chính xác! "${currentQ.expectedWord}" hoàn thành trọn vẹn câu ngữ cảnh.`
          : `Từ cần điền là: "${currentQ.expectedWord}". Ví dụ: ${currentQ.vocabularyItem.exampleEn}`;
        break;
      }
      case 'WORD_MATCHING': {
        const matched = state.selectedAnswer.matchedPairs || [];
        isCorrect = matched.length === currentQ.pairs.length;
        explanation = isCorrect
          ? `Tuyệt vời! Bạn đã ghép chính xác tất cả ${currentQ.pairs.length} cặp từ vựng.`
          : `Chưa hoàn thành toàn bộ ${currentQ.pairs.length} cặp từ. Hãy luyện tập thêm!`;
        break;
      }
      case 'PRONUNCIATION_DRILL': {
        const score = state.selectedAnswer.pronunciationScore || 0;
        isCorrect = score >= currentQ.passScore;
        explanation = isCorrect
          ? `Phát âm đạt ${score}% (Ngưỡng đạt: ${currentQ.passScore}%). Rất chuẩn xác!`
          : `Điểm phát âm ${score}% chưa đạt ngưỡng ${currentQ.passScore}%. Hãy chú ý phiên âm [${currentQ.targetIpa}].`;
        break;
      }
    }

    const nextStreak = isCorrect ? state.streakCount + 1 : 0;
    const nextMaxStreak = Math.max(state.maxStreak, nextStreak);
    const nextHearts = isCorrect ? state.hearts : Math.max(0, state.hearts - 1);
    const nextCorrect = isCorrect ? state.correctCount + 1 : state.correctCount;
    const nextWrong = !isCorrect ? state.wrongCount + 1 : state.wrongCount;

    set({
      submissionStatus: isCorrect ? 'CORRECT' : 'WRONG',
      feedbackExplanation: explanation,
      streakCount: nextStreak,
      maxStreak: nextMaxStreak,
      hearts: nextHearts,
      correctCount: nextCorrect,
      wrongCount: nextWrong,
    });
  },

  skipQuestion: () => {
    const state = get();
    if (state.submissionStatus !== 'IDLE') return;
    const currentQ = state.questions[state.currentIndex];
    if (!currentQ) return;

    set({
      submissionStatus: 'WRONG',
      feedbackExplanation: `Đã bỏ qua. Đáp án tham khảo: "${currentQ.vocabularyItem.word}" - ${currentQ.vocabularyItem.meaningVi}`,
      streakCount: 0,
      hearts: Math.max(0, state.hearts - 1),
      wrongCount: state.wrongCount + 1,
    });
  },

  nextQuestion: () => {
    const state = get();
    const nextIdx = state.currentIndex + 1;

    // Kiểm tra hết câu hoặc hết tim
    if (nextIdx >= state.questions.length || state.hearts <= 0) {
      const timeSpent = Math.max(1, Math.floor((Date.now() - state.sessionStartTime) / 1000));
      const total = state.questions.length;
      const metrics: SessionResultMetrics = {
        totalQuestions: total,
        correctCount: state.correctCount,
        wrongCount: state.wrongCount,
        accuracyRate: total > 0 ? Math.round((state.correctCount / total) * 100) : 0,
        maxStreak: state.maxStreak,
        timeSpentSeconds: timeSpent,
        learnedVocabIds: state.questions.map((q) => q.vocabularyItem.id),
      };

      set({
        isSessionCompleted: true,
        finalMetrics: metrics,
        submissionStatus: 'IDLE',
        selectedAnswer: {},
        feedbackExplanation: null,
      });
      return;
    }

    set({
      currentIndex: nextIdx,
      selectedAnswer: {},
      submissionStatus: 'IDLE',
      feedbackExplanation: null,
    });
  },

  resetSession: () => {
    set({
      currentIndex: 0,
      selectedAnswer: {},
      submissionStatus: 'IDLE',
      feedbackExplanation: null,
      streakCount: 0,
      maxStreak: 0,
      hearts: 5,
      correctCount: 0,
      wrongCount: 0,
      sessionStartTime: Date.now(),
      isSessionCompleted: false,
      finalMetrics: null,
    });
  },
}));
