// src/features/student/hooks/useShadowingAudioEngine.ts
import { useCallback, useEffect, useRef } from "react";
import { studentApi } from "@/features/student/api/studentApi";
import type { ShadowingEvaluationResponse } from "@/features/student/types";
import { useAudioStore, WAVEFORM_BARS } from "@/store/useAudioStore";
import { usePracticeStore } from "@/store/usePracticeStore";
import {
  appendAudioCacheBuster,
  clearSampleAudioCache,
  isInvalidSampleAudioUrl,
  isMockOrBrokenAudioUrl,
  playSampleAudio,
  resolveFullAudioUrl,
  stopAllSampleAudio,
} from "@/utils/sampleAudioPlayer";

export interface UseShadowingAudioEngineParams {
  readonly questionId: string;
  readonly studentAnswerId?: string;
  readonly targetSentence: string;
  readonly referenceAudioUrl?: string;
  readonly savedAudioUrl?: string;
  readonly onAudioSubmitted: (
    audioBlob: Blob,
    result?: ShadowingEvaluationResponse,
  ) => void;
}

export interface UseShadowingAudioEngineReturn {
  readonly togglePlayNativeAudio: () => Promise<void>;
  readonly togglePlayLearnerAudio: () => void;
  readonly toggleRecording: () => void;
  readonly startRecording: () => Promise<void>;
  readonly stopRecording: () => void;
  readonly resetRecording: () => void;
  readonly triggerAiEvaluation: () => Promise<void>;
  readonly repairNativeAudio: () => Promise<void>;
  readonly changePlaybackSpeed: (speed: number) => void;
}

