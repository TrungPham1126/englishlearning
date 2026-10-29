// src/features/student/components/VocabularyMatchingBoard.tsx
import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
} from "react";
import {
  Volume2,
  Sparkles,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Check,
  Unlink,
  AlertCircle,
  HelpCircle,
  BookOpen,
} from "lucide-react";
import type { QuestionResultDetail } from "@/features/student/types";

export interface VocabularyMatchingBoardProps {
  questions: QuestionResultDetail[];
  answers: Record<
    string,
    { selectedOptionId?: string; textAnswer?: string; audioUrl?: string }
  >;
  onAnswersChange: (
    questionId: string,
    partial: { selectedOptionId?: string; textAnswer?: string }
  ) => void;
  disabled?: boolean;
  isReview?: boolean;
  resolveAudioUrl?: (url?: string) => string;
}

interface LeftWordItem {
  id: string; // questionId
  index: number;
  word: string;
  ipa: string;
  audioUrl?: string;
  explanation?: string;
  correctAnswer?: string;
  isCorrect?: boolean;
  studentAnswer?: string;
  selectedOptionId?: string;
  options: {
    id: string;
    text: string;
    isCorrect?: boolean;
    isSelected?: boolean;
  }[];
}

interface RightMeaningItem {
  id: string; // unique id for right card
  questionId: string; // question this meaning originally belongs to
  optionId: string; // optionId if available
  text: string;
}

export interface RayLine {
  leftId: string;
  rightId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isMatched: boolean;
  isCorrect: boolean;
}

const RAY_COLOR_MATCHED = "#10b981"; // Xanh lá Emerald khi đã nối thành công
const RAY_COLOR_ERROR = "#f43f5e"; // Đỏ Rose khi nối sai trong chế độ Review
const RAY_COLOR_ACTIVE = "#6366f1"; // Màu tím Indigo khi đang chọn thẻ chờ nối

