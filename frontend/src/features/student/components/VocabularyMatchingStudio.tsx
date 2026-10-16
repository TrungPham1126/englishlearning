// src/features/student/components/VocabularyMatchingStudio.tsx
import React, { useState, useMemo, useEffect } from "react";
import {
  Volume2,
  Sparkles,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Link2,
  Unlink,
  Check,
  BookOpen,
  ArrowRight,
  HelpCircle,
  Flame,
} from "lucide-react";
import type { QuestionResultDetail } from "@/features/student/types";

export interface VocabularyMatchingStudioProps {
  questions: QuestionResultDetail[];
  answers: Record<
    string,
    { selectedOptionId?: string; textAnswer?: string; audioUrl?: string }
  >;
  onUpdateAnswer: (
    questionId: string,
    partial: { selectedOptionId?: string; textAnswer?: string }
  ) => void;
  disabled?: boolean;
  isReview?: boolean;
  resolveAudioUrl?: (url?: string) => string;
}

interface ParsedWordItem {
  questionId: string;
  index: number;
  word: string;
  ipa: string;
  audioUrl?: string;
  rawPrompt: string;
  explanation?: string;
  correctAnswer?: string;
  isCorrect?: boolean;
  options: {
    id: string;
    label: string;
    text: string;
    isCorrect?: boolean;
  }[];
}

// Bảng màu phân biệt các cặp từ đã nối
const PAIR_COLORS = [
  {
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    border: "border-indigo-400 dark:border-indigo-600",
    text: "text-indigo-700 dark:text-indigo-300",
    badge: "bg-indigo-600 text-white",
    glow: "shadow-indigo-100 dark:shadow-indigo-900/30",
  },
  {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-400 dark:border-emerald-600",
    text: "text-emerald-700 dark:text-emerald-300",
    badge: "bg-emerald-600 text-white",
    glow: "shadow-emerald-100 dark:shadow-emerald-900/30",
  },
  {
    bg: "bg-sky-50 dark:bg-sky-950/40",
    border: "border-sky-400 dark:border-sky-600",
    text: "text-sky-700 dark:text-sky-300",
    badge: "bg-sky-600 text-white",
    glow: "shadow-sky-100 dark:shadow-sky-900/30",
  },
  {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-400 dark:border-amber-600",
    text: "text-amber-700 dark:text-amber-300",
    badge: "bg-amber-600 text-white",
    glow: "shadow-amber-100 dark:shadow-amber-900/30",
  },
  {
    bg: "bg-purple-50 dark:bg-purple-950/40",
    border: "border-purple-400 dark:border-purple-600",
    text: "text-purple-700 dark:text-purple-300",
    badge: "bg-purple-600 text-white",
    glow: "shadow-purple-100 dark:shadow-purple-900/30",
  },
  {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-400 dark:border-rose-600",
    text: "text-rose-700 dark:text-rose-300",
    badge: "bg-rose-600 text-white",
    glow: "shadow-rose-100 dark:shadow-rose-900/30",
  },
  {
    bg: "bg-teal-50 dark:bg-teal-950/40",
    border: "border-teal-400 dark:border-teal-600",
    text: "text-teal-700 dark:text-teal-300",
    badge: "bg-teal-600 text-white",
    glow: "shadow-teal-100 dark:shadow-teal-900/30",
  },
  {
    bg: "bg-cyan-50 dark:bg-cyan-950/40",
    border: "border-cyan-400 dark:border-cyan-600",
    text: "text-cyan-700 dark:text-cyan-300",
    badge: "bg-cyan-600 text-white",
    glow: "shadow-cyan-100 dark:shadow-cyan-900/30",
  },
];

