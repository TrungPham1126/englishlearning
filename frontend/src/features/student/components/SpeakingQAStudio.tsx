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
  Gauge,
  Activity,
  Award,
  BookOpen,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import { studentApi } from "../api/studentApi";
import type { SpeakingAiEvaluationResult } from "../types";

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
  const [showGuidelines, setShowGuidelines] = useState(false);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(
    savedAudioUrl || null,
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
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Audio Player and Cache for Examiner Voice (Kokoro-82M)
  const promptAudioRef = useRef<HTMLAudioElement | null>(null);
  const promptAudioCacheRef = useRef<Map<string, string>>(new Map());

  // Text-To-Speech for Question Prompt using Kokoro-82M
  const handleReadPrompt = async () => {
    if (isReadingPrompt) {
      if (promptAudioRef.current) promptAudioRef.current.pause();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      setIsReadingPrompt(false);
      return;
    }

    const cleanPrompt = promptQuestion?.trim();
    if (!cleanPrompt) return;

    let audioUrl = promptAudioCacheRef.current.get(cleanPrompt);

    if (!audioUrl) {
      try {
        setIsReadingPrompt(true);
        const res = await studentApi.synthesizeTTS({
          text: cleanPrompt,
          voice: "am_michael", // Giám khảo nam Mỹ trầm ấm
          speed: 1.0,
        });
        if (res?.audioUrl) {
          audioUrl = res.audioUrl;
          promptAudioCacheRef.current.set(cleanPrompt, audioUrl);
        }
      } catch (err) {
        console.warn("Kokoro TTS fallback to Web Speech API in SpeakingQAStudio:", err);
      }
    }

    if (audioUrl) {
      if (!promptAudioRef.current) {
        promptAudioRef.current = new Audio(audioUrl);
      } else {
        promptAudioRef.current.src = audioUrl;
      }
      promptAudioRef.current.onended = () => setIsReadingPrompt(false);
      promptAudioRef.current.onerror = () => setIsReadingPrompt(false);
      setIsReadingPrompt(true);
      try {
        await promptAudioRef.current.play();
      } catch {
        setIsReadingPrompt(false);
      }
      return;
    }

    // Fallback Web Speech
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanPrompt);
      utterance.lang = "en-US";
      utterance.rate = 0.95;
      utterance.onstart = () => setIsReadingPrompt(true);
      utterance.onend = () => setIsReadingPrompt(false);
      utterance.onerror = () => setIsReadingPrompt(false);
      window.speechSynthesis.speak(utterance);
    }
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
    <div className="rounded-2xl border-2 border-indigo-500/20 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 p-6 shadow-xl space-y-6">
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
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Mic className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Speaking Q&A: Hỏi - Đáp Phỏng Vấn AI
              <span className="text-[10px] uppercase bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-black border border-indigo-500/30">
                AI Examiner
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Đọc câu hỏi phỏng vấn, ghi âm câu trả lời & nhận đánh giá chi tiết theo tiêu chuẩn Cambridge / IELTS
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReadPrompt}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
            isReadingPrompt
              ? "bg-amber-500/20 border-amber-500/30 text-amber-300 animate-pulse"
              : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white"
          }`}
          title="Nghe giám khảo AI đọc câu hỏi"
        >
          <Volume2 className="h-4 w-4 text-indigo-400" />
          <span>{isReadingPrompt ? "Đang đọc..." : "Nghe đọc câu hỏi"}</span>
        </button>
      </div>

      {/* 1. KHUNG HIỂN THỊ CÂU HỎI PHỎNG VẤN (QUESTION PROMPT) */}
      <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-5 space-y-3 relative overflow-hidden">
        <div className="flex items-center justify-between text-xs font-bold text-indigo-400">
          <span className="flex items-center gap-1.5 uppercase tracking-wider">
            <HelpCircle className="h-4 w-4" /> Câu Hỏi Phỏng Vấn (Interview Prompt):
          </span>
        </div>

        <p className="text-base md:text-xl font-bold text-white leading-relaxed tracking-wide pt-1">
          "{promptQuestion}"
        </p>

        {/* Guidelines / Hints Accordion */}
        {guidelines && guidelines.trim().length > 0 && (
          <div className="pt-2 border-t border-indigo-900/40">
            <button
              type="button"
              onClick={() => setShowGuidelines(!showGuidelines)}
              className="flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition cursor-pointer"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              <span>Gợi ý ý tưởng & từ vựng hỗ trợ</span>
              {showGuidelines ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>

            {showGuidelines && (
              <div className="mt-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed whitespace-pre-wrap animate-in fade-in duration-150">
                {guidelines}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. KHU VỰC THU ÂM VÀ ĐIỀU KHIỂN (RECORDING STUDIO) */}
      <div className="flex flex-col items-center justify-center p-6 rounded-xl border border-slate-800 bg-slate-950/40 space-y-4">
        {/* Timer & Trạng thái */}
        <div className="flex items-center space-x-3">
          <div
            className={`h-3 w-3 rounded-full ${
              isRecording
                ? "bg-rose-500 animate-ping"
                : audioBlob
                ? "bg-emerald-500"
                : "bg-slate-600"
            }`}
          />
          <span className="text-2xl font-mono font-black text-white tracking-widest">
            {formatTimer(recordingSeconds)}
          </span>
          {isRecording && (
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider animate-pulse">
              • Đang thu âm câu trả lời...
            </span>
          )}
        </div>

        {/* Các nút bấm hành động */}
        <div className="flex items-center space-x-4">
          {!isRecording ? (
            <button
              type="button"
              onClick={startRecording}
              disabled={isEvaluating}
              className="flex items-center space-x-2 px-6 py-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-600/30 transition hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Mic className="h-5 w-5" />
              <span>{audioBlob ? "Ghi Âm Lại (Re-record)" : "Bắt Đầu Trả Lời (Record)"}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="flex items-center space-x-2 px-6 py-3 rounded-full bg-slate-100 hover:bg-white text-slate-950 font-bold text-sm shadow-lg shadow-white/20 transition hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Square className="h-5 w-5 fill-slate-950" />
              <span>Hoàn Thành & Chấm AI</span>
            </button>
          )}

          {/* Nghe lại âm thanh học sinh đã thu */}
          {recordedAudioUrl && !isRecording && (
            <button
              type="button"
              onClick={togglePlayStudentAudio}
              className="flex items-center space-x-2 px-5 py-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-700 transition cursor-pointer"
            >
              {isPlayingStudent ? (
                <Pause className="h-5 w-5 text-indigo-400" />
              ) : (
                <Play className="h-5 w-5 text-indigo-400" />
              )}
              <span>{isPlayingStudent ? "Tạm dừng" : "Nghe lại giọng nói"}</span>
            </button>
          )}

          {/* Nút Reset */}
          {audioBlob && !isRecording && (
            <button
              type="button"
              onClick={resetRecording}
              className="p-3 rounded-full bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              title="Xóa bản thu và làm lại từ đầu"
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
            className="flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 underline pt-2 cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            Bấm vào đây nếu muốn gửi chấm điểm lại bằng AI
          </button>
        )}
      </div>

      {/* 3. TRẠNG THÁI LOADING CHẤM ĐIỂM AI */}
      {isEvaluating && (
        <div className="p-8 rounded-xl border border-indigo-500/30 bg-indigo-950/30 flex flex-col items-center justify-center space-y-3 text-center animate-in fade-in">
          <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
          <h4 className="text-sm font-bold text-white">
            Giám khảo AI đang chấm điểm câu trả lời của bạn...
          </h4>
          <p className="text-xs text-slate-400 max-w-md">
            Groq Whisper STT đang bóc băng giọng nói & AI Examiner đang đối chiếu câu hỏi, chấm điểm Phát âm, Độ trôi chảy, Trả lời đúng trọng tâm và Ngữ pháp.
          </p>
        </div>
      )}

      {/* Lỗi nếu AI chấm thất bại */}
      {evalError && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{evalError}</span>
          </div>
          <button
            type="button"
            onClick={() => triggerAiEvaluation()}
            className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold transition shrink-0 ml-3"
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
            {/* Overall Band Card */}
            <div className="p-4 rounded-xl border border-indigo-500/40 bg-gradient-to-br from-indigo-950/60 to-slate-900 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 block">
                  Overall Band Score
                </span>
                <span className="text-3xl font-black text-white">
                  {aiResult.overallBand?.toFixed(1) || "6.0"}
                </span>
                <span className="text-xs text-indigo-400 block font-semibold mt-0.5">
                  Trình độ CEFR: {aiResult.estimatedCefr || "B2"}
                </span>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Award className="h-6 w-6" />
              </div>
            </div>

            {/* Trả lời đúng trọng tâm / Lạc đề (Task Response) */}
            <div
              className={`p-4 rounded-xl border md:col-span-2 flex flex-col justify-between ${
                aiResult.isOffTopic
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {aiResult.isOffTopic ? (
                    <AlertTriangle className="h-5 w-5 text-rose-400" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  )}
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {aiResult.isOffTopic
                      ? "⚠️ Cảnh báo: Trả lời Lạc Đề / Chưa đúng câu hỏi"
                      : "✅ Trả lời đúng trọng tâm câu hỏi (On Topic)"}
                  </span>
                </div>
                {aiResult.taskAchievement?.score !== undefined && (
                  <span className="text-xs font-black px-2 py-0.5 rounded bg-slate-900/60">
                    Task Score: {aiResult.taskAchievement.score.toFixed(1)}
                  </span>
                )}
              </div>

              {/* Chi tiết các ý đã trả lời & còn thiếu */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800 text-[11px]">
                <div>
                  <span className="font-bold text-white block mb-0.5">
                    ✓ Ý chính đã nêu được:
                  </span>
                  {aiResult.taskAchievement?.addressedPoints &&
                  aiResult.taskAchievement.addressedPoints.length > 0 ? (
                    <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                      {aiResult.taskAchievement.addressedPoints.map((pt, i) => (
                        <li key={i}>{pt}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-slate-400 italic">Chưa ghi nhận ý rõ ràng</span>
                  )}
                </div>

                <div>
                  <span className="font-bold text-amber-300 block mb-0.5">
                    ✗ Ý quan trọng còn thiếu:
                  </span>
                  {aiResult.taskAchievement?.missingPoints &&
                  aiResult.taskAchievement.missingPoints.length > 0 ? (
                    <ul className="list-disc list-inside space-y-0.5 text-amber-200/90">
                      {aiResult.taskAchievement.missingPoints.map((pt, i) => (
                        <li key={i}>{pt}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-emerald-400">Đã đáp ứng trọn vẹn yêu cầu</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 4 Trụ Cột Đánh Giá Chi Tiết: Phát âm, Trôi chảy, Ngữ pháp, Từ vựng */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 text-center">
              <span className="text-[11px] font-bold text-slate-400 block">Phát Âm (Pronunciation)</span>
              <span className="text-xl font-black text-rose-400">
                {aiResult.pronunciationScore?.toFixed(1) || "0.0"}
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 text-center">
              <span className="text-[11px] font-bold text-slate-400 block">Độ Trôi Chảy (Fluency)</span>
              <span className="text-xl font-black text-amber-400">
                {aiResult.fluencyScore?.toFixed(1) || "0.0"}
              </span>
              {aiResult.wordsPerMinute ? (
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {aiResult.wordsPerMinute} wpm
                </span>
              ) : null}
            </div>

            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 text-center">
              <span className="text-[11px] font-bold text-slate-400 block">Ngữ Pháp (Grammar)</span>
              <span className="text-xl font-black text-sky-400">
                {aiResult.grammarScore?.toFixed(1) || "0.0"}
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 text-center">
              <span className="text-[11px] font-bold text-slate-400 block">Từ Vựng (Lexical)</span>
              <span className="text-xl font-black text-emerald-400">
                {aiResult.lexicalScore?.toFixed(1) || "0.0"}
              </span>
            </div>
          </div>

          {/* Bản Bóc Băng Lời Nói Của Học Sinh (Transcript) */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                <BookOpen className="h-4 w-4 text-indigo-400" /> Bản Bóc Băng Giọng Nói Học Sinh (Transcript STT):
              </span>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed italic bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
              "{aiResult.transcript || "(Không nhận diện được giọng nói rõ ràng)"}"
            </p>
          </div>

          {/* Lỗi Sai Cụ Thể (Mistakes) */}
          {aiResult.mistakes && aiResult.mistakes.length > 0 && (
            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-3">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5 uppercase tracking-wider">
                <AlertCircle className="h-4 w-4 text-amber-400" /> Các Điểm Cần Chỉnh Sửa Ngữ Pháp & Phát Âm:
              </span>
              <div className="space-y-2">
                {aiResult.mistakes.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-slate-800 bg-slate-900/90 text-xs space-y-1"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="line-through text-rose-400 font-semibold">
                        {m.original}
                      </span>
                      <span className="text-slate-500">➔</span>
                      <span className="text-emerald-400 font-bold">
                        {m.correction}
                      </span>
                      {m.type && (
                        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-bold ml-auto">
                          {m.type}
                        </span>
                      )}
                    </div>
                    {m.explanation && (
                      <p className="text-slate-400 text-[11px] pt-1">
                        💡 {m.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bản Diễn Đạt Lại Mượt Mà (Corrected Text) */}
          {aiResult.correctedText && (
            <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 space-y-2">
              <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="h-4 w-4 text-indigo-400" /> Gợi Ý Câu Trả Lời Chuẩn Mẫu (Model Answer):
              </span>
              <p className="text-sm text-indigo-100 leading-relaxed bg-slate-900/80 p-3 rounded-lg border border-indigo-500/20">
                "{aiResult.correctedText}"
              </p>
            </div>
          )}

          {/* Lời Khuyên & Gợi Ý Cải Thiện (Suggestions & General Feedback) */}
          {(aiResult.generalFeedback || (aiResult.suggestions && aiResult.suggestions.length > 0)) && (
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 space-y-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Lời Nhận Xét & Lộ Trình Cải Thiện Từ Giám Khảo:
              </span>
              {aiResult.generalFeedback && (
                <p className="text-xs text-slate-300 leading-relaxed">
                  {aiResult.generalFeedback}
                </p>
              )}
              {aiResult.suggestions && aiResult.suggestions.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  {aiResult.suggestions.map((s, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                    >
                      <span className="font-bold text-indigo-400 block mb-0.5">
                        {s.area}:
                      </span>
                      <span className="text-slate-300">{s.recommendation}</span>
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