export function useShadowingAudioEngine({
  questionId,
  studentAnswerId,
  targetSentence,
  referenceAudioUrl,
  savedAudioUrl,
  onAudioSubmitted,
}: UseShadowingAudioEngineParams): UseShadowingAudioEngineReturn {
  const refAudioRef = useRef<HTMLAudioElement | null>(null);
  const learnerAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeRefAudioUrlRef = useRef<string | null>(
    referenceAudioUrl && !isInvalidSampleAudioUrl(referenceAudioUrl, savedAudioUrl)
      ? referenceAudioUrl
      : null,
  );
  const ttsCacheRef = useRef<Map<string, string>>(new Map());

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafWaveformRef = useRef<number | null>(null);
  const rafNativeProgressRef = useRef<number | null>(null);
  const rafLearnerProgressRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const startTimeMsRef = useRef<number>(0);

  // Chỉ lấy các action tĩnh từ store -> Không bao giờ gây re-render component
  const setRecordingState = useAudioStore((s) => s.setRecordingState);
  const setIsPlayingNative = useAudioStore((s) => s.setIsPlayingNative);
  const setIsPlayingLearner = useAudioStore((s) => s.setIsPlayingLearner);
  const setIsSynthesizingNative = useAudioStore((s) => s.setIsSynthesizingNative);
  const setIsRepairingNative = useAudioStore((s) => s.setIsRepairingNative);
  const setRecordingSeconds = useAudioStore((s) => s.setRecordingSeconds);
  const setPlaybackSpeed = useAudioStore((s) => s.setPlaybackSpeed);
  const setNativeProgress = useAudioStore((s) => s.setNativeProgress);
  const setLearnerProgress = useAudioStore((s) => s.setLearnerProgress);
  const setRecordedAudio = useAudioStore((s) => s.setRecordedAudio);
  const setErrorMessage = useAudioStore((s) => s.setErrorMessage);
  const pushLiveLearnerPeaks = useAudioStore((s) => s.pushLiveLearnerPeaks);

  const setTargetSentence = usePracticeStore((s) => s.setTargetSentence);
  const setEvaluationResult = usePracticeStore((s) => s.setEvaluationResult);

  const cleanupAudioGraph = useCallback(() => {
    if (rafWaveformRef.current !== null) {
      cancelAnimationFrame(rafWaveformRef.current);
      rafWaveformRef.current = null;
    }
    if (timerIntervalRef.current !== null) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const stopAllPlaybacks = useCallback(() => {
    if (rafNativeProgressRef.current !== null) {
      cancelAnimationFrame(rafNativeProgressRef.current);
      rafNativeProgressRef.current = null;
    }
    if (rafLearnerProgressRef.current !== null) {
      cancelAnimationFrame(rafLearnerProgressRef.current);
      rafLearnerProgressRef.current = null;
    }
    if (refAudioRef.current) {
      refAudioRef.current.pause();
    }
    if (learnerAudioRef.current) {
      learnerAudioRef.current.pause();
    }
    stopAllSampleAudio();
    setIsPlayingNative(false);
    setIsPlayingLearner(false);
  }, [setIsPlayingLearner, setIsPlayingNative]);

  // Đồng bộ câu mẫu và dừng ngay mọi âm thanh cũ khi chuyển câu hỏi
  useEffect(() => {
    stopAllPlaybacks();
    setTargetSentence(targetSentence);
    setNativeProgress(0);
    setLearnerProgress(0);
  }, [
    questionId,
    targetSentence,
    setTargetSentence,
    setNativeProgress,
    setLearnerProgress,
    stopAllPlaybacks,
  ]);

  // Cập nhật hoặc xóa URL câu mẫu khi đổi câu hỏi (tuyệt đối không giữ lại URL của câu trước)
  useEffect(() => {
    if (
      referenceAudioUrl &&
      !isInvalidSampleAudioUrl(referenceAudioUrl, savedAudioUrl)
    ) {
      activeRefAudioUrlRef.current = resolveFullAudioUrl(referenceAudioUrl);
    } else {
      activeRefAudioUrlRef.current = null;
    }
  }, [questionId, referenceAudioUrl, savedAudioUrl]);

  // Cập nhật hoặc xóa bản thu âm của học viên khi đổi câu hỏi
  useEffect(() => {
    if (
      savedAudioUrl &&
      !isMockOrBrokenAudioUrl(savedAudioUrl) &&
      savedAudioUrl !== referenceAudioUrl
    ) {
      setRecordedAudio(null, resolveFullAudioUrl(savedAudioUrl), 0);
    } else {
      setRecordedAudio(null, null, 0);
    }
  }, [questionId, savedAudioUrl, referenceAudioUrl, setRecordedAudio]);

  const changePlaybackSpeed = useCallback(
    (speed: number) => {
      setPlaybackSpeed(speed);
      if (refAudioRef.current) {
        refAudioRef.current.playbackRate = speed;
        refAudioRef.current.defaultPlaybackRate = speed;
      }
    },
    [setPlaybackSpeed],
  );

  // Sửa lỗi / Tạo lại âm thanh mẫu từ Kokoro-82M trên server (nếu khả dụng, nếu không dùng TTS trình duyệt)
  const repairNativeAudio = useCallback(async () => {
    if (!questionId) return;
    stopAllPlaybacks();
    setTargetSentence(targetSentence);
    setIsRepairingNative(true);
    setErrorMessage(null);
    clearSampleAudioCache();
    ttsCacheRef.current.clear();

    const { playbackSpeed, selectedVoice } = useAudioStore.getState();

    try {
      const res = await studentApi.repairQuestionAudio(questionId, {
        text: targetSentence,
        voice: selectedVoice,
        speed: playbackSpeed,
      });
      if (res && res.url && !isInvalidSampleAudioUrl(res.url, savedAudioUrl)) {
        const freshUrlWithCacheBuster = appendAudioCacheBuster(res.url);
        activeRefAudioUrlRef.current = freshUrlWithCacheBuster;
        await playSampleAudio(targetSentence, {
          audioUrl: freshUrlWithCacheBuster,
          voice: selectedVoice,
          lang: selectedVoice.startsWith("b") ? "en-GB" : "en-US",
          rate: playbackSpeed,
          forceRefresh: true,
          studentAudioUrl: savedAudioUrl,
          onStart: () => setIsPlayingNative(true),
          onProgress: (p) => setNativeProgress(p),
          onEnd: () => {
            setIsPlayingNative(false);
            setNativeProgress(1);
          },
          onError: () => setIsPlayingNative(false),
        });
      } else {
        // Fallback ngay sang giọng đọc tiếng Anh chuẩn nếu server chưa sinh được file
        activeRefAudioUrlRef.current = null;
        await playSampleAudio(targetSentence, {
          voice: selectedVoice,
          lang: selectedVoice.startsWith("b") ? "en-GB" : "en-US",
          rate: playbackSpeed,
          skipBackendTts: true,
          onStart: () => setIsPlayingNative(true),
          onProgress: (p) => setNativeProgress(p),
          onEnd: () => {
            setIsPlayingNative(false);
            setNativeProgress(1);
          },
          onError: () => setIsPlayingNative(false),
        });
      }
    } catch {
      // Nếu microservice Kokoro đang tắt, tự động phát bằng Web Speech API tiếng Anh chuẩn thay vì báo lỗi chặn học viên
      activeRefAudioUrlRef.current = null;
      await playSampleAudio(targetSentence, {
        voice: selectedVoice,
        lang: selectedVoice.startsWith("b") ? "en-GB" : "en-US",
        rate: playbackSpeed,
        skipBackendTts: true,
        onStart: () => setIsPlayingNative(true),
        onProgress: (p) => setNativeProgress(p),
        onEnd: () => {
          setIsPlayingNative(false);
          setNativeProgress(1);
        },
        onError: () => setIsPlayingNative(false),
      });
    } finally {
      setIsRepairingNative(false);
    }
  }, [
    questionId,
    savedAudioUrl,
    setErrorMessage,
    setIsPlayingNative,
    setIsRepairingNative,
    setNativeProgress,
    setTargetSentence,
    stopAllPlaybacks,
    targetSentence,
  ]);

  // Phát / Dừng âm thanh mẫu (Native Speaker)
  const togglePlayNativeAudio = useCallback(async () => {
    const { isPlayingNative, playbackSpeed, selectedVoice, recordedAudioUrl } =
      useAudioStore.getState();

    if (isPlayingNative) {
      stopAllPlaybacks();
      return;
    }

    stopAllPlaybacks();
    if (!targetSentence) return;

    // Đồng bộ câu mẫu của card hiện tại vào store
    setTargetSentence(targetSentence);

    const studentUrl = recordedAudioUrl || savedAudioUrl || null;
    const candidateRefUrl =
      selectedVoice === "af_heart" &&
      activeRefAudioUrlRef.current &&
      !isInvalidSampleAudioUrl(activeRefAudioUrlRef.current, studentUrl)
        ? activeRefAudioUrlRef.current
        : undefined;

    setIsSynthesizingNative(true);
    try {
      await playSampleAudio(targetSentence, {
        audioUrl: candidateRefUrl,
        voice: selectedVoice,
        lang: selectedVoice.startsWith("b") ? "en-GB" : "en-US",
        rate: playbackSpeed,
        studentAudioUrl: studentUrl,
        onStart: () => {
          setIsSynthesizingNative(false);
          setIsPlayingNative(true);
        },
        onProgress: (ratio) => {
          setNativeProgress(ratio);
        },
        onEnd: () => {
          setIsSynthesizingNative(false);
          setIsPlayingNative(false);
          setNativeProgress(1);
        },
        onError: () => {
          setIsSynthesizingNative(false);
          setIsPlayingNative(false);
        },
      });
    } finally {
      setIsSynthesizingNative(false);
    }
  }, [
    savedAudioUrl,
    setIsPlayingNative,
    setIsSynthesizingNative,
    setNativeProgress,
    setTargetSentence,
    stopAllPlaybacks,
    targetSentence,
  ]);

  // Phát / Dừng bản ghi âm của học viên
  const togglePlayLearnerAudio = useCallback(() => {
    const { isPlayingLearner, recordedAudioUrl } = useAudioStore.getState();
    if (!recordedAudioUrl || isMockOrBrokenAudioUrl(recordedAudioUrl)) return;

    if (isPlayingLearner) {
      stopAllPlaybacks();
      return;
    }

    stopAllPlaybacks();
    const audio = new Audio(resolveFullAudioUrl(recordedAudioUrl));
    learnerAudioRef.current = audio;
    setLearnerProgress(0);

    const trackLearner = () => {
      if (!learnerAudioRef.current || learnerAudioRef.current.paused) return;
      const duration = learnerAudioRef.current.duration;
      if (Number.isFinite(duration) && duration > 0) {
        setLearnerProgress(
          Math.min(1, learnerAudioRef.current.currentTime / duration),
        );
      }
      rafLearnerProgressRef.current = requestAnimationFrame(trackLearner);
    };

    audio.onplay = () => {
      setIsPlayingLearner(true);
      rafLearnerProgressRef.current = requestAnimationFrame(trackLearner);
    };
    audio.onended = () => {
      if (rafLearnerProgressRef.current !== null) {
        cancelAnimationFrame(rafLearnerProgressRef.current);
      }
      setIsPlayingLearner(false);
      setLearnerProgress(1);
    };
    audio.onerror = () => setIsPlayingLearner(false);

    void audio.play().catch(() => setIsPlayingLearner(false));
  }, [setIsPlayingLearner, setLearnerProgress, stopAllPlaybacks]);

  // Bắt đầu thu âm kèm phân tích tần số 60fps đẩy thẳng vào Zustand store
  const startRecording = useCallback(async () => {
    stopAllPlaybacks();
    cleanupAudioGraph();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      // Khởi tạo Web Audio API AnalyserNode để trích xuất biên độ sóng âm thời gian thực
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.76;
      source.connect(analyser);
      analyserRef.current = analyser;

      let mimeType = "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
        mimeType = "audio/ogg;codecs=opus";
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finalMime = recorder.mimeType || mimeType;
        const blob = new Blob(audioChunksRef.current, { type: finalMime });
        const url = URL.createObjectURL(blob);
        const durationSec = (Date.now() - startTimeMsRef.current) / 1000;

        setRecordedAudio(blob, url, durationSec);
        cleanupAudioGraph();
        onAudioSubmitted(blob);
      };

      startTimeMsRef.current = Date.now();
      recorder.start(150);
      setRecordingState("recording");
      setRecordingSeconds(0);
      setEvaluationResult(null, false);

      timerIntervalRef.current = setInterval(() => {
        const elapsedSec = Math.floor(
          (Date.now() - startTimeMsRef.current) / 1000,
        );
        setRecordingSeconds(elapsedSec);
      }, 500);

      const freqBins = new Uint8Array(analyser.frequencyBinCount);
      const updateWaveformLoop = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(freqBins);

        const nextPeaks = new Array<number>(WAVEFORM_BARS);
        const step = Math.max(1, Math.floor(freqBins.length / WAVEFORM_BARS));
        for (let i = 0; i < WAVEFORM_BARS; i++) {
          const raw = freqBins[i * step] ?? 0;
          nextPeaks[i] = Math.max(0.06, Math.min(1, raw / 255));
        }

        // Transient update: chỉ Canvas subscribe mới nhận, không re-render React
        pushLiveLearnerPeaks(nextPeaks);
        rafWaveformRef.current = requestAnimationFrame(updateWaveformLoop);
      };

      rafWaveformRef.current = requestAnimationFrame(updateWaveformLoop);
    } catch {
      setErrorMessage(
        "Không thể truy cập Microphone! Vui lòng cấp quyền ghi âm trên trình duyệt.",
      );
    }
  }, [
    cleanupAudioGraph,
    onAudioSubmitted,
    pushLiveLearnerPeaks,
    setErrorMessage,
    setEvaluationResult,
    setRecordedAudio,
    setRecordingSeconds,
    setRecordingState,
    stopAllPlaybacks,
  ]);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    } else {
      cleanupAudioGraph();
      setRecordingState("idle");
    }
  }, [cleanupAudioGraph, setRecordingState]);

  const toggleRecording = useCallback(() => {
    const current = useAudioStore.getState().recordingState;
    if (current === "recording") {
      stopRecording();
    } else if (current !== "evaluating") {
      void startRecording();
    }
  }, [startRecording, stopRecording]);

  const resetRecording = useCallback(() => {
    stopAllPlaybacks();
    cleanupAudioGraph();
    useAudioStore.getState().resetAudioSession();
    usePracticeStore.getState().resetPracticeState();
  }, [cleanupAudioGraph, stopAllPlaybacks]);

  // Gửi bản thu âm lên Backend chấm điểm AI (Praat F1/F2 & Whisper-large-v3)
  const triggerAiEvaluation = useCallback(async () => {
    const { recordedBlob, recordedAudioUrl, recordingDuration } =
      useAudioStore.getState();

    let blobToEvaluate = recordedBlob;

    if (
      !blobToEvaluate &&
      recordedAudioUrl &&
      !isMockOrBrokenAudioUrl(recordedAudioUrl) &&
      (recordedAudioUrl.startsWith("http") ||
        recordedAudioUrl.startsWith("blob:"))
    ) {
      try {
        const res = await fetch(recordedAudioUrl);
        if (res.ok) {
          blobToEvaluate = await res.blob();
          setRecordedAudio(blobToEvaluate, recordedAudioUrl, recordingDuration);
        }
      } catch {
        // ignore fetch error
      }
    }

    if (!blobToEvaluate) {
      setErrorMessage("Vui lòng thu âm giọng đọc trước khi bấm Nộp & Chấm điểm AI.");
      return;
    }

    if (recordingDuration > 0 && recordingDuration < 1.2) {
      setErrorMessage(
        "Bản ghi âm quá ngắn (dưới 1.2 giây). Vui lòng phát âm rõ ràng cả câu.",
      );
      return;
    }

    if (!targetSentence.trim()) {
      setErrorMessage("Không tìm thấy câu mẫu đối chiếu (Reference Sentence).");
      return;
    }

    setRecordingState("evaluating");

    try {
      const targetId = studentAnswerId || questionId;
      const result = await studentApi.evaluateShadowingAI(
        blobToEvaluate,
        targetId,
        targetSentence,
      );
      setEvaluationResult(result, true);
      setRecordingState("evaluated");
      onAudioSubmitted(blobToEvaluate, result);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      const msg =
        apiErr?.response?.data?.message ||
        "Lỗi xử lý âm học từ máy chủ. Bạn có thể bấm Nộp & Chấm lại.";
      setErrorMessage(msg);
    }
  }, [
    onAudioSubmitted,
    questionId,
    setErrorMessage,
    setEvaluationResult,
    setRecordedAudio,
    setRecordingState,
    studentAnswerId,
    targetSentence,
  ]);

  useEffect(() => {
    return () => {
      stopAllPlaybacks();
      cleanupAudioGraph();
    };
  }, [cleanupAudioGraph, stopAllPlaybacks]);

  return {
    togglePlayNativeAudio,
    togglePlayLearnerAudio,
    toggleRecording,
    startRecording,
    stopRecording,
    resetRecording,
    triggerAiEvaluation,
    repairNativeAudio,
    changePlaybackSpeed,
  };
}