export const VocabularyMatchingStudio: React.FC<VocabularyMatchingStudioProps> = ({
  questions,
  answers,
  onUpdateAnswer,
  disabled = false,
  isReview = false,
  resolveAudioUrl,
}) => {
  const [activeWordId, setActiveWordId] = useState<string | null>(null);
  const [playingWord, setPlayingWord] = useState<string | null>(null);

  // 1. Phân tích và trích xuất danh sách Từ tiếng Anh + Phiên âm IPA + Lựa chọn
  const wordItems = useMemo<ParsedWordItem[]>(() => {
    return questions.map((q, idx) => {
      let word =
        (q as any).targetWord ||
        (q as any).word ||
        "";
      let ipa = (q as any).ipa || "";
      const prompt = q.promptText || "";

      // Trích xuất IPA nếu có trong prompt hoặc explanation
      if (!ipa) {
        const ipaMatch =
          prompt.match(/\/[^\/\n\r]+?\//) ||
          (q.explanation || "").match(/\/[^\/\n\r]+?\//);
        if (ipaMatch) {
          ipa = ipaMatch[0];
        }
      }

      // Trích xuất từ tiếng Anh nếu chưa có
      if (!word) {
        const quoteMatch = prompt.match(/['"“]([a-zA-Z\s'-]+)['"”]/);
        if (quoteMatch && quoteMatch[1] && quoteMatch[1].trim().length < 35) {
          word = quoteMatch[1].trim();
        } else {
          const cleanPrompt = prompt
            .replace(/\[.*?\]/g, "")
            .replace(/^câu\s*\d+[:.\s]*/i, "")
            .replace(/^\d+[\.\)\-–—]\s*/, "");
          const beforeIpa = cleanPrompt.split("/")[0].trim();
          if (
            beforeIpa &&
            beforeIpa.length < 35 &&
            !beforeIpa.toLowerCase().includes("chọn") &&
            !beforeIpa.toLowerCase().includes("định nghĩa") &&
            !beforeIpa.toLowerCase().includes("nối")
          ) {
            word = beforeIpa;
          } else {
            word = `Từ vựng ${idx + 1}`;
          }
        }
      }

      // Chuẩn hóa danh sách Options
      const rawOptions = (q as any).options || [];
      const opts = Array.isArray(rawOptions)
        ? rawOptions.map((o: any, oIdx: number) => ({
            id: String(o.id || o.optionLabel || oIdx),
            label: o.optionLabel || String.fromCharCode(65 + oIdx),
            text: o.optionText || o.text || String(o),
            isCorrect: o.isCorrect,
          }))
        : [];

      return {
        questionId: q.questionId,
        index: idx,
        word,
        ipa,
        audioUrl: q.mediaUrl || (q as any).audioUrl,
        rawPrompt: prompt,
        explanation: q.explanation,
        correctAnswer: q.correctAnswer,
        isCorrect: q.isCorrect,
        options: opts,
      };
    });
  }, [questions]);

  // Tự động chọn từ đầu tiên khi mở bài tập
  useEffect(() => {
    if (wordItems.length > 0 && !activeWordId) {
      // Ưu tiên chọn từ đầu tiên chưa được nối
      const firstUnmatched = wordItems.find(
        (w) =>
          !answers[w.questionId]?.selectedOptionId &&
          !answers[w.questionId]?.textAnswer
      );
      setActiveWordId(firstUnmatched ? firstUnmatched.questionId : wordItems[0].questionId);
    }
  }, [wordItems, activeWordId, answers]);

  // Xác định từ đang kích hoạt
  const currentActiveItem = useMemo(() => {
    return wordItems.find((w) => w.questionId === activeWordId) || wordItems[0];
  }, [wordItems, activeWordId]);

  // Kiểm tra xem bài tập là dạng 1-to-1 matching thuần hay mỗi từ có options riêng
  const isGlobalMatching = useMemo(() => {
    // Nếu mỗi question chỉ có 1 option, hoặc tổng options bằng đúng số questions
    return wordItems.every((w) => w.options.length <= 1);
  }, [wordItems]);

  // Danh sách các meanings hiển thị ở Cột Phải
  const rightColumnMeanings = useMemo(() => {
    if (isGlobalMatching) {
      // Tập hợp tất cả các nghĩa từ các câu hỏi, xáo trộn thứ tự
      const allMeanings = wordItems.map((w) => {
        const text =
          w.options[0]?.text || w.correctAnswer || w.explanation || "Định nghĩa";
        return {
          questionId: w.questionId,
          optionId: w.options[0]?.id || w.questionId,
          text,
        };
      });
      // Xáo trộn cố định theo thứ tự câu hỏi đảo
      return [...allMeanings].reverse();
    }

    // Nếu mỗi question có 4 options: Hiển thị các options của từ đang chọn (Cột Phải tương tác trực tiếp)
    if (currentActiveItem) {
      return currentActiveItem.options.map((opt) => ({
        questionId: currentActiveItem.questionId,
        optionId: opt.id,
        text: opt.text,
        isCorrect: opt.isCorrect,
      }));
    }
    return [];
  }, [isGlobalMatching, wordItems, currentActiveItem]);

  // Đếm tiến độ số từ đã nối
  const matchedCount = useMemo(() => {
    return wordItems.filter(
      (w) =>
        Boolean(answers[w.questionId]?.selectedOptionId) ||
        Boolean(answers[w.questionId]?.textAnswer)
    ).length;
  }, [wordItems, answers]);

  const progressPercent = Math.round(
    (matchedCount / (wordItems.length || 1)) * 100
  );

  // 2. TÍCH HỢP PHÁT ÂM AUDIO & IPA (Web Speech API + Fallback Youdao CDN)
  const handlePlayPronunciation = (
    wordText: string,
    audioUrl?: string,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    if (!wordText) return;

    const cleanWord = wordText
      .replace(/\[.*?\]/g, "")
      .replace(/[^a-zA-Z\s'-]/g, "")
      .trim();
    if (!cleanWord) return;

    setPlayingWord(cleanWord);

    // 1. Nếu có file Audio MP3 từ Backend/Từ điển CDN
    const finalAudioUrl = resolveAudioUrl
      ? resolveAudioUrl(audioUrl)
      : audioUrl;

    if (
      finalAudioUrl &&
      !finalAudioUrl.includes("translate.google") &&
      !finalAudioUrl.includes("api.dictionaryapi.dev")
    ) {
      const audio = new Audio(finalAudioUrl);
      audio.onended = () => setPlayingWord(null);
      audio.onerror = () => playSpeechOrCdn(cleanWord);
      audio.play().catch(() => playSpeechOrCdn(cleanWord));
      return;
    }

    playSpeechOrCdn(cleanWord);
  };

  const playSpeechOrCdn = (cleanWord: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanWord);
        utterance.lang = "en-US";
        utterance.rate = 0.88; // Tốc độ chuẩn cho học tập phát âm
        utterance.onend = () => setPlayingWord(null);
        utterance.onerror = () => playCdnFallback(cleanWord);
        window.speechSynthesis.speak(utterance);
        return;
      } catch (err) {
        console.warn("SpeechSynthesis error, fallback to CDN:", err);
      }
    }
    playCdnFallback(cleanWord);
  };

  const playCdnFallback = (cleanWord: string) => {
    try {
      const cdnUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(
        cleanWord
      )}&type=2`;
      const audio = new Audio(cdnUrl);
      audio.onended = () => setPlayingWord(null);
      audio.onerror = () => setPlayingWord(null);
      audio.play().catch(() => setPlayingWord(null));
    } catch {
      setPlayingWord(null);
    }
  };

  // 3. THAO TÁC NỐI TỪ (MATCHING SELECTION)
  const handleSelectMeaning = (
    targetQuestionId: string,
    optionId: string,
    meaningText: string
  ) => {
    if (disabled || isReview) return;

    // Cập nhật câu trả lời vào state answers
    onUpdateAnswer(targetQuestionId, {
      selectedOptionId: optionId,
      textAnswer: meaningText,
    });

    // Tự động phát âm từ vừa chọn
    const matchedItem = wordItems.find((w) => w.questionId === targetQuestionId);
    if (matchedItem) {
      handlePlayPronunciation(matchedItem.word, matchedItem.audioUrl);
    }

    // Tự động chuyển tiêu điểm sang từ tiếp theo chưa được nối
    const remainingUnmatched = wordItems.find(
      (w) =>
        w.questionId !== targetQuestionId &&
        !answers[w.questionId]?.selectedOptionId &&
        !answers[w.questionId]?.textAnswer
    );
    if (remainingUnmatched) {
      setActiveWordId(remainingUnmatched.questionId);
    }
  };

  // Hủy nối một cặp từ
  const handleUnlinkPair = (questionId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (disabled || isReview) return;
    onUpdateAnswer(questionId, {
      selectedOptionId: undefined,
      textAnswer: "",
    });
  };

  // Đặt lại toàn bộ các cặp từ
  const handleResetAll = () => {
    if (disabled || isReview) return;
    if (window.confirm("Bạn có chắc chắn muốn đặt lại toàn bộ các cặp nối từ?")) {
      wordItems.forEach((w) => {
        onUpdateAnswer(w.questionId, {
          selectedOptionId: undefined,
          textAnswer: "",
        });
      });
      if (wordItems.length > 0) {
        setActiveWordId(wordItems[0].questionId);
      }
    }
  };

  if (wordItems.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* 1. Header Bảng điều khiển Matching */}
      <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 dark:from-indigo-950/40 dark:to-purple-950/40 p-5 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/80 backdrop-blur-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-600 text-white flex items-center gap-1 shadow-xs">
              <Sparkles size={12} /> BÀI TẬP NỐI TỪ VỰNG (VOCABULARY MATCHING)
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {wordItems.length} cặp từ vựng
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 font-medium">
            💡 Chạm vào từ tiếng Anh ở cột trái để nghe phát âm, sau đó chọn ý nghĩa tương ứng ở cột phải để hoàn thành cặp ghép.
          </p>
        </div>

        {/* Thanh tiến độ ghép từ */}
        <div className="w-full md:w-auto flex items-center gap-3">
          <div className="w-full md:w-48 bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5">
            <div
              className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-black text-indigo-700 dark:text-indigo-300 shrink-0">
            {matchedCount}/{wordItems.length} cặp ({progressPercent}%)
          </span>
          {!isReview && matchedCount > 0 && (
            <button
              type="button"
              onClick={handleResetAll}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 flex items-center gap-1 cursor-pointer transition ml-2"
              title="Đặt lại toàn bộ các cặp đã nối"
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      </div>

      {/* 2. GIAO DIỆN HAI CỘT TƯƠNG TÁC (TWO-COLUMN INTERACTIVE MATCHING BOARD) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ================= CỘT TRÁI: TỪ TIẾNG ANH & PHIÊN ÂM IPA ================= */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-black">
                A
              </span>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                TỪ TIẾNG ANH & PHIÊN ÂM IPA
              </h3>
            </div>
            <span className="text-[11px] font-bold text-slate-400">
              Nhấn để phát âm & chọn
            </span>
          </div>

          <div className="space-y-3">
            {wordItems.map((item, idx) => {
              const currentAns = answers[item.questionId];
              const isMatched =
                Boolean(currentAns?.selectedOptionId) ||
                Boolean(currentAns?.textAnswer);
              const isActive = activeWordId === item.questionId;
              const colorTheme = PAIR_COLORS[idx % PAIR_COLORS.length];
              const isPlayingThisWord = playingWord === item.word;

              // Trích xuất văn bản nghĩa đã nối
              const matchedOption = item.options.find(
                (o) => o.id === currentAns?.selectedOptionId
              );
              const matchedMeaningText =
                matchedOption?.text || currentAns?.textAnswer || "";

              // Kiểm tra xem câu này đúng hay sai trong chế độ REVIEW
              const isCorrectInReview =
                item.isCorrect === true ||
                (item.correctAnswer &&
                  matchedMeaningText.trim().toLowerCase() ===
                    item.correctAnswer.trim().toLowerCase());

              return (
                <div
                  key={item.questionId}
                  onClick={() => {
                    setActiveWordId(item.questionId);
                    handlePlayPronunciation(item.word, item.audioUrl);
                  }}
                  className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer select-none ${
                    isReview
                      ? isCorrectInReview
                        ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30"
                        : "border-rose-500 bg-rose-50/60 dark:bg-rose-950/30"
                      : isActive
                      ? "border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 shadow-md ring-2 ring-indigo-500/20"
                      : isMatched
                      ? `${colorTheme.border} ${colorTheme.bg} hover:border-indigo-400`
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {/* Số thứ tự / Huy hiệu cặp */}
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 transition-transform ${
                          isMatched
                            ? `${colorTheme.badge} scale-105`
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {idx + 1}
                      </span>

                      {/* Thông tin Từ & IPA */}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base md:text-lg font-black text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition">
                            {item.word}
                          </span>
                          {item.ipa && (
                            <span className="text-xs font-mono font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/80">
                              {item.ipa}
                            </span>
                          )}
                        </div>

                        {/* Nhãn hiển thị kết quả nối */}
                        {isMatched && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                            <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5">
                              <Link2 size={12} /> Nghĩa:
                            </span>
                            <span className="font-semibold line-clamp-1 italic">
                              "{matchedMeaningText}"
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Nút phát âm Audio & Thao tác gỡ */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) =>
                          handlePlayPronunciation(item.word, item.audioUrl, e)
                        }
                        className={`p-2 rounded-lg border transition cursor-pointer ${
                          isPlayingThisWord
                            ? "bg-indigo-600 text-white border-indigo-600 animate-pulse"
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300"
                        }`}
                        title="Nghe phát âm chuẩn người bản xứ"
                      >
                        <Volume2
                          size={16}
                          className={isPlayingThisWord ? "animate-bounce" : ""}
                        />
                      </button>

                      {isMatched && !disabled && !isReview && (
                        <button
                          type="button"
                          onClick={(e) => handleUnlinkPair(item.questionId, e)}
                          className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 cursor-pointer transition"
                          title="Hủy nối cặp này"
                        >
                          <Unlink size={15} />
                        </button>
                      )}

                      {/* Biểu tượng Review sau nộp bài */}
                      {isReview && (
                        <div className="ml-1">
                          {isCorrectInReview ? (
                            <CheckCircle2 size={20} className="text-emerald-500" />
                          ) : (
                            <XCircle size={20} className="text-rose-500" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hiển thị đáp án đúng và giải thích trong Chế độ Review */}
                  {isReview && !isCorrectInReview && item.correctAnswer && (
                    <div className="mt-3 pt-3 border-t border-rose-200 dark:border-rose-900 text-xs space-y-1">
                      <p className="font-bold text-rose-700 dark:text-rose-300">
                        Đáp án đúng:{" "}
                        <span className="font-normal">{item.correctAnswer}</span>
                      </p>
                      {item.explanation && (
                        <p className="text-slate-600 dark:text-slate-400 italic">
                          💡 {item.explanation}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ================= CỘT PHẢI: Ý NGHĨA & ĐỊNH NGHĨA TIẾNG VIỆT ================= */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs font-black">
                B
              </span>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Ý NGHĨA & ĐỊNH NGHĨA
              </h3>
            </div>
            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
              Đang chọn:{" "}
              <strong className="underline underline-offset-2">
                {currentActiveItem?.word || "Chưa chọn"}
              </strong>
            </span>
          </div>

          {/* Hộp gợi ý cho học sinh */}
          <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 text-xs text-indigo-900 dark:text-indigo-200 flex items-center gap-2.5">
            <BookOpen size={16} className="text-indigo-600 shrink-0" />
            <span>
              Chọn ý nghĩa đúng nhất cho từ{" "}
              <span className="font-black text-indigo-700 dark:text-indigo-300">
                "{currentActiveItem?.word}"
              </span>
              :
            </span>
          </div>

          <div className="space-y-3">
            {rightColumnMeanings.map((meaning, mIdx) => {
              const targetQId = meaning.questionId;
              const isSelectedForActiveWord =
                answers[currentActiveItem?.questionId]?.selectedOptionId ===
                  meaning.optionId ||
                answers[currentActiveItem?.questionId]?.textAnswer ===
                  meaning.text;

              // Kiểm tra xem ý nghĩa này đã được nối với từ nào chưa
              const linkedWordItem = wordItems.find(
                (w) =>
                  answers[w.questionId]?.selectedOptionId === meaning.optionId ||
                  answers[w.questionId]?.textAnswer === meaning.text
              );

              return (
                <div
                  key={`${meaning.optionId}-${mIdx}`}
                  onClick={() =>
                    handleSelectMeaning(
                      currentActiveItem.questionId,
                      meaning.optionId,
                      meaning.text
                    )
                  }
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer select-none flex items-start justify-between gap-3 group ${
                    isSelectedForActiveWord
                      ? "border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/60 shadow-md ring-2 ring-indigo-500/20"
                      : linkedWordItem
                      ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 opacity-80 hover:opacity-100"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                        isSelectedForActiveWord
                          ? "bg-indigo-600 text-white"
                          : linkedWordItem
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-700"
                      }`}
                    >
                      {String.fromCharCode(65 + mIdx)}
                    </span>

                    <div>
                      <p className="text-sm md:text-base font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
                        {meaning.text}
                      </p>

                      {/* Hiển thị liên kết với từ nào nếu đã ghép */}
                      {linkedWordItem && (
                        <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <Check size={11} /> Đã nối với: "{linkedWordItem.word}"
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 pt-0.5">
                    {isSelectedForActiveWord ? (
                      <span className="p-1 rounded-full bg-indigo-600 text-white">
                        <Check size={14} />
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 transition">
                        <ArrowRight size={16} />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VocabularyMatchingStudio;

