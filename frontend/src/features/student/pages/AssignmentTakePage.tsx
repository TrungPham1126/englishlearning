// src/features/student/pages/AssignmentTakePage.tsx
import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { studentApi } from "@/features/student/api/studentApi";
import AudioRecorder from "@/features/student/components/AudioRecorder";
import SpeakingShadowingStudio, { cleanShadowingSentence } from "@/features/student/components/SpeakingShadowingStudio";
import SpeakingQAStudio from "@/features/student/components/SpeakingQAStudio";
import VocabularyMatchingBoard from "@/features/student/components/VocabularyMatchingBoard";
import type {
  AttemptResponse,
  QuestionResultDetail,
  WritingAiEvaluationResult,
  ReadingShortAnswerEvaluationResult,
  DialogueSegment,
} from "@/features/student/types";
import {
  Clock,
  Send,
  ArrowLeft,
  Loader2,
  PlayCircle,
  ShieldAlert,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Check,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BookOpen,
  Highlighter,
  Eraser,
  Type,
  Headphones,
  Sparkles,
  Lightbulb,
  FileText,
  Square,
} from "lucide-react";

// =========================================================================
// COMPONENT 1: SẮP XẾP TỪ THÀNH CÂU HOÀN CHỈNH (WORD UNSCRAMBLE CHIPS)
// =========================================================================
function WordUnscrambleInteractive({
  promptText,
  currentAnswer,
  onAnswerChange,
  disabled,
}: {
  promptText: string;
  currentAnswer: string;
  onAnswerChange: (ans: string) => void;
  disabled?: boolean;
}) {
  const chips = useMemo(() => {
    const raw = promptText.includes(":") ? promptText.split(":")[1] || promptText : promptText;
    const tokens = raw
      .replace(/^[0-9]+\.\s*/, "")
      .split("/")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter((s) => s.length > 0 && !s.includes("Sắp xếp") && !s.includes("Unscramble"));
    return tokens;
  }, [promptText]);

  const placedTokens = useMemo(() => {
    return currentAnswer ? currentAnswer.split(" ").filter(Boolean) : [];
  }, [currentAnswer]);

  const availableChips = useMemo(() => {
    const placedCopy = [...placedTokens];
    const available: { word: string; id: number }[] = [];
    chips.forEach((c, idx) => {
      const placedIdx = placedCopy.indexOf(c);
      if (placedIdx !== -1) {
        placedCopy.splice(placedIdx, 1);
      } else {
        available.push({ word: c, id: idx });
      }
    });
    return available;
  }, [chips, placedTokens]);

  const handleAddChip = (word: string) => {
    if (disabled) return;
    const newPlaced = [...placedTokens, word];
    onAnswerChange(newPlaced.join(" "));
  };

  const handleRemoveChip = (index: number) => {
    if (disabled) return;
    const newPlaced = [...placedTokens];
    newPlaced.splice(index, 1);
    onAnswerChange(newPlaced.join(" "));
  };

  const handleReset = () => {
    if (disabled) return;
    onAnswerChange("");
  };

  if (chips.length <= 1) return null;

  return (
    <div className="space-y-3 p-4 rounded-2xl border-2 border-indigo-100 bg-indigo-50/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
          <Sparkles size={14} className="text-amber-500" /> Nhấn các từ để ghép thành câu:
        </span>
        {placedTokens.length > 0 && !disabled && (
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
          >
            <RotateCcw size={12} /> Đặt lại
          </button>
        )}
      </div>

      <div className="min-h-[52px] p-3 rounded-xl border-2 border-dashed border-indigo-300 bg-white flex flex-wrap items-center gap-2">
        {placedTokens.length === 0 ? (
          <span className="text-xs text-slate-400 font-medium italic select-none">
            Chạm vào các từ bên dưới theo đúng thứ tự ngữ pháp...
          </span>
        ) : (
          placedTokens.map((word, idx) => (
            <button
              key={`${word}-${idx}`}
              type="button"
              disabled={disabled}
              onClick={() => handleRemoveChip(idx)}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-rose-600 text-white font-bold text-sm shadow-xs transition-all cursor-pointer group flex items-center gap-1.5"
              title="Chạm để gỡ từ này"
            >
              <span>{word}</span>
              <span className="text-[10px] opacity-60 group-hover:opacity-100">×</span>
            </button>
          ))
        )}
      </div>

      <div className="pt-1 flex flex-wrap gap-2">
        {availableChips.map(({ word, id }) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => handleAddChip(word)}
            className="px-3.5 py-1.5 rounded-lg bg-white border-2 border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 text-slate-800 font-bold text-sm shadow-xs transition-all cursor-pointer active:scale-95"
          >
            {word}
          </button>
        ))}
      </div>
    </div>
  );
}

