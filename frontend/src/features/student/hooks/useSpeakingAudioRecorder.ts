import { useState, useRef, useEffect, useCallback } from "react";
import {
  cleanShadowingSentence,
} from "@/features/student/components/SpeakingShadowingStudio";
import {
  extractReferenceSentence,
  isInvalidSampleAudioUrl,
  isMockOrBrokenAudioUrl,
  playSampleAudio,
  stopAllSampleAudio,
} from "@/utils/sampleAudioPlayer";

export function useSpeakingAudioRecorder() {
  // Trạng thái thu âm
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);
  const [activeAudioBlob, setActiveAudioBlob] = useState<Blob | null>(null);

  const timerRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const recordingDurationRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Phát câu mẫu Text-to-speech (Kokoro Neural Audio / Web Speech English Fallback)
  const [isPlayingRefTts, setIsPlayingRefTts] = useState(false);
  const [ttsSpeed, setTtsSpeed] = useState<number>(1.0);
  const [selectedVoice, setSelectedVoice] = useState<string>("af_heart");
  const [isSynthesizingTts, setIsSynthesizingTts] = useState<boolean>(false);

  // Phát lại bản thu âm của học viên (tách biệt 100% với state & instance câu mẫu)
  const [isPlayingStudentRec, setIsPlayingStudentRec] = useState(false);
  const studentPlaybackAudioRef = useRef<HTMLAudioElement | null>(null);

  // Dừng mọi track micro và timer
  const cleanupMediaResources = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  // Bắt đầu thu âm
  const startRecording = useCallback(async () => {
    try {
      cleanupMediaResources();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      let mimeType = "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
        mimeType = "audio/ogg;codecs=opus";
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const finalType = recorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: finalType });
        setActiveAudioBlob(blob);
        setActiveAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;

        const duration = (Date.now() - startTimeRef.current) / 1000;
        recordingDurationRef.current = duration;
      };

      startTimeRef.current = Date.now();
      recordingDurationRef.current = 0;
      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      alert("Không thể truy cập Microphone. Vui lòng cấp quyền micro cho trình duyệt.");
    }
  }, [cleanupMediaResources]);

  // Dừng thu âm
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  // Upload file âm thanh ghi sẵn
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setActiveAudioBlob(file);
        setActiveAudioUrl(URL.createObjectURL(file));
        recordingDurationRef.current = 10;
      }
    },
    [],
  );

  // Reset toàn bộ trạng thái audio (khi đổi câu hỏi hoặc rời trang)
  const resetAudioState = useCallback(() => {
    cleanupMediaResources();
    stopAllSampleAudio();
    setIsPlayingRefTts(false);
    setIsSynthesizingTts(false);

    if (studentPlaybackAudioRef.current) {
      studentPlaybackAudioRef.current.pause();
      studentPlaybackAudioRef.current.currentTime = 0;
    }
    setIsPlayingStudentRec(false);

    setIsRecording(false);
    setRecordingSeconds(0);
    setActiveAudioUrl(null);
    setActiveAudioBlob(null);
    recordingDurationRef.current = 0;
  }, [cleanupMediaResources]);

  // Điều khiển phát câu mẫu chuẩn (Sample Audio / Reference TTS)
  const handlePlayTtsPrompt = useCallback(
    async (textToRead?: string, currentQ?: any) => {
      if (isPlayingRefTts) {
        stopAllSampleAudio();
        setIsPlayingRefTts(false);
        return;
      }

      // Dừng phát bản thu của học viên nếu đang chạy
      if (studentPlaybackAudioRef.current && isPlayingStudentRec) {
        studentPlaybackAudioRef.current.pause();
        setIsPlayingStudentRec(false);
      }

      const sampleText =
        cleanShadowingSentence(textToRead?.trim() || "") ||
        extractReferenceSentence(currentQ);
      if (!sampleText) return;

      const studentUrl = activeAudioUrl || currentQ?.audioUrl || null;
      const validMediaUrl =
        selectedVoice === "af_heart" &&
        currentQ?.mediaUrl &&
        !isInvalidSampleAudioUrl(currentQ.mediaUrl, studentUrl)
          ? currentQ.mediaUrl
          : undefined;

      setIsSynthesizingTts(true);
      try {
        await playSampleAudio(sampleText, {
          audioUrl: validMediaUrl,
          voice: selectedVoice,
          lang: selectedVoice.startsWith("b") ? "en-GB" : "en-US",
          rate: ttsSpeed,
          studentAudioUrl: studentUrl,
          onStart: () => {
            setIsSynthesizingTts(false);
            setIsPlayingRefTts(true);
          },
          onEnd: () => {
            setIsSynthesizingTts(false);
            setIsPlayingRefTts(false);
          },
          onError: () => {
            setIsSynthesizingTts(false);
            setIsPlayingRefTts(false);
          },
        });
      } finally {
        setIsSynthesizingTts(false);
      }
    },
    [isPlayingRefTts, isPlayingStudentRec, activeAudioUrl, selectedVoice, ttsSpeed],
  );

  // Điều khiển phát lại bản thu âm của học viên (User Audio Playback)
  const handleTogglePlayStudentAudio = useCallback(() => {
    if (!activeAudioUrl || isMockOrBrokenAudioUrl(activeAudioUrl)) return;

    if (isPlayingStudentRec && studentPlaybackAudioRef.current) {
      studentPlaybackAudioRef.current.pause();
      setIsPlayingStudentRec(false);
      return;
    }

    // Dừng phát câu mẫu nếu đang bật
    if (isPlayingRefTts) {
      stopAllSampleAudio();
      setIsPlayingRefTts(false);
    }

    if (!studentPlaybackAudioRef.current) {
      studentPlaybackAudioRef.current = new Audio(activeAudioUrl);
    } else if (studentPlaybackAudioRef.current.src !== activeAudioUrl) {
      studentPlaybackAudioRef.current.pause();
      studentPlaybackAudioRef.current.src = activeAudioUrl;
    }

    studentPlaybackAudioRef.current.onended = () => setIsPlayingStudentRec(false);
    studentPlaybackAudioRef.current.onerror = () => setIsPlayingStudentRec(false);
    studentPlaybackAudioRef.current
      .play()
      .then(() => setIsPlayingStudentRec(true))
      .catch(() => setIsPlayingStudentRec(false));
  }, [activeAudioUrl, isPlayingStudentRec, isPlayingRefTts]);

  // Cleanup khi unmount
  useEffect(() => {
    return () => {
      cleanupMediaResources();
      if (studentPlaybackAudioRef.current) {
        studentPlaybackAudioRef.current.pause();
      }
      stopAllSampleAudio();
    };
  }, [cleanupMediaResources]);

  return {
    isRecording,
    recordingSeconds,
    activeAudioUrl,
    setActiveAudioUrl,
    activeAudioBlob,
    setActiveAudioBlob,
    recordingDurationRef,
    startRecording,
    stopRecording,
    handleFileUpload,
    resetAudioState,
    isPlayingRefTts,
    setIsPlayingRefTts,
    ttsSpeed,
    setTtsSpeed,
    selectedVoice,
    setSelectedVoice,
    isSynthesizingTts,
    handlePlayTtsPrompt,
    isPlayingStudentRec,
    setIsPlayingStudentRec,
    handleTogglePlayStudentAudio,
  };
}
