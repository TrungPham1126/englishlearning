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
  Flame,
  VolumeX,
  Repeat,
} from "lucide-react";
import { studentApi } from "../api/studentApi";
import type { ShadowingEvaluationResponse } from "../types";

interface SpeakingShadowingStudioProps {
  questionId: string;
  studentAnswerId?: string;
  referenceSentence: string;
  referenceAudioUrl?: string;
  savedAudioUrl?: string;
  onAudioSubmitted: (audioBlob: Blob, result?: ShadowingEvaluationResponse) => void;
}

export function cleanShadowingSentence(raw?: string | null): string {
  if (!raw) return "";
  let s = raw.trim();

  // 1. Quoted text extraction ("...", “...”, '...')
  const quoteMatch = s.match(/["“'«]([^"“”'»]{4,})["”'»]/);
  if (quoteMatch && quoteMatch[1] && quoteMatch[1].trim().length >= 5) {
    const inside = quoteMatch[1].trim();
    if (inside.includes(" ") || inside.length >= 8) {
      s = inside;
    }
  } else if (s.includes(":")) {
    // 2. Text after colon if it looks like an instruction prefix
    const parts = s.split(":");
    const lastPart = parts[parts.length - 1].trim();
    if (lastPart.length >= 5 && (lastPart.includes(" ") || lastPart.length >= 8)) {
      s = lastPart;
    }
  }

  // 3. Strip instructional prefixes (English & Vietnamese)
  s = s.replace(
    /^(?:please\s+)?(?:listen\s+(?:and|&|\+)\s+(?:repeat|shadow)|repeat\s+after\s+(?:me|the\s+speaker)|shadow(?:ing)?(?:\s+practice(?:\s*\d+)?)?(?:\s+the\s+following)?(?:\s+sentence)?|read\s+aloud|imitate\s+the\s+sentence|practice\s+saying)[:\s\-–—]+/i,
    ""
  );
  s = s.replace(
    /^(?:hãy\s+)?(?:nghe\s+(?:và|&)\s+(?:nhại|lặp)\s+lại|nhại\s+(?:theo|giọng|lại)|đọc\s+(?:theo|lại)|luyện\s+phát\s+âm)(?:\s+chính\s+xác(?:\s+ngữ\s+điệu)?)?(?:\s+câu(?:\s+sau)?)?[:\s\-–—]+/i,
    ""
  );
  s = s.replace(/^(?:question|câu)\s*\d+[:\s.\-–—]+/i, "");
  s = s.replace(/^\d+[\.\)\-–—]\s*/, "");

  // 4. Strip surrounding quotes or stray brackets
  s = s.replace(/^["“'«\s]+|["”'»\s]+$/g, "").trim();

  // 5. If multi-line, take the clean English sentence line
  if (s.includes("\n")) {
    const lines = s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (!/^(hãy|lặp lại|nghe|shadow|repeat|câu|question)/i.test(line)) {
        s = line.replace(/^["“'«\s]+|["”'»\s]+$/g, "").trim();
        break;
      }
    }
  }

  return s;
}

const KOKORO_VOICES = [
  { id: "af_heart", label: "Heart (US Nữ)", tag: "Chuẩn bản xứ" },
  { id: "am_michael", label: "Michael (US Nam)", tag: "Trầm ấm" },
  { id: "bf_emma", label: "Emma (UK Nữ)", tag: "Chuẩn Anh-Anh" },
];

export default function SpeakingShadowingStudio({
  questionId,
  studentAnswerId,
  referenceSentence,
  referenceAudioUrl,
  savedAudioUrl,
  onAudioSubmitted,
}: SpeakingShadowingStudioProps) {
  // Always clean referenceSentence to speak and display strictly the target sentence alone
  const targetSentence = React.useMemo(() => {
    return cleanShadowingSentence(referenceSentence);
  }, [referenceSentence]);

  // Reference Audio Player & Kokoro-82M TTS State
  const refAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingRef, setIsPlayingRef] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [selectedVoice, setSelectedVoice] = useState<string>("af_heart");
  const [isSynthesizingRef, setIsSynthesizingRef] = useState<boolean>(false);
  const [isRepairingAudio, setIsRepairingAudio] = useState<boolean>(false);
  const [activeRefAudioUrl, setActiveRefAudioUrl] = useState<string | null>(
    referenceAudioUrl || null
  );
  const [synthesizedAudioUrl, setSynthesizedAudioUrl] = useState<string | null>(null);
  const ttsCacheRef = useRef<Map<string, string>>(new Map());

  // Synchronize reference audio URL when props change
  useEffect(() => {
    if (referenceAudioUrl) {
      setActiveRefAudioUrl(referenceAudioUrl);
    }
  }, [referenceAudioUrl]);

  // Student Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(
    savedAudioUrl || null,
  );

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // AI Evaluation State
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [aiResult, setAiResult] = useState<ShadowingEvaluationResponse | null>(
    null,
  );

  // Audio Playback of Recorded Student Voice
  const studentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingStudent, setIsPlayingStudent] = useState(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  // Handle reference audio speed toggle with pitch preservation (HTML5 preservesPitch)
  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (refAudioRef.current) {
      refAudioRef.current.playbackRate = speed;
      refAudioRef.current.defaultPlaybackRate = speed;
      (refAudioRef.current as any).preservesPitch = true;
      (refAudioRef.current as any).mozPreservesPitch = true;
      (refAudioRef.current as any).webkitPreservesPitch = true;
    }
  };

  // Synchronize playbackRate across audio element reloads
  useEffect(() => {
    if (refAudioRef.current) {
      refAudioRef.current.playbackRate = playbackSpeed;
      refAudioRef.current.defaultPlaybackRate = playbackSpeed;
      (refAudioRef.current as any).preservesPitch = true;
    }
  }, [playbackSpeed, synthesizedAudioUrl, activeRefAudioUrl]);

  // Self-Healing Audio Repair: Request server to re-generate Kokoro audio with lock & atomic update
  const handleRepairAudio = async () => {
    if (!questionId) return;
    setIsRepairingAudio(true);
    try {
      const res = await studentApi.repairQuestionAudio(questionId);
      if (res && res.url) {
        setActiveRefAudioUrl(res.url);
        ttsCacheRef.current.clear();

        if (!refAudioRef.current) {
          refAudioRef.current = new Audio(res.url);
        } else {
          refAudioRef.current.src = res.url;
        }
        refAudioRef.current.playbackRate = playbackSpeed;
        (refAudioRef.current as any).preservesPitch = true;
        (refAudioRef.current as any).mozPreservesPitch = true;
        (refAudioRef.current as any).webkitPreservesPitch = true;
        refAudioRef.current.onended = () => setIsPlayingRef(false);
        refAudioRef.current.onerror = () => setIsPlayingRef(false);
        try {
          await refAudioRef.current.play();
          setIsPlayingRef(true);
        } catch (_) {}
      }
    } catch (err: any) {
      console.error("Lỗi khi tạo lại audio:", err);
      alert(err?.response?.data?.message || "Không thể tạo lại audio vào lúc này. Vui lòng thử lại sau.");
    } finally {
      setIsRepairingAudio(false);
    }
  };

  // Play / Pause Reference Audio with Kokoro-82M TTS & <300ms pre-generated playback
  const togglePlayRefAudio = async () => {
    // If currently playing, pause it
    if (isPlayingRef) {
      if (refAudioRef.current) {
        refAudioRef.current.pause();
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingRef(false);
      return;
    }

    // Stop student voice if playing
    if (studentAudioRef.current && isPlayingStudent) {
      studentAudioRef.current.pause();
      setIsPlayingStudent(false);
    }

    const textToSpeak = targetSentence;
    if (!textToSpeak) return;

    // Check if referenceAudioUrl is genuine recording (NOT google translate, NOT student recording)
    const isInvalidOrRoboticUrl = (url?: string | null) => {
      if (!url) return true;
      const lower = url.toLowerCase();
      return (
        lower.includes("translate.google") ||
        lower.includes("dictvoice") ||
        lower.includes("speech_gen") ||
        url === savedAudioUrl ||
        url === recordedAudioUrl
      );
    };

    const cacheKey = `${textToSpeak}_${selectedVoice}`;
    let targetUrl: string | null = null;

    // 1. Check client-side Kokoro cache
    if (ttsCacheRef.current.has(cacheKey)) {
      targetUrl = ttsCacheRef.current.get(cacheKey)!;
    }
    // 2. Pre-generated audio (from backend/DB storage) is prioritized (<300ms latency)
    else if (activeRefAudioUrl && !isInvalidOrRoboticUrl(activeRefAudioUrl)) {
      targetUrl = activeRefAudioUrl;
    }

    // 3. Otherwise synthesize via self-hosted Kokoro-82M on demand
    if (!targetUrl) {
      setIsSynthesizingRef(true);
      try {
        const response = await studentApi.synthesizeTTS({
          text: textToSpeak,
          voice: selectedVoice,
          speed: 1.0,
        });

        if (response && response.audioUrl) {
          targetUrl = response.audioUrl;
          ttsCacheRef.current.set(cacheKey, targetUrl);
          setSynthesizedAudioUrl(targetUrl);
        } else {
          throw new Error("Không nhận được audioUrl từ máy chủ TTS");
        }
      } catch (err) {
        console.warn("Kokoro TTS backend error. Falling back to browser SpeechSynthesis...", err);
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(textToSpeak);
          utterance.rate = playbackSpeed;
          utterance.lang = selectedVoice.startsWith("b") ? "en-GB" : "en-US";
          utterance.onend = () => setIsPlayingRef(false);
          utterance.onerror = () => setIsPlayingRef(false);
          setIsPlayingRef(true);
          window.speechSynthesis.speak(utterance);
          setIsSynthesizingRef(false);
          return;
        }
      } finally {
        setIsSynthesizingRef(false);
      }
    }

    if (targetUrl) {
      if (!refAudioRef.current) {
        refAudioRef.current = new Audio(targetUrl);
      } else {
        refAudioRef.current.src = targetUrl;
      }

      refAudioRef.current.playbackRate = playbackSpeed;
      (refAudioRef.current as any).preservesPitch = true;
      (refAudioRef.current as any).mozPreservesPitch = true;
      (refAudioRef.current as any).webkitPreservesPitch = true;
      refAudioRef.current.onended = () => setIsPlayingRef(false);
      refAudioRef.current.onerror = () => setIsPlayingRef(false);

      try {
        await refAudioRef.current.play();
        setIsPlayingRef(true);
      } catch (playErr) {
        console.error("Lỗi phát audio:", playErr);
        setIsPlayingRef(false);
      }
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
        runAiEvaluation(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      setAiResult(null);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert("Không thể truy cập Microphone! Vui lòng cho phép quyền ghi âm.");
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // Run AI Shadowing Evaluation
  const runAiEvaluation = async (blob: Blob) => {
    setIsEvaluating(true);
    try {
      const targetId = studentAnswerId || questionId;
      const result = await studentApi.evaluateShadowingAI(
        blob,
        targetId,
        targetSentence,
      );
      setAiResult(result);
      onAudioSubmitted(blob, result);
    } catch (err) {
      console.error(err);
      onAudioSubmitted(blob);
    } finally {
      setIsEvaluating(false);
    }
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="rounded-2xl border-2 border-indigo-500/20 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 p-6 shadow-xl space-y-6">
      {/* Hidden HTML5 Audio tags */}
      <audio
        ref={refAudioRef}
        src={synthesizedAudioUrl || referenceAudioUrl || undefined}
        onEnded={() => setIsPlayingRef(false)}
        className="hidden"
      />
      {recordedAudioUrl && (
        <audio
          ref={studentAudioRef}
          src={recordedAudioUrl}
          onEnded={() => setIsPlayingStudent(false)}
          className="hidden"
        />
      )}

      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <Mic className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Speaking Studio: Shadowing AI Practice
              <span className="text-[10px] uppercase bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded font-black border border-rose-500/30">
                Luyện Nhại Giọng
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Nghe câu mẫu, bật micro nhại lại chuẩn phát âm & nhận chấm điểm từng từ từ AI
            </p>
          </div>
        </div>

        {/* Voice Selector & Playback Speed Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Voice selector */}
          <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            {KOKORO_VOICES.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setSelectedVoice(v.id);
                  if (isPlayingRef) {
                    if (refAudioRef.current) refAudioRef.current.pause();
                    setIsPlayingRef(false);
                  }
                }}
                title={v.tag}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                  selectedVoice === v.id
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Speed controls */}
          <div className="flex items-center space-x-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            {[0.75, 1.0, 1.25, 1.5].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => changeSpeed(spd)}
                className={`px-2 py-1 text-[11px] font-bold rounded-lg transition ${
                  playbackSpeed === spd
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 1. REFERENCE SENTENCE DISPLAY CARD */}
      <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-5 space-y-3 relative overflow-hidden">
        <div className="flex items-center justify-between text-xs font-bold text-indigo-400">
          <span className="flex items-center gap-1.5 uppercase tracking-wider">
            <Volume2 className="h-4 w-4" /> Câu Mẫu Cần Nhại Giọng (Target Sentence):
          </span>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-300/80 bg-indigo-900/40 px-2 py-0.5 rounded-md border border-indigo-700/50">
              <Sparkles className="h-3 w-3 text-amber-300" /> Giọng đọc bản xứ HD
            </span>
            <button
              type="button"
              onClick={handleRepairAudio}
              disabled={isRepairingAudio || isSynthesizingRef}
              title="Tự sửa lỗi: Tái tạo âm thanh mẫu trên máy chủ nếu file bị hỏng hoặc không tải được"
              className="flex items-center gap-1.5 text-xs font-bold text-indigo-300 hover:text-white bg-indigo-900/40 hover:bg-indigo-800/60 disabled:opacity-50 px-3 py-1.5 rounded-lg border border-indigo-700/50 transition cursor-pointer"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isRepairingAudio ? "animate-spin text-amber-400" : ""}`} />
              <span>{isRepairingAudio ? "Đang tạo lại..." : "Tạo lại audio"}</span>
            </button>
            <button
              type="button"
              onClick={togglePlayRefAudio}
              disabled={isSynthesizingRef || isRepairingAudio}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-3.5 py-1.5 rounded-lg transition shadow-md cursor-pointer"
            >
              {isSynthesizingRef ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Đang tải audio...</span>
                </>
              ) : isPlayingRef ? (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  <span>Đang phát mẫu...</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-white" />
                  <span>Nghe âm mẫu</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Text of reference sentence */}
        <p className="text-lg md:text-xl font-bold text-white leading-relaxed tracking-wide pt-1">
          {aiResult?.sentenceTokens && aiResult.sentenceTokens.length > 0
            ? aiResult.sentenceTokens.map((tok, idx) => {
                let colorClass = "text-white";
                if (tok.color === "GREEN") colorClass = "text-emerald-400 font-black";
                if (tok.color === "YELLOW") colorClass = "text-amber-400 font-bold";
                if (tok.color === "RED") colorClass = "text-rose-400 font-bold underline";
                if (tok.color === "GRAY" || tok.wordStatus === "MISSING") colorClass = "text-slate-500 font-medium line-through";
                return (
                  <React.Fragment key={idx}>
                    <span className={`${colorClass} mr-1.5 inline-block`}>
                      {tok.word}
                    </span>
                    {tok.hasLinkingAfter && (
                      <span className="text-indigo-400 font-bold mr-1 text-sm select-none" title="Nối âm (Linking)">
                        ‿
                      </span>
                    )}
                    {tok.hasPauseAfter && (
                      <span className="text-slate-500 font-bold mr-1.5 text-xs px-1.5 py-0.5 bg-slate-800 rounded select-none" title="Ngắt nhịp (Pause)">
                        ||
                      </span>
                    )}
                  </React.Fragment>
                );
              })
            : targetSentence || "Listen to the audio and repeat the sentence accurately."}
        </p>
      </div>

      {/* 2. RECORDING CONTROL & VISUALIZER */}
      <div className="flex flex-col items-center justify-center p-6 rounded-xl border border-slate-800 bg-slate-950/80 space-y-4">
        {/* Animated Visualizer / Recording Pulse */}
        <div className="relative flex items-center justify-center">
          {isRecording && (
            <div className="absolute inset-0 rounded-full bg-rose-500/20 animate-ping" />
          )}
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`relative z-10 h-20 w-20 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 cursor-pointer ${
              isRecording
                ? "bg-rose-600 hover:bg-rose-700 text-white ring-4 ring-rose-500/40 scale-110"
                : recordedAudioUrl
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30"
            }`}
          >
            {isRecording ? (
              <Square className="h-8 w-8" />
            ) : (
              <Mic className="h-8 w-8" />
            )}
          </button>
        </div>

        {/* Timer & Status Label */}
        <div className="text-center space-y-1">
          {isRecording ? (
            <div className="flex items-center justify-center space-x-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="font-mono text-xl font-black text-rose-400">
                {formatTimer(recordingSeconds)}
              </span>
              <span className="text-xs text-slate-400">(Đang ghi âm...)</span>
            </div>
          ) : recordedAudioUrl ? (
            <div className="flex items-center justify-center space-x-2 text-xs font-bold text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>Đã hoàn thành bản ghi âm nhại giọng</span>
            </div>
          ) : (
            <span className="text-xs font-medium text-slate-400">
              Bấm biểu tượng Micro để bắt đầu thu âm
            </span>
          )}
        </div>

        {/* Student Audio Playback Control */}
        {recordedAudioUrl && !isRecording && (
          <div className="flex items-center space-x-3 pt-2">
            <button
              type="button"
              onClick={() => {
                if (!studentAudioRef.current) return;
                if (isPlayingStudent) {
                  studentAudioRef.current.pause();
                  setIsPlayingStudent(false);
                } else {
                  if (refAudioRef.current && isPlayingRef) {
                    refAudioRef.current.pause();
                    setIsPlayingRef(false);
                  }
                  studentAudioRef.current.play();
                  setIsPlayingStudent(true);
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700"
            >
              {isPlayingStudent ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{isPlayingStudent ? "Tạm dừng" : "Nghe lại bài nói của bạn (Học sinh)"}</span>
            </button>

            <button
              type="button"
              onClick={startRecording}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 text-xs font-bold transition border border-slate-700"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Thu âm lại</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. AI EVALUATION FEEDBACK CARD */}
      {isEvaluating && (
        <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 flex items-center justify-center space-x-3 text-indigo-300 text-xs font-bold">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
          <span>AI đang phân tích âm tần & chấm điểm phát âm Shadowing...</span>
        </div>
      )}

      {aiResult && !isEvaluating && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5 space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs">
                <Sparkles className="h-4 w-4" />
                <span>Kết Quả AI Chấm Điểm Shadowing</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {aiResult.evaluatedBy === "PYTHON_ACOUSTIC_ENGINE"
                  ? "Acoustic AI (Praat F1/F2)"
                  : "AI Cloud Fallback"}
              </span>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-black ${
                aiResult.isPassed
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
              }`}
            >
              Score: {aiResult.overallScore} / 100
            </span>
          </div>

          {/* KPI Gauges */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/80">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Độ Chính Xác (Accuracy)</span>
              <span className="text-lg font-black text-emerald-400">
                {aiResult.kpi?.pronunciation ?? Math.round(aiResult.overallScore)}%
              </span>
            </div>
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/80">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Lưu Loát (Fluency)</span>
              <span className="text-lg font-black text-indigo-400">
                {aiResult.kpi?.fluency ?? Math.round(aiResult.overallScore)}%
              </span>
            </div>
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/80">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Ngữ Điệu (Intonation)</span>
              <span className="text-lg font-black text-amber-400">
                {aiResult.kpi?.prosody ?? Math.round(aiResult.overallScore)}/100
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed pt-1">
            💬 <span className="font-bold text-emerald-300">Nhận xét từ AI:</span>{" "}
            {aiResult.statusMessage}
          </p>

          {/* Chi tiết từng từ & Formant F1, F2 từ Praat */}
          {aiResult.wordRows && aiResult.wordRows.length > 0 && (
            <div className="pt-2 space-y-2 border-t border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Phân Tích Âm Học F1/F2 Từng Từ (Praat Acoustics):
              </span>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {aiResult.wordRows.map((wr, wIdx) => (
                  <div
                    key={wIdx}
                    className="p-2.5 rounded-lg border border-slate-800/80 bg-slate-900/60 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">
                        {wr.word}
                      </span>
                      <span
                        className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                          wr.score >= 80
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : wr.score >= 60
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {wr.score} pts
                      </span>
                    </div>

                    {wr.phonemes && wr.phonemes.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                        {wr.phonemes.map((ph, pIdx) => (
                          <div
                            key={pIdx}
                            className="p-1.5 rounded bg-slate-950/70 border border-slate-800 text-[11px] flex flex-col gap-0.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-indigo-300">
                                {ph.ipa}
                              </span>
                              <span
                                className={`font-mono text-[10px] font-bold ${
                                  ph.score >= 80
                                    ? "text-emerald-400"
                                    : ph.score >= 60
                                    ? "text-amber-400"
                                    : "text-rose-400"
                                }`}
                              >
                                {ph.score}%
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 leading-tight">
                              {ph.note}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