// =========================================================================
// COMPONENT 2: WRITING SCAFFOLDING STUDIO (HƯỚNG DẪN VIẾT 5 BƯỚC)
// =========================================================================
function WritingScaffoldingStudio({
  promptText,
  explanation,
  currentEssay,
  onEssayChange,
  studentAnswerId,
}: {
  promptText: string;
  explanation?: string;
  currentEssay: string;
  onEssayChange: (text: string) => void;
  studentAnswerId?: string;
}) {
  const [activeStep, setActiveStep] = useState<number>(4);
  const [brainstormNotes, setBrainstormNotes] = useState({
    mainIdea: "",
    explanationNote: "",
    exampleNote: "",
  });
  const [outlineNotes, setOutlineNotes] = useState({
    intro: "",
    body1: "",
    body2: "",
    conclusion: "",
  });
  const [isAiGrading, setIsAiGrading] = useState(false);
  const [gradingResult, setGradingResult] = useState<WritingAiEvaluationResult | null>(null);

  const wordCount = useMemo(() => {
    return currentEssay.trim() ? currentEssay.trim().split(/\s+/).length : 0;
  }, [currentEssay]);

  const targetWords = useMemo(() => {
    const lower = promptText.toLowerCase();
    if (lower.includes("task 1") || lower.includes("150")) return 150;
    return 250;
  }, [promptText]);

  const handleAiGrade = async () => {
    if (wordCount < 10) {
      alert("Vui lòng viết tối thiểu một vài câu trước khi yêu cầu AI chấm điểm!");
      return;
    }
    setIsAiGrading(true);
    try {
      const res = await studentApi.evaluateWritingAI(
        promptText,
        currentEssay,
        studentAnswerId || "",
      );
      setGradingResult(res);
      setActiveStep(5);
    } catch (e: any) {
      alert("Chấm bài Writing thất bại: " + (e.response?.data?.message || e.message));
    } finally {
      setIsAiGrading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-xs">
      <div className="grid grid-cols-5 gap-1.5 p-1.5 rounded-xl bg-slate-100 text-[11px] font-bold">
        {[
          { num: 1, label: "Phân tích đề" },
          { num: 2, label: "Brainstorm" },
          { num: 3, label: "Lập dàn ý" },
          { num: 4, label: "Viết bài" },
          { num: 5, label: "Chấm AI" },
        ].map((s) => (
          <button
            key={s.num}
            type="button"
            onClick={() => setActiveStep(s.num)}
            className={`py-2 px-1 rounded-lg text-center transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
              activeStep === s.num
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            <span className="text-[10px] opacity-75">BƯỚC {s.num}</span>
            <span className="truncate max-w-full">{s.label}</span>
          </button>
        ))}
      </div>

      {activeStep === 1 && (
        <div className="space-y-3 p-4 rounded-xl bg-indigo-50/50 border border-indigo-200 text-xs">
          <div className="font-bold text-indigo-950 flex items-center gap-2 text-sm">
            <BookOpen size={16} className="text-indigo-600" />
            1. Phân Tích Yêu Cầu Đề Bài:
          </div>
          <div className="p-3 bg-white rounded-lg border border-indigo-100 font-medium text-slate-800 leading-relaxed">
            {promptText}
          </div>
          {explanation && (
            <div className="p-3 bg-indigo-100/60 rounded-lg text-indigo-900 leading-relaxed">
              <span className="font-bold block mb-1">💡 Gợi ý tiêu chí & từ vựng từ đề:</span>
              {explanation}
            </div>
          )}
          <div className="flex items-center justify-between text-slate-600 pt-1">
            <span>Mục tiêu độ dài: <b>tối thiểu {targetWords} từ</b></span>
            <button
              type="button"
              onClick={() => setActiveStep(2)}
              className="text-indigo-600 hover:underline font-bold cursor-pointer"
            >
              Tiếp tục sang Brainstorm →
            </button>
          </div>
        </div>
      )}

      {activeStep === 2 && (
        <div className="space-y-3 p-4 rounded-xl bg-amber-50/50 border border-amber-200 text-xs">
          <div className="font-bold text-amber-950 flex items-center gap-2 text-sm">
            <Lightbulb size={16} className="text-amber-600" />
            2. Brainstorm Ý Tưởng Nhanh:
          </div>
          <p className="text-slate-600">
            Ghi chú nhanh 2–3 ý chính để phát triển bài viết mạch lạc:
          </p>
          <div className="space-y-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Luận điểm chính (Main Idea):</label>
              <input
                type="text"
                value={brainstormNotes.mainIdea}
                onChange={(e) => setBrainstormNotes({ ...brainstormNotes, mainIdea: e.target.value })}
                placeholder="Vd: Công nghệ giúp tiết kiệm thời gian và kết nối toàn cầu..."
                className="w-full p-2.5 rounded-lg border border-amber-200 bg-white text-xs outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Giải thích & Phân tích (Explanation):</label>
              <input
                type="text"
                value={brainstormNotes.explanationNote}
                onChange={(e) => setBrainstormNotes({ ...brainstormNotes, explanationNote: e.target.value })}
                placeholder="Vd: Internet cho phép làm việc từ xa mà không cần di chuyển..."
                className="w-full p-2.5 rounded-lg border border-amber-200 bg-white text-xs outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Ví dụ thực tế (Example):</label>
              <input
                type="text"
                value={brainstormNotes.exampleNote}
                onChange={(e) => setBrainstormNotes({ ...brainstormNotes, exampleNote: e.target.value })}
                placeholder="Vd: Nền tảng học trực tuyến, video call..."
                className="w-full p-2.5 rounded-lg border border-amber-200 bg-white text-xs outline-none focus:border-amber-500"
              />
            </div>
          </div>
          <div className="text-right pt-1">
            <button
              type="button"
              onClick={() => setActiveStep(3)}
              className="text-amber-700 hover:underline font-bold cursor-pointer"
            >
              Lập dàn ý bài viết →
            </button>
          </div>
        </div>
      )}

      {activeStep === 3 && (
        <div className="space-y-3 p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 text-xs">
          <div className="font-bold text-emerald-950 flex items-center gap-2 text-sm">
            <FileText size={16} className="text-emerald-600" />
            3. Dàn Ý Bài Viết (Outline 4 Đoạn Chuẩn):
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
              <span className="font-bold text-emerald-800 block mb-1">1. Mở bài (Introduction):</span>
              <textarea
                rows={2}
                value={outlineNotes.intro}
                onChange={(e) => setOutlineNotes({ ...outlineNotes, intro: e.target.value })}
                placeholder="Paraphrase đề bài + Thesis statement..."
                className="w-full text-xs outline-none bg-transparent resize-none"
              />
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
              <span className="font-bold text-emerald-800 block mb-1">2. Thân bài 1 (Body 1):</span>
              <textarea
                rows={2}
                value={outlineNotes.body1}
                onChange={(e) => setOutlineNotes({ ...outlineNotes, body1: e.target.value })}
                placeholder="Luận điểm 1 + Giải thích + Ví dụ..."
                className="w-full text-xs outline-none bg-transparent resize-none"
              />
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
              <span className="font-bold text-emerald-800 block mb-1">3. Thân bài 2 (Body 2):</span>
              <textarea
                rows={2}
                value={outlineNotes.body2}
                onChange={(e) => setOutlineNotes({ ...outlineNotes, body2: e.target.value })}
                placeholder="Luận điểm 2 + Phản biện / So sánh..."
                className="w-full text-xs outline-none bg-transparent resize-none"
              />
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
              <span className="font-bold text-emerald-800 block mb-1">4. Kết bài (Conclusion):</span>
              <textarea
                rows={2}
                value={outlineNotes.conclusion}
                onChange={(e) => setOutlineNotes({ ...outlineNotes, conclusion: e.target.value })}
                placeholder="Tóm tắt lại quan điểm..."
                className="w-full text-xs outline-none bg-transparent resize-none"
              />
            </div>
          </div>
          <div className="text-right pt-1">
            <button
              type="button"
              onClick={() => setActiveStep(4)}
              className="text-emerald-700 hover:underline font-bold cursor-pointer"
            >
              Chuyển sang soạn thảo bài viết →
            </button>
          </div>
        </div>
      )}

      <div className={activeStep === 4 ? "block space-y-3" : "hidden"}>
        <div className="flex items-center justify-between text-xs font-bold text-slate-600">
          <span>Khu vực viết bài luận hoàn chỉnh:</span>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-md font-bold ${
              wordCount >= targetWords
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}>
              {wordCount} / {targetWords} từ
            </span>
          </div>
        </div>

        <textarea
          rows={10}
          placeholder="Nhập nội dung bài viết hoàn chỉnh của bạn tại đây..."
          value={currentEssay}
          onChange={(e) => onEssayChange(e.target.value)}
          className="w-full border-2 border-slate-200 focus:border-indigo-600 rounded-xl p-4 text-sm font-medium leading-relaxed outline-none bg-slate-50/50 resize-y"
        />

        <div className="flex items-center justify-between pt-2">
          <div className="text-[11px] text-slate-400">
            {wordCount < targetWords ? (
              <span className="text-amber-600 font-semibold">
                ⚠️ Chưa đủ số lượng từ tối thiểu ({wordCount}/{targetWords} từ)
              </span>
            ) : (
              <span className="text-emerald-600 font-semibold">
                ✓ Đã đạt độ dài yêu cầu ({wordCount} từ)
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={isAiGrading || wordCount < 5}
            onClick={handleAiGrade}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-black px-5 py-2.5 rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
          >
            {isAiGrading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} className="text-amber-300" />}
            <span>Chấm Điểm & Góp Ý Bằng AI</span>
          </button>
        </div>
      </div>

      {activeStep === 5 && (
        <div className="space-y-4 p-5 rounded-2xl bg-indigo-50/40 border-2 border-indigo-200 animate-in fade-in">
          {gradingResult ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-200 pb-4">
                <div>
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                    Kết Quả Đánh Giá Writing AI
                  </span>
                  <h4 className="text-lg font-black text-slate-900 mt-0.5">
                    Estimated Band: <span className="text-indigo-600">{gradingResult.overallBand?.toFixed(1) || "6.0"}</span> / 9.0 ({gradingResult.estimatedCefr || "B2"})
                  </h4>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-white border border-indigo-100">
                    <span className="text-[10px] text-slate-400 block font-bold">TR / TA</span>
                    <span className="font-black text-indigo-700">{gradingResult.taskAchievement?.score?.toFixed(1) || gradingResult.overallBand?.toFixed(1) || "6.0"}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-indigo-100">
                    <span className="text-[10px] text-slate-400 block font-bold">CC</span>
                    <span className="font-black text-indigo-700">{gradingResult.coherenceScore?.toFixed(1) || "6.0"}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-indigo-100">
                    <span className="text-[10px] text-slate-400 block font-bold">LR</span>
                    <span className="font-black text-indigo-700">{gradingResult.vocabularyScore?.toFixed(1) || "6.0"}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-indigo-100">
                    <span className="text-[10px] text-slate-400 block font-bold">GRA</span>
                    <span className="font-black text-indigo-700">{gradingResult.grammarScore?.toFixed(1) || "6.0"}</span>
                  </div>
                </div>
              </div>

              {gradingResult.generalFeedback && (
                <div className="p-3.5 rounded-xl bg-white border border-indigo-100 text-xs text-slate-800 leading-relaxed">
                  <b className="text-indigo-900 block mb-1">📌 Nhận xét tổng thể:</b>
                  {gradingResult.generalFeedback}
                </div>
              )}

              {gradingResult.mistakes && gradingResult.mistakes.length > 0 && (
                <div className="space-y-2">
                  <b className="text-xs text-rose-700 block">⚠️ Các lỗi cần sửa trong bài:</b>
                  <div className="space-y-2">
                    {gradingResult.mistakes.map((m, mIdx) => (
                      <div key={mIdx} className="p-3 rounded-lg bg-white border border-rose-200 text-xs space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="line-through text-rose-600 font-bold">{m.original}</span>
                          <span>→</span>
                          <span className="text-emerald-700 font-bold">{m.correction}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded ml-auto">{m.type}</span>
                        </div>
                        {m.explanation && <p className="text-[11px] text-slate-500 italic">{m.explanation}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {gradingResult.correctedText && (
                <div className="p-4 rounded-xl bg-white border border-emerald-200 text-xs space-y-1.5">
                  <b className="text-emerald-800 block">✨ Phiên bản nâng cấp gợi ý (Rewritten naturally):</b>
                  <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{gradingResult.correctedText}</p>
                </div>
              )}

              <div className="pt-2 text-right">
                <button
                  type="button"
                  onClick={() => setActiveStep(4)}
                  className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                >
                  ← Quay lại chỉnh sửa bài viết
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-slate-500 text-xs">
              Chưa có kết quả chấm. Vui lòng bấm nút <b>Chấm Điểm & Góp Ý Bằng AI</b> ở bước 4.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// COMPONENT 3: LUYỆN VIẾT ĐOẠN VĂN CÓ HƯỚNG DẪN (PARAGRAPH WRITING STUDIO)
// =========================================================================
function ParagraphWritingStudio({
  promptText,
  explanation,
  currentParagraph,
  onParagraphChange,
  studentAnswerId,
  modelAnswer,
}: {
  promptText: string;
  explanation?: string;
  currentParagraph: string;
  onParagraphChange: (text: string) => void;
  studentAnswerId?: string;
  modelAnswer?: string;
}) {
  const [isAiGrading, setIsAiGrading] = useState(false);
  const [gradingResult, setGradingResult] = useState<WritingAiEvaluationResult | null>(null);
  const [showConnectors, setShowConnectors] = useState(false);
  const [showOutlineGuide, setShowOutlineGuide] = useState(true);

  const wordCount = useMemo(() => {
    return currentParagraph.trim() ? currentParagraph.trim().split(/\s+/).length : 0;
  }, [currentParagraph]);

  const targetRange = useMemo(() => {
    const lower = promptText.toLowerCase();
    if (lower.includes("30-50") || lower.includes("30–50")) return { min: 30, max: 50 };
    if (lower.includes("30-80") || lower.includes("30–80")) return { min: 30, max: 80 };
    if (lower.includes("50-80") || lower.includes("50–80")) return { min: 50, max: 80 };
    if (lower.includes("100-150") || lower.includes("100–150")) return { min: 100, max: 150 };
    if (lower.includes("120-150") || lower.includes("120–150")) return { min: 120, max: 150 };
    if (lower.includes("120-180") || lower.includes("120–180")) return { min: 120, max: 180 };
    if (lower.includes("180-250") || lower.includes("180–250")) return { min: 180, max: 250 };
    return { min: 50, max: 120 };
  }, [promptText]);

  const progressPercent = Math.min(100, Math.round((wordCount / targetRange.min) * 100));

  const connectorGroups = [
    { label: "Bổ sung ý", words: ["Furthermore", "In addition", "Moreover", "Besides", "Also"] },
    { label: "Tương phản", words: ["However", "On the other hand", "In contrast", "Although", "Nevertheless"] },
    { label: "Nguyên nhân / Kết quả", words: ["Therefore", "As a result", "Because of this", "Consequently"] },
    { label: "Ví dụ dẫn chứng", words: ["For example", "For instance", "Specifically", "In particular"] },
    { label: "Kết luận", words: ["In conclusion", "To sum up", "Overall", "In brief"] },
  ];

  const handleInsertWord = (word: string) => {
    const trimmed = currentParagraph.trimEnd();
    const needsSpace = trimmed.length > 0 && !trimmed.endsWith(" ") && !trimmed.endsWith("\n");
    const newText = (needsSpace ? trimmed + " " : trimmed) + word + ", ";
    onParagraphChange(newText);
  };

  const handleAiGrade = async () => {
    if (wordCount < 10) {
      alert("Vui lòng viết tối thiểu một vài câu trước khi yêu cầu AI chấm điểm đoạn văn!");
      return;
    }
    setIsAiGrading(true);
    try {
      const res = await studentApi.evaluateWritingAI(
        promptText,
        currentParagraph,
        studentAnswerId || "",
      );
      setGradingResult(res);
    } catch (e: any) {
      alert("Chấm đoạn văn thất bại: " + (e.response?.data?.message || e.message));
    } finally {
      setIsAiGrading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border-2 border-indigo-100 bg-white p-5 md:p-6 shadow-xs">
      {/* Tiêu đề & Mục tiêu độ dài đoạn văn */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
            <BookOpen size={16} />
          </span>
          <div>
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">
              Luyện Viết Đoạn Văn (Guided Paragraph)
            </h4>
            <p className="text-[11px] text-slate-500">
              Viết 01 đoạn văn mạch lạc với câu mở đoạn, các ý bổ trợ và câu kết luận.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold border transition ${
              wordCount < targetRange.min
                ? "bg-amber-50 text-amber-800 border-amber-200"
                : wordCount > targetRange.max
                ? "bg-blue-50 text-blue-800 border-blue-200"
                : "bg-emerald-50 text-emerald-800 border-emerald-200"
            }`}
          >
            {wordCount} / {targetRange.min}–{targetRange.max} từ
          </span>
        </div>
      </div>

      {/* Đề bài & Hướng dẫn phát triển đoạn văn */}
      <div className="space-y-2 p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-800">
        <b className="text-indigo-950 flex items-center gap-1.5 font-bold">
          <Sparkles size={14} className="text-indigo-600" />
          Yêu cầu đề bài:
        </b>
        <p className="font-semibold text-slate-900 leading-relaxed text-sm bg-white p-3 rounded-lg border border-slate-200">
          {promptText}
        </p>

        {explanation && (
          <div className="pt-1.5 text-slate-600 leading-relaxed">
            <span className="font-bold text-slate-700">💡 Gợi ý dàn bài & từ vựng: </span>
            <span className="whitespace-pre-wrap">{explanation}</span>
          </div>
        )}
      </div>

      {/* Cấu trúc 3 phần của 1 đoạn văn chuẩn */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
            <FileText size={14} className="text-indigo-600" />
            Cấu trúc 1 đoạn văn chuẩn (Paragraph Checklist):
          </span>
          <button
            type="button"
            onClick={() => setShowOutlineGuide(!showOutlineGuide)}
            className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
          >
            {showOutlineGuide ? "Thu gọn" : "Xem chi tiết"}
          </button>
        </div>

        {showOutlineGuide && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
            <div className="p-2.5 rounded-lg bg-white border border-indigo-100 shadow-2xs">
              <span className="font-black text-indigo-900 block mb-0.5">1. Câu mở đoạn (Topic Sentence)</span>
              <p className="text-slate-600">Nêu rõ chủ đề chính và quan điểm cốt lõi của đoạn văn.</p>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-indigo-100 shadow-2xs">
              <span className="font-black text-indigo-900 block mb-0.5">2. Các ý bổ trợ (Supporting Sentences)</span>
              <p className="text-slate-600">Phát triển 2–3 ý giải thích, dẫn chứng hoặc ví dụ minh họa.</p>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-indigo-100 shadow-2xs">
              <span className="font-black text-indigo-900 block mb-0.5">3. Câu kết đoạn (Concluding Sentence)</span>
              <p className="text-slate-600">Tóm tắt lại ý chính hoặc nêu cảm nghĩ/kết luận ngắn gọn.</p>
            </div>
          </div>
        )}
      </div>

      {/* Ngân hàng từ nối (Useful Linking Words Bank) */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Lightbulb size={14} className="text-amber-500" />
            Ngân hàng từ nối học thuật (Bấm vào từ để chèn nhanh):
          </span>
          <button
            type="button"
            onClick={() => setShowConnectors(!showConnectors)}
            className="text-[11px] font-bold text-slate-600 hover:underline cursor-pointer"
          >
            {showConnectors ? "Ẩn từ nối" : "Hiện từ nối"}
          </button>
        </div>

        {showConnectors && (
          <div className="space-y-2 pt-1">
            {connectorGroups.map((grp, gIdx) => (
              <div key={gIdx} className="flex items-center gap-2 flex-wrap text-xs">
                <span className="text-[10px] font-bold text-slate-400 min-w-24 uppercase tracking-wider">
                  {grp.label}:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {grp.words.map((w, wIdx) => (
                    <button
                      key={wIdx}
                      type="button"
                      onClick={() => handleInsertWord(w)}
                      className="px-2 py-0.5 rounded-md bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 text-[11px] font-medium transition cursor-pointer"
                      title={`Chèn "${w}" vào đoạn văn`}
                    >
                      + {w}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Khung Soạn Thảo Đoạn Văn */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-xs font-bold text-slate-600">
          <span>Khung soạn thảo đoạn văn:</span>
          <span className="text-[11px] font-normal text-slate-400">
            {wordCount < targetRange.min ? (
              <span className="text-amber-600 font-bold">
                ⚠️ Cần thêm ít nhất {targetRange.min - wordCount} từ nữa
              </span>
            ) : wordCount > targetRange.max ? (
              <span className="text-blue-600 font-bold">
                ℹ️ Vượt quá độ dài tiêu chuẩn ({wordCount}/{targetRange.max} từ)
              </span>
            ) : (
              <span className="text-emerald-600 font-bold">
                ✓ Đạt độ dài lý tưởng ({wordCount} từ)
              </span>
            )}
          </span>
        </div>

        <textarea
          rows={7}
          placeholder="Viết đoạn văn hoàn chỉnh của bạn tại đây (sử dụng câu mở đoạn, các ý triển khai và câu kết)..."
          value={currentParagraph}
          onChange={(e) => onParagraphChange(e.target.value)}
          className="w-full border-2 border-slate-200 focus:border-indigo-600 rounded-xl p-4 text-sm font-medium leading-relaxed outline-none bg-slate-50/50 resize-y"
        />

        {/* Thanh tiến độ số lượng từ */}
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              wordCount < targetRange.min
                ? "bg-amber-500"
                : wordCount > targetRange.max
                ? "bg-blue-500"
                : "bg-emerald-500"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-[11px] text-slate-500">
            {modelAnswer && (
              <span className="text-slate-400">
                (Có bài mẫu tham khảo đối chiếu sau khi làm)
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={isAiGrading || wordCount < 5}
            onClick={handleAiGrade}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-black px-5 py-2.5 rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
          >
            {isAiGrading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Sparkles size={15} className="text-amber-300" />
            )}
            <span>Chấm Điểm Đoạn Văn Bằng AI</span>
          </button>
        </div>
      </div>

      {/* Kết Quả Chấm AI */}
      {gradingResult && (
        <div className="space-y-4 p-5 rounded-2xl bg-indigo-50/40 border-2 border-indigo-200 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-200 pb-4">
            <div>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                Kết Quả Đánh Giá Đoạn Văn AI
              </span>
              <h4 className="text-lg font-black text-slate-900 mt-0.5">
                Band Điểm Ước Tính: <span className="text-indigo-600">{gradingResult.overallBand?.toFixed(1) || "6.5"}</span> / 9.0 ({gradingResult.estimatedCefr || "B2"})
              </h4>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-lg bg-white border border-indigo-100">
                <span className="text-[10px] text-slate-400 block font-bold">Mạch lạc & Cấu trúc</span>
                <span className="font-black text-indigo-700">{gradingResult.coherenceScore?.toFixed(1) || "6.5"}</span>
              </div>
              <div className="p-2 rounded-lg bg-white border border-indigo-100">
                <span className="text-[10px] text-slate-400 block font-bold">Từ vựng (LR)</span>
                <span className="font-black text-indigo-700">{gradingResult.vocabularyScore?.toFixed(1) || "6.5"}</span>
              </div>
              <div className="p-2 rounded-lg bg-white border border-indigo-100">
                <span className="text-[10px] text-slate-400 block font-bold">Ngữ pháp (GRA)</span>
                <span className="font-black text-indigo-700">{gradingResult.grammarScore?.toFixed(1) || "6.5"}</span>
              </div>
            </div>
          </div>

          {gradingResult.generalFeedback && (
            <div className="p-3.5 rounded-xl bg-white border border-indigo-100 text-xs text-slate-800 leading-relaxed">
              <b className="text-indigo-900 block mb-1">📌 Nhận xét của AI:</b>
              {gradingResult.generalFeedback}
            </div>
          )}

          {gradingResult.mistakes && gradingResult.mistakes.length > 0 && (
            <div className="space-y-2">
              <b className="text-xs text-rose-700 block">⚠️ Các lỗi diễn đạt & ngữ pháp cần sửa:</b>
              <div className="space-y-2">
                {gradingResult.mistakes.map((m, mIdx) => (
                  <div key={mIdx} className="p-3 rounded-lg bg-white border border-rose-200 text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="line-through text-rose-600 font-bold">{m.original}</span>
                      <span>→</span>
                      <span className="text-emerald-700 font-bold">{m.correction}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded ml-auto">{m.type}</span>
                    </div>
                    {m.explanation && <p className="text-[11px] text-slate-500 italic">{m.explanation}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {gradingResult.correctedText && (
            <div className="p-4 rounded-xl bg-white border border-emerald-200 text-xs space-y-1.5">
              <b className="text-emerald-800 block">✨ Phiên bản hoàn thiện nâng cao (Polished Paragraph):</b>
              <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{gradingResult.correctedText}</p>
            </div>
          )}

          {modelAnswer && (
            <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs space-y-1.5">
              <b className="text-slate-800 block">📖 Đoạn văn mẫu tham khảo của giáo viên:</b>
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{modelAnswer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type PagePhase = "CHECKING" | "INTRO" | "TESTING" | "REVIEW" | "EXHAUSTED";

export default function AssignmentTakePage() {
  const params = useParams();
  const navigate = useNavigate();
  const assignmentId = params.assignmentId || params.id;

  const [phase, setPhase] = useState<PagePhase>("CHECKING");
  const [previousAttempts, setPreviousAttempts] = useState<AttemptResponse[]>(
    [],
  );
  const [attempt, setAttempt] = useState<AttemptResponse | null>(null);

  // Chế độ Luyện tập (PRACTICE) vs Thi thử (TEST)
  const [studyMode, setStudyMode] = useState<"PRACTICE" | "TEST">("PRACTICE");
  const [checkedQuestions, setCheckedQuestions] = useState<
    Record<
      string,
      {
        isChecked: boolean;
        isCorrect?: boolean;
        isContentCorrect?: boolean;
        isGrammarCorrect?: boolean;
        feedback?: string;
        contentAnalysis?: string;
        grammarAnalysis?: string;
        suggestedAnswer?: string;
        isEvaluating?: boolean;
      }
    >
  >({});
  const [expandedHints, setExpandedHints] = useState<Record<string, boolean>>({});

  // Lưu trữ toàn bộ câu trả lời của học viên: { [questionId]: { selectedOptionId, textAnswer, audioUrl } }
  const [answers, setAnswers] = useState<
    Record<
      string,
      { selectedOptionId?: string; textAnswer?: string; audioUrl?: string }
    >
  >({});

  
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);

  // Audio Player State (Dành cho bài tập Listening)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isPlayingAiVoice, setIsPlayingAiVoice] = useState(false);
  const [showListeningScript, setShowListeningScript] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioVolume, setAudioVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [listeningSegments, setListeningSegments] = useState<DialogueSegment[]>([]);
  const [isRepairingListeningAudio, setIsRepairingListeningAudio] = useState(false);
  const [customListeningAudioUrl, setCustomListeningAudioUrl] = useState<string | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsCacheMapRef = useRef<Map<string, string>>(new Map());

  // IELTS Reading State & Highlighters
  const passageContainerRef = useRef<HTMLDivElement | null>(null);
  const [fontSizeLevel, setFontSizeLevel] = useState<
    "normal" | "large" | "xlarge"
  >("normal");

  useEffect(() => {
    if (!assignmentId) return;
    let isMounted = true;

    const checkAttemptStatus = async () => {
      try {
        const history = await studentApi
          .getMyAttempts(assignmentId)
          .catch(() => []);
        if (!isMounted) return;

        setPreviousAttempts(history);
        const inProgressAtt = history.find(
          (att) => att.status === "IN_PROGRESS",
        );

        if (inProgressAtt) {
          const detail = await studentApi
            .getAttemptDetail(inProgressAtt.attemptId)
            .catch(() => null);
          if (!isMounted) return;

          if (detail) {
            setAttempt(detail);
            const restored: any = {};
            detail.questions?.forEach((q) => {
              restored[q.questionId] = {
                selectedOptionId:
                  q.selectedOptionId ||
                  (q.studentAnswer?.length === 36
                    ? q.studentAnswer
                    : undefined),
                textAnswer: q.studentAnswer,
                audioUrl: q.audioUrl,
              };
            });
            setAnswers(restored);

            const totalDuration = 45 * 60;
            if (detail.startedAt) {
              const elapsed = Math.floor(
                (Date.now() - new Date(detail.startedAt).getTime()) / 1000,
              );
              
            } else {
              
            }
            setPhase("TESTING");
            return;
          }
        }
        setPhase("INTRO");
      } catch (err) {
        if (isMounted) setPhase("INTRO");
      }
    };

    checkAttemptStatus();
    return () => {
      isMounted = false;
    };
  }, [assignmentId]);

  // Bộ đếm ngược thời gian làm bài
  // Xác định thể loại bài tập
  const questions = attempt?.questions || [];
  const isListeningTest = useMemo(() => {
    const skill = String((attempt as any)?.skillType || "").toUpperCase();
    const title = (attempt?.assignmentTitle || "").toLowerCase();
    const desc = (
      (attempt as any)?.assignmentDescription ||
      (attempt as any)?.description ||
      ""
    ).toLowerCase();
    return (
      skill === "LISTENING" ||
      title.includes("listening") ||
      title.includes("nghe") ||
      desc.includes("listening")
    );
  }, [attempt]);

  const isVocabTest = useMemo(() => {
    const skill = String((attempt as any)?.skillType || "").toUpperCase();
    const title = (attempt?.assignmentTitle || "").toLowerCase();
    const desc = (
      (attempt as any)?.assignmentDescription ||
      (attempt as any)?.description ||
      ""
    ).toLowerCase();
    return (
      skill === "VOCABULARY" ||
      title.includes("vocab") ||
      title.includes("từ vựng") ||
      desc.includes("vocabulary")
    );
  }, [attempt]);

  const isVocabMatching = useMemo(() => {
    if (!attempt) return false;
    const skill = String((attempt as any)?.skillType || "").toUpperCase();
    const title = (attempt?.assignmentTitle || "").toLowerCase();
    const desc = (
      (attempt as any)?.assignmentDescription ||
      (attempt as any)?.description ||
      ""
    ).toLowerCase();
    const exType = String(
      (attempt as any)?.exerciseType || (attempt as any)?.subFormat || ""
    ).toUpperCase();

    const hasMatchingQuestion = (questions || []).some((q) => {
      const qType = String(q.questionType || "").toUpperCase();
      const p = (q.promptText || "").toLowerCase();
      return (
        qType === "MATCHING" ||
        p.includes("nối từ") ||
        p.includes("matching") ||
        p.includes("định nghĩa chính xác nhất của từ")
      );
    });

    return (
      (skill === "VOCABULARY" &&
        (title.includes("nối") ||
          desc.includes("matching") ||
          desc.includes("nối") ||
          title.includes("matching") ||
          exType.includes("VOCAB_MATCHING") ||
          exType.includes("MATCH"))) ||
      hasMatchingQuestion
    );
  }, [attempt, questions]);

  const handleMatchingAnswers = (
    questionId: string,
    partial: { selectedOptionId?: string; textAnswer?: string }
  ) => {
    updateAnswer(questionId, partial);
  };

  const isReadingTest = useMemo(() => {
    const skill = String((attempt as any)?.skillType || "").toUpperCase();
    const title = (attempt?.assignmentTitle || "").toLowerCase();
    const desc = (
      (attempt as any)?.assignmentDescription ||
      (attempt as any)?.description ||
      ""
    ).toLowerCase();
    return (
      skill === "READING" ||
      title.includes("reading") ||
      title.includes("đọc") ||
      desc.includes("reading")
    );
  }, [attempt]);

  const isGrammarTest = useMemo(() => {
    const skill = String((attempt as any)?.skillType || "").toUpperCase();
    const title = (attempt?.assignmentTitle || "").toLowerCase();
    const desc = (
      (attempt as any)?.assignmentDescription ||
      (attempt as any)?.description ||
      ""
    ).toLowerCase();
    return (
      skill === "GRAMMAR" ||
      title.includes("grammar") ||
      title.includes("ngữ pháp") ||
      desc.includes("grammar")
    );
  }, [attempt]);

  // Đánh giá tỷ lệ sai & điều kiện làm lại (Remedial / Retake Evaluation)
  const retakeEvaluation = useMemo(() => {
    if (!attempt || phase !== "REVIEW") return null;

    // Kiểm tra câu hỏi tự luận (Essay, IELTS Task 1, Task 2, Paragraph)
    const hasEssay = questions.some((q) => {
      const type = String(q.questionType || "").toUpperCase();
      const prompt = (q.promptText || "").toLowerCase();
      return (
        type === "ESSAY" ||
        type.includes("ESSAY") ||
        type.includes("PARAGRAPH") ||
        type.includes("IELTS_TASK") ||
        prompt.includes("bài luận") ||
        prompt.includes("opinion paragraph") ||
        prompt.includes("ielts task")
      );
    });

    if (hasEssay) {
      return {
        isEssay: true,
        canRetry: false,
        errorRate: 0,
        scorePercent: 0,
        message: "Bài viết tự luận đã được nộp thành công và đang chờ giáo viên / AI chấm điểm chuyên sâu.",
      };
    }

    const currentScore =
      attempt.score != null
        ? attempt.score
        : (attempt as any).totalScore != null
        ? (attempt as any).totalScore
        : 0;
    const scorePercent = Math.max(0, Math.min(100, (Number(currentScore) / 10) * 100));
    const errorRate = Math.round((100 - scorePercent) * 10) / 10;

    let canRetry = false;
    let message = "";

    if (isVocabTest || isGrammarTest || isReadingTest) {
      // Threshold: Sai > 50% (hoặc Điểm < 50%) -> Cần làm lại
      if (errorRate > 50 || scorePercent < 50) {
        canRetry = true;
        message = `Kết quả bài làm chưa đạt chuẩn (Sai ${Math.round(errorRate)}%). Bạn cần làm lại bài tập này để củng cố kiến thức!`;
      } else {
        message = "Chúc mừng! Bạn đã hoàn thành xuất sắc bài tập và đạt chuẩn kiến thức.";
      }
    } else if (isListeningTest) {
      // Threshold: Sai > 70% (hoặc Điểm < 30%) -> Cần làm lại
      if (errorRate > 70 || scorePercent < 30) {
        canRetry = true;
        message = `Kết quả bài nghe chưa đạt chuẩn (Sai ${Math.round(errorRate)}%). Bạn hãy luyện tập nghe lại bài này để cải thiện kỹ năng!`;
      } else {
        message = "Chúc mừng! Bạn đã đạt chuẩn kỹ năng nghe.";
      }
    } else {
      // Writing ngắn hoặc dạng bài khác: Sai > 70% -> Cần làm lại
      if (errorRate > 70 || scorePercent < 30) {
        canRetry = true;
        message = `Kết quả bài tập chưa đạt chuẩn (Sai ${Math.round(errorRate)}%). Hãy luyện tập làm lại để nắm vững kiến thức!`;
      } else {
        message = "Chúc mừng! Bạn đã hoàn thành bài tập đạt chuẩn.";
      }
    }

    return {
      isEssay: false,
      canRetry,
      errorRate,
      scorePercent,
      message: (attempt as any).aiFeedback || message,
    };
  }, [attempt, phase, questions, isVocabTest, isGrammarTest, isReadingTest, isListeningTest]);

  // Helper chuẩn hóa đường dẫn Audio (hỗ trợ cả Cloudflare R2 lẫn local backend uploads)
  // Helper chuẩn hóa đường dẫn Audio (hỗ trợ cả Cloudflare R2 lẫn local backend uploads)
  const resolveAudioUrl = (url?: string) => {
    if (!url) return "";
    const trimmed = url.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("blob:")) return trimmed;
    const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
    return `${base}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
  };

  // Tìm URL Audio chính của bài nghe (Ưu tiên lấy từ attempt.audioUrl)
  const baseMainAudioUrl = useMemo(() => {
    const attemptAudio = (attempt as any)?.audioUrl;
    if (
      attemptAudio &&
      typeof attemptAudio === "string" &&
      attemptAudio.trim().length > 3 &&
      !attemptAudio.includes("translate.google") &&
      !attemptAudio.includes("dictvoice")
    ) {
      return resolveAudioUrl(attemptAudio.trim());
    }
    // Với bài LISTENING: KHÔNG quét questions để tránh lấy nhầm audio của Question 1!
    if (!isListeningTest) {
      for (const q of questions) {
        const url = (q as any).mediaUrl || (q as any).audioUrl;
        if (
          url &&
          typeof url === "string" &&
          url.trim().length > 3 &&
          !url.includes("translate.google") &&
          !url.includes("dictvoice")
        ) {
          return resolveAudioUrl(url.trim());
        }
      }
    }
    return "";
  }, [attempt, questions, isListeningTest]);

  // Luôn ưu tiên baseMainAudioUrl (audio chính thức của bài nghe).
  // Chỉ fallback sang customListeningAudioUrl nếu bài chưa có baseMainAudioUrl.
  const mainAudioUrl = baseMainAudioUrl || customListeningAudioUrl || "";

  const firstListeningQuestionId = useMemo(() => {
    return (
      questions.find((q) => (q as any).mediaUrl || (q as any).audioUrl || (q as any).transcript)?.questionId ||
      questions[0]?.questionId
    );
  }, [questions]);

  // Load Kokoro dialogue metadata & segments if available
  useEffect(() => {
    if (isListeningTest && firstListeningQuestionId) {
      studentApi
        .getQuestionAudioStatus(firstListeningQuestionId)
        .then((audio) => {
          if (audio) {
            // Chỉ cập nhật customListeningAudioUrl nếu attempt chưa có audioUrl
            if (audio.url && !baseMainAudioUrl) {
              setCustomListeningAudioUrl(resolveAudioUrl(audio.url));
            }
            if (audio.segments && audio.segments.length > 0) {
              setListeningSegments(audio.segments);
            }
          }
        })
        .catch(() => {});
    }
  }, [isListeningTest, firstListeningQuestionId, baseMainAudioUrl]);

  // Self-Healing Audio Repair for Listening
  const handleRepairListeningAudio = async () => {
    if (!firstListeningQuestionId) return;
    setIsRepairingListeningAudio(true);
    try {
      const repaired = await studentApi.repairQuestionAudio(firstListeningQuestionId);
      if (repaired && repaired.url) {
        const resolved = resolveAudioUrl(repaired.url);
        setCustomListeningAudioUrl(resolved);
        if (repaired.segments) {
          setListeningSegments(repaired.segments);
        }
        if (attempt) {
          (attempt as any).audioUrl = resolved;
        }
        if (audioRef.current) {
          audioRef.current.src = resolved;
          audioRef.current.playbackRate = playbackRate;
          audioRef.current.defaultPlaybackRate = playbackRate;
          (audioRef.current as any).preservesPitch = true;
          audioRef.current.load();
          audioRef.current
            .play()
            .then(() => setIsPlayingAudio(true))
            .catch(() => {});
        }
      }
    } catch (err: any) {
      console.error("Lỗi khi tạo lại audio bài nghe:", err);
      alert(err?.response?.data?.message || "Không thể tạo lại audio lúc này. Vui lòng thử lại sau.");
    } finally {
      setIsRepairingListeningAudio(false);
    }
  };

  // Tìm kịch bản nghe liên tục cho toàn bộ bài nghe (Ưu tiên lấy từ attempt.listeningScript / passage, sau đó fallback quét questions)
  const listeningPassageText = useMemo(() => {
    const attemptScript =
      (attempt as any)?.listeningScript ||
      (attempt as any)?.passage;
    if (attemptScript && typeof attemptScript === "string" && attemptScript.trim().length > 10) {
      return attemptScript.trim();
    }
    for (const q of questions) {
      const trans = (q as any).transcript;
      if (trans && typeof trans === "string" && trans.trim().length > 10) {
        return trans.trim();
      }
    }
    return "";
  }, [attempt, questions]);

  // Tìm văn bản bài đọc nếu là bài Reading (Ưu tiên lấy từ mô tả bài tập dùng chung, sau đó mới quét câu hỏi)
  const readingPassageText = useMemo<string>(() => {
    // 1. Kiểm tra từ description của attempt / assignment
    const desc =
      (attempt as any)?.assignmentDescription ||
      (attempt as any)?.description ||
      (attempt as any)?.assignment?.description ||
      "";
    if (desc && desc.toUpperCase().includes("READING PASSAGE")) {
      const match = desc.match(/\[READING PASSAGE\]\s*([\s\S]*?)(?=\n\n\[Loại:|\n\n\[|$)/i);
      if (match && match[1]?.trim()) {
        return match[1].trim();
      }
      const parts = desc.split(/\[?READING PASSAGE\]?:?/i);
      if (parts.length > 1) {
        return parts[1].split(/\n\s*\[/)[0].trim();
      }
    }
    // 2. Fallback nếu đề bài cũ để ở prompt câu hỏi
    for (const q of questions) {
      if (
        q.promptText &&
        q.promptText.toUpperCase().includes("READING PASSAGE")
      ) {
        const parts = q.promptText.split(/\[?READING PASSAGE\]?:?/i);
        if (parts.length > 1) {
          const passageAndQuestion = parts[1];
          const doubleNewline = passageAndQuestion.lastIndexOf("\n\n");
          if (doubleNewline !== -1) {
            return passageAndQuestion.slice(0, doubleNewline).trim();
          }
          const lines = passageAndQuestion.split(/\n\s*\n/);
          return lines
            .slice(0, Math.max(1, lines.length - 1))
            .join("\n\n")
            .trim();
        }
      }
    }
    return "";
  }, [questions, attempt]);

  // Cập nhật câu trả lời cho từng câu hỏi
  const updateAnswer = (
    questionId: string,
    partial: {
      selectedOptionId?: string;
      textAnswer?: string;
      audioUrl?: string;
    },
  ) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        ...partial,
      },
    }));
  };

  // Cuộn mượt đến câu hỏi tương ứng khi bấm số trên bảng điều khiển
  const scrollToQuestion = (questionId: string) => {
    const element = document.getElementById(`question-${questionId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // Xử lý Audio Player
  const togglePlayAudio = () => {
    if (!mainAudioUrl || !audioRef.current) return;
    if (isPlayingAiVoice) {
      if (ttsAudioRef.current) ttsAudioRef.current.pause();
      window.speechSynthesis?.cancel();
      setIsPlayingAiVoice(false);
    }
    const audio = audioRef.current;
    if (isPlayingAudio || !audio.paused) {
      audio.pause();
      setIsPlayingAudio(false);
    } else {
      audio.playbackRate = playbackRate;
      audio.defaultPlaybackRate = playbackRate;
      (audio as any).preservesPitch = true;
      audio
        .play()
        .then(() => setIsPlayingAudio(true))
        .catch((e) => {
          console.warn("Lỗi phát audio:", e);
        });
    }
  };

  // Đồng bộ tốc độ phát âm thanh và nạp lại audio khi mainAudioUrl / playbackRate thay đổi
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.defaultPlaybackRate = playbackRate;
      (audioRef.current as any).preservesPitch = true;
      if (mainAudioUrl) {
        audioRef.current.load();
      }
    }
    if (ttsAudioRef.current) {
      ttsAudioRef.current.playbackRate = playbackRate;
      (ttsAudioRef.current as any).preservesPitch = true;
    }
  }, [playbackRate, mainAudioUrl]);

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      setAudioCurrentTime(audioRef.current.currentTime);
      const d = audioRef.current.duration;
      if (Number.isFinite(d) && !isNaN(d) && d > 0) {
        setAudioDuration(d);
      }
    }
  };

  const handleSeekAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setAudioCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
      audioRef.current.defaultPlaybackRate = rate;
      (audioRef.current as any).preservesPitch = true;
    }
    if (ttsAudioRef.current) {
      ttsAudioRef.current.playbackRate = rate;
      (ttsAudioRef.current as any).preservesPitch = true;
    }
  };

  // Phát đọc toàn bộ kịch bản bài nghe (chỉ đọc kịch bản/transcript, tuyệt đối KHÔNG đọc câu hỏi)
  const playAiVoiceTranscript = async () => {
    if (isPlayingAiVoice) {
      if (ttsAudioRef.current) ttsAudioRef.current.pause();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setIsPlayingAiVoice(false);
      return;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (isPlayingAudio && audioRef.current) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    }

    // Nếu đã có file mainAudioUrl, phát trực tiếp file audio chính thức
    if (mainAudioUrl && audioRef.current) {
      togglePlayAudio();
      return;
    }

    // CHỈ đọc kịch bản nghe (transcript/script), TUYỆT ĐỐI KHÔNG đọc câu hỏi trắc nghiệm (promptText)
    const fullText =
      listeningPassageText ||
      questions
        .map((q) => (q as any).transcript)
        .filter(Boolean)
        .join("\n\n");

    if (!fullText || fullText.trim().length < 5) {
      alert("Đang chuẩn bị âm thanh cho bài nghe. Vui lòng bấm nút 'Tạo lại audio' hoặc chờ giây lát.");
      setIsPlayingAiVoice(false);
      return;
    }

    setIsPlayingAiVoice(true);
    await speakText(fullText, () => setIsPlayingAiVoice(false));
  };

  // Công cụ Highlight bài đọc
  const applyHighlight = (color: "yellow" | "green") => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !passageContainerRef.current)
      return;
    if (!passageContainerRef.current.contains(selection.anchorNode)) {
      alert("Vui lòng bôi đen văn bản bên trong bài đọc để highlight.");
      return;
    }

    try {
      const range = selection.getRangeAt(0);
      const mark = document.createElement("mark");
      mark.className =
        color === "yellow"
          ? "bg-amber-200 text-slate-900 rounded px-1 py-0.5 cursor-pointer hover:bg-amber-300 transition"
          : "bg-emerald-200 text-slate-900 rounded px-1 py-0.5 cursor-pointer hover:bg-emerald-300 transition";
      mark.title = "Click chuột vào đây để xóa bôi màu";
      mark.onclick = (e) => {
        e.stopPropagation();
        const parent = mark.parentNode;
        if (parent) {
          while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
          parent.removeChild(mark);
        }
      };

      mark.appendChild(range.extractContents());
      range.insertNode(mark);
      selection.removeAllRanges();
    } catch (e) {
      console.warn("Không thể highlight:", e);
    }
  };

  const removeAllHighlights = () => {
    if (!passageContainerRef.current) return;
    const marks = passageContainerRef.current.querySelectorAll("mark");
    marks.forEach((m) => {
      const parent = m.parentNode;
      if (parent) {
        while (m.firstChild) parent.insertBefore(m.firstChild, m);
        parent.removeChild(m);
      }
    });
  };

  const handleStartNewAttempt = async () => {
    if (!assignmentId) return;
    setIsStarting(true);
    try {
      const started = await studentApi.startAssignment(assignmentId);
      const detail = await studentApi.getAttemptDetail(started.attemptId);
      setAttempt(detail);
      setAnswers({});
      setCheckedQuestions({});
      setPhase("TESTING");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      const msg = err.response?.data?.message || "";
      if (
        msg.includes("hết hạn") ||
        msg.includes("maxAttempts") ||
        msg.includes("hết số lần") ||
        msg.includes("không thể làm lại")
      ) {
        setPhase("EXHAUSTED");
      } else {
        alert("Không thể bắt đầu: " + msg);
      }
    } finally {
      setIsStarting(false);
    }
  };

  const handleSubmitTest = async () => {
    if (!attempt || !assignmentId) return;
    const answeredCount = questions.filter((q) => {
      const a = answers[q.questionId];
      return Boolean(
        a?.selectedOptionId ||
        (a?.textAnswer && a.textAnswer.trim().length > 0) ||
        a?.audioUrl,
      );
    }).length;

    const unAnswered = questions.length - answeredCount;
    const confirmMsg =
      unAnswered > 0
        ? `Bạn vẫn còn ${unAnswered} câu chưa trả lời. Bạn có chắc chắn muốn nộp bài?`
        : "Bạn đã hoàn tất tất cả câu hỏi. Nộp bài ngay bây giờ?";

    if (!window.confirm(confirmMsg)) return;

    setIsSubmitting(true);
    try {
      const payload = Object.entries(answers).map(([qId, ans]) => ({
        questionId: qId,
        selectedOptionId: ans.selectedOptionId,
        textAnswer: ans.textAnswer,
      }));
      const res = await studentApi.submitAssignment(
        assignmentId,
        attempt.attemptId,
        payload,
      );
      try {
        const freshDetail = await studentApi.getAttemptDetail(res.attemptId || attempt.attemptId);
        setAttempt(freshDetail);
        const restored: any = {};
        freshDetail.questions?.forEach((q) => {
          restored[q.questionId] = {
            selectedOptionId:
              q.selectedOptionId ||
              (q.studentAnswer?.length === 36 ? q.studentAnswer : undefined),
            textAnswer: q.studentAnswer,
            audioUrl: q.audioUrl,
          };
        });
        setAnswers((prev) => ({ ...prev, ...restored }));
        setPhase("REVIEW");
        setShowListeningScript(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch {
        navigate(
          `/student/assignments/${assignmentId}/submissions/${res.attemptId || attempt.attemptId}`,
        );
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi khi nộp bài");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoSubmit = async () => {
    if (!attempt || !assignmentId) return;
    setIsSubmitting(true);
    try {
      const payload = Object.entries(answers).map(([qId, ans]) => ({
        questionId: qId,
        selectedOptionId: ans.selectedOptionId,
        textAnswer: ans.textAnswer,
      }));
      const res = await studentApi.submitAssignment(
        assignmentId,
        attempt.attemptId,
        payload,
      );
      alert("Hết thời gian làm bài! Hệ thống đã tự động lưu và gửi bài tập.");
      try {
        const freshDetail = await studentApi.getAttemptDetail(res.attemptId || attempt.attemptId);
        setAttempt(freshDetail);
        const restored: any = {};
        freshDetail.questions?.forEach((q) => {
          restored[q.questionId] = {
            selectedOptionId:
              q.selectedOptionId ||
              (q.studentAnswer?.length === 36 ? q.studentAnswer : undefined),
            textAnswer: q.studentAnswer,
            audioUrl: q.audioUrl,
          };
        });
        setAnswers((prev) => ({ ...prev, ...restored }));
        setPhase("REVIEW");
        setShowListeningScript(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch {
        navigate(
          `/student/assignments/${assignmentId}/submissions/${res.attemptId || attempt.attemptId}`,
        );
      }
    } catch {
      navigate(`/student/assignments/${assignmentId}/submissions/latest`);
    }
  };

  const handleUploadSpeaking = async (questionId: string, blob: Blob) => {
    if (!attempt) return;
    setIsUploadingAudio(true);
    try {
      await studentApi.uploadSpeakingAudio(attempt.attemptId, questionId, blob);
      const audioUrl = URL.createObjectURL(blob);
      updateAnswer(questionId, { audioUrl });
    } catch (err: any) {
      alert(
        "Không thể tải lên file ghi âm: " +
          (err.response?.data?.message || err.message),
      );
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const formatTimer = (secs: number) => {
    if (!Number.isFinite(secs) || isNaN(secs) || secs < 0) return "00:00";
    const total = Math.floor(secs);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Phát âm giọng đọc tiếng Anh tự nhiên Kokoro-82M TTS (có fallback sang Web Speech API)
  const speakText = async (text: string, onEnd?: () => void) => {
    if (!text) {
      if (onEnd) onEnd();
      return;
    }
    if (ttsAudioRef.current) {
      try {
        ttsAudioRef.current.pause();
        ttsAudioRef.current.currentTime = 0;
      } catch (_) {}
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    const cleanText = text
      .replace(/\[READING PASSAGE\][\s\S]*?(?=\n\n|$)/i, "")
      .replace(/\[.*?\]/g, "")
      .replace(/(?:^|\n)\s*(?:[-*•]\s*)?\*{0,2}(?:speaker\s*\d+|friend\s*[a-z0-9]+|person\s*[a-z0-9]+|student\s*[a-z0-9]*|teacher|professor|man|woman|boy|girl|narrator|interviewer|candidate|examiner|host|guest|customer|waiter|receptionist|doctor|patient|[a-zA-Z]{2,15})\*{0,2}\s*(?:\([^)]{1,25}\))?\s*:\s*/gi, "\n")
      .replaceAll("_+", "blank")
      .trim();

    if (!cleanText) {
      if (onEnd) onEnd();
      return;
    }

    const playWebSpeechFallback = () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(cleanText);
          utterance.lang = "en-US";
          utterance.rate = playbackRate || 1.0;
          utterance.onend = () => {
            if (onEnd) onEnd();
          };
          utterance.onerror = () => {
            if (onEnd) onEnd();
          };
          window.speechSynthesis.speak(utterance);
          return;
        } catch (_) {
          if (onEnd) onEnd();
        }
      } else {
        if (onEnd) onEnd();
      }
    };

    let audioUrl = ttsCacheMapRef.current.get(cleanText);
    if (!audioUrl) {
      try {
        const res = await studentApi.synthesizeTTS({
          text: cleanText,
          voice: "af_heart",
          speed: 1.0,
        });
        if (res?.audioUrl) {
          audioUrl = res.audioUrl;
          ttsCacheMapRef.current.set(cleanText, audioUrl);
        }
      } catch (err) {
        console.warn("Kokoro TTS fallback in AssignmentTakePage:", err);
      }
    }

    if (audioUrl) {
      try {
        const audio = new Audio(resolveAudioUrl(audioUrl));
        ttsAudioRef.current = audio;
        audio.playbackRate = playbackRate;
        audio.onended = () => {
          if (onEnd) onEnd();
        };
        audio.onerror = () => {
          playWebSpeechFallback();
        };
        audio.play().catch((err) => {
          if (err.name !== "AbortError") {
            playWebSpeechFallback();
          }
        });
        return;
      } catch (_) {
        playWebSpeechFallback();
        return;
      }
    }

    playWebSpeechFallback();
  };

  // State quản lý ID câu hỏi đang phát âm thanh
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const playingQuestionId = playingAudioId;
  const setPlayingQuestionId = setPlayingAudioId;

  // Phát audio cho cả câu/đoạn kịch bản trong bài tập LISTENING
  const playListeningAudio = (questionId: string, mediaUrl?: string, textContent?: string) => {
    if (playingAudioId === questionId) {
      if (ttsAudioRef.current) {
        try {
          ttsAudioRef.current.pause();
          ttsAudioRef.current.currentTime = 0;
        } catch (_) {}
      }
      window.speechSynthesis?.cancel();
      setPlayingAudioId(null);
      return;
    }

    if (ttsAudioRef.current) {
      try {
        ttsAudioRef.current.pause();
        ttsAudioRef.current.currentTime = 0;
      } catch (_) {}
    }
    window.speechSynthesis?.cancel();
    setPlayingAudioId(questionId);

    const cleanText = textContent
      ? textContent.replace(/\[.*?\]/g, "").replaceAll("_+", "blank").trim()
      : "";

    const resolvedUrl = resolveAudioUrl(mediaUrl);
    if (resolvedUrl && !resolvedUrl.includes("translate.google") && !resolvedUrl.includes("dictvoice")) {
      const audio = new Audio(resolvedUrl);
      ttsAudioRef.current = audio;
      audio.onended = () => setPlayingAudioId(null);
      audio.onerror = () => {
        speakText(cleanText, () => setPlayingAudioId(null));
      };
      audio.play().catch((err) => {
        if (err.name !== "AbortError") {
          speakText(cleanText, () => setPlayingAudioId(null));
        }
      });
      return;
    }

    speakText(cleanText, () => setPlayingAudioId(null));
  };

  // 1. Hàm trích xuất từ tiếng Anh mục tiêu (extractTargetWord)
  const extractTargetWord = (q: QuestionResultDetail): string => {
    // Ưu tiên targetWord / word tường minh từ database hoặc AI Generator
    const explicitWord = ((q as any).targetWord || (q as any).word || "").trim();
    if (explicitWord) {
      const cleaned = explicitWord.replace(/[^a-zA-Z\s-]/g, "").trim();
      if (cleaned) return cleaned;
    }

    // Trích xuất từ tiếng Anh nằm trong dấu ngoặc kép hoặc ngoặc đơn trong prompt
    const prompt = (q.promptText || "")
      .replace(/\[LISTEN_WORD\]\s*/gi, "")
      .replace(/\[LISTEN_SPELL\]\s*/gi, "")
      .trim();

    const quotedMatch = prompt.match(/["'“‘]([a-zA-Z\s'-]{2,})["'”’]/);
    if (quotedMatch && quotedMatch[1]) {
      const cleaned = quotedMatch[1].replace(/[^a-zA-Z\s-]/g, "").trim();
      if (cleaned) return cleaned;
    }

    // Nếu correctAnswer là từ tiếng Anh (không phải mã option dạng A, B, C, opt-1... và không phải tiếng Việt)
    const ans = (q.correctAnswer || "").trim();
    const isEnglishAns =
      /^[a-zA-Z\s'-]{2,}$/.test(ans) &&
      !/^(option|opt|choice)[-_]?[0-9a-z]+$/i.test(ans) &&
      !/^[A-D]$/i.test(ans);
    if (isEnglishAns) {
      const cleaned = ans.replace(/[^a-zA-Z\s-]/g, "").trim();
      if (cleaned) return cleaned;
    }

    // Bóc tách từ tiếng Anh hợp lệ (chứa từ 2 chữ cái trở lên) từ candidate
    const candidate = (q as any).targetWord || (isEnglishAns ? ans : "") || prompt;
    const matched = candidate.match(/[a-zA-Z]{2,}(?:[-'\s][a-zA-Z]+)*/);
    return matched ? matched[0].replace(/[^a-zA-Z\s-]/g, "").trim() : "";
  };

  // 2. Multi-tier Audio Fallback Pipeline cho câu hỏi Từ Vựng (VOCABULARY)
  // Tầng 1: URL có sẵn (q.mediaUrl / q.audioUrl) -> Tầng 2: Youdao CDN (US Native) -> Tầng 3: Web Speech API (en-US)
  const playVocabularyAudio = (q: QuestionResultDetail) => {
    const qId = q.questionId || (q as any).id;
    if (!qId) return;

    // Toggle tắt nếu đang phát chính câu hỏi này
    if (playingAudioId === qId) {
      if (ttsAudioRef.current) {
        try {
          ttsAudioRef.current.pause();
          ttsAudioRef.current.currentTime = 0;
        } catch (_) {}
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setPlayingAudioId(null);
      return;
    }

    // Dừng mọi âm thanh hiện tại
    if (ttsAudioRef.current) {
      try {
        ttsAudioRef.current.pause();
        ttsAudioRef.current.currentTime = 0;
      } catch (_) {}
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    const targetWord = extractTargetWord(q);
    if (!targetWord) {
      console.warn("Không trích xuất được từ vựng tiếng Anh hợp lệ cho câu hỏi:", qId);
      setPlayingAudioId(null);
      return;
    }

    setPlayingAudioId(qId);

    // TẦNG 3: Web Speech API (en-US)
    const playTier3 = () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(targetWord);
          utterance.lang = "en-US";
          utterance.rate = playbackRate || 1.0;
          utterance.onend = () => {
            setPlayingAudioId((curr) => (curr === qId ? null : curr));
          };
          utterance.onerror = () => {
            setPlayingAudioId((curr) => (curr === qId ? null : curr));
          };
          window.speechSynthesis.speak(utterance);
          return;
        } catch (err) {
          console.warn("Web Speech API playback error:", err);
        }
      }
      setPlayingAudioId((curr) => (curr === qId ? null : curr));
    };

    // TẦNG 2: Youdao CDN (US Native Voice)
    const playTier2 = () => {
      try {
        const youdaoUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(targetWord)}&type=2`;
        const audio = new Audio(youdaoUrl);
        ttsAudioRef.current = audio;
        audio.playbackRate = playbackRate;

        audio.onended = () => {
          setPlayingAudioId((curr) => (curr === qId ? null : curr));
        };

        audio.onerror = () => {
          playTier3();
        };

        audio.play().catch((err) => {
          if (err.name !== "AbortError") {
            playTier3();
          }
        });
      } catch (_) {
        playTier3();
      }
    };

    // TẦNG 1: URL có sẵn (q.mediaUrl hoặc q.audioUrl)
    const rawUrl = (q.mediaUrl || q.audioUrl || "").trim();
    const isValidUrl =
      rawUrl &&
      !rawUrl.includes("api.dictionaryapi.dev") &&
      !rawUrl.includes("translate.google");

    if (isValidUrl) {
      try {
        const resolved = resolveAudioUrl(rawUrl);
        const audio = new Audio(resolved);
        ttsAudioRef.current = audio;
        audio.playbackRate = playbackRate;

        audio.onended = () => {
          setPlayingAudioId((curr) => (curr === qId ? null : curr));
        };

        audio.onerror = () => {
          playTier2();
        };

        audio.play().catch((err) => {
          if (err.name !== "AbortError") {
            playTier2();
          }
        });
        return;
      } catch (_) {
        playTier2();
        return;
      }
    }

    // Không có URL tầng 1 -> Kích hoạt ngay Tầng 2
    playTier2();
  };

  // Wrapper tương thích ngược cho các vị trí gọi playWordAudio cũ
  const playWordAudio = (questionId: string, mediaUrl?: string, fallbackText?: string) => {
    const foundQ = questions.find((q) => q.questionId === questionId || (q as any).id === questionId);
    if (foundQ) {
      playVocabularyAudio(foundQ);
    } else {
      playVocabularyAudio({
        id: questionId,
        questionId,
        mediaUrl,
        audioUrl: mediaUrl,
        promptText: fallbackText || "",
        correctAnswer: fallbackText || "",
        questionType: "VOCABULARY",
        maxPoints: 1,
      });
    }
  };

  // Đổi trạng thái hiển thị gợi ý
  const toggleHint = (questionId: string) => {
    setExpandedHints((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  // Làm lại câu hỏi trong chế độ Luyện tập
  const handleRetryQuestion = (questionId: string) => {
    setCheckedQuestions((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    updateAnswer(questionId, {
      selectedOptionId: undefined,
      textAnswer: "",
    });
  };

  // Kiểm tra đáp án tức thì (Chế độ Luyện tập)
  const handleCheckAnswer = async (q: QuestionResultDetail) => {
    const rawType = String(q.questionType || "").toUpperCase();
    const promptText = q.promptText || "";
    const isPromptSentenceFill =
      promptText.includes("___") ||
      promptText.includes(" / ") ||
      promptText.toLowerCase().includes("sắp xếp") ||
      promptText.toLowerCase().includes("hoàn thành câu") ||
      promptText.toLowerCase().includes("viết lại câu") ||
      promptText.toLowerCase().includes("từ gợi ý") ||
      (promptText.length < 130 && promptText.includes("(") && promptText.includes(")"));

    const isSentenceTask =
      rawType === "FILL_IN_BLANK" ||
      rawType.includes("ARRANGE") ||
      rawType.includes("UNSCRAMBLE") ||
      ((rawType === "ESSAY" || rawType === "WRITING") && isPromptSentenceFill);

    const isMultipleChoice = rawType === "MULTIPLE_CHOICE";
    const isTrueFalse = rawType === "TRUE_FALSE";
    const userAns = answers[q.questionId];

    if (isSentenceTask) {
      const studentText = userAns?.textAnswer?.trim() || "";
      if (!studentText) {
        alert("Vui lòng nhập câu trả lời của bạn trước khi kiểm tra!");
        return;
      }

      // Trường hợp có bài đọc Reading: Đánh giá bằng AI (phân biệt ý vs ngữ pháp)
      if (readingPassageText) {
        setCheckedQuestions((prev) => ({
          ...prev,
          [q.questionId]: {
            isChecked: true,
            isEvaluating: true,
          },
        }));

        try {
          const evalRes = await studentApi.evaluateReadingShortAnswerAI(
            readingPassageText,
            q.promptText,
            studentText,
            q.correctAnswer,
          );

          setCheckedQuestions((prev) => ({
            ...prev,
            [q.questionId]: {
              isChecked: true,
              isEvaluating: false,
              isCorrect: evalRes.isContentCorrect && evalRes.isGrammarCorrect,
              isContentCorrect: evalRes.isContentCorrect,
              isGrammarCorrect: evalRes.isGrammarCorrect,
              feedback: evalRes.contentFeedback,
              grammarAnalysis: evalRes.grammarFeedback,
              suggestedAnswer: evalRes.suggestedAnswer || q.correctAnswer,
              contentAnalysis: evalRes.passageQuote,
            },
          }));
        } catch {
          // Fallback so sánh text đơn giản nếu mất kết nối AI
          const expected = (q.correctAnswer || "").trim().toLowerCase();
          const isMatch = studentText.toLowerCase() === expected;
          setCheckedQuestions((prev) => ({
            ...prev,
            [q.questionId]: {
              isChecked: true,
              isEvaluating: false,
              isCorrect: isMatch,
              isContentCorrect: isMatch,
              isGrammarCorrect: isMatch,
              feedback: isMatch ? "Câu trả lời chính xác!" : "Câu trả lời chưa khớp với đáp án mẫu.",
              suggestedAnswer: q.correctAnswer,
            },
          }));
        }
        return;
      }

      // Ngữ pháp hoặc Từ vựng điền từ / sắp xếp từ:
      const expected = (q.correctAnswer || "").trim().toLowerCase();
      const current = studentText.toLowerCase();
      const cleanExpected = expected.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s+/g, " ");
      const cleanCurrent = current.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s+/g, " ");
      const isMatch = cleanExpected === cleanCurrent;

      setCheckedQuestions((prev) => ({
        ...prev,
        [q.questionId]: {
          isChecked: true,
          isCorrect: isMatch,
          isContentCorrect: isMatch,
          isGrammarCorrect: isMatch,
          feedback: isMatch
            ? "Chính xác tuyệt đối! Làm tốt lắm."
            : "Chưa chính xác. Bạn hãy quan sát cấu trúc câu mẫu bên dưới nhé.",
          suggestedAnswer: q.correctAnswer,
        },
      }));
      return;
    }

    if (isMultipleChoice) {
      const selectedId = userAns?.selectedOptionId;
      if (!selectedId) {
        alert("Vui lòng chọn một phương án trước khi kiểm tra!");
        return;
      }
      const opts = (q as any).options || [];
      const chosenOpt = opts.find((o: any) => (o.id || o.optionLabel || o.text) === selectedId);
      const correctOpt = opts.find((o: any) => o.isCorrect === true);
      const isCorrect = correctOpt
        ? (chosenOpt?.isCorrect === true || chosenOpt?.id === correctOpt?.id)
        : selectedId === q.correctAnswer;

      setCheckedQuestions((prev) => ({
        ...prev,
        [q.questionId]: {
          isChecked: true,
          isCorrect,
          isContentCorrect: isCorrect,
          feedback: isCorrect
            ? "Chúc mừng! Bạn đã chọn đáp án chính xác."
            : "Đáp án bạn chọn chưa chính xác. Hãy xem phân tích bên dưới.",
          suggestedAnswer: correctOpt?.optionText || correctOpt?.text || q.correctAnswer,
        },
      }));
      return;
    }

    if (isTrueFalse) {
      const selectedVal = userAns?.selectedOptionId || userAns?.textAnswer;
      if (!selectedVal) {
        alert("Vui lòng chọn TRUE, FALSE hoặc NOT GIVEN!");
        return;
      }
      const expected = (q.correctAnswer || "TRUE").trim().toUpperCase();
      const isCorrect = selectedVal.toUpperCase() === expected;

      setCheckedQuestions((prev) => ({
        ...prev,
        [q.questionId]: {
          isChecked: true,
          isCorrect,
          isContentCorrect: isCorrect,
          feedback: isCorrect
            ? "Chính xác theo dữ kiện bài đọc!"
            : `Chưa đúng, đáp án chính xác là ${expected}.`,
          suggestedAnswer: expected,
        },
      }));
      return;
    }
  };

  if (!assignmentId) return null;

  if (phase === "CHECKING") {
    return (
      <div className="p-20 text-center text-xs font-semibold text-slate-500 flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-indigo-600" size={28} />
        <span>Đang nạp dữ liệu bài tập...</span>
      </div>
    );
  }

  if (phase === "EXHAUSTED" || phase === "INTRO") {
    const completedList = previousAttempts.filter(
      (a) => a.status !== "IN_PROGRESS",
    );
    const isExhausted = phase === "EXHAUSTED";

    return (
      <div className="elp-page max-w-3xl mx-auto my-12 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={() => navigate(-1)}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-3 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer shadow-sm"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="elp-card bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 p-8 md:p-12 shadow-sm text-center space-y-6">
          <div className="h-20 w-20 rounded-full bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
            {isExhausted ? (
              <ShieldAlert size={36} className="text-amber-500" />
            ) : (
              <BookOpen size={36} />
            )}
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">
              {isExhausted
                ? "Hết Lượt Làm Bài"
                : previousAttempts[0]?.assignmentTitle ||
                  "Bắt Đầu bài tập IELTS"}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-3 text-base leading-relaxed max-w-xl mx-auto">
              {isExhausted
                ? "Bạn đã dùng hết số lượt làm bài cho phép đối với bài tập này."
                : "Hệ thống hỗ trợ làm bài tập toàn diện: có Audio phát nghe liên tục, toàn bộ câu hỏi hiển thị trên 1 trang và tự động lưu đáp án."}
            </p>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            {completedList.length > 0 && (
              <button
                onClick={() =>
                  navigate(
                    `/student/assignments/${assignmentId}/submissions/latest`,
                  )
                }
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                Xem Lịch Sử Bài Nộp
              </button>
            )}
            {!isExhausted && (
              <button
                disabled={isStarting}
                onClick={handleStartNewAttempt}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-200 dark:shadow-none transition cursor-pointer disabled:opacity-50"
              >
                {isStarting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <PlayCircle size={20} />
                )}
                <span>Bắt Đầu Làm Bài Ngay</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const answeredQuestionsCount = questions.filter((q) => {
    const a = answers[q.questionId];
    return Boolean(
      a?.selectedOptionId ||
      (a?.textAnswer && a.textAnswer.trim().length > 0) ||
      a?.audioUrl,
    );
  }).length;

  return (
    <div className="elp-page max-w-[1550px] mx-auto space-y-4 pb-16">
      {/* 1. TOPBAR CỐ ĐỊNH CHUẨN IELTS CBT */}
      <header className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sticky top-2 z-40 transition-colors duration-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              window.confirm("Bạn có muốn tạm dừng làm bài?") && navigate(-1)
            }
            className="rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="font-black text-base md:text-lg text-slate-900 dark:text-white leading-tight">
              {attempt?.assignmentTitle}
            </h1>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">
              IELTS Standard Computer-Delivered Examination • Hiển thị 1 trang
              duy nhất
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {phase === "REVIEW" ? (
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-center">
                <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold block uppercase tracking-wider">
                  Điểm Số Đạt Được
                </span>
                <span className="text-base font-black text-emerald-700 dark:text-emerald-400">
                  {attempt?.score != null
                    ? Number(attempt.score).toFixed(1)
                    : attempt?.totalScore != null
                    ? Number(attempt.totalScore).toFixed(1)
                    : "Hoàn thành"}{" "}
                  pts
                </span>
              </div>
              {!retakeEvaluation?.isEssay && (
                <button
                  type="button"
                  disabled={isStarting}
                  onClick={handleStartNewAttempt}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 text-xs font-black transition cursor-pointer shadow-xs ${
                    retakeEvaluation?.canRetry
                      ? "border-amber-300 bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200"
                      : "border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                  }`}
                >
                  {isStarting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  <span>{retakeEvaluation?.canRetry ? "Làm Lại Bài Ngay" : "Làm Lại Đề Này"}</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Công cụ Highlight văn bản nếu có bài đọc */}
              {Boolean(readingPassageText) && (
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5">
                  <button
                    type="button"
                    onClick={() => applyHighlight("yellow")}
                    className="flex items-center gap-1 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-800/60 text-amber-900 dark:text-amber-200 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                    title="Bôi đen chữ rồi bấm nút này để Highlight Vàng"
                  >
                    <Highlighter size={13} className="text-amber-600 dark:text-amber-400" />
                    <span>Bôi vàng</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyHighlight("green")}
                    className="flex items-center gap-1 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:hover:bg-emerald-800/60 text-emerald-900 dark:text-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                    title="Bôi đen chữ rồi bấm nút này để Highlight Xanh"
                  >
                    <Highlighter size={13} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Bôi xanh</span>
                  </button>
                  <button
                    type="button"
                    onClick={removeAllHighlights}
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                    title="Xóa tất cả Highlight"
                  >
                    <Eraser size={15} />
                  </button>
                  <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
                  <button
                    type="button"
                    onClick={() =>
                      setFontSizeLevel((prev) =>
                        prev === "normal"
                          ? "large"
                          : prev === "large"
                            ? "xlarge"
                            : "normal",
                      )
                    }
                    className="flex items-center gap-1 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                    title="Đổi cỡ chữ bài đọc"
                  >
                    <Type size={13} />
                    <span>
                      {fontSizeLevel === "normal"
                        ? "1x"
                        : fontSizeLevel === "large"
                          ? "1.2x"
                          : "1.4x"}
                    </span>
                  </button>
                </div>
              )}

              {/* Chế độ Luyện tập vs Thi thử */}
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setStudyMode("PRACTICE")}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    studyMode === "PRACTICE"
                      ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs font-black"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  title="Chế độ Luyện tập: Kiểm tra đáp án từng câu, xem gợi ý & hướng dẫn giải"
                >
                  <Lightbulb size={13} className={studyMode === "PRACTICE" ? "text-amber-500" : ""} />
                  <span>Luyện Tập</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStudyMode("TEST")}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    studyMode === "TEST"
                      ? "bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 shadow-xs font-black"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  title="Chế độ Thi thử: Làm bài chuẩn đề thi, nộp bài tính điểm cuối cùng"
                >
                  <Clock size={13} className={studyMode === "TEST" ? "text-rose-500" : ""} />
                  <span>Thi Thử</span>
                </button>
              </div>

              <button
                onClick={handleSubmitTest}
                disabled={isSubmitting || isUploadingAudio}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-100 transition"
              >
                {isSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                <span>Nộp Bài</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* 2. AUDIO PLAYER BAR CỐ ĐỊNH CHO bài tập LISTENING */}
      {isListeningTest && (
        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] rounded-2xl p-4 text-slate-900 dark:text-white shadow-sm sticky top-20 z-30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <audio
              ref={audioRef}
              src={mainAudioUrl || undefined}
              preload="auto"
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                if (Number.isFinite(d) && !isNaN(d) && d > 0) {
                  setAudioDuration(d);
                }
                e.currentTarget.playbackRate = playbackRate;
                e.currentTarget.defaultPlaybackRate = playbackRate;
                (e.currentTarget as any).preservesPitch = true;
              }}
              onCanPlay={(e) => {
                const d = e.currentTarget.duration;
                if (Number.isFinite(d) && !isNaN(d) && d > 0) {
                  setAudioDuration(d);
                }
                e.currentTarget.playbackRate = playbackRate;
                e.currentTarget.defaultPlaybackRate = playbackRate;
              }}
              onDurationChange={(e) => {
                const d = e.currentTarget.duration;
                if (Number.isFinite(d) && !isNaN(d) && d > 0) {
                  setAudioDuration(d);
                }
              }}
              onTimeUpdate={(e) => {
                setAudioCurrentTime(e.currentTarget.currentTime);
                const d = e.currentTarget.duration;
                if (Number.isFinite(d) && !isNaN(d) && d > 0) {
                  setAudioDuration(d);
                }
              }}
              onPlay={() => setIsPlayingAudio(true)}
              onPause={() => setIsPlayingAudio(false)}
              onEnded={() => {
                setIsPlayingAudio(false);
                setAudioCurrentTime(0);
              }}
            />

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={mainAudioUrl ? togglePlayAudio : playAiVoiceTranscript}
                className={`h-12 w-12 rounded-full flex items-center justify-center font-black transition-transform active:scale-95 shadow-md cursor-pointer shrink-0 ${
                  isPlayingAudio || isPlayingAiVoice
                    ? "bg-rose-500 text-white hover:bg-rose-600 animate-pulse"
                    : "bg-amber-400 hover:bg-amber-300 text-slate-950"
                }`}
                title={isPlayingAudio || isPlayingAiVoice ? "Tạm dừng" : "Phát Audio bài nghe"}
              >
                {isPlayingAudio || isPlayingAiVoice ? (
                  <Pause size={20} />
                ) : (
                  <Play size={20} className="ml-0.5" />
                )}
              </button>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Headphones size={14} />{" "}
                  {mainAudioUrl
                    ? "Official Listening Audio Track"
                    : "Continuous Listening Passage (AI Voice)"}
                </span>
                <p className="text-sm font-black text-white leading-tight mt-0.5">
                  {isPlayingAudio
                    ? "Đang phát âm thanh bài nghe..."
                    : isPlayingAiVoice
                    ? "Đang đọc kịch bản bài nghe liên tục..."
                    : mainAudioUrl
                    ? "Bấm nút Play để bắt đầu nghe bài"
                    : "Bấm Play hoặc Voice AI để nghe trọn vẹn đoạn văn"}
                </p>
              </div>
            </div>

            {/* Thanh cuộn tua thời gian (khi có file audio) */}
            {Boolean(mainAudioUrl) && (
              <div className="flex-1 flex items-center gap-3 max-w-xl mx-2">
                <span className="text-xs font-mono text-indigo-200 w-12 text-right">
                  {formatTimer(audioCurrentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={audioDuration > 0 ? audioDuration : 100}
                  step={0.1}
                  value={Math.min(audioCurrentTime, audioDuration > 0 ? audioDuration : 100)}
                  onChange={handleSeekAudio}
                  className="flex-1 h-2 bg-indigo-700/60 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <span className="text-xs font-mono text-indigo-300 w-12">
                  {formatTimer(audioDuration)}
                </span>
              </div>
            )}

            {/* Các nút tùy chỉnh: Tốc độ, Âm lượng, Voice AI, Sửa lỗi & Xem Transcript */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1 border border-white/10">
                {[0.75, 1.0, 1.25, 1.5].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => changePlaybackRate(rate)}
                    className={`px-2 py-0.5 rounded text-[11px] font-black transition ${
                      playbackRate === rate
                        ? "bg-amber-400 text-slate-950"
                        : "text-white hover:bg-white/10"
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>

              {Boolean(mainAudioUrl) && (
                <button
                  type="button"
                  onClick={toggleMute}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                  title={isMuted ? "Bật âm" : "Tắt âm"}
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
              )}

              {/* Nút Tạo lại audio (Self-Healing) */}
              <button
                type="button"
                onClick={handleRepairListeningAudio}
                disabled={isRepairingListeningAudio}
                title="Tự sửa lỗi: Tái tạo audio bài nghe từ máy chủ nếu file bị hỏng hoặc không tải được"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer border border-amber-400/40 bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 disabled:opacity-50"
              >
                <RotateCcw className={`h-3.5 w-3.5 ${isRepairingListeningAudio ? "animate-spin text-amber-400" : ""}`} />
                <span>{isRepairingListeningAudio ? "Đang tạo lại..." : "Tạo lại audio"}</span>
              </button>

              <button
                type="button"
                onClick={playAiVoiceTranscript}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer border ${
                  isPlayingAiVoice
                    ? "bg-rose-500 text-white border-rose-400 animate-pulse"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400"
                }`}
                title={isPlayingAiVoice ? "Dừng giọng đọc AI" : "Phát đọc toàn bộ đoạn nghe bằng Web Speech AI"}
              >
                {isPlayingAiVoice ? <Square size={13} /> : <Sparkles size={13} className="text-amber-300" />}
                <span>{isPlayingAiVoice ? "Dừng AI" : "Voice AI Đoạn Văn"}</span>
              </button>

              {/* Chỉ cho phép xem transcript sau khi học sinh hoàn thành và nộp bài */}
              {phase === "REVIEW" && (
                <button
                  type="button"
                  onClick={() => setShowListeningScript(!showListeningScript)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer border ${
                    showListeningScript
                      ? "bg-amber-400 text-slate-950 border-amber-300"
                      : "bg-white/10 hover:bg-white/20 text-white border-white/20"
                  }`}
                  title="Xem kịch bản nội dung bài nghe (Khả dụng sau khi nộp bài)"
                >
                  <FileText size={13} />
                  <span>{showListeningScript ? "Ẩn Transcript" : "Xem Transcript"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Panel kịch bản bài nghe liên tục chỉ mở khi đã nộp bài (phase === REVIEW) */}
          {phase === "REVIEW" && showListeningScript && (
            <div className="mt-3.5 p-4 rounded-xl bg-slate-900/95 border border-indigo-500/30 text-indigo-100 text-xs leading-relaxed max-h-72 overflow-y-auto animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between font-bold text-amber-300 mb-2 border-b border-white/10 pb-2">
                <span className="flex items-center gap-2 uppercase tracking-wider text-xs">
                  <Headphones size={14} /> Full Audio Transcript (Kịch bản bài nghe đồng bộ đa nhân vật)
                </span>
                <button
                  type="button"
                  onClick={() => setShowListeningScript(false)}
                  className="text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  ✕ Đóng
                </button>
              </div>

              {listeningSegments && listeningSegments.length > 0 ? (
                <div className="space-y-2">
                  {listeningSegments.map((seg, idx) => {
                    const currentMs = audioCurrentTime * 1000;
                    const isActive = currentMs >= seg.startMs && currentMs <= seg.endMs;
                    return (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-lg transition-all border ${
                          isActive
                            ? "bg-indigo-900/60 border-amber-400 shadow-md ring-1 ring-amber-400/50"
                            : "bg-slate-800/40 border-slate-700/60"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className={`font-black ${isActive ? "text-amber-300" : "text-indigo-300"}`}>
                            {seg.speaker}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {formatTimer(Math.floor(seg.startMs / 1000))} - {formatTimer(Math.floor(seg.endMs / 1000))}
                            {seg.voice && ` • ${seg.voice}`}
                          </span>
                        </div>
                        <p className={`text-sm ${isActive ? "text-white font-medium" : "text-slate-300"}`}>
                          {seg.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-200">
                  {listeningPassageText ||
                    questions
                      .map((q, i) => `[Câu ${i + 1}]: ${(q as any).transcript || q.promptText}`)
                      .join("\n\n")}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. THÂN TRANG THI: CỘT BÀI ĐỌC (NẾU CÓ) + TOÀN BỘ CÂU HỎI + SIDEBAR ĐIỀU HƯỚNG */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================================= */}
        {/* CỘT TRÁI: BÀI ĐỌC READING PASSAGE (NẾU ĐỀ CÓ BÀI ĐỌC DÀI)                 */}
        {/* ========================================================================= */}
        {Boolean(readingPassageText) && (
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col h-[calc(100vh-140px)] sticky top-20">
            <div className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between rounded-t-2xl">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <BookOpen size={16} className="text-indigo-600 dark:text-indigo-400" /> READING
                PASSAGE
              </span>
              <span className="text-[11px] font-semibold text-slate-400 italic">
                Bôi đen văn bản để highlight
              </span>
            </div>
            <div
              ref={passageContainerRef}
              className={`p-6 md:p-8 overflow-y-auto leading-loose text-slate-800 dark:text-slate-200 font-serif select-text ${
                fontSizeLevel === "normal"
                  ? "text-base"
                  : fontSizeLevel === "large"
                    ? "text-lg"
                    : "text-xl"
              }`}
            >
              {readingPassageText.split(/\n\s*\n/).map((para: string, pIdx: number) => (
                <p key={pIdx} className="mb-5 text-justify">
                  {para}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CỘT CHÍNH: HIỂN THỊ TOÀN BỘ CÁC CÂU HỎI CUỘN LIÊN TỤC TRÊN 1 TRANG        */}
        {/* ========================================================================= */}
        <div
          className={`${
            readingPassageText ? "lg:col-span-5" : "lg:col-span-9"
          } space-y-6`}
        >
          {/* BANNER THỐNG KÊ KẾT QUẢ & ĐIỀU KIỆN LÀM LẠI (REMEDIAL BANNER TRONG PHASE REVIEW) */}
          {phase === "REVIEW" && retakeEvaluation && (
            <div
              className={`p-5 rounded-2xl border-2 transition-all shadow-sm ${
                retakeEvaluation.isEssay
                  ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-950 dark:text-blue-100"
                  : retakeEvaluation.canRetry
                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/80 text-amber-950 dark:text-amber-100"
                  : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/80 text-emerald-950 dark:text-emerald-100"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div
                    className={`p-2.5 rounded-xl shrink-0 ${
                      retakeEvaluation.isEssay
                        ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300"
                        : retakeEvaluation.canRetry
                        ? "bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300"
                        : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300"
                    }`}
                  >
                    {retakeEvaluation.isEssay ? (
                      <Clock size={24} />
                    ) : retakeEvaluation.canRetry ? (
                      <AlertCircle size={24} />
                    ) : (
                      <CheckCircle2 size={24} />
                    )}
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-black text-base flex items-center gap-2">
                      {retakeEvaluation.isEssay
                        ? "Bài Tự Luận Đang Chờ Đánh Giá"
                        : retakeEvaluation.canRetry
                        ? `Kết quả bài làm chưa đạt chuẩn (Sai ${Math.round(retakeEvaluation.errorRate)}%)`
                        : "Chúc Mừng! Đã Đạt Chuẩn Kiến Thức"}
                    </h3>
                    <p className="text-sm font-medium opacity-90 leading-relaxed">
                      {retakeEvaluation.isEssay
                        ? "Bài viết đã được gửi thành công, đang chờ chấm điểm."
                        : retakeEvaluation.canRetry
                        ? `Kết quả bài làm chưa đạt chuẩn (Sai ${Math.round(retakeEvaluation.errorRate)}%). Bạn cần làm lại bài tập này để củng cố kiến thức!`
                        : "Bạn đã hoàn thành xuất sắc bài tập với điểm số cao. Hãy tiếp tục duy trì phong độ!"}
                    </p>
                  </div>
                </div>

                {retakeEvaluation.canRetry && !retakeEvaluation.isEssay && (
                  <button
                    type="button"
                    disabled={isStarting}
                    onClick={handleStartNewAttempt}
                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-black text-sm shadow-md shadow-amber-200 dark:shadow-none transition cursor-pointer shrink-0"
                  >
                    {isStarting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <RotateCcw size={16} />
                    )}
                    <span>Làm Lại Bài Ngay</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {questions.length === 0 ? (
            <div className="p-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
              bài tập chưa có câu hỏi nào.
            </div>
          ) : isVocabMatching ? (
            <VocabularyMatchingBoard
              questions={questions}
              answers={answers}
              onAnswersChange={handleMatchingAnswers}
              disabled={isSubmitting || phase === "REVIEW"}
              isReview={phase === "REVIEW"}
              resolveAudioUrl={resolveAudioUrl}
            />
          ) : (
            questions.map((q, idx) => {
              const rawType = String(q.questionType || "").toUpperCase();
              const isSpeaking =
                rawType === "AUDIO_RESPONSE" || rawType === "SPEAKING";
              const asgDescLower = (
                (attempt as any)?.assignmentDescription ||
                (attempt as any)?.description ||
                ""
              ).toLowerCase();
              const asgTitleLower = (attempt?.assignmentTitle || "").toLowerCase();
              const isExplicitShadowing =
                asgDescLower.includes("shadowing") ||
                asgTitleLower.includes("shadowing") ||
                asgTitleLower.includes("nhại") ||
                q.promptText?.toLowerCase().includes("shadowing") ||
                q.promptText?.toLowerCase().includes("repeat") ||
                q.promptText?.toLowerCase().includes("nhại") ||
                (Boolean(q.correctAnswer) &&
                  Boolean(q.promptText) &&
                  q.promptText
                    .toLowerCase()
                    .includes(String(q.correctAnswer).toLowerCase())) ||
                Boolean(
                  (q.audioUrl || (q as any).mediaUrl) &&
                    !q.promptText?.trim().endsWith("?"),
                );
              const isSpeakingShadowing = isSpeaking && isExplicitShadowing;
              const isSpeakingQA = isSpeaking && !isExplicitShadowing;

              const isMultipleChoice = rawType === "MULTIPLE_CHOICE";
              const isTrueFalse = rawType === "TRUE_FALSE";
              const isFillBlank = rawType === "FILL_IN_BLANK";

              // Rút gọn phần prompt nếu câu hỏi cũ có lặp lại tiêu đề / đoạn văn Reading Passage
              let displayPrompt = q.promptText || "";
              if (displayPrompt.toUpperCase().includes("READING PASSAGE")) {
                const markerIdx = displayPrompt.toUpperCase().indexOf("READING PASSAGE");
                const afterMarker = displayPrompt.slice(markerIdx);
                const doubleNewline = afterMarker.lastIndexOf("\n\n");
                if (doubleNewline !== -1) {
                  displayPrompt = afterMarker.slice(doubleNewline + 2).trim();
                } else {
                  displayPrompt = displayPrompt.replace(/\[?READING PASSAGE\]?:?/gi, "").trim();
                }
              }

              const hasAudioMedia = Boolean(q.mediaUrl || (q as any).audioUrl);
              const isListeningWord =
                (isVocabTest || displayPrompt.includes("[LISTEN_WORD]") || displayPrompt.includes("[LISTEN_SPELL]")) &&
                !isSpeaking &&
                !isListeningTest;

              const cleanDisplayPrompt = displayPrompt
                .replace(/\[LISTEN_WORD\]\s*/gi, "")
                .replace(/\[LISTEN_SPELL\]\s*/gi, "");

              // Phân loại dạng bài Writing chi tiết (3 cấp độ: Câu ngắn -> Đoạn văn 50-150 từ -> Bài luận IELTS)
              const isPromptSentenceFill =
                cleanDisplayPrompt.includes("___") ||
                cleanDisplayPrompt.includes(" / ") ||
                cleanDisplayPrompt.toLowerCase().includes("sắp xếp") ||
                cleanDisplayPrompt.toLowerCase().includes("hoàn thành câu") ||
                cleanDisplayPrompt.toLowerCase().includes("viết lại câu") ||
                cleanDisplayPrompt.toLowerCase().includes("từ gợi ý") ||
                (cleanDisplayPrompt.length < 130 && cleanDisplayPrompt.includes("(") && cleanDisplayPrompt.includes(")"));

              const isSentenceWriting =
                !isSpeaking &&
                (isFillBlank ||
                  rawType.includes("ARRANGE") ||
                  rawType.includes("UNSCRAMBLE") ||
                  ((rawType === "ESSAY" || rawType === "WRITING") && isPromptSentenceFill));

              const isParagraphWriting =
                !isSpeaking &&
                !isSentenceWriting &&
                (rawType === "ESSAY" || rawType === "WRITING") &&
                (cleanDisplayPrompt.toLowerCase().includes("paragraph") ||
                  cleanDisplayPrompt.toLowerCase().includes("đoạn văn") ||
                  cleanDisplayPrompt.toLowerCase().includes("opinion paragraph") ||
                  cleanDisplayPrompt.toLowerCase().includes("30-80") ||
                  cleanDisplayPrompt.toLowerCase().includes("50-80") ||
                  cleanDisplayPrompt.toLowerCase().includes("100-150") ||
                  cleanDisplayPrompt.toLowerCase().includes("120-150") ||
                  cleanDisplayPrompt.toLowerCase().includes("120-180") ||
                  (attempt as any)?.description?.toLowerCase().includes("paragraph") ||
                  (attempt as any)?.description?.toLowerCase().includes("đoạn văn") ||
                  (!cleanDisplayPrompt.toLowerCase().includes("task 1") &&
                   !cleanDisplayPrompt.toLowerCase().includes("task 2") &&
                   !cleanDisplayPrompt.toLowerCase().includes("ielts") &&
                   !cleanDisplayPrompt.toLowerCase().includes("250 từ") &&
                   !cleanDisplayPrompt.toLowerCase().includes("250 words") &&
                   cleanDisplayPrompt.length < 350));

              const isIeltsEssay =
                !isSpeaking &&
                !isSentenceWriting &&
                !isParagraphWriting &&
                (rawType === "ESSAY" || rawType === "WRITING");

              const isWordUnscramble =
                isSentenceWriting &&
                (cleanDisplayPrompt.includes(" / ") ||
                  cleanDisplayPrompt.toLowerCase().includes("sắp xếp") ||
                  rawType.includes("ARRANGE") ||
                  rawType.includes("UNSCRAMBLE"));

              // Lấy danh sách options (hỗ trợ cả options từ backend lẫn fallback)
              const options =
                (q as any).options && (q as any).options.length > 0
                  ? (q as any).options
                  : isMultipleChoice
                    ? [
                        { id: "A", optionLabel: "A", text: "Option A" },
                        { id: "B", optionLabel: "B", text: "Option B" },
                        { id: "C", optionLabel: "C", text: "Option C" },
                        { id: "D", optionLabel: "D", text: "Option D" },
                      ]
                    : [];

              return (
                <div
                  key={q.questionId}
                  id={`question-${q.questionId}`}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-sm space-y-5 transition hover:border-slate-300 dark:hover:border-slate-700 scroll-mt-24"
                >
                  {/* Header của từng câu hỏi */}
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-md border border-indigo-200 dark:border-indigo-800">
                        CÂU HỎI {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        ({isSpeakingQA
                          ? "SPEAKING Q&A"
                          : isSpeakingShadowing
                          ? "SHADOWING"
                          : isWordUnscramble
                          ? "SẮP XẾP TỪ"
                          : isSentenceWriting
                          ? "HOÀN THÀNH CÂU"
                          : isParagraphWriting
                          ? "VIẾT ĐOẠN VĂN"
                          : isIeltsEssay
                          ? "BÀI LUẬN IELTS"
                          : isTrueFalse
                          ? "ĐÚNG / SAI"
                          : "TRẮC NGHIỆM"})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isSpeaking && isVocabTest && !isListeningTest && (
                        <button
                          type="button"
                          onClick={() => playVocabularyAudio(q)}
                          className={`p-1.5 rounded-lg border transition cursor-pointer ${
                            playingQuestionId === q.questionId
                              ? "bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 shadow-xs"
                              : "bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 border-slate-200 dark:border-slate-700"
                          }`}
                          title="Nghe phát âm từ vựng chuẩn (Audio Pronunciation)"
                        >
                          <Volume2
                            size={15}
                            className={playingQuestionId === q.questionId ? "animate-bounce text-indigo-600 dark:text-indigo-300" : ""}
                          />
                        </button>
                      )}
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                        {q.maxPoints} pts
                      </span>
                    </div>
                  </div>

                  {/* Nội dung câu hỏi (chỉ hiện cho các dạng bài ngoài Speaking) */}
                  {!isSpeaking && (
                    <div className="text-base md:text-lg font-bold text-slate-900 dark:text-slate-100 leading-relaxed whitespace-pre-wrap">
                      {cleanDisplayPrompt}
                    </div>
                  )}

                  {/* Banner nghe phát âm từ vựng (CHỈ hiển thị cho bài tập TỪ VỰNG - VOCABULARY) */}
                  {isListeningWord && (
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                        <Volume2
                          className={`h-4 w-4 text-amber-600 dark:text-amber-400 ${
                            playingQuestionId === q.questionId ? "animate-bounce text-amber-800 dark:text-amber-300" : "animate-pulse"
                          }`}
                        />
                        <span>
                          {hasAudioMedia
                            ? "Nghe phát âm chuẩn người bản xứ từ Từ điển (Native Audio MP3)"
                            : "Bấm nút để nghe phát âm từ vựng chuẩn (Audio Pronunciation)"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => playVocabularyAudio(q)}
                        className={`px-4 py-2 rounded-lg text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                          playingQuestionId === q.questionId
                            ? "bg-amber-800 ring-2 ring-amber-400"
                            : "bg-amber-600 hover:bg-amber-700"
                        }`}
                      >
                        <Volume2 size={15} className={playingQuestionId === q.questionId ? "animate-bounce" : ""} />
                        {playingQuestionId === q.questionId ? "Đang phát audio..." : "Nghe phát âm từ"}
                      </button>
                    </div>
                  )}

                  {/* Script/Transcript tham khảo (CHỈ hiển thị sau khi học sinh hoàn thành và nộp bài, cho các bài KHÔNG phải LISTENING vì LISTENING đã có khung transcript toàn bài ở đầu) */}
                  {phase === "REVIEW" && !isListeningTest && Boolean((q as any).transcript) && (
                    <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-1.5 animate-in fade-in">
                      <div className="flex items-center gap-2 text-xs font-black text-indigo-900 uppercase tracking-wide">
                        <FileText size={14} className="text-indigo-600" />
                        <span>Kịch bản nghe đối chiếu (Reference Script / Transcript):</span>
                      </div>
                      <p className="text-xs text-indigo-800 leading-relaxed italic bg-white p-3 rounded-lg border border-indigo-100 font-sans">
                        "{String((q as any).transcript)}"
                      </p>
                    </div>
                  )}

                  {/* 1A. DẠNG BÀI SẮP XẾP TỪ THÀNH CÂU (WORD UNSCRAMBLE INTERACTIVE) */}
                  {isSentenceWriting && isWordUnscramble && (
                    <div className="pt-2">
                      <WordUnscrambleInteractive
                        promptText={cleanDisplayPrompt}
                        currentAnswer={answers[q.questionId]?.textAnswer || ""}
                        onAnswerChange={(ans) =>
                          updateAnswer(q.questionId, { textAnswer: ans })
                        }
                      />
                    </div>
                  )}

                  {/* 1B. DẠNG BÀI ĐIỀN TỪ / HOÀN THÀNH CÂU / TỪ GỢI Ý (SENTENCE LEVEL) */}
                  {isSentenceWriting && !isWordUnscramble && (
                    <div className="pt-2">
                      <div className="p-4 rounded-xl border border-dashed border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20">
                        <label className="block text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-200 mb-2">
                          {cleanDisplayPrompt.includes("______") || cleanDisplayPrompt.includes("...")
                            ? "Nhập từ hoặc câu trả lời vào ô trống:"
                            : "Nhập câu tiếng Anh hoàn chỉnh của bạn:"}
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Gõ từ hoặc câu trả lời hoàn chỉnh vào đây..."
                          value={answers[q.questionId]?.textAnswer || ""}
                          onChange={(e) =>
                            updateAnswer(q.questionId, {
                              textAnswer: e.target.value,
                            })
                          }
                          className="w-full border-b-2 border-indigo-600 pb-2 text-base md:text-lg font-bold text-slate-900 dark:text-slate-100 outline-none bg-transparent placeholder:font-medium placeholder:text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* 2. DẠNG BÀI TRẮC NGHIỆM (MULTIPLE CHOICE) */}
                  {isMultipleChoice && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {options.map((opt: any) => {
                        const optId = opt.id || opt.optionLabel || opt.text;
                        const isChecked =
                          answers[q.questionId]?.selectedOptionId === optId;

                        return (
                          <div
                            key={optId}
                            onClick={() =>
                              updateAnswer(q.questionId, {
                                selectedOptionId: optId,
                              })
                            }
                            className={`flex items-center gap-3.5 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                              isChecked
                                ? "border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 dark:border-indigo-500 shadow-sm"
                                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                            }`}
                          >
                            <span
                              className={`h-7 w-7 rounded-full flex items-center justify-center font-black text-xs border-2 shrink-0 ${
                                isChecked
                                  ? "border-indigo-600 bg-indigo-600 text-white"
                                  : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                              }`}
                            >
                              {opt.optionLabel || "•"}
                            </span>
                            <span
                              className={`text-sm md:text-base font-bold ${
                                isChecked ? "text-indigo-950 dark:text-indigo-200" : "text-slate-800 dark:text-slate-200"
                              }`}
                            >
                              {opt.optionText || opt.text}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 3. DẠNG BÀI TRUE / FALSE / NOT GIVEN */}
                  {isTrueFalse && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      {["TRUE", "FALSE", "NOT GIVEN"].map((val) => {
                        const currentSelected =
                          answers[q.questionId]?.selectedOptionId;
                        const isSelected =
                          currentSelected === val ||
                          (val === "TRUE" && currentSelected === "true") ||
                          (val === "FALSE" && currentSelected === "false");

                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() =>
                              updateAnswer(q.questionId, {
                                selectedOptionId: val,
                                textAnswer: val,
                              })
                            }
                            className={`py-3.5 px-3 rounded-xl border-2 font-black text-sm flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                              isSelected
                                ? val === "TRUE"
                                  ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 shadow-md ring-2 ring-emerald-500/20"
                                  : val === "FALSE"
                                    ? "border-rose-600 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 shadow-md ring-2 ring-rose-500/20"
                                    : "border-slate-700 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-md ring-2 ring-slate-500/20"
                                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                            }`}
                          >
                            <span>{val}</span>
                            <span className="text-[10px] font-bold opacity-75 uppercase">
                              {val === "TRUE"
                                ? "Đúng"
                                : val === "FALSE"
                                  ? "Sai"
                                  : "Không có trong bài"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* 4. DẠNG BÀI SPEAKING: SHADOWING HOẶC HỎI - ĐÁP (Q&A) */}
                  {isSpeakingShadowing && (
                    <SpeakingShadowingStudio
                      questionId={q.questionId}
                      studentAnswerId={q.studentAnswerId || q.id}
                      referenceSentence={
                        cleanShadowingSentence(
                          (q.correctAnswer && !q.correctAnswer.toLowerCase().includes("answer should") && !q.correctAnswer.toLowerCase().includes("presentation response"))
                            ? q.correctAnswer
                            : displayPrompt
                        )
                      }
                      referenceAudioUrl={
                        q.mediaUrl && !q.mediaUrl.includes("translate.google") && !q.mediaUrl.includes("dictvoice")
                          ? resolveAudioUrl(q.mediaUrl)
                          : undefined
                      }
                      savedAudioUrl={answers[q.questionId]?.audioUrl || q.audioUrl}
                      onAudioSubmitted={(blob) => {
                        handleUploadSpeaking(q.questionId, blob);
                      }}
                    />
                  )}

                  {isSpeakingQA && (
                    <SpeakingQAStudio
                      questionId={q.questionId}
                      studentAnswerId={q.studentAnswerId || q.id}
                      promptQuestion={
                        displayPrompt || "Please answer the interview question."
                      }
                      guidelines={q.explanation}
                      keyPoints={q.correctAnswer}
                      savedAudioUrl={answers[q.questionId]?.audioUrl}
                      onAudioSubmitted={(blob) => {
                        handleUploadSpeaking(q.questionId, blob);
                      }}
                    />
                  )}

                  {/* 5A. DẠNG BÀI VIẾT ĐOẠN VĂN CÓ HƯỚNG DẪN (PARAGRAPH WRITING STUDIO) */}
                  {isParagraphWriting && (
                    <ParagraphWritingStudio
                      promptText={cleanDisplayPrompt}
                      explanation={q.explanation}
                      currentParagraph={answers[q.questionId]?.textAnswer || ""}
                      onParagraphChange={(text) =>
                        updateAnswer(q.questionId, { textAnswer: text })
                      }
                      studentAnswerId={q.studentAnswerId || q.id}
                      modelAnswer={q.correctAnswer}
                    />
                  )}

                  {/* 5B. DẠNG BÀI LUẬN IELTS TASK 1 / TASK 2 (5-STEP SCAFFOLDING STUDIO) */}
                  {isIeltsEssay && (
                    <WritingScaffoldingStudio
                      promptText={cleanDisplayPrompt}
                      explanation={q.explanation}
                      currentEssay={answers[q.questionId]?.textAnswer || ""}
                      onEssayChange={(text) =>
                        updateAnswer(q.questionId, { textAnswer: text })
                      }
                      studentAnswerId={q.studentAnswerId || q.id}
                    />
                  )}

                  {/* 6. CHẾ ĐỘ LUYỆN TẬP: NÚT GỢI Ý & KIỂM TRA ĐÁP ÁN TỨC THÌ */}
                  {studyMode === "PRACTICE" && !isSpeaking && !isParagraphWriting && !isIeltsEssay && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        {/* Nút Xem Gợi Ý */}
                        {q.explanation && (
                          <button
                            type="button"
                            onClick={() => toggleHint(q.questionId)}
                            className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/25 border border-amber-200 dark:border-amber-500/30 px-3.5 py-2 rounded-xl transition cursor-pointer"
                          >
                            <Lightbulb size={14} className="text-amber-600 dark:text-amber-400" />
                            <span>{expandedHints[q.questionId] ? "Ẩn gợi ý" : "Xem gợi ý & quy tắc"}</span>
                          </button>
                        )}

                        <div className="flex items-center gap-2 ml-auto">
                          {checkedQuestions[q.questionId]?.isChecked ? (
                            <button
                              type="button"
                              onClick={() => handleRetryQuestion(q.questionId)}
                              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-4 py-2 rounded-xl transition cursor-pointer"
                            >
                              <RotateCcw size={13} />
                              <span>Làm lại câu này</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={checkedQuestions[q.questionId]?.isEvaluating}
                              onClick={() => handleCheckAnswer(q)}
                              className="flex items-center gap-1.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-5 py-2 rounded-xl shadow-xs transition cursor-pointer"
                            >
                              {checkedQuestions[q.questionId]?.isEvaluating ? (
                                <>
                                  <Loader2 size={14} className="animate-spin" />
                                  <span>AI đang chấm...</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 size={14} />
                                  <span>Kiểm tra đáp án</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Hộp Gợi Ý khi mở */}
                      {expandedHints[q.questionId] && q.explanation && (
                        <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 animate-in fade-in">
                          <b className="flex items-center gap-1 text-amber-950 dark:text-amber-300 mb-1">
                            💡 Gợi ý / Quy tắc:
                          </b>
                          <p className="leading-relaxed whitespace-pre-wrap">{q.explanation}</p>
                        </div>
                      )}

                      {/* Hộp Phản Hồi Sư Phạm Sau Khi Kiểm Tra */}
                      {checkedQuestions[q.questionId]?.isChecked && !checkedQuestions[q.questionId]?.isEvaluating && (
                        <div className={`p-4 rounded-xl border-2 space-y-2 animate-in fade-in ${
                          checkedQuestions[q.questionId]?.isCorrect
                            ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-200"
                            : checkedQuestions[q.questionId]?.isContentCorrect
                              ? "bg-blue-50/70 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 text-blue-950 dark:text-blue-200"
                              : "bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-700 text-rose-950 dark:text-rose-200"
                        }`}>
                          <div className="flex items-center gap-2">
                            {checkedQuestions[q.questionId]?.isCorrect ? (
                              <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                            ) : checkedQuestions[q.questionId]?.isContentCorrect ? (
                              <AlertCircle size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
                            ) : (
                              <XCircle size={18} className="text-rose-600 dark:text-rose-400 shrink-0" />
                            )}
                            <span className="font-black text-sm">
                              {checkedQuestions[q.questionId]?.isCorrect
                                ? "Chính xác tuyệt đối!"
                                : checkedQuestions[q.questionId]?.isContentCorrect
                                  ? "Hiểu đúng bài đọc (Cần lưu ý lỗi ngữ pháp)"
                                  : "Chưa chính xác"}
                            </span>

                            {/* Badges phân biệt hiểu ý vs ngữ pháp */}
                            {checkedQuestions[q.questionId]?.isContentCorrect !== undefined && (
                              <div className="flex items-center gap-1.5 ml-auto text-[11px] font-black">
                                <span className={`px-2 py-0.5 rounded ${
                                  checkedQuestions[q.questionId]?.isContentCorrect
                                    ? "bg-emerald-200 dark:bg-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                                    : "bg-rose-200 dark:bg-rose-500/30 text-rose-900 dark:text-rose-200"
                                }`}>
                                  Đọc hiểu: {checkedQuestions[q.questionId]?.isContentCorrect ? "✓ ĐÚNG" : "✗ SAI"}
                                </span>
                                <span className={`px-2 py-0.5 rounded ${
                                  checkedQuestions[q.questionId]?.isGrammarCorrect
                                    ? "bg-emerald-200 dark:bg-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                                    : "bg-amber-200 dark:bg-amber-500/30 text-amber-900 dark:text-amber-200"
                                }`}>
                                  Ngữ pháp: {checkedQuestions[q.questionId]?.isGrammarCorrect ? "✓ CHUẨN" : "⚠️ CẦN SỬA"}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Nhận xét chi tiết */}
                          {checkedQuestions[q.questionId]?.feedback && (
                            <p className="text-xs leading-relaxed font-medium">
                              {checkedQuestions[q.questionId]?.feedback}
                            </p>
                          )}

                          {/* Nhận xét ngữ pháp riêng nếu có */}
                          {checkedQuestions[q.questionId]?.grammarAnalysis && (
                            <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-100/60 dark:bg-amber-950/40 p-2.5 rounded-lg font-medium">
                              <b>Lưu ý ngữ pháp:</b> {checkedQuestions[q.questionId]?.grammarAnalysis}
                            </p>
                          )}

                          {/* Trích dẫn đoạn văn chứng minh nếu có */}
                          {checkedQuestions[q.questionId]?.contentAnalysis && (
                            <div className="text-xs text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 font-serif">
                              <b>Trích dẫn bài đọc:</b> "{checkedQuestions[q.questionId]?.contentAnalysis}"
                            </div>
                          )}

                          {/* Đáp án mẫu gợi ý */}
                          {checkedQuestions[q.questionId]?.suggestedAnswer && (
                            <div className="text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                              <span className="font-bold opacity-75">Đáp án gợi ý: </span>
                              <span className="font-black text-indigo-700 dark:text-indigo-400">
                                {checkedQuestions[q.questionId]?.suggestedAnswer}
                              </span>
                            </div>
                          )}

                          {/* Giải thích chi tiết từ đề bài */}
                          {!checkedQuestions[q.questionId]?.isContentCorrect && q.explanation && (
                            <div className="text-xs pt-1 text-slate-600 dark:text-slate-300">
                              <b>Giải thích:</b> {q.explanation}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 7. KẾT QUẢ ĐÁNH GIÁ & LỜI GIẢI SAU KHI NỘP BÀI (phase === REVIEW) */}
                  {phase === "REVIEW" && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                            <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
                            Đánh giá kết quả & Lời giải:
                          </span>
                          {(q as any).earnedPoints != null && (
                            <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-indigo-600 text-white">
                              +{(q as any).earnedPoints} / {q.maxPoints} pts
                            </span>
                          )}
                        </div>

                        {Boolean(q.correctAnswer) && (
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            <span className="text-emerald-700 dark:text-emerald-400">Đáp án chính xác: </span>
                            <span className="font-mono bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/30 font-black">
                              {q.correctAnswer}
                            </span>
                          </div>
                        )}

                        {Boolean((q as any).explanation) && (
                          <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                            <b className="text-slate-900 dark:text-white block mb-1">💡 Lời giải chi tiết:</b>
                            <p className="whitespace-pre-wrap">{(q as any).explanation}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ========================================================================= */}
        {/* CỘT PHẢI: BẢNG ĐIỀU HƯỚNG CÂU HỎI (QUESTION PALETTE) CỐ ĐỊNH               */}
        {/* ========================================================================= */}
        <div
          className={`${
            readingPassageText ? "lg:col-span-2" : "lg:col-span-3"
          } bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-5 sticky top-20`}
        >
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
            <h2 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">
              Bảng Câu Hỏi
            </h2>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded">
              {answeredQuestionsCount}/{questions.length} câu
            </span>
          </div>

          {/* Lưới các nút câu hỏi */}
          <div className="grid grid-cols-4 gap-2">
            {questions.map((q, idx) => {
              const ans = answers[q.questionId];
              const isDone = Boolean(
                ans?.selectedOptionId ||
                (ans?.textAnswer && ans.textAnswer.trim().length > 0) ||
                ans?.audioUrl,
              );

              return (
                <button
                  key={q.questionId}
                  type="button"
                  onClick={() => scrollToQuestion(q.questionId)}
                  className={`h-10 rounded-xl text-xs font-black transition-all border flex items-center justify-center cursor-pointer ${
                    isDone
                      ? "bg-emerald-500 border-emerald-600 text-white shadow-sm"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                  }`}
                  title={`Bấm để cuộn đến câu hỏi ${idx + 1}`}
                >
                  {isDone ? (
                    <span className="flex items-center gap-0.5">
                      {idx + 1}
                      <Check size={11} strokeWidth={3} />
                    </span>
                  ) : (
                    idx + 1
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-md bg-emerald-500 inline-block shadow-xs" />
              <span>Đã trả lời xong</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 inline-block" />
              <span>Chưa hoàn thành</span>
            </div>
          </div>

          {phase === "REVIEW" ? null : (
            <button
              type="button"
              onClick={handleSubmitTest}
              disabled={isSubmitting || isUploadingAudio}
              className="w-full mt-4 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black py-3 rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              <span>Nộp Toàn Bộ bài tập</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
