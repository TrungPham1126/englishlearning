import {
  useState,
  useRef,
  useMemo,
  useCallback,
  useLayoutEffect,
} from "react";
import type {
  VocabularyMatchingBoardProps,
  LeftWordItem,
  RightMeaningItem,
  RayLine,
} from "./matchingTypes";

export function useMatchingLines({
  questions,
  answers,
  onAnswersChange,
  disabled = false,
  isReview = false,
  resolveAudioUrl,
}: VocabularyMatchingBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftAnchorRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rightAnchorRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const [selectedRightId, setSelectedRightId] = useState<string | null>(null);
  const [playingWord, setPlayingWord] = useState<string | null>(null);
  const [rayCoordinates, setRayCoordinates] = useState<RayLine[]>([]);

  // 1. Normalize questions
  const normalizedQuestions = useMemo(() => {
    if (!questions || questions.length === 0) return [];

    if (questions.length === 1 && (questions[0] as any).questionType === "MATCHING") {
      const q = questions[0];
      const rawContent = (q as any).content || q.promptText || "";
      if (rawContent.includes('"pairs"') || rawContent.includes('"questions"')) {
        try {
          const parsed = JSON.parse(rawContent);
          if (Array.isArray(parsed.pairs)) {
            return parsed.pairs.map((p: any, idx: number) => ({
              questionId: `${q.questionId}_pair_${idx}`,
              promptText: p.word || p.left || `Word ${idx + 1}`,
              ipa: p.ipa || "",
              audioUrl: p.audioUrl || "",
              options: [
                {
                  id: `${q.questionId}_opt_${idx}`,
                  text: p.meaning || p.right || "",
                  matchText: p.meaning || p.right || "",
                  isCorrect: true,
                },
              ],
              correctAnswer: p.meaning || p.right || "",
              explanation: p.explanation || "",
              isCorrect: (q as any).isCorrect,
              studentAnswer: answers[`${q.questionId}_pair_${idx}`]?.textAnswer,
            }));
          }
        } catch (e) {
          console.warn("Could not parse matching json:", e);
        }
      }
    }
    return questions;
  }, [questions, answers]);

  // 2. Left items
  const leftItems = useMemo<LeftWordItem[]>(() => {
    return normalizedQuestions.map((q: any, idx: number) => {
      let word = (q as any).targetWord || (q as any).word || "";
      let ipa = (q as any).ipa || "";

      if (!word) {
        const prompt = q.promptText || "";
        const ipaMatch = prompt.match(/\/([^\/]+)\//);
        if (ipaMatch) {
          ipa = ipaMatch[1];
        }

        const matchPairPattern = prompt.match(/['"“](.*?)['"”]/);
        if (matchPairPattern) {
          word = matchPairPattern[1];
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
            matchText:
              o.matchText ||
              o.explanation ||
              o.meaning ||
              o.definition ||
              o.targetText ||
              o.correctAnswer ||
              "",
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
        audioUrl: (q as any).mediaUrl || (q as any).audioUrl,
        explanation: q.explanation,
        correctAnswer: (q as any).correctAnswer,
        isCorrect: (q as any).isCorrect,
        studentAnswer: (q as any).studentAnswer || ans?.textAnswer,
        selectedOptionId: selectedOpt?.id || ans?.selectedOptionId,
        options: opts,
      };
    });
  }, [normalizedQuestions, answers]);

  // 3. Right items
  const rightItems = useMemo<RightMeaningItem[]>(() => {
    const rawItems: RightMeaningItem[] = leftItems.map((item) => {
      let optId = item.id;
      const optMatchText = item.options.find((o) => o.matchText)?.matchText;
      const optCorrectText = item.options.find((o) => o.isCorrect && o.matchText)?.matchText;

      let meaningText =
        (item as any).meaning ||
        (item as any).definition ||
        (item as any).matchText ||
        item.correctAnswer ||
        optCorrectText ||
        optMatchText ||
        (item.options.length > 0 && item.options[0].matchText ? item.options[0].matchText : "");

      if (!meaningText && item.explanation) {
        const dashIdx = item.explanation.lastIndexOf(" - ");
        const colonIdx = item.explanation.lastIndexOf(":");
        if (dashIdx !== -1) {
          meaningText = item.explanation.slice(dashIdx + 3).trim();
        } else if (colonIdx !== -1) {
          meaningText = item.explanation.slice(colonIdx + 1).trim();
        } else {
          meaningText = item.explanation.trim();
        }
      }

      if (!meaningText && item.options.length > 0) {
        const firstOpt = item.options[0];
        if (firstOpt.text && firstOpt.text.trim().toLowerCase() !== item.word.trim().toLowerCase()) {
          meaningText = firstOpt.text.trim();
        }
      }

      meaningText = (meaningText || "").trim();

      if (item.options.length > 0) {
        const matchingOpt = item.options.find(
          (o) => o.text === meaningText || o.matchText === meaningText,
        );
        if (matchingOpt) optId = matchingOpt.id;
      }

      return {
        id: `right-card-${item.id}`,
        questionId: String(item.id),
        optionId: String(optId),
        text: meaningText,
      };
    });

    const shuffled = [...rawItems];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = (i * 3 + 1) % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [leftItems]);

  // 4. Connections map
  const connections = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    leftItems.forEach((left) => {
      const leftId = String(left.id);
      const ans = answers[leftId] || answers[left.id];
      const studentAnsText = (
        ans?.textAnswer ||
        left.studentAnswer ||
        ""
      ).trim().toLowerCase();
      const selectedOptId = ans?.selectedOptionId
        ? String(ans.selectedOptionId)
        : left.selectedOptionId
        ? String(left.selectedOptionId)
        : undefined;

      let matchedRight = rightItems.find(
        (r) =>
          (selectedOptId &&
            (String(r.id) === selectedOptId ||
              String(r.optionId) === selectedOptId ||
              String(r.questionId) === selectedOptId)) ||
          (studentAnsText &&
            r.text.trim().toLowerCase() === studentAnsText),
      );

      if (!matchedRight && isReview && left.isCorrect === true) {
        matchedRight = rightItems.find((r) => String(r.questionId) === leftId);
      }

      if (!matchedRight && isReview && studentAnsText) {
        matchedRight = rightItems.find(
          (r) =>
            r.text.toLowerCase().includes(studentAnsText) ||
            studentAnsText.includes(r.text.toLowerCase()),
        );
      }

      if (matchedRight) {
        map[leftId] = String(matchedRight.id);
      }
    });
    return map;
  }, [leftItems, rightItems, answers, isReview]);

  // 5. Audio playback
  const playYoudaoFallback = (word: string) => {
    try {
      const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(
        word,
      )}&type=2`;
      const audio = new Audio(url);
      audio.onended = () => setPlayingWord(null);
      audio.onerror = () => setPlayingWord(null);
      audio.play().catch(() => setPlayingWord(null));
    } catch {
      setPlayingWord(null);
    }
  };

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
    [resolveAudioUrl],
  );

  // 6. Click handlers
  const handleLeftClick = (item: LeftWordItem) => {
    if (disabled || isReview) return;
    const leftId = String(item.id);

    handlePlayAudio(item.word, item.audioUrl);

    if (connections[leftId]) {
      onAnswersChange(leftId, {
        selectedOptionId: undefined,
        textAnswer: "",
      });
      setSelectedLeftId(leftId);
      setSelectedRightId(null);
      return;
    }

    if (selectedRightId) {
      const rightItem = rightItems.find((r) => String(r.id) === String(selectedRightId));
      if (rightItem) {
        onAnswersChange(leftId, {
          selectedOptionId: String(rightItem.optionId || rightItem.questionId),
          textAnswer: String(rightItem.text).trim(),
        });
      }
      setSelectedLeftId(null);
      setSelectedRightId(null);
      return;
    }

    setSelectedLeftId((prev) => (prev === leftId ? null : leftId));
  };

  const handleRightClick = (item: RightMeaningItem) => {
    if (disabled || isReview) return;
    const rightId = String(item.id);

    const linkedLeftId = Object.keys(connections).find(
      (lId) => String(connections[lId]) === rightId,
    );

    if (linkedLeftId) {
      onAnswersChange(String(linkedLeftId), {
        selectedOptionId: undefined,
        textAnswer: "",
      });
      setSelectedRightId(rightId);
      setSelectedLeftId(null);
      return;
    }

    if (selectedLeftId) {
      const leftItem = leftItems.find((l) => String(l.id) === String(selectedLeftId));
      if (leftItem) {
        onAnswersChange(String(leftItem.id), {
          selectedOptionId: String(item.optionId || item.questionId),
          textAnswer: String(item.text).trim(),
        });
      }
      setSelectedLeftId(null);
      setSelectedRightId(null);
      return;
    }

    setSelectedRightId((prev) => (prev === rightId ? null : rightId));
  };

  const handleReset = () => {
    if (disabled || isReview) return;
    if (window.confirm("Bạn có chắc chắn muốn đặt lại toàn bộ các đường nối?")) {
      leftItems.forEach((left) => {
        onAnswersChange(String(left.id), {
          selectedOptionId: undefined,
          textAnswer: "",
        });
      });
      setSelectedLeftId(null);
      setSelectedRightId(null);
    }
  };

  // 7. Ray calculations
  const updateRayPositions = useCallback(() => {
    if (!containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) return;

    const list: RayLine[] = [];

    Object.entries(connections).forEach(([lId, rId]) => {
      const leftEl = leftAnchorRefs.current[lId];
      const rightEl = rightAnchorRefs.current[rId];
      if (leftEl && rightEl) {
        const lRect = leftEl.getBoundingClientRect();
        const rRect = rightEl.getBoundingClientRect();

        const leftItem = leftItems.find((l) => l.id === lId);
        const rightItem = rightItems.find((r) => r.id === rId);

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

  return {
    containerRef,
    leftAnchorRefs,
    rightAnchorRefs,
    leftItems,
    rightItems,
    connections,
    selectedLeftId,
    selectedRightId,
    playingWord,
    rayCoordinates,
    handlePlayAudio,
    handleLeftClick,
    handleRightClick,
    handleReset,
  };
}

export default useMatchingLines;