export const VocabularyMatchingBoard: React.FC<VocabularyMatchingBoardProps> = ({
  questions,
  answers,
  onAnswersChange,
  disabled = false,
  isReview = false,
  resolveAudioUrl,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftAnchorRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rightAnchorRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const [selectedRightId, setSelectedRightId] = useState<string | null>(null);
  const [playingWord, setPlayingWord] = useState<string | null>(null);
  const [rayCoordinates, setRayCoordinates] = useState<RayLine[]>([]);

  // 1. Phân tích Cột Trái: Danh sách từ vựng tiếng Anh kèm phiên âm IPA
  const leftItems = useMemo<LeftWordItem[]>(() => {
    return questions.map((q, idx) => {
      let word = (q as any).targetWord || (q as any).word || "";
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

      // Trích xuất từ tiếng Anh
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
            word = `Word ${idx + 1}`;
          }
        }
      }

      const rawOptions = (q as any).options || [];
      const opts = Array.isArray(rawOptions)
        ? rawOptions.map((o: any, oIdx: number) => ({
            id: String(o.id || o.optionLabel || oIdx),
            text: o.optionText || o.text || String(o),
            isCorrect: o.isCorrect,
            isSelected: o.isSelected,
          }))
        : [];

      const ans = answers[q.questionId];
      const selectedOpt = opts.find((o) => o.isSelected);

      return {
        id: q.questionId,
        index: idx,
        word,
        ipa,
        audioUrl: q.mediaUrl || (q as any).audioUrl,
        explanation: q.explanation,
        correctAnswer: q.correctAnswer,
        isCorrect: q.isCorrect,
        studentAnswer: (q as any).studentAnswer || ans?.textAnswer,
        selectedOptionId: selectedOpt?.id || ans?.selectedOptionId,
        options: opts,
      };
    });
  }, [questions, answers]);

  // 2. Phân tích Cột Phải: Danh sách ý nghĩa / định nghĩa (được xáo trộn độc lập)
  const rightItems = useMemo<RightMeaningItem[]>(() => {
    const rawItems: RightMeaningItem[] = leftItems.map((item, idx) => {
      let meaningText = "";
      let optId = item.id;

      if (item.correctAnswer) {
        meaningText = item.correctAnswer;
        const matchingOpt = item.options.find((o) => o.text === item.correctAnswer);
        if (matchingOpt) optId = matchingOpt.id;
      } else {
        const correctOpt = item.options.find((o) => o.isCorrect === true);
        if (correctOpt) {
          meaningText = correctOpt.text;
          optId = correctOpt.id;
        } else if (item.options.length > 0) {
          meaningText = item.options[0].text;
          optId = item.options[0].id;
        } else if (item.explanation) {
          const colonIdx = item.explanation.lastIndexOf(":");
          meaningText =
            colonIdx !== -1
              ? item.explanation.slice(colonIdx + 1).trim()
              : item.explanation;
        } else {
          meaningText = `Ý nghĩa / Định nghĩa ${idx + 1}`;
        }
      }

      return {
        id: `right-card-${item.id}`,
        questionId: item.id,
        optionId: optId,
        text: meaningText,
      };
    });

    // Xáo trộn cố định (deterministic shuffle) để vị trí ổn định qua các lần re-render
    const shuffled = [...rawItems];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = (i * 3 + 1) % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [leftItems]);

  // 3. Quản lý trạng thái kết nối các cặp từ { leftId -> rightCardId }
  const connections = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    leftItems.forEach((left) => {
      const ans = answers[left.id];
      const studentAnsText = (
        ans?.textAnswer ||
        left.studentAnswer ||
        ""
      ).trim().toLowerCase();
      const selectedOptId = ans?.selectedOptionId || left.selectedOptionId;

      // Tìm thẻ bên phải mà học sinh đã chọn
      // 1. So khớp theo selectedOptionId hoặc id thẻ phải
      let matchedRight = rightItems.find(
        (r) =>
          (selectedOptId &&
            (r.id === selectedOptId ||
              r.optionId === selectedOptId ||
              r.questionId === selectedOptId)) ||
          (studentAnsText &&
            r.text.trim().toLowerCase() === studentAnsText)
      );

      // 2. Trong chế độ Review: nếu học sinh làm đúng (isCorrect === true), nối với rightCard của chính câu này
      if (!matchedRight && isReview && left.isCorrect === true) {
        matchedRight = rightItems.find((r) => r.questionId === left.id);
      }

      // 3. Trong chế độ Review: nếu có studentAnsText so khớp tương đối
      if (!matchedRight && isReview && studentAnsText) {
        matchedRight = rightItems.find(
          (r) =>
            r.text.toLowerCase().includes(studentAnsText) ||
            studentAnsText.includes(r.text.toLowerCase())
        );
      }

      if (matchedRight) {
        map[left.id] = matchedRight.id;
      }
    });
    return map;
  }, [leftItems, rightItems, answers, isReview]);

  // 4. Phát âm Audio chuẩn (Web Speech API + Youdao CDN Fallback) - CHỈ dành cho Cột Trái (Word & IPA)
  const handlePlayAudio = useCallback(
    (wordText: string, customAudioUrl?: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      if (!wordText) return;

      const cleanWord = wordText
        .replace(/\[.*?\]/g, "")
        .replace(/[^a-zA-Z\s'-]/g, "")
        .trim();
      if (!cleanWord) return;

      setPlayingWord(cleanWord);

      const finalAudioUrl = resolveAudioUrl
        ? resolveAudioUrl(customAudioUrl)
        : customAudioUrl;

      if (
        finalAudioUrl &&
        !finalAudioUrl.includes("translate.google") &&
        !finalAudioUrl.includes("api.dictionaryapi.dev")
      ) {
        const audio = new Audio(finalAudioUrl);
        audio.onended = () => setPlayingWord(null);
        audio.onerror = () => playSpeechSynthesisWithFallback(cleanWord);
        audio.play().catch(() => playSpeechSynthesisWithFallback(cleanWord));
        return;
      }

      playSpeechSynthesisWithFallback(cleanWord);
    },
    [resolveAudioUrl]
  );

  const playSpeechSynthesisWithFallback = (word: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = "en-US";
        utterance.rate = 0.88;
        utterance.onend = () => setPlayingWord(null);
        utterance.onerror = () => playYoudaoFallback(word);
        window.speechSynthesis.speak(utterance);
        return;
      } catch (err) {
        console.warn("SpeechSynthesis error:", err);
      }
    }
    playYoudaoFallback(word);
  };

  const playYoudaoFallback = (word: string) => {
    try {
      const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(
        word
      )}&type=2`;
      const audio = new Audio(url);
      audio.onended = () => setPlayingWord(null);
      audio.onerror = () => setPlayingWord(null);
      audio.play().catch(() => setPlayingWord(null));
    } catch {
      setPlayingWord(null);
    }
  };

  // 5. Thao tác Click Cột Trái (Từ tiếng Anh & IPA): Kích hoạt phát âm + chọn/nối
  const handleLeftClick = (item: LeftWordItem) => {
    if (disabled || isReview) return;

    // Phát âm từ tiếng Anh
    handlePlayAudio(item.word, item.audioUrl);

    // Nếu đã nối với thẻ phải, hủy nối để học sinh dễ chọn lại
    if (connections[item.id]) {
      onAnswersChange(item.id, {
        selectedOptionId: undefined,
        textAnswer: "",
      });
      setSelectedLeftId(item.id);
      setSelectedRightId(null);
      return;
    }

    // Nếu thẻ phải đã chọn trước đó, hoàn tất kết nối
    if (selectedRightId) {
      const rightItem = rightItems.find((r) => r.id === selectedRightId);
      if (rightItem) {
        onAnswersChange(item.id, {
          selectedOptionId: rightItem.optionId || rightItem.id,
          textAnswer: rightItem.text,
        });
      }
      setSelectedLeftId(null);
      setSelectedRightId(null);
      return;
    }

    // Đánh dấu thẻ trái đang chọn
    setSelectedLeftId((prev) => (prev === item.id ? null : item.id));
  };

  // 6. Thao tác Click Cột Phải (Ý nghĩa / Định nghĩa): TUYỆT ĐỐI KHÔNG CÓ ÂM THANH
  const handleRightClick = (item: RightMeaningItem) => {
    if (disabled || isReview) return;

    // Kiểm tra xem thẻ phải này đã được nối với thẻ trái nào chưa
    const linkedLeftId = Object.keys(connections).find(
      (lId) => connections[lId] === item.id
    );

    if (linkedLeftId) {
      // Hủy nối cặp này (KHÔNG phát âm)
      onAnswersChange(linkedLeftId, {
        selectedOptionId: undefined,
        textAnswer: "",
      });
      setSelectedRightId(item.id);
      setSelectedLeftId(null);
      return;
    }

    // Nếu thẻ trái đã được chọn từ trước, hoàn tất kết nối (KHÔNG phát âm)
    if (selectedLeftId) {
      const leftItem = leftItems.find((l) => l.id === selectedLeftId);
      if (leftItem) {
        onAnswersChange(leftItem.id, {
          selectedOptionId: item.optionId || item.id,
          textAnswer: item.text,
        });
      }
      setSelectedLeftId(null);
      setSelectedRightId(null);
      return;
    }

    // Đánh dấu thẻ phải đang chọn (KHÔNG phát âm)
    setSelectedRightId((prev) => (prev === item.id ? null : item.id));
  };

  // 7. Tính toán tọa độ các tia nối SVG (Dynamic SVG Ray Overlay)
  const updateRayPositions = useCallback(() => {
    if (!containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) return;

    const list: RayLine[] = [];

    // A. Các cặp đã nối
    Object.entries(connections).forEach(([lId, rId]) => {
      const leftEl = leftAnchorRefs.current[lId];
      const rightEl = rightAnchorRefs.current[rId];
      if (leftEl && rightEl) {
        const lRect = leftEl.getBoundingClientRect();
        const rRect = rightEl.getBoundingClientRect();

        const leftItem = leftItems.find((l) => l.id === lId);
        const rightItem = rightItems.find((r) => r.id === rId);

        // Đánh giá đúng sai trong Review Mode
        const isCorrectPair =
          leftItem?.isCorrect === true ||
          (Boolean(leftItem?.correctAnswer) &&
            rightItem?.text?.trim().toLowerCase() ===
              leftItem?.correctAnswer?.trim().toLowerCase()) ||
          false;

        list.push({
          leftId: lId,
          rightId: rId,
          x1: lRect.left + lRect.width / 2 - containerRect.left,
          y1: lRect.top + lRect.height / 2 - containerRect.top,
          x2: rRect.left + rRect.width / 2 - containerRect.left,
          y2: rRect.top + rRect.height / 2 - containerRect.top,
          isMatched: true,
          isCorrect: isReview ? isCorrectPair : true,
        });
      }
    });

    // B. Tia nối đang chọn (Active Selection Ray)
    if (selectedLeftId && selectedRightId) {
      const leftEl = leftAnchorRefs.current[selectedLeftId];
      const rightEl = rightAnchorRefs.current[selectedRightId];
      if (leftEl && rightEl) {
        const lRect = leftEl.getBoundingClientRect();
        const rRect = rightEl.getBoundingClientRect();

        list.push({
          leftId: selectedLeftId,
          rightId: selectedRightId,
          x1: lRect.left + lRect.width / 2 - containerRect.left,
          y1: lRect.top + lRect.height / 2 - containerRect.top,
          x2: rRect.left + rRect.width / 2 - containerRect.left,
          y2: rRect.top + rRect.height / 2 - containerRect.top,
          isMatched: false,
          isCorrect: true,
        });
      }
    }

    setRayCoordinates(list);
  }, [connections, selectedLeftId, selectedRightId, leftItems, rightItems, isReview]);

  // Cập nhật lại tọa độ tia nối khi layout thay đổi, resize hoặc cuộn trang
  useLayoutEffect(() => {
    let animId: number;
    const handleUpdate = () => {
      animId = requestAnimationFrame(updateRayPositions);
    };

    handleUpdate();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      ro = new ResizeObserver(handleUpdate);
      ro.observe(containerRef.current);
    }

    window.addEventListener("resize", handleUpdate);
    window.addEventListener("scroll", handleUpdate, true);

    const t1 = setTimeout(handleUpdate, 60);
    const t2 = setTimeout(handleUpdate, 200);

    return () => {
      cancelAnimationFrame(animId);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("scroll", handleUpdate, true);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [updateRayPositions]);

  // Đặt lại toàn bộ bài làm
  const handleReset = () => {
    if (disabled || isReview) return;
    if (window.confirm("Bạn có chắc chắn muốn đặt lại toàn bộ các đường nối?")) {
      leftItems.forEach((l) => {
        onAnswersChange(l.id, {
          selectedOptionId: undefined,
          textAnswer: "",
        });
      });
      setSelectedLeftId(null);
      setSelectedRightId(null);
    }
  };

  const matchedCount = Object.keys(connections).length;
  const progressPercent = Math.round(
    (matchedCount / (leftItems.length || 1)) * 100
  );

  return (
    <div className="space-y-6">
      {/* Header Bảng Điều Khiển Nối Từ */}
      <div className="bg-white dark:bg-surface-card p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-800 text-white flex items-center gap-1 shadow-xs">
              <Sparkles size={12} /> BÀI TẬP NỐI TỪ VỰNG TƯƠNG TÁC (MATCHING)
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {leftItems.length} cặp từ vựng
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 font-medium">
            💡 Chạm vào từ hoặc phiên âm IPA ở cột trái để nghe phát âm, sau đó chạm vào định nghĩa tương ứng ở cột phải để hoàn thành cặp ghép.
          </p>
        </div>

        {/* Thanh tiến độ ghép từ */}
        <div className="w-full md:w-auto flex items-center gap-3">
          <div className="w-full md:w-48 bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5">
            <div
              className="bg-brand-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-black text-blue-800 dark:text-blue-300 shrink-0">
            {matchedCount}/{leftItems.length} cặp ({progressPercent}%)
          </span>
          {!isReview && matchedCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 flex items-center gap-1 cursor-pointer transition ml-2"
              title="Đặt lại toàn bộ các đường nối"
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      </div>

      {/* KHUNG BÀI LÀM 2 CỘT KÈM LỚP SVG VẼ TIA NỐI (INTERACTIVE BOARD OVERLAY) */}
      <div
        ref={containerRef}
        className="relative bg-slate-50/50 dark:bg-slate-950/40 p-6 md:p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs"
      >
        {/* LỚP SVG PHỦ TOÀN KHUNG ĐỂ VẼ TIA NỐI TRỰC QUAN */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
          <defs>
            <linearGradient id="rayMatchedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
            <linearGradient id="rayErrorGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
            <filter id="rayGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {rayCoordinates.map((ray, rIdx) => {
            const dx = Math.max(40, Math.abs(ray.x2 - ray.x1) * 0.45);
            const pathD = `M ${ray.x1} ${ray.y1} C ${ray.x1 + dx} ${ray.y1}, ${
              ray.x2 - dx
            } ${ray.y2}, ${ray.x2} ${ray.y2}`;

            const rayStrokeColor = !ray.isMatched
              ? RAY_COLOR_ACTIVE
              : isReview
              ? ray.isCorrect
                ? RAY_COLOR_MATCHED
                : RAY_COLOR_ERROR
              : RAY_COLOR_MATCHED;

            return (
              <g key={`ray-${ray.leftId}-${ray.rightId}-${rIdx}`}>
                {/* Đường viền phát sáng mờ phía sau */}
                <path
                  d={pathD}
                  stroke={rayStrokeColor}
                  strokeWidth={6}
                  strokeOpacity={0.25}
                  strokeLinecap="round"
                  fill="none"
                  filter="url(#rayGlow)"
                />
                {/* Tia nối sắc nét chính */}
                <path
                  d={pathD}
                  stroke={
                    !ray.isMatched
                      ? RAY_COLOR_ACTIVE
                      : isReview && !ray.isCorrect
                      ? "url(#rayErrorGradient)"
                      : "url(#rayMatchedGradient)"
                  }
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeDasharray={ray.isMatched ? "none" : "6 4"}
                  fill="none"
                  className={ray.isMatched ? "" : "animate-pulse"}
                />
              </g>
            );
          })}
        </svg>

        {/* BỐ CỤC 2 CỘT TƯƠNG TÁC (TWO-COLUMN CARDS) */}
        <div className="flex flex-col md:flex-row justify-between items-stretch gap-8 md:gap-16 relative z-0">
          {/* ================= CỘT TRÁI: TỪ TIẾNG ANH & PHIÊN ÂM IPA ================= */}
          <div className="w-full md:w-1/2 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 flex items-center justify-center text-xs font-black">
                  A
                </span>
                <h3 className="text-xs md:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  TỪ TIẾNG ANH & PHIÊN ÂM IPA
                </h3>
              </div>
              <span className="text-[11px] font-bold text-slate-400">
                Bấm từ/IPA để phát âm
              </span>
            </div>

            <div className="space-y-4">
              {leftItems.map((item, idx) => {
                const connectedRightId = connections[item.id];
                const isMatched = Boolean(connectedRightId);
                const isSelected = selectedLeftId === item.id;
                const isPlaying = playingWord === item.word;

                const matchedRight = rightItems.find(
                  (r) => r.id === connectedRightId
                );

                // Đánh giá đúng/sai trong chế độ Review
                const isCorrectReview =
                  item.isCorrect === true ||
                  (item.correctAnswer &&
                    matchedRight?.text?.trim().toLowerCase() ===
                      item.correctAnswer.trim().toLowerCase());

                return (
                  <div
                    key={item.id}
                    onClick={() => handleLeftClick(item)}
                    className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer select-none flex items-center justify-between gap-3 ${
                      isReview
                        ? isMatched
                          ? isCorrectReview
                            ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30"
                            : "border-rose-500 bg-rose-50/70 dark:bg-rose-950/30"
                          : "border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-950/20"
                        : isSelected
                        ? "border-blue-700 bg-blue-50/80 dark:bg-slate-900/60 shadow-md ring-2 ring-blue-600/20"
                        : isMatched
                        ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 hover:border-emerald-600"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-700 hover:bg-slate-50 dark:hover:bg-slate-850"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Số thứ tự */}
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                          isReview
                            ? isMatched
                              ? isCorrectReview
                                ? "bg-emerald-600 text-white"
                                : "bg-rose-600 text-white"
                              : "bg-amber-500 text-white"
                            : isMatched
                            ? "bg-emerald-600 text-white"
                            : isSelected
                            ? "bg-blue-800 text-white"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {idx + 1}
                      </span>

                      {/* Chữ Tiếng Anh & Huy hiệu IPA (Logic phát âm kép) */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* 1. Bấm vào chữ Tiếng Anh để phát âm */}
                        <span
                          onClick={(e) => handlePlayAudio(item.word, item.audioUrl, e)}
                          className="text-base md:text-lg font-black text-slate-900 dark:text-slate-100 hover:text-blue-700 dark:hover:text-blue-400 transition cursor-pointer"
                          title="Bấm để nghe phát âm"
                        >
                          {item.word}
                        </span>

                        {/* 2. Bấm vào huy hiệu IPA để phát âm */}
                        {item.ipa && (
                          <span
                            onClick={(e) => handlePlayAudio(item.word, item.audioUrl, e)}
                            className="text-xs font-mono font-bold text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-slate-900/60 hover:bg-blue-100 dark:hover:bg-blue-950 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900/80 transition cursor-pointer"
                            title="Phiên âm IPA - Bấm để nghe phát âm chuẩn"
                          >
                            {item.ipa}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Nút loa phát âm độc lập & Trạng thái Review */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handlePlayAudio(item.word, item.audioUrl, e)}
                        className={`p-1.5 rounded-lg border transition cursor-pointer ${
                          isPlaying
                            ? "bg-blue-800 text-white border-blue-700 animate-pulse"
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400"
                        }`}
                        title="Nghe phát âm chuẩn bản xứ"
                      >
                        <Volume2
                          size={15}
                          className={isPlaying ? "scale-105 transition-transform" : ""}
                        />
                      </button>

                      {/* Biểu tượng Review sau nộp bài */}
                      {isReview && (
                        <div className="ml-1">
                          {isMatched ? (
                            isCorrectReview ? (
                              <CheckCircle2 size={18} className="text-emerald-500" />
                            ) : (
                              <XCircle size={18} className="text-rose-500" />
                            )
                          ) : (
                            <AlertCircle size={18} className="text-amber-500" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Điểm neo kết nối (Anchor Dot) bên cạnh phải thẻ */}
                    <div
                      ref={(el) => {
                        leftAnchorRefs.current[item.id] = el;
                      }}
                      className={`absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 transition-all z-20 ${
                        isReview
                          ? isMatched
                            ? isCorrectReview
                              ? "border-emerald-500 bg-emerald-500 shadow-sm shadow-emerald-200 dark:shadow-none"
                              : "border-rose-500 bg-rose-500 shadow-sm shadow-rose-200 dark:shadow-none"
                            : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                          : isMatched
                          ? "border-emerald-500 bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900/40"
                          : isSelected
                          ? "border-blue-700 bg-blue-800 ring-4 ring-blue-500 dark:ring-blue-700/60 animate-pulse"
                          : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* ================= CỘT PHẢI: Ý NGHĨA / ĐỊNH NGHĨA (KHÔNG CÓ ÂM THANH) ================= */}
          <div className="w-full md:w-1/2 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-black">
                  B
                </span>
                <h3 className="text-xs md:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Ý NGHĨA / ĐỊNH NGHĨA
                </h3>
              </div>
              <span className="text-[11px] font-bold text-slate-400">
                Chạm để liên kết
              </span>
            </div>

            <div className="space-y-4">
              {rightItems.map((item, idx) => {
                const linkedLeftId = Object.keys(connections).find(
                  (lId) => connections[lId] === item.id
                );
                const isMatched = Boolean(linkedLeftId);
                const isSelected = selectedRightId === item.id;

                const linkedLeftItem = leftItems.find((l) => l.id === linkedLeftId);

                // Đánh giá đúng sai trong Review Mode cho Cột Phải
                const isCorrectReview =
                  linkedLeftItem?.isCorrect === true ||
                  (linkedLeftItem?.correctAnswer &&
                    item.text.trim().toLowerCase() ===
                      linkedLeftItem.correctAnswer.trim().toLowerCase());

                return (
                  <div
                    key={item.id}
                    onClick={() => handleRightClick(item)}
                    className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer select-none flex items-center justify-between gap-3 ${
                      isReview
                        ? isMatched
                          ? isCorrectReview
                            ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30"
                            : "border-rose-500 bg-rose-50/70 dark:bg-rose-950/30"
                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-80"
                        : isSelected
                        ? "border-blue-700 bg-blue-50/80 dark:bg-slate-900/60 shadow-md ring-2 ring-blue-600/20"
                        : isMatched
                        ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 hover:border-emerald-600"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-slate-50 dark:hover:bg-slate-850"
                    }`}
                  >
                    {/* Điểm neo kết nối (Anchor Dot) bên cạnh trái thẻ */}
                    <div
                      ref={(el) => {
                        rightAnchorRefs.current[item.id] = el;
                      }}
                      className={`absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 transition-all z-20 ${
                        isReview
                          ? isMatched
                            ? isCorrectReview
                              ? "border-emerald-500 bg-emerald-500"
                              : "border-rose-500 bg-rose-500"
                            : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                          : isMatched
                          ? "border-emerald-500 bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900/40"
                          : isSelected
                          ? "border-blue-700 bg-blue-800 ring-4 ring-blue-500 dark:ring-blue-700/60 animate-pulse"
                          : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                      }`}
                    />

                    <div className="flex items-center gap-3">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                          isReview
                            ? isMatched
                              ? isCorrectReview
                                ? "bg-emerald-600 text-white"
                                : "bg-rose-600 text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                            : isMatched
                            ? "bg-emerald-600 text-white"
                            : isSelected
                            ? "bg-blue-800 text-white"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {String.fromCharCode(65 + idx)}
                      </span>

                      <div>
                        <p className="text-sm md:text-base font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
                          {item.text}
                        </p>

                        {/* Nhãn hiển thị từ vựng đang nối */}
                        {linkedLeftItem && (
                          <span
                            className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded text-[11px] font-bold ${
                              isReview
                                ? isCorrectReview
                                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                                  : "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300"
                                : "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                            }`}
                          >
                            <Check size={11} /> Đã nối: "{linkedLeftItem.word}"
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {isReview ? (
                        isMatched ? (
                          isCorrectReview ? (
                            <CheckCircle2 size={18} className="text-emerald-500" />
                          ) : (
                            <XCircle size={18} className="text-rose-500" />
                          )
                        ) : null
                      ) : isMatched ? (
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                          <Check size={12} />
                        </span>
                      ) : isSelected ? (
                        <span className="w-5 h-5 rounded-full bg-blue-800 text-white flex items-center justify-center animate-pulse shadow-xs">
                          <Sparkles size={11} />
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ================= BẢNG ĐỐI CHIẾU ĐÁP ÁN & GIẢI THÍCH CHI TIẾT (REVIEW MODE) ================= */}
      {isReview && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-slate-900/60 text-blue-700 dark:text-blue-400">
                <BookOpen size={20} />
              </div>
              <div>
                <h3 className="text-sm md:text-base font-black text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                  BẢNG ĐỐI CHIẾU ĐÁP ÁN & GIẢI THÍCH CHI TIẾT
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Xem lại toàn bộ kết quả ghép cặp, câu trả lời của bạn và phần giải nghĩa chi tiết
                </p>
              </div>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 self-start sm:self-auto">
              {leftItems.filter((item) => {
                const connectedRightId = connections[item.id];
                const matchedRight = rightItems.find((r) => r.id === connectedRightId);
                return (
                  item.isCorrect === true ||
                  (Boolean(item.correctAnswer) &&
                    matchedRight?.text?.trim().toLowerCase() ===
                      item.correctAnswer?.trim().toLowerCase())
                );
              }).length}/{leftItems.length} Cặp Đúng
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {leftItems.map((item, idx) => {
              const connectedRightId = connections[item.id];
              const matchedRight = rightItems.find((r) => r.id === connectedRightId);
              const isMatched = Boolean(connectedRightId);
              const isCorrectReview =
                item.isCorrect === true ||
                (Boolean(item.correctAnswer) &&
                  matchedRight?.text?.trim().toLowerCase() ===
                    item.correctAnswer?.trim().toLowerCase());

              return (
                <div
                  key={`review-detail-${item.id}`}
                  className={`p-4 rounded-xl border transition-all space-y-3 ${
                    !isMatched
                      ? "border-amber-200 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20"
                      : isCorrectReview
                      ? "border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20"
                      : "border-rose-200 dark:border-rose-800/60 bg-rose-50/40 dark:bg-rose-950/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-black shrink-0 ${
                          !isMatched
                            ? "bg-amber-500 text-white"
                            : isCorrectReview
                            ? "bg-emerald-600 text-white"
                            : "bg-rose-600 text-white"
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className="text-base font-black text-slate-900 dark:text-slate-100">
                        {item.word}
                      </span>
                      {item.ipa && (
                        <span className="text-xs font-mono font-bold text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-slate-900/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                          {item.ipa}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handlePlayAudio(item.word, item.audioUrl, e)}
                        className="p-1 rounded-md text-slate-400 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-slate-800 transition cursor-pointer"
                        title="Nghe lại phát âm"
                      >
                        <Volume2 size={14} />
                      </button>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 ${
                        !isMatched
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                          : isCorrectReview
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300"
                      }`}
                    >
                      {!isMatched ? (
                        <>
                          <AlertCircle size={12} /> Chưa nối
                        </>
                      ) : isCorrectReview ? (
                        <>
                          <CheckCircle2 size={12} /> Chính xác
                        </>
                      ) : (
                        <>
                          <XCircle size={12} /> Chưa đúng
                        </>
                      )}
                    </span>
                  </div>

                  {/* Nội dung đối chiếu đáp án */}
                  <div className="space-y-1.5 text-xs bg-white/70 dark:bg-slate-900/70 p-3 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-slate-500 dark:text-slate-400 min-w-[90px] shrink-0">
                        Bạn đã chọn:
                      </span>
                      <span
                        className={`font-semibold ${
                          !isMatched
                            ? "text-slate-400 italic"
                            : isCorrectReview
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-rose-700 dark:text-rose-300 line-through"
                        }`}
                      >
                        {matchedRight?.text || item.studentAnswer || "Chưa ghép cặp"}
                      </span>
                    </div>

                    {(!isCorrectReview || !isMatched) && item.correctAnswer && (
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 min-w-[90px] shrink-0">
                          Đáp án đúng:
                        </span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">
                          {item.correctAnswer}
                        </span>
                      </div>
                    )}

                    {item.explanation && (
                      <div className="flex items-start gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 mt-1">
                        <span className="font-bold text-slate-500 dark:text-slate-400 min-w-[90px] shrink-0">
                          Giải thích:
                        </span>
                        <span className="text-slate-600 dark:text-slate-300 italic leading-relaxed">
                          {item.explanation}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default VocabularyMatchingBoard;

