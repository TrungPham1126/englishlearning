// src/features/student/components/SpeakingShadowingStudio.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ShadowingEvaluationResponse } from "../types";
import { usePracticeStore } from "@/store/usePracticeStore";
import { cleanShadowingSentence } from "@/utils/sampleAudioPlayer";
import { useShadowingAudioEngine } from "../hooks/useShadowingAudioEngine";
import { useShadowingShortcuts } from "../hooks/useShadowingShortcuts";
import { ShadowingTopBar } from "./shadowing/ShadowingTopBar";
import { ShadowingTranscriptBoard } from "./shadowing/ShadowingTranscriptBoard";
import { DualWaveformVisualizer } from "./shadowing/DualWaveformVisualizer";
import { ShadowingControlDock } from "./shadowing/ShadowingControlDock";
import { ShadowingFeedbackDrawer } from "./shadowing/ShadowingFeedbackDrawer";
import ShadowingEvaluationView from "./ShadowingEvaluationView";

export { cleanShadowingSentence };

export interface SpeakingShadowingStudioProps {
  readonly questionId: string;
  readonly studentAnswerId?: string;
  readonly referenceSentence: string;
  readonly referenceAudioUrl?: string;
  readonly savedAudioUrl?: string;
  readonly currentStep?: number;
  readonly totalSteps?: number;
  readonly onBack?: () => void;
  readonly onAudioSubmitted: (
    audioBlob: Blob,
    result?: ShadowingEvaluationResponse,
  ) => void;
}

/**
 * Màn hình / Khung Luyện Phát Âm & Shadowing (Shadowing Practice Screen)
 * - Phân tách theo Atomic Design (Atoms, Molecules, Organisms).
 * - Tích hợp Zustand store (`useAudioStore`, `usePracticeStore`) với cơ chế Transient Updates:
 *   Sóng âm thời gian thực 60fps chỉ vẽ dưới `<canvas>` của `DualWaveformVisualizer`,
 *   không bao giờ gây re-render lên component cha hay thanh điều hướng.
 * - Hỗ trợ đầy đủ WCAG 2.1 AA: aria-label, role, phím tắt Space (Record/Stop), R (Replay),
 *   và tương thích hoàn toàn Dark/Light mode.
 */
export default function SpeakingShadowingStudio({
  questionId,
  studentAnswerId,
  referenceSentence,
  referenceAudioUrl,
  savedAudioUrl,
  currentStep = 1,
  totalSteps = 1,
  onBack,
  onAudioSubmitted,
}: SpeakingShadowingStudioProps) {
  const targetSentence = useMemo(
    () => cleanShadowingSentence(referenceSentence),
    [referenceSentence],
  );

  const [localEvaluationResult, setLocalEvaluationResult] =
    useState<ShadowingEvaluationResponse | null>(null);
  const [isCardFocused, setIsCardFocused] = useState(currentStep === 1);

  const setFeedbackDrawerOpen = usePracticeStore(
    (s) => s.setFeedbackDrawerOpen,
  );
  const setTargetSentence = usePracticeStore((s) => s.setTargetSentence);
  const resetPracticeState = usePracticeStore((s) => s.resetPracticeState);

  useEffect(() => {
    setLocalEvaluationResult(null);
    if (currentStep === 1) {
      setTargetSentence(targetSentence);
      resetPracticeState();
    }
  }, [
    questionId,
    currentStep,
    targetSentence,
    setTargetSentence,
    resetPracticeState,
  ]);

  const handleAudioSubmittedInternal = useCallback(
    (audioBlob: Blob, result?: ShadowingEvaluationResponse) => {
      if (result) {
        setLocalEvaluationResult(result);
      }
      onAudioSubmitted(audioBlob, result);
    },
    [onAudioSubmitted],
  );

  const {
    togglePlayNativeAudio,
    togglePlayLearnerAudio,
    toggleRecording,
    resetRecording,
    triggerAiEvaluation,
    repairNativeAudio,
    changePlaybackSpeed,
  } = useShadowingAudioEngine({
    questionId,
    studentAnswerId,
    targetSentence,
    referenceAudioUrl,
    savedAudioUrl,
    onAudioSubmitted: handleAudioSubmittedInternal,
  });

  const handleCloseDrawer = useCallback(() => {
    setFeedbackDrawerOpen(false);
  }, [setFeedbackDrawerOpen]);

  // Kích hoạt phím tắt WCAG 2.1 AA: Space (Thu/Dừng), R (Nghe mẫu), Escape (Đóng Drawer)
  useShadowingShortcuts({
    enabled: isCardFocused,
    onToggleRecord: toggleRecording,
    onReplayNative: () => {
      void togglePlayNativeAudio();
    },
    onCloseDrawer: handleCloseDrawer,
  });

  return (
    <div
      onMouseEnter={() => setIsCardFocused(true)}
      onMouseLeave={() => setIsCardFocused(false)}
      onFocus={() => setIsCardFocused(true)}
      className="elp-card rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 sm:p-8 shadow-card space-y-6 transition-colors duration-200"
    >
      {/* Vùng 1 (Top): Thanh tiến trình bài học, chế độ Shadowing/Normal, giọng đọc và nút Back */}
      <ShadowingTopBar
        currentStep={currentStep}
        totalSteps={totalSteps}
        onBack={onBack}
        onChangeSpeed={changePlaybackSpeed}
        onRepairAudio={() => {
          void repairNativeAudio();
        }}
      />

      {/* Vùng 2 (Center): Transcript tiếng Anh cỡ chữ lớn, highlight từng từ theo trạng thái */}
      <ShadowingTranscriptBoard
        targetSentence={targetSentence}
        evaluationResult={localEvaluationResult}
      />

      {/* Vùng 3 (Waveform & Player): Khung hiển thị sóng âm song song (Native Speaker vs Learner) */}
      <DualWaveformVisualizer
        targetSentence={targetSentence}
        onTogglePlayNative={() => {
          void togglePlayNativeAudio();
        }}
        onTogglePlayLearner={togglePlayLearnerAudio}
      />

      {/* Vùng 4 (Controls): Nút Record to bản với hiệu ứng pulse, kèm nút Nghe lại mẫu và Nộp bài */}
      <ShadowingControlDock
        onPlayNative={() => {
          void togglePlayNativeAudio();
        }}
        onToggleRecord={toggleRecording}
        onResetRecord={() => {
          setLocalEvaluationResult(null);
          resetRecording();
        }}
        onSubmitEvaluation={() => {
          void triggerAiEvaluation();
        }}
      />

      {/* Báo cáo chi tiết cố định bên dưới nếu đã chấm xong */}
      {localEvaluationResult && (
        <ShadowingEvaluationView data={localEvaluationResult} />
      )}

      {/* Vùng 5 (Feedback Drawer/Modal): Bảng điểm 3 chỉ số (Accuracy, Fluency, Completeness) & Khẩu hình miệng */}
      <ShadowingFeedbackDrawer />
    </div>
  );
}
