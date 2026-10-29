// src/store/usePracticeStore.ts
import { create } from "zustand";
import type { ShadowingEvaluationResponse } from "@/features/student/types";

export type ShadowingPracticeMode = "shadowing" | "normal";

export interface PracticeStoreState {
  readonly practiceMode: ShadowingPracticeMode;
  readonly targetSentence: string;
  readonly selectedWordKey: string | null;
  readonly evaluationResult: ShadowingEvaluationResponse | null;
  readonly isFeedbackDrawerOpen: boolean;
  readonly nativeStaticPeaks: readonly number[];

  // Actions
  readonly setPracticeMode: (mode: ShadowingPracticeMode) => void;
  readonly setTargetSentence: (sentence: string) => void;
  readonly setSelectedWordKey: (wordKey: string | null) => void;
  readonly setEvaluationResult: (
    result: ShadowingEvaluationResponse | null,
    autoOpenDrawer?: boolean,
  ) => void;
  readonly setFeedbackDrawerOpen: (isOpen: boolean) => void;
  readonly resetPracticeState: () => void;
}

/**
 * Sinh biên độ sóng âm chuẩn hóa [0.12 .. 0.95] tất định theo nội dung câu mẫu
 * để hiển thị sóng âm Native Speaker trực quan ngay lập tức.
 */
export function buildDeterministicNativePeaks(sentence: string, count = 60): readonly number[] {
  const clean = sentence.trim() || "Shadowing practice reference sentence";
  const peaks: number[] = [];
  let seed = 0;
  for (let i = 0; i < clean.length; i++) {
    seed = (seed * 31 + clean.charCodeAt(i)) % 10007;
  }
  for (let i = 0; i < count; i++) {
    const wave = Math.sin((i / count) * Math.PI * 3.5 + (seed % 7));
    const harmonic = Math.cos((i * 1.7) + (seed % 13)) * 0.35;
    const envelope = Math.sin((i / (count - 1)) * Math.PI); // Mượt ở 2 đầu câu
    const value = Math.abs(wave * 0.65 + harmonic) * (0.35 + 0.65 * envelope);
    peaks.push(Math.max(0.12, Math.min(0.95, Number(value.toFixed(3)))));
  }
  return peaks;
}

export const usePracticeStore = create<PracticeStoreState>((set) => ({
  practiceMode: "shadowing",
  targetSentence: "",
  selectedWordKey: null,
  evaluationResult: null,
  isFeedbackDrawerOpen: false,
  nativeStaticPeaks: buildDeterministicNativePeaks(""),

  setPracticeMode: (practiceMode) => set({ practiceMode }),

  setTargetSentence: (targetSentence) =>
    set({
      targetSentence,
      nativeStaticPeaks: buildDeterministicNativePeaks(targetSentence),
      selectedWordKey: null,
    }),

  setSelectedWordKey: (selectedWordKey) => set({ selectedWordKey }),

  setEvaluationResult: (evaluationResult, autoOpenDrawer = true) =>
    set({
      evaluationResult,
      isFeedbackDrawerOpen: evaluationResult !== null ? autoOpenDrawer : false,
    }),

  setFeedbackDrawerOpen: (isFeedbackDrawerOpen) => set({ isFeedbackDrawerOpen }),

  resetPracticeState: () =>
    set({
      selectedWordKey: null,
      evaluationResult: null,
      isFeedbackDrawerOpen: false,
    }),
}));
