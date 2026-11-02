import type { QuestionResultDetail } from "@/features/student/types";

export interface VocabularyMatchingBoardProps {
  questions: QuestionResultDetail[];
  answers: Record<
    string,
    { selectedOptionId?: string; textAnswer?: string; audioUrl?: string }
  >;
  onAnswersChange: (
    questionId: string,
    partial: { selectedOptionId?: string; textAnswer?: string }
  ) => void;
  disabled?: boolean;
  isReview?: boolean;
  resolveAudioUrl?: (url?: string) => string;
}

export interface LeftWordItem {
  id: string; // questionId
  index: number;
  word: string;
  ipa: string;
  audioUrl?: string;
  explanation?: string;
  correctAnswer?: string;
  isCorrect?: boolean;
  studentAnswer?: string;
  selectedOptionId?: string;
  options: {
    id: string;
    text: string;
    matchText?: string;
    isCorrect?: boolean;
    isSelected?: boolean;
  }[];
}

export interface RightMeaningItem {
  id: string; // unique id for right card
  questionId: string; // question this meaning originally belongs to
  optionId: string; // optionId if available
  text: string;
}

export interface RayLine {
  leftId: string;
  rightId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isMatched: boolean;
  isCorrect: boolean;
}

export const RAY_COLOR_MATCHED = "#10b981"; // Emerald green
export const RAY_COLOR_ERROR = "#f43f5e"; // Rose red in Review
export const RAY_COLOR_ACTIVE = "#6366f1"; // Indigo violet when selecting
