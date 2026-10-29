// src/features/student/components/SpeakingQAStudio.tsx
import React, { useState, useRef, useEffect } from "react";
import {
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Award,
  BookOpen,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  AlertTriangle,
  Lightbulb,
  Timer,
  SkipForward,
} from "lucide-react";
import { studentApi } from "../api/studentApi";
import type { SpeakingAiEvaluationResult } from "../types";
import {
  cleanShadowingSentence,
  isMockOrBrokenAudioUrl,
  playSampleAudio,
  resolveFullAudioUrl,
  stopAllSampleAudio,
} from "@/utils/sampleAudioPlayer";

interface SpeakingQAStudioProps {
  questionId: string;
  studentAnswerId?: string;
  promptQuestion: string;
  guidelines?: string;
  keyPoints?: string;
  savedAudioUrl?: string;
  onAudioSubmitted: (audioBlob: Blob, result?: SpeakingAiEvaluationResult) => void;
}

export default function SpeakingQAStudio({
  questionId,
  studentAnswerId,
  promptQuestion,
  guidelines,
  keyPoints,
  savedAudioUrl,
  onAudioSubmitted,
}: SpeakingQAStudioProps) {
  // TTS State for reading the question out loud
  const [isReadingPrompt, setIsReadingPrompt] = useState(false);

  // Guidelines accordion
  const [showGuidelines, setShowGuidelines] = useState(true);

  // Preparation Timer (60s IELTS Part 2 style)
  const [isPrepping, setIsPrepping] = useState(false);
  const [prepSeconds, setPrepSeconds] = useState(60);
  const prepTimerRef = useRef<any>(null);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(
    savedAudioUrl && !isMockOrBrokenAudioUrl(savedAudioUrl)
      ? resolveFullAudioUrl(savedAudioUrl)
      : null,
  );

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Playback of student's recorded speech
  const studentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingStudent, setIsPlayingStudent] = useState(false);

  // AI Evaluation State
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [aiResult, setAiResult] = useState<SpeakingAiEvaluationResult | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  useEffect(() => {
    stopAllSampleAudio();
    setIsReadingPrompt(false);
    if (studentAudioRef.current) {
      studentAudioRef.current.pause();
      setIsPlayingStudent(false);
    }
    setRecordedAudioUrl(
      savedAudioUrl && !isMockOrBrokenAudioUrl(savedAudioUrl)
        ? resolveFullAudioUrl(savedAudioUrl)
        : null,
    );
  }, [questionId, promptQuestion, savedAudioUrl]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (prepTimerRef.current) clearInterval(prepTimerRef.current);
      stopAllSampleAudio();
    };
  }, []);

  const startPrepTimer = () => {
    if (isRecording) return;
    if (prepTimerRef.current) clearInterval(prepTimerRef.current);
    setPrepSeconds(60);
    setIsPrepping(true);
    prepTimerRef.current = setInterval(() => {
      setPrepSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(prepTimerRef.current);
          setIsPrepping(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopPrepTimer = () => {
    if (prepTimerRef.current) clearInterval(prepTimerRef.current);
    setIsPrepping(false);
  };

  // Text-To-Speech for Question Prompt using Kokoro-82M & Web Speech English fallback
  const handleReadPrompt = async () => {
    if (isReadingPrompt) {
      stopAllSampleAudio();
      setIsReadingPrompt(false);
      return;
    }

    const cleanPrompt = cleanShadowingSentence(promptQuestion?.trim());
    if (!cleanPrompt) return;

    if (studentAudioRef.current && isPlayingStudent) {
      studentAudioRef.current.pause();
      setIsPlayingStudent(false);
    }

    await playSampleAudio(cleanPrompt, {
      voice: "am_michael",
      lang: "en-US",
      rate: 0.96,
      studentAudioUrl: recordedAudioUrl,
      onStart: () => setIsReadingPrompt(true),
      onEnd: () => setIsReadingPrompt(false),
      onError: () => setIsReadingPrompt(false),
    });
  };

  // Start Mic Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());

        // Tự động kích hoạt chấm AI ngay sau khi hoàn thành thu âm
        triggerAiEvaluation(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      setAiResult(null);
      setEvalError(null);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert("Không thể truy cập Microphone! Vui lòng cho phép quyền ghi âm trên trình duyệt.");
    }
  };

  // Stop Mic Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // Trigger AI Evaluation
  const triggerAiEvaluation = async (blobToEvaluate?: Blob) => {
    const blob = blobToEvaluate || audioBlob;
    if (!blob) {
      alert("Vui lòng ghi âm câu trả lời trước khi chấm điểm!");
      return;
    }

    setIsEvaluating(true);
    setEvalError(null);
    try {
      const targetId = studentAnswerId || questionId;
      const result = await studentApi.evaluateSpeakingAI(
        promptQuestion,
        blob,
        targetId,
      );
      setAiResult(result);
      onAudioSubmitted(blob, result);
    } catch (err: any) {
      console.error("AI Speaking Evaluation error:", err);
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        "Lỗi chấm điểm Speaking bằng AI. Vui lòng thử lại.";
      setEvalError(errMsg);
      onAudioSubmitted(blob);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Reset recording to re-take
  const resetRecording = () => {
    setAudioBlob(null);
    setRecordedAudioUrl(null);
    setRecordingSeconds(0);
    setAiResult(null);
    setEvalError(null);
    if (studentAudioRef.current) {
      studentAudioRef.current.pause();
    }
    setIsPlayingStudent(false);
  };

  const togglePlayStudentAudio = () => {
    if (!studentAudioRef.current) return;
    if (isPlayingStudent) {
      studentAudioRef.current.pause();
      setIsPlayingStudent(false);
    } else {
      studentAudioRef.current
        .play()
        .then(() => setIsPlayingStudent(true))
        .catch(() => {});
    }
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="rounded-xl border border-blue-200/80 dark:border-blue-600/20 bg-white dark:bg-slate-900 p-5 sm:p-7 shadow-lg space-y-6 transition-colors">
      {/* Hidden Student Audio Player */}
      {recordedAudioUrl && (
        <audio
          ref={studentAudioRef}
          src={recordedAudioUrl}
          onEnded={() => setIsPlayingStudent(false)}
          className="hidden"
        />
      )}

      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-600/10 border border-blue-200 dark:border-blue-600/20 text-blue-700 dark:text-blue-400">
            <Mic className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
              Speaking Q&A: Hỏi - Đáp Phỏng Vấn AI
              <span className="text-[10px] uppercase bg-blue-100 dark:bg-blue-600/20 text-blue-800 dark:text-blue-300 px-2.5 py-0.5 rounded-full font-black border border-blue-200 dark:border-blue-600/30">
                AI Examiner • IELTS / Cambridge
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Chuẩn bị ý tưởng với Cue Card, thu âm câu trả lời & nhận đánh giá 4 tiêu chí chấm điểm tự động
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 60s Prep Timer Control */}
          {!isRecording && !aiResult && (
            <button
              type="button"
              onClick={isPrepping ? stopPrepTimer : startPrepTimer}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                isPrepping
                  ? "bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              }`}
              title="Đồng hồ chuẩn bị ý tưởng 60 giây chuẩn IELTS Part 2"
            >
              <Timer className="h-4 w-4 text-amber-500" />
              <span>
                {isPrepping ? `Chuẩn bị: ${formatTimer(prepSeconds)}` : "60s Chuẩn bị"}
              </span>
              {isPrepping && <SkipForward className="h-3.5 w-3.5 ml-0.5 opacity-75" />}
            </button>
          )}

          <button
            type="button"
            onClick={handleReadPrompt}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
              isReadingPrompt
                ? "bg-blue-800 border-blue-600 text-white animate-pulse"
                : "bg-blue-50 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-slate-700 border-blue-200 dark:border-slate-700 text-blue-800 dark:text-slate-200"
            }`}
            title="Nghe giám khảo AI đọc câu hỏi"
          >
            <Volume2 className="h-4 w-4" />
            <span>{isReadingPrompt ? "Đang đọc..." : "Nghe câu hỏi"}</span>
          </button>
        </div>
      </div>

      {/* 1. KHUNG CUE CARD / CÂU HỎI PHỎNG VẤN (QUESTION PROMPT) */}
      <div className="rounded-xl border border-blue-200/80 dark:border-blue-600/30 bg-white dark:bg-surface-card p-5 sm:p-6 space-y-3.5 relative overflow-hidden shadow-card">
        <div className="flex items-center justify-between text-xs font-extrabold text-blue-700 dark:text-blue-400">
          <span className="flex items-center gap-1.5 uppercase tracking-wider">
            <HelpCircle className="h-4 w-4" /> Cue Card & Interview Prompt
          </span>
          {keyPoints && (
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Trọng tâm: {keyPoints}
            </span>
          )}
        </div>

        <p className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white leading-relaxed tracking-tight">
          "{promptQuestion}"
        </p>

        {/* Guidelines / Hints Accordion */}
        {guidelines && guidelines.trim().length > 0 && (
          <div className="pt-2.5 border-t border-blue-200/60 dark:border-blue-900/40">
            <button
              type="button"
              onClick={() => setShowGuidelines(!showGuidelines)}
              className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 transition cursor-pointer"
            >
              <Lightbulb className="h-4 w-4" />
              <span>Gợi ý triển khai ý tưởng (Bullet points) & Từ vựng ăn điểm</span>
              {showGuidelines ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>

            {showGuidelines && (
              <div className="mt-2.5 p-3.5 rounded-xl bg-amber-50/90 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-900 dark:text-amber-200/90 leading-relaxed whitespace-pre-wrap animate-in fade-in duration-150">
                {guidelines}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. KHU VỰC THU ÂM VÀ ĐIỀU KHIỂN (RECORDING STUDIO) */}
      <div className="flex flex-col items-center justify-center p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 space-y-5 relative overflow-hidden">
        {/* Timer & Trạng thái */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center space-x-3">
            <div
              className={`h-3 w-3 rounded-full ${
                isRecording
                  ? "bg-rose-500 animate-ping"
                  : audioBlob
                  ? "bg-emerald-500"
                  : "bg-slate-400 dark:bg-slate-600"
              }`}
            />
            <span className="text-3xl font-mono font-black text-slate-900 dark:text-white tracking-widest">
              {formatTimer(recordingSeconds)}
            </span>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
              / 02:00
            </span>
          </div>

          {/* Animated Soundwave Bars when Recording */}
          {isRecording ? (
            <div className="flex items-center gap-2 pt-1">
              <div className="flex items-end gap-1 h-4">
                <span className="w-1 bg-rose-500 rounded-full animate-pulse h-2" />
                <span className="w-1 bg-rose-500 rounded-full animate-pulse h-4 [animation-delay:150ms]" />
                <span className="w-1 bg-rose-500 rounded-full animate-pulse h-3 [animation-delay:300ms]" />
                <span className="w-1 bg-rose-500 rounded-full animate-pulse h-4 [animation-delay:75ms]" />
                <span className="w-1 bg-rose-500 rounded-full animate-pulse h-2 [animation-delay:225ms]" />
              </div>
              <span className="text-xs font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider animate-pulse">
                Đang thu âm giọng nói trực tiếp...
              </span>
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {audioBlob
                ? "Đã lưu bản thu âm. Bạn có thể nghe lại hoặc thu âm lại bất kỳ lúc nào."
                : "Nhấn nút Microphone bên dưới để bắt đầu trả lời câu hỏi."}
            </p>
          )}
        </div>

        {/* Các nút bấm hành động với hiệu ứng Pulse Ring */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-1">
          {!isRecording ? (
            <button
              type="button"
              onClick={() => {
                stopPrepTimer();
                startRecording();
              }}
              disabled={isEvaluating}
              aria-label={audioBlob ? "Ghi âm lại câu trả lời" : "Bắt đầu ghi âm câu trả lời"}
              className="flex items-center space-x-2.5 px-7 py-3.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-600/25 transition hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Mic className="h-5 w-5" />
              <span>{audioBlob ? "Ghi Âm Lại (Re-record)" : "Bắt Đầu Trả Lời (Record)"}</span>
            </button>
          ) : (
            <div className="relative flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-rose-500/30 animate-ping" />
              <button
                type="button"
                onClick={stopRecording}
                aria-label="Dừng ghi âm và gửi chấm điểm AI"
                className="relative z-10 flex items-center space-x-2.5 px-7 py-3.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-card shadow-rose-600/40 transition hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Square className="h-4 w-4 fill-white" />
                <span>Hoàn Thành & Chấm Điểm AI</span>
              </button>
            </div>
          )}

          {/* Nghe lại âm thanh học sinh đã thu */}
          {recordedAudioUrl && !isRecording && (
            <button
              type="button"
              onClick={togglePlayStudentAudio}
              className="flex items-center space-x-2 px-5 py-3.5 rounded-full bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm border border-slate-200 dark:border-slate-700 shadow-sm transition cursor-pointer"
            >
              {isPlayingStudent ? (
                <Pause className="h-4 w-4 text-blue-700 dark:text-blue-400" />
              ) : (
                <Play className="h-4 w-4 text-blue-700 dark:text-blue-400" />
              )}
              <span>{isPlayingStudent ? "Tạm dừng" : "Nghe lại bản thu"}</span>
            </button>
          )}

          {/* Nút Reset */}
          {audioBlob && !isRecording && (
            <button
              type="button"
              onClick={resetRecording}
              className="p-3.5 rounded-full bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              title="Xóa bản thu và làm lại từ đầu"
              aria-label="Xóa bản thu âm"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Nút bấm chấm điểm AI thủ công (nếu cần chấm lại) */}
        {audioBlob && !isRecording && !isEvaluating && !aiResult && (
          <button
            type="button"
            onClick={() => triggerAiEvaluation()}
            className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400 hover:underline pt-1 cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            Bấm vào đây để gửi chấm điểm lại bằng AI
          </button>
        )}
      </div>

      {/* 3. TRẠNG THÁI LOADING CHẤM ĐIỂM AI */}
      {isEvaluating && (
        <div className="p-8 rounded-xl border border-blue-200 dark:border-blue-600/30 bg-blue-50/60 dark:bg-slate-900/30 flex flex-col items-center justify-center space-y-3 text-center animate-in fade-in">
          <Loader2 className="h-9 w-9 text-blue-700 dark:text-blue-400 animate-spin" />
          <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
            Giám khảo AI đang phân tích giọng nói & chấm điểm...
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md leading-relaxed">
            Groq Whisper STT đang bóc băng phát âm & AI Examiner đang đối chiếu câu hỏi, đánh giá Pronunciation, Fluency, Grammar và Lexical Resource.
          </p>
        </div>
      )}

      {/* Lỗi nếu AI chấm thất bại */}
      {evalError && (
        <div className="p-4 rounded-xl border border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 flex items-center justify-between text-xs text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span className="font-medium">{evalError}</span>
          </div>
          <button
            type="button"
            onClick={() => triggerAiEvaluation()}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition shrink-0 ml-3 cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* 4. BẢNG KẾT QUẢ ĐÁNH GIÁ CHI TIẾT CỦA AI EXAMINER */}
      {aiResult && !isEvaluating && (
        <div className="space-y-5 animate-in fade-in duration-300">
          {/* Header Tổng Quan Band Score & Task Response */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Overall Band Card with Circular Ring */}
            <div className="p-5 rounded-xl border border-brand-700 bg-brand-600 text-white flex items-center justify-between shadow-card">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-100 block">
                  Overall Band Score
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-4xl font-black text-white">
                    {aiResult.overallBand?.toFixed(1) || "6.0"}
                  </span>
                  <span className="text-xs font-bold text-blue-200">/ 9.0</span>
                </div>
                <span className="inline-flex items-center gap-1 text-xs bg-white/15 text-white px-2.5 py-0.5 rounded-full font-bold mt-2">
                  <Award className="h-3.5 w-3.5" />
                  CEFR: {aiResult.estimatedCefr || "B2"}
                </span>
              </div>
              <div className="relative h-16 w-16 flex items-center justify-center">
                <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    fill="none"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="6"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 26}
                    strokeDashoffset={
                      2 *
                      Math.PI *
                      26 *
                      (1 - Math.min(9, Math.max(0, aiResult.overallBand || 6)) / 9)
                    }
                  />
                </svg>
                <span className="absolute text-xs font-black text-white">
                  {Math.round(((aiResult.overallBand || 6) / 9) * 100)}%
                </span>
              </div>
            </div>

            {/* Trả lời đúng trọng tâm / Lạc đề (Task Response) */}
            <div
              className={`p-5 rounded-xl border md:col-span-2 flex flex-col justify-between ${
                aiResult.isOffTopic
                  ? "border-rose-300 dark:border-rose-500/40 bg-rose-50/80 dark:bg-rose-500/10 text-rose-800 dark:text-rose-200"
                  : "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/80 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
              }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {aiResult.isOffTopic ? (
                    <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <span className="text-xs font-extrabold uppercase tracking-wider">
                    {aiResult.isOffTopic
                      ? "⚠️ Cảnh báo: Trả lời Lạc Đề / Chưa đúng trọng tâm"
                      : "✅ Trả lời đúng trọng tâm câu hỏi (On Topic)"}
                  </span>
                </div>
                {aiResult.taskAchievement?.score !== undefined && (
                  <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-900/60 text-slate-900 dark:text-white border border-slate-200/60 dark:border-slate-700">
                    Task Score: {aiResult.taskAchievement.score.toFixed(1)} / 9.0
                  </span>
                )}
              </div>

              {/* Chi tiết các ý đã trả lời & còn thiếu */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-800 text-xs">
                <div>
                  <span className="font-extrabold text-slate-900 dark:text-white block mb-1">
                    ✓ Ý chính đã triển khai:
                  </span>
                  {aiResult.taskAchievement?.addressedPoints &&
                  aiResult.taskAchievement.addressedPoints.length > 0 ? (
                    <ul className="list-disc list-inside space-y-0.5 text-slate-700 dark:text-slate-300">
                      {aiResult.taskAchievement.addressedPoints.map((pt, i) => (
                        <li key={i}>{pt}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400 italic">
                      Chưa ghi nhận ý rõ ràng
                    </span>
                  )}
                </div>

                <div>
                  <span className="font-extrabold text-amber-700 dark:text-amber-300 block mb-1">
                    ✗ Ý quan trọng cần bổ sung:
                  </span>
                  {aiResult.taskAchievement?.missingPoints &&
                  aiResult.taskAchievement.missingPoints.length > 0 ? (
                    <ul className="list-disc list-inside space-y-0.5 text-amber-800 dark:text-amber-200/90">
                      {aiResult.taskAchievement.missingPoints.map((pt, i) => (
                        <li key={i}>{pt}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                      Đã đáp ứng trọn vẹn yêu cầu câu hỏi
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 4 Trụ Cột Đánh Giá Chi Tiết với Thanh Tiến Trình (Progress Gauges) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {[
              {
                label: "Phát Âm (Pronunciation)",
                score: aiResult.pronunciationScore || 0,
                color: "text-rose-600 dark:text-rose-400",
                bar: "bg-rose-500",
                sub: "Chuẩn IPA & Trọng âm",
              },
              {
                label: "Độ Trôi Chảy (Fluency)",
                score: aiResult.fluencyScore || 0,
                color: "text-amber-600 dark:text-amber-400",
                bar: "bg-amber-500",
                sub: aiResult.wordsPerMinute ? `Tốc độ: ${aiResult.wordsPerMinute} WPM` : "Nhịp điệu & Ngắt nghỉ",
              },
              {
                label: "Ngữ Pháp (Grammar)",
                score: aiResult.grammarScore || 0,
                color: "text-sky-600 dark:text-sky-400",
                bar: "bg-sky-500",
                sub: "Cấu trúc & Thì câu",
              },
              {
                label: "Từ Vựng (Lexical)",
                score: aiResult.lexicalScore || 0,
                color: "text-emerald-600 dark:text-emerald-400",
                bar: "bg-emerald-500",
                sub: "Collocations & Idioms",
              },
            ].map((item) => {
              const pct = Math.min(100, Math.round((item.score / 9) * 100));
              return (
                <div
                  key={item.label}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-2"
                >
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                    {item.label}
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className={`text-2xl font-black ${item.color}`}>
                      {item.score.toFixed(1)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">/ 9.0</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.bar} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block">
                    {item.sub}
                  </span>
                </div>
              );
            })}
          </div>

          {/* So Sánh Song Song: Bản Bóc Băng Giọng Nói (STT) vs Câu Trả Lời Mẫu Nâng Cấp (Model Answer) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bản Bóc Băng Lời Nói Của Học Sinh (Transcript) */}
            <div className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-2">
                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <BookOpen className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                  Bản Bóc Băng Giọng Nói (Whisper STT Transcript)
                </span>
                <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed italic bg-white dark:bg-slate-900/80 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  "{aiResult.transcript || "(Không nhận diện được giọng nói rõ ràng)"}"
                </p>
              </div>
            </div>

            {/* Bản Diễn Đạt Lại Mượt Mà (Corrected Text / Model Answer) */}
            {aiResult.correctedText && (
              <div className="p-4 sm:p-5 rounded-xl border border-emerald-200 dark:border-emerald-500/25 bg-emerald-50/40 dark:bg-emerald-500/5 space-y-2.5">
                <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Câu Trả Lời Nâng Cấp Chuẩn Band 8.0+ (Model Answer)
                </span>
                <p className="text-sm text-slate-800 dark:text-emerald-100 leading-relaxed bg-white dark:bg-slate-900/80 p-3.5 rounded-xl border border-emerald-200/70 dark:border-emerald-500/20 font-medium">
                  "{aiResult.correctedText}"
                </p>
              </div>
            )}
          </div>

          {/* Lỗi Sai Cụ Thể (Mistakes) */}
          {aiResult.mistakes && aiResult.mistakes.length > 0 && (
            <div className="p-5 rounded-xl border border-amber-200 dark:border-amber-500/25 bg-amber-50/50 dark:bg-amber-500/5 space-y-3">
              <span className="text-xs font-extrabold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 uppercase tracking-wider">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Các Điểm Cần Chỉnh Sửa Ngữ Pháp, Từ Vựng & Phát Âm ({aiResult.mistakes.length})
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {aiResult.mistakes.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 text-xs space-y-1.5 shadow-sm"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="line-through text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded">
                        {m.original}
                      </span>
                      <span className="text-slate-400">➔</span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-extrabold bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded">
                        {m.correction}
                      </span>
                      {m.type && (
                        <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold ml-auto">
                          {m.type}
                        </span>
                      )}
                    </div>
                    {m.explanation && (
                      <p className="text-slate-600 dark:text-slate-400 text-[11px] pt-0.5 leading-relaxed">
                        💡 {m.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lời Khuyên & Gợi Ý Cải Thiện (Suggestions & General Feedback) */}
          {(aiResult.generalFeedback || (aiResult.suggestions && aiResult.suggestions.length > 0)) && (
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 space-y-3">
              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                Lời Nhận Xét & Lộ Trình Cải Thiện Từ Giám Khảo AI
              </span>
              {aiResult.generalFeedback && (
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {aiResult.generalFeedback}
                </p>
              )}
              {aiResult.suggestions && aiResult.suggestions.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {aiResult.suggestions.map((s, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs shadow-sm"
                    >
                      <span className="font-extrabold text-blue-700 dark:text-blue-400 block mb-0.5">
                        {s.area}:
                      </span>
                      <span className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        {s.recommendation}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

