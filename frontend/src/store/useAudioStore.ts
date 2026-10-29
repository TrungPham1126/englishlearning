// src/store/useAudioStore.ts
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type RecordingLifecycleState =
  | "idle"
  | "recording"
  | "recorded"
  | "evaluating"
  | "evaluated"
  | "error";

export interface AudioStoreState {
  readonly recordingState: RecordingLifecycleState;
  readonly isPlayingNative: boolean;
  readonly isPlayingLearner: boolean;
  readonly isSynthesizingNative: boolean;
  readonly isRepairingNative: boolean;
  readonly recordingSeconds: number;
  readonly recordingDuration: number;
  readonly playbackSpeed: number;
  readonly selectedVoice: string;
  readonly nativeProgress: number; // 0 -> 1
  readonly learnerProgress: number; // 0 -> 1
  readonly recordedBlob: Blob | null;
  readonly recordedAudioUrl: string | null;
  readonly errorMessage: string | null;

  /**
   * Mảng 60 cột biên độ sóng âm thời gian thực (0 -> 1).
   * KIẾN TRÚC TRANSIENT SUBSCRIPTION:
   * - Component cha hoặc thanh điều hướng KHÔNG subscribe vào trường này.
   * - Chỉ DualWaveformVisualizer lắng nghe qua `useAudioStore.subscribe(s => s.liveLearnerPeaks, ...)`
   *   để vẽ trực tiếp lên HTML5 Canvas ở 60fps mà không kích hoạt React re-render.
   */
  readonly liveLearnerPeaks: readonly number[];

  // Actions
  readonly setRecordingState: (state: RecordingLifecycleState) => void;
  readonly setIsPlayingNative: (playing: boolean) => void;
  readonly setIsPlayingLearner: (playing: boolean) => void;
  readonly setIsSynthesizingNative: (synthesizing: boolean) => void;
  readonly setIsRepairingNative: (repairing: boolean) => void;
  readonly setRecordingSeconds: (seconds: number) => void;
  readonly setRecordingDuration: (duration: number) => void;
  readonly setPlaybackSpeed: (speed: number) => void;
  readonly setSelectedVoice: (voiceId: string) => void;
  readonly setNativeProgress: (progress: number) => void;
  readonly setLearnerProgress: (progress: number) => void;
  readonly setRecordedAudio: (blob: Blob | null, url: string | null, duration?: number) => void;
  readonly setErrorMessage: (message: string | null) => void;
  readonly pushLiveLearnerPeaks: (peaks: readonly number[]) => void;
  readonly resetAudioSession: () => void;
}

export const WAVEFORM_BARS = 60;

const IDLE_PEAKS: readonly number[] = Array.from(
  { length: WAVEFORM_BARS },
  () => 0.06,
);

export const useAudioStore = create<AudioStoreState>()(
  subscribeWithSelector((set, get) => ({
    recordingState: "idle",
    isPlayingNative: false,
    isPlayingLearner: false,
    isSynthesizingNative: false,
    isRepairingNative: false,
    recordingSeconds: 0,
    recordingDuration: 0,
    playbackSpeed: 1.0,
    selectedVoice: "af_heart",
    nativeProgress: 0,
    learnerProgress: 0,
    recordedBlob: null,
    recordedAudioUrl: null,
    errorMessage: null,
    liveLearnerPeaks: IDLE_PEAKS,

    setRecordingState: (recordingState) =>
      set({
        recordingState,
        errorMessage: recordingState === "error" ? get().errorMessage : null,
      }),

    setIsPlayingNative: (isPlayingNative) => set({ isPlayingNative }),

    setIsPlayingLearner: (isPlayingLearner) => set({ isPlayingLearner }),

    setIsSynthesizingNative: (isSynthesizingNative) =>
      set({ isSynthesizingNative }),

    setIsRepairingNative: (isRepairingNative) => set({ isRepairingNative }),

    setRecordingSeconds: (recordingSeconds) => set({ recordingSeconds }),

    setRecordingDuration: (recordingDuration) => set({ recordingDuration }),

    setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),

    setSelectedVoice: (selectedVoice) => set({ selectedVoice }),

    setNativeProgress: (nativeProgress) => set({ nativeProgress }),

    setLearnerProgress: (learnerProgress) => set({ learnerProgress }),

    setRecordedAudio: (recordedBlob, recordedAudioUrl, duration = 0) => {
      const prevUrl = get().recordedAudioUrl;
      if (prevUrl && prevUrl !== recordedAudioUrl && prevUrl.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(prevUrl);
        } catch {
          // ignore revoke error
        }
      }
      set({
        recordedBlob,
        recordedAudioUrl,
        recordingDuration: duration,
        recordingState: recordedAudioUrl ? "recorded" : "idle",
      });
    },

    setErrorMessage: (errorMessage) =>
      set({
        errorMessage,
        recordingState: errorMessage ? "error" : get().recordingState,
      }),

    pushLiveLearnerPeaks: (liveLearnerPeaks) => set({ liveLearnerPeaks }),

    resetAudioSession: () => {
      const prevUrl = get().recordedAudioUrl;
      if (prevUrl && prevUrl.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(prevUrl);
        } catch {
          // ignore
        }
      }
      set({
        recordingState: "idle",
        isPlayingNative: false,
        isPlayingLearner: false,
        isSynthesizingNative: false,
        isRepairingNative: false,
        recordingSeconds: 0,
        recordingDuration: 0,
        nativeProgress: 0,
        learnerProgress: 0,
        recordedBlob: null,
        recordedAudioUrl: null,
        errorMessage: null,
        liveLearnerPeaks: IDLE_PEAKS,
      });
    },
  })),
);
