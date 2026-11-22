import { useState, useEffect, useMemo, useRef } from "react";
import { teacherApi } from "../../api/teacherApi";
import { notifyTeacherTaskStatus } from "@/utils/teacherTaskNotification";
import { isGradingRubricOrMetaText } from "@/utils/sampleAudioPlayer";
import {
  downloadExcelTemplate,
  downloadSkillExcelTemplate,
  groupKeyOf,
  normalizeTrueFalse,
  parseExcelRows,
  parseRawText,
  readSpreadsheetFile,
} from "../../utils/assignmentImport";
import type {
  ImportGroup,
  ImportReport,
  ImportResult,
  SkillKey,
  SpeakingModeKey,
} from "../../utils/assignmentImport";
import {
  SUB_PARTS_CONFIG,
  getLevelQuestionFormats,
  getSuggestedTopics,
  type QuestionDraft,
} from "./assignmentModalConfig";

export interface UseCreateAssignmentFormOptions {
  isOpen: boolean;
  classId: string;
  initialDate?: string;
  onSuccess?: () => void;
  onAssignmentCreated?: () => void;
  onClose: () => void;
  initialData?: any;
  mode?: "CREATE" | "EDIT";
  initialSkillType?: string;
  initialPlanId?: string;
}

interface SavePayload {
  skill: SkillKey;
  shadowing: boolean;
  speakingMode?: SpeakingModeKey;
  questions: QuestionDraft[];
  readingPassage: string;
  listeningScript: string;
  audioUrl: string;
  subFormat: string;
  title: string;
}

export function useCreateAssignmentForm({
  isOpen,
  classId,
  initialDate,
  onSuccess,
  onAssignmentCreated,
  onClose,
  initialData,
  mode = "CREATE",
  initialSkillType,
  initialPlanId,
}: UseCreateAssignmentFormOptions) {
  const [step, setStep] = useState<number>(1);
  const [creationSource, setCreationSource] = useState<
    "AI" | "TEXT_AI" | "EXCEL" | "MANUAL" | "RESOURCE"
  >("AI");

  // Neural Studio TTS state
  const [isSynthesizingTts, setIsSynthesizingTts] = useState<boolean>(false);
  const [ttsVoice, setTtsVoice] = useState<string>("af_heart");
  const [ttsSpeed, setTtsSpeed] = useState<number>(1.0);
  const [synthesizeAudioError, setSynthesizeAudioError] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const [rawText, setRawText] = useState<string>("");
  const [mainAudioUrl, setMainAudioUrl] = useState<string>("");
  const [mainTranscript, setMainTranscript] = useState<string>("");
  const [readingPassageText, setReadingPassageText] = useState<string>("");
  const [isUploadingAudio, setIsUploadingAudio] = useState<boolean>(false);
  const [audioUploadSuccess, setAudioUploadSuccess] = useState<string | null>(null);
  const [isPlayingMainAudio, setIsPlayingMainAudio] = useState<boolean>(false);

  const [assignmentType, setAssignmentType] = useState<
    "VOCABULARY" | "READING" | "LISTENING" | "SPEAKING" | "WRITING" | "GRAMMAR"
  >("READING");
  const [speakingMode, setSpeakingMode] = useState<SpeakingModeKey>("QA");
  const [writingTaskType, setWritingTaskType] = useState<"TASK_1" | "TASK_2">("TASK_2");
  const [readingPassageIelts, setReadingPassageIelts] = useState<1 | 2 | 3>(1);
  const [selectedSubFormat, setSelectedSubFormat] = useState<string>("READING_FILL_BLANK");

  // Data sources
  const [globalResources, setGlobalResources] = useState<any[]>([]);
  const [dailyPlans, setDailyPlans] = useState<any[]>([]);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("NEW_DAY");

  // AI Generator state
  const [aiTopic, setAiTopic] = useState<string>(
    "Anna's Daily Routine and Her Job at a Small Café"
  );
  const [aiLevel, setAiLevel] = useState<string>("A1");
  const [aiQuestionCount, setAiQuestionCount] = useState<number>(5);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Questions editor list
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);

  // Metadata & Schedule
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState<string>(
    initialDate || new Date().toISOString().split("T")[0]
  );
  const [startTime, setStartTime] = useState<string>("08:00");
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split("T")[0]
  );
  const [targetStudents, setTargetStudents] = useState<"ALL" | "WEAK_STUDENTS">("ALL");
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">("MEDIUM");
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(30);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(30);
  const [maxAllowedErrorPercent, setMaxAllowedErrorPercent] = useState<number>(20);
  const [maxAttempts, setMaxAttempts] = useState<number>(3);
  const [status, setStatus] = useState<"PUBLISHED" | "DRAFT">("PUBLISHED");

  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Kết quả nạp từ Excel / Text
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importGroups, setImportGroups] = useState<ImportGroup[]>([]);
  const [showCheatSheetModal, setShowCheatSheetModal] = useState<boolean>(false);
  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);

  const loadInitialData = async () => {
    try {
      const [resResources, resPlans]: any = await Promise.allSettled([
        teacherApi.getGlobalResources(),
        teacherApi.getDailyPlans(classId),
      ]);
      if (resResources.status === "fulfilled" && resResources.value?.data) {
        setGlobalResources(resResources.value.data?.data || []);
      }
      if (resPlans.status === "fulfilled" && resPlans.value?.data) {
        const loadedPlans = resPlans.value.data?.data || [];
        setDailyPlans(loadedPlans);
        const byPlanId = initialPlanId
          ? loadedPlans.find((p: any) => p.id === initialPlanId)
          : null;
        const targetDate = initialDate || scheduledDate;
        const match = byPlanId || loadedPlans.find((p: any) => p.scheduledDate === targetDate);
        if (match) {
          setSelectedPlanId(match.id);
          if (match.scheduledDate) {
            setScheduledDate(match.scheduledDate);
          }
        } else if (initialDate) {
          setSelectedPlanId("NEW_DAY");
          setScheduledDate(initialDate);
        } else if (loadedPlans.length > 0) {
          setSelectedPlanId(loadedPlans[0].id);
          setScheduledDate(loadedPlans[0].scheduledDate);
        } else {
          setSelectedPlanId("NEW_DAY");
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen && classId) {
      loadInitialData();
    }
  }, [isOpen, classId, initialDate, initialPlanId]);

  useEffect(() => {
    const cleanupAudio = () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      const mainElem = document.getElementById(
        "main-assignment-audio"
      ) as HTMLAudioElement | null;
      if (mainElem) {
        mainElem.pause();
        mainElem.remove();
      }
      setIsPlayingMainAudio(false);
      setPlayingPreviewId(null);
    };

    if (!isOpen) {
      cleanupAudio();
    }
    return () => {
      cleanupAudio();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (mode === "EDIT" && initialData) {
      setTitle(initialData.title || "");
      setDescription(initialData.description || "");
      const loadedSkill = initialData.skillType
        ? (initialData.skillType.toUpperCase() as SkillKey)
        : "READING";
      if (initialData.skillType) {
        setAssignmentType(loadedSkill as any);
      }

      const rawMetaText = `${initialData.title || ""} ${initialData.description || ""}`.toLowerCase();
      const hasPart2Hint =
        rawMetaText.includes("part 2") ||
        rawMetaText.includes("part_2") ||
        rawMetaText.includes("cue card") ||
        (initialData.questions || []).some((q: any) =>
          String(q?.promptText || "").toLowerCase().includes("you should say:")
        );
      const hasPart3Hint =
        rawMetaText.includes("part 3") ||
        rawMetaText.includes("part_3") ||
        rawMetaText.includes("thảo luận chuyên sâu");
      const hasQaHint =
        rawMetaText.includes("q&a") ||
        rawMetaText.includes("hỏi đáp") ||
        rawMetaText.includes("hỏi - đáp") ||
        rawMetaText.includes("phỏng vấn") ||
        rawMetaText.includes("speaking_qa");
      const hasShadowHint =
        rawMetaText.includes("shadow") ||
        rawMetaText.includes("nhại") ||
        rawMetaText.includes("đọc đuổi");

      const inferredSpeakingMode: SpeakingModeKey = hasPart2Hint
        ? "PART_2"
        : hasPart3Hint
        ? "PART_3"
        : hasShadowHint && !hasQaHint
        ? "SHADOWING"
        : "QA";

      if (loadedSkill === "SPEAKING") {
        setSpeakingMode(inferredSpeakingMode);
        setSelectedSubFormat(
          inferredSpeakingMode === "PART_2"
            ? "SPEAKING_PART_2"
            : inferredSpeakingMode === "PART_3"
            ? "SPEAKING_PART_3"
            : inferredSpeakingMode === "SHADOWING"
            ? "SPEAKING_SHADOWING"
            : "SPEAKING_QA"
        );
      }

      setTimeLimitMinutes(initialData.timeLimitMinutes || initialData.estimatedMinutes || 30);
      setEstimatedMinutes(initialData.timeLimitMinutes || initialData.estimatedMinutes || 30);
      const errPct = initialData.maxAllowedErrorPercent != null
        ? initialData.maxAllowedErrorPercent
        : (initialData.passScore != null ? Math.max(0, 100 - (initialData.passScore <= 10 ? initialData.passScore * 10 : initialData.passScore)) : 20);
      setMaxAllowedErrorPercent(errPct);
      setMaxAttempts(initialData.maxAttempts || 3);
      if (initialData.dueDate) {
        setDueDate(initialData.dueDate.split("T")[0]);
      }
      if (initialData.audioUrl) {
        setMainAudioUrl(initialData.audioUrl);
      }
      if (initialData.listeningScript) {
        setMainTranscript(initialData.listeningScript);
      }

      if (initialData.description && initialData.description.includes("[READING PASSAGE]")) {
        const parts = initialData.description.split("[READING PASSAGE]\n");
        if (parts[1]) {
          const passageAndRest = parts[1].split("\n\n");
          setReadingPassageText(passageAndRest[0] || "");
        }
      }

      if (initialData.questions && initialData.questions.length > 0) {
        const isNonShadowSpeaking =
          loadedSkill === "SPEAKING" && inferredSpeakingMode !== "SHADOWING";
        const mapped: QuestionDraft[] = initialData.questions.map((q: any) => {
          let opts = (q.options || []).map((o: any) => o.optionText || "");
          if (opts.length === 0 && q.questionType === "MULTIPLE_CHOICE") {
            opts = ["", "", "", ""];
          }
          const fallbackMatchAns =
            q.questionType === "MATCHING" ? q.options?.[0]?.matchText || "" : "";
          return {
            id: q.id || crypto.randomUUID(),
            prompt: q.promptText || "",
            questionType: q.questionType || "MULTIPLE_CHOICE",
            options: opts,
            correctAnswer: q.correctAnswer || fallbackMatchAns || "",
            explanation: q.explanation || "",
            referenceAudioUrl: isNonShadowSpeaking ? "" : q.mediaUrl || "",
            transcript: isNonShadowSpeaking ? "" : q.transcript || "",
            points: q.points || 1,
          };
        });
        setQuestions(mapped);
      }

      setStep(2);
    } else {
      if (initialDate) {
        setScheduledDate(initialDate);
      }
      if (initialSkillType) {
        const upperSkill = initialSkillType.toUpperCase() as any;
        setAssignmentType(upperSkill);
        if (upperSkill === "SPEAKING") {
          const defaultFmt = getLevelQuestionFormats("SPEAKING", aiLevel)[0]?.code || "SPEAKING_QA";
          setSelectedSubFormat(defaultFmt);
          setSpeakingMode(
            defaultFmt.includes("PART_2")
              ? "PART_2"
              : defaultFmt.includes("PART_3")
              ? "PART_3"
              : defaultFmt.includes("SHADOWING")
              ? "SHADOWING"
              : "QA"
          );
        }
      }
      if (initialPlanId) {
        setSelectedPlanId(initialPlanId);
      }
      setStep(1);
    }
  }, [isOpen, mode, initialData, initialDate, initialSkillType, initialPlanId]);

  const prevAssignmentTypeRef = useRef<string>(assignmentType);
  useEffect(() => {
    const prevSkill = prevAssignmentTypeRef.current;
    if (prevSkill === assignmentType) return;
    prevAssignmentTypeRef.current = assignmentType;
    if (mode === "EDIT") return;

    if (assignmentType === "WRITING") {
      const upperFmt = String(selectedSubFormat || "").toUpperCase();
      const isEssayFmt = !["WORD_ARRANGEMENT", "UNSCRAMBLE", "WORD_ORDER", "KEYWORD", "SENTENCE"].some((kw) =>
        upperFmt.includes(kw)
      );
      if (isEssayFmt) {
        setAiQuestionCount(1);
      }
    } else if (aiQuestionCount < 3) {
      setAiQuestionCount(5);
    }
  }, [assignmentType, mode, selectedSubFormat, aiQuestionCount]);

  useEffect(() => {
    if (mode === "EDIT") return;
    const subs = SUB_PARTS_CONFIG[assignmentType] || [];
    const currentSub = subs.find((s) => s.code === selectedSubFormat) || subs[0];
    const subLabel = currentSub ? currentSub.shortLabel : assignmentType;
    setTitle(`${subLabel} (${aiLevel}) - ${scheduledDate}`);
  }, [mode, assignmentType, selectedSubFormat, aiLevel, scheduledDate]);

  const currentLevelFormats = useMemo(() => {
    return getLevelQuestionFormats(assignmentType, aiLevel);
  }, [assignmentType, aiLevel]);

  const updateTopicSuggestion = (
    type: string,
    level: string,
    subCode?: string,
    writingTask?: string
  ) => {
    const topics = getSuggestedTopics(
      type,
      level,
      subCode || selectedSubFormat,
      readingPassageIelts,
      writingTask || writingTaskType
    );
    if (topics.length > 0) {
      setAiTopic(topics[0]);
    }
  };

  const handleSelectSubFormat = (code: string, targetLevel?: string) => {
    const lvl = targetLevel || aiLevel;
    setSelectedSubFormat(code);
    if (assignmentType === "SPEAKING") {
      if (code.includes("PART_2")) setSpeakingMode("PART_2");
      else if (code.includes("PART_3")) setSpeakingMode("PART_3");
      else if (code.includes("SHADOWING")) setSpeakingMode("SHADOWING");
      else setSpeakingMode("QA");
    }
    if (assignmentType === "WRITING") {
      if (code === "WRITING_IELTS_TASK1") setWritingTaskType("TASK_1");
      if (code === "WRITING_IELTS_TASK2" || code === "WRITING_DISCURSIVE_ESSAY") {
        setWritingTaskType("TASK_2");
      }
      const upperCode = code.toUpperCase();
      const isEssayWriting = !["WORD_ARRANGEMENT", "UNSCRAMBLE", "WORD_ORDER", "KEYWORD", "SENTENCE"].some((kw) =>
        upperCode.includes(kw)
      );
      if (isEssayWriting && aiQuestionCount > 5) {
        setAiQuestionCount(1);
      } else if (!isEssayWriting && aiQuestionCount < 3) {
        setAiQuestionCount(5);
      }
    }
    updateTopicSuggestion(assignmentType, lvl, code);
  };

  const handleSelectLevel = (newLevel: string) => {
    setAiLevel(newLevel);
    const nextFormats = getLevelQuestionFormats(assignmentType, newLevel);
    if (nextFormats.length > 0 && !nextFormats.some((f) => f.code === selectedSubFormat)) {
      handleSelectSubFormat(nextFormats[0].code, newLevel);
    } else {
      updateTopicSuggestion(assignmentType, newLevel);
    }
  };

  // AI Question Generation
  const handleGenerateAiQuestions = async (customTopicOrPrompt?: string) => {
    setIsGeneratingAi(true);
    setAiError(null);
    setImportGroups([]);
    setImportReport(null);
    try {
      const rawTopicInput = (customTopicOrPrompt || aiTopic || "General Practice").trim();
      const promptToUse =
        assignmentType === "READING" &&
        aiLevel === "IELTS" &&
        readingPassageIelts &&
        !/^\s*passage\s+\d+/i.test(rawTopicInput)
          ? `Passage ${readingPassageIelts}: ${rawTopicInput}`
          : rawTopicInput;
      let exType = selectedSubFormat;
      if (assignmentType === "SPEAKING") {
        if (speakingMode === "SHADOWING" || selectedSubFormat?.includes("SHADOWING")) {
          exType = "SPEAKING_SHADOWING";
        } else if (speakingMode === "PART_2" || selectedSubFormat?.includes("PART_2")) {
          exType = "SPEAKING_PART_2";
        } else if (speakingMode === "PART_3" || selectedSubFormat?.includes("PART_3")) {
          exType = "SPEAKING_PART_3";
        } else {
          exType = "SPEAKING_QA";
        }
      } else if (assignmentType === "GRAMMAR") {
        if (!exType || !exType.startsWith("GRAMMAR")) {
          exType = "GRAMMAR_MULTIPLE_CHOICE";
        }
      } else if (assignmentType === "READING") {
        if (!exType || !exType.startsWith("READING")) {
          exType = "READING_MULTIPLE_CHOICE";
        }
      } else if (assignmentType === "VOCABULARY") {
        if (!exType || !exType.startsWith("VOCAB")) {
          exType = "VOCAB_MEANING_TO_WORD";
        }
      } else if (assignmentType === "LISTENING") {
        if (!exType || !exType.startsWith("LISTENING")) {
          exType = "LISTENING_MC";
        }
      } else if (assignmentType === "WRITING") {
        if (!exType || !exType.startsWith("WRITING")) {
          exType = "WRITING_PARAGRAPH";
        }
      }

      const res: any = await teacherApi.generateAiQuiz({
        topic: promptToUse,
        level: aiLevel,
        questionCount: aiQuestionCount,
        exerciseType: exType,
        skillType: assignmentType,
        assignmentType: assignmentType,
      });

      const data = res.data?.data || res.data;
      let rawJsonStr = data?.rawResponseJson;
      let parsed: any = null;

      if (typeof rawJsonStr === "string") {
        try {
          parsed = JSON.parse(rawJsonStr);
        } catch (e) {
          console.error("Lỗi parse rawResponseJson:", e);
        }
      } else if (typeof rawJsonStr === "object" && rawJsonStr !== null) {
        parsed = rawJsonStr;
      } else if (data?.questions) {
        parsed = data;
      }

      let rawQuestions = parsed?.questions || [];
      if ((!rawQuestions || rawQuestions.length === 0) && Array.isArray(parsed?.pairs)) {
        rawQuestions = parsed.pairs.map((p: any, idx: number) => ({
          questionType: "MATCHING",
          prompt: p.word || p.leftText || `Word ${idx + 1}`,
          promptText: p.word || p.leftText || `Word ${idx + 1}`,
          word: p.word || p.leftText,
          targetWord: p.word || p.leftText,
          ipa: p.ipa || "",
          correctAnswer: p.meaning || p.rightText || "",
          meaning: p.meaning || p.rightText,
          explanation: p.ipa
            ? `${p.ipa} - ${p.meaning || p.rightText || ""}`
            : p.meaning || p.rightText || "",
          options: [],
        }));
      }

      if (!rawQuestions || rawQuestions.length === 0) {
        const errorMsg =
          data?.message ||
          "AI không tạo được câu hỏi. Kiểm tra chủ đề/cấu hình.";
        setAiError(errorMsg);
        alert(`⚠️ ${errorMsg}`);
        return;
      }

      const readingPassage = (parsed?.readingPassage || "").trim();
      if (readingPassage) {
        setReadingPassageText(readingPassage);
      }

      const listeningPassage = (
        parsed?.listeningPassage ||
        parsed?.audioScript ||
        rawQuestions[0]?.transcript ||
        ""
      ).trim();
      if (assignmentType === "LISTENING" && listeningPassage) {
        setMainTranscript(listeningPassage);
      }

      const preGeneratedListeningAudio = (
        parsed?.audioUrl ||
        parsed?.mediaUrl ||
        rawQuestions[0]?.audioUrl ||
        rawQuestions[0]?.mediaUrl ||
        ""
      ).trim();
      if (
        assignmentType === "LISTENING" &&
        preGeneratedListeningAudio &&
        !preGeneratedListeningAudio.includes("translate.google")
      ) {
        setMainAudioUrl(preGeneratedListeningAudio);
      }

      const detectedMode = String(parsed?.speakingMode || "").toUpperCase();
      const isPart2Task =
        assignmentType === "SPEAKING" &&
        (speakingMode === "PART_2" ||
          selectedSubFormat.includes("PART_2") ||
          detectedMode === "PART_2");
      const isPart3Task =
        assignmentType === "SPEAKING" &&
        !isPart2Task &&
        (speakingMode === "PART_3" ||
          selectedSubFormat.includes("PART_3") ||
          detectedMode === "PART_3");
      const isShadowingTask =
        assignmentType === "SPEAKING" &&
        !isPart2Task &&
        !isPart3Task &&
        (speakingMode === "SHADOWING" ||
          selectedSubFormat.includes("SHADOWING") ||
          detectedMode === "SHADOWING");
      if (isPart2Task) {
        setSpeakingMode("PART_2");
        setSelectedSubFormat("SPEAKING_PART_2");
      } else if (isPart3Task) {
        setSpeakingMode("PART_3");
        setSelectedSubFormat("SPEAKING_PART_3");
      } else if (isShadowingTask) {
        setSpeakingMode("SHADOWING");
        setSelectedSubFormat("SPEAKING_SHADOWING");
      } else if (assignmentType === "SPEAKING") {
        setSpeakingMode("QA");
        setSelectedSubFormat("SPEAKING_QA");
      }

      const formatted: QuestionDraft[] = rawQuestions.map((q: any, idx: number) => {
        let questionPrompt =
          q.prompt ||
          q.question ||
          q.promptText ||
          q.sentence ||
          q.text ||
          (q.definition
            ? `Đoán từ: "${q.definition}"${
                q.word ? ` (${q.word.charAt(0)}...)` : ""
              }`
            : "") ||
          (q.word ? `Từ vựng: "${q.word}"` : "") ||
          `Câu hỏi ${idx + 1}`;

        if (questionPrompt.includes("[READING PASSAGE]")) {
          const parts = questionPrompt.split(/\[READING PASSAGE\]/i);
          const after = parts[1] || "";
          const dIdx = after.lastIndexOf("\n\n");
          if (dIdx !== -1) {
            const extracted = after.substring(0, dIdx).trim();
            if (extracted && !readingPassage) {
              setReadingPassageText(extracted);
            }
            questionPrompt = after.substring(dIdx + 2).trim();
          } else {
            questionPrompt = after.trim();
          }
        }

        let qType: QuestionDraft["questionType"] = "MULTIPLE_CHOICE";
        let opts: string[] = [];
        let correct = String(
          q.correctAnswer ||
            q.answer ||
            q.correct ||
            q.correct_answer ||
            q.targetWord ||
            q.word ||
            ""
        ).trim();

        const subFormat = String(selectedSubFormat || "").toUpperCase();
        const rawQType = String(q.questionType || q.type || "").toUpperCase();

        const isFillInBlank =
          subFormat.includes("FILL") ||
          subFormat.includes("BLANK") ||
          subFormat.includes("WORD_FORM") ||
          subFormat.includes("MEANING_TO_WORD") ||
          subFormat.includes("DEFINITION") ||
          subFormat.includes("DICTATION") ||
          subFormat.includes("SPELL") ||
          subFormat.includes("CONJUGAT") ||
          subFormat.includes("WORD_ARRANGEMENT") ||
          subFormat.includes("UNSCRAMBLE") ||
          subFormat.includes("ERROR_CORRECTION") ||
          subFormat.includes("TRANSFORMATION") ||
          rawQType.includes("FILL") ||
          rawQType.includes("BLANK") ||
          rawQType.includes("SHORT_ANSWER") ||
          rawQType.includes("WORD_ARRANGEMENT") ||
          rawQType.includes("SPELL") ||
          rawQType.includes("COMPLETION") ||
          rawQType.includes("WORD_FORM") ||
          rawQType.includes("FORM") ||
          rawQType.includes("CONJUGAT") ||
          rawQType.includes("DICTATION") ||
          rawQType.includes("TRANSFORM") ||
          rawQType.includes("CORRECTION") ||
          rawQType.includes("UNSCRAMBLE") ||
          rawQType.includes("GAP");

        const isTrueFalse =
          subFormat.includes("TRUE_FALSE") ||
          subFormat.includes("YES_NO") ||
          rawQType.includes("TRUE") ||
          rawQType.includes("FALSE") ||
          rawQType.includes("YES_NO");

        const hasMcOptions =
          Array.isArray(q.options || q.choices || q.answers) &&
          (q.options || q.choices || q.answers).length >= 2;
        const isMatching =
          (assignmentType === "VOCABULARY" &&
            (subFormat.includes("MATCHING") || subFormat.includes("MATCH"))) ||
          ((rawQType.includes("MATCHING") || rawQType.includes("MATCH")) && !hasMcOptions);

        if (assignmentType === "SPEAKING") {
          qType = "AUDIO_RESPONSE";
          if (isShadowingTask) {
            const cleanRef = (correct || questionPrompt)
              .replace(
                /^(?:shadowing|repeat after me|listen and repeat|câu\s*\d+)[:\s\-–—]+/i,
                ""
              )
              .trim();
            questionPrompt = cleanRef;
            correct = cleanRef;
          } else {
            correct = correct || "";
          }
        } else if (assignmentType === "WRITING") {
          const isSentenceWriting =
            subFormat.includes("WORD_ARRANGEMENT") ||
            subFormat.includes("UNSCRAMBLE") ||
            subFormat.includes("WORD_ORDER") ||
            subFormat.includes("SENTENCE") ||
            subFormat.includes("KEYWORD") ||
            rawQType.includes("FILL") ||
            rawQType.includes("BLANK") ||
            rawQType.includes("ARRANGE") ||
            rawQType.includes("UNSCRAMBLE") ||
            questionPrompt.includes("______") ||
            questionPrompt.includes(" / ") ||
            questionPrompt.toLowerCase().includes("sắp xếp") ||
            questionPrompt.toLowerCase().includes("hoàn thành câu") ||
            questionPrompt.toLowerCase().includes("từ gợi ý");

          if (isSentenceWriting) {
            qType = "FILL_IN_BLANK";
            correct = correct || q.correctAnswer || "";
          } else {
            qType = "ESSAY";
            correct = correct || q.correctAnswer || "";
          }
        } else if (isMatching) {
          qType = "MATCHING";
          correct = String(q.correctAnswer || q.meaning || q.rightText || "").trim();
          questionPrompt = String(
            q.prompt ||
              q.promptText ||
              q.word ||
              q.targetWord ||
              q.leftText ||
              `Word ${idx + 1}`
          ).trim();
          opts = [];
        } else if (isFillInBlank) {
          qType = "FILL_IN_BLANK";
        } else if (isTrueFalse) {
          qType = "TRUE_FALSE";
          const upperAns = (correct || "TRUE").trim().toUpperCase().replace(/_/g, " ");
          const mappedTf =
            upperAns === "YES" || upperAns === "T" || upperAns === "TRUE"
              ? "TRUE"
              : upperAns === "NO" || upperAns === "F" || upperAns === "FALSE"
              ? "FALSE"
              : upperAns.includes("NOT GIVEN") || upperAns === "NG"
              ? "NOT GIVEN"
              : normalizeTrueFalse(correct) || "TRUE";
          correct = mappedTf;
          opts = ["TRUE", "FALSE", "NOT GIVEN"];
        } else {
          qType = "MULTIPLE_CHOICE";
          const stripOptLabel = (val: string) =>
            val.trim().replace(/^(?:[A-Da-d][.)\-:]\s+|\([A-Da-d]\)\s+)/, "").trim();

          const rawOptions = q.options || q.choices || q.answers || q.distractors;
          if (Array.isArray(rawOptions) && rawOptions.length > 0) {
            opts = rawOptions
              .map((opt: any) =>
                stripOptLabel(
                  typeof opt === "string"
                    ? opt
                    : opt.optionText || opt.text || opt.label || opt.value || ""
                )
              )
              .filter((s: string) => typeof s === "string" && s.trim().length > 0);

            const correctOpt = rawOptions.find(
              (opt: any) => opt && (opt.isCorrect || opt.correct)
            );
            if (correctOpt) {
              correct = stripOptLabel(
                typeof correctOpt === "string"
                  ? correctOpt
                  : correctOpt.optionText || correctOpt.text || correctOpt.label || ""
              );
            }
          } else if (typeof rawOptions === "object" && rawOptions !== null) {
            const keys = Object.keys(rawOptions);
            opts = keys
              .map((k) => {
                const val = rawOptions[k];
                return stripOptLabel(typeof val === "string" ? val : String(val));
              })
              .filter((s: string) => s.trim().length > 0);
            if (keys.includes(correct)) {
              correct = stripOptLabel(String(rawOptions[correct]));
            }
          } else if (q.optionA || q.optionB || q.optionC || q.optionD) {
            opts = [q.optionA, q.optionB, q.optionC, q.optionD]
              .filter((s: any) => typeof s === "string" && s.trim().length > 0)
              .map((s: string) => stripOptLabel(s));
          }

          if (opts.length > 0) {
            const rawTrimmed = String(correct || "").trim();
            const letterMatch = rawTrimmed.match(/^\(?([A-Da-d])\)?(?:[.)\-:]\s*(.*))?$/);
            const cleanCorrect = stripOptLabel(rawTrimmed);
            const letterIdx =
              letterMatch && (!letterMatch[2] || !letterMatch[2].trim())
                ? ["A", "B", "C", "D"].indexOf(letterMatch[1].toUpperCase())
                : -1;

            if (letterIdx >= 0 && opts[letterIdx]) {
              correct = opts[letterIdx];
            } else if (cleanCorrect) {
              const matchedOpt = opts.find(
                (o) => o.trim().toLowerCase() === cleanCorrect.toLowerCase()
              );
              if (matchedOpt) {
                correct = matchedOpt;
              } else {
                // Keep the AI's intended correct answer aligned with explanation instead of overwriting with opts[0]
                if (opts.length < 4) {
                  opts = [...opts, cleanCorrect];
                } else {
                  opts = [...opts.slice(0, opts.length - 1), cleanCorrect];
                }
                correct = cleanCorrect;
              }
            } else {
              correct = opts[0];
            }
          }

          if (opts.length < 2) {
            if (correct && correct.trim()) {
              qType = "FILL_IN_BLANK";
              opts = [];
            } else {
              throw new Error(
                `Câu ${idx + 1} ("${questionPrompt}") thiếu đáp án/lựa chọn từ AI.`
              );
            }
          }
        }

        let rawAudio = "";
        let targetWord = "";
        let ipa = "";
        let transcript = q.transcript || listeningPassage || "";

        if (assignmentType === "VOCABULARY") {
          targetWord = q.targetWord || q.word || correct || "";
          ipa = q.ipa || "";
          rawAudio = q.audioUrl || q.mediaUrl || "";
          const cleanWord = targetWord
            .replace(/\[.*?\]/g, "")
            .replace(/[^a-zA-Z\s-]/g, "")
            .trim();
          if (cleanWord && (!rawAudio || rawAudio.includes("api.dictionaryapi.dev"))) {
            rawAudio = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(
              cleanWord
            )}&type=2`;
          }
        } else if (assignmentType === "LISTENING") {
          rawAudio = "";
          transcript = "";
        } else if (assignmentType === "SPEAKING") {
          if (!isShadowingTask) {
            rawAudio = "";
            transcript = "";
          } else {
            rawAudio = q.audioUrl || q.mediaUrl || "";
            if (rawAudio.includes("translate.google")) {
              rawAudio = "";
            }
          }
        }

        return {
          id: `q-ai-${Date.now()}-${idx}`,
          prompt: questionPrompt,
          questionType: qType,
          options: opts,
          correctAnswer: correct,
          explanation:
            q.explanation ||
            q.meaning ||
            (q.part_of_speech ? `Từ loại: ${q.part_of_speech}` : "") ||
            "",
          referenceAudioUrl: rawAudio,
          ipa: ipa,
          targetWord: targetWord,
          transcript: transcript,
        };
      });

      setQuestions(formatted);
      setAiError(null);
      setStep(2);
    } catch (err: any) {
      console.error("AI Generation error:", err);
      const isTimeoutError =
        err?.code === "ECONNABORTED" ||
        String(err?.message || "").toLowerCase().includes("timeout");
      const errMsg = isTimeoutError
        ? "Quá thời gian chờ phản hồi từ AI (timeout). Vui lòng thử lại hoặc giảm số câu/đề."
        : err?.response?.status === 429
        ? err?.response?.data?.message ||
          "Bạn thao tác AI quá nhanh hoặc đã hết hạn mức. Vui lòng đợi 1 phút rồi thử lại."
        : err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          "Lỗi gọi AI tạo bài tập.";
      setAiError(errMsg);
      alert(`Lỗi AI:\n${errMsg}`);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleAddBlankQuestion = () => {
    const isSpeaking = assignmentType === "SPEAKING";
    const isWriting = assignmentType === "WRITING";
    const isSentenceWriting =
      isWriting &&
      (selectedSubFormat.includes("WORD_ARRANGEMENT") ||
        selectedSubFormat.includes("UNSCRAMBLE") ||
        selectedSubFormat.includes("WORD_ORDER") ||
        selectedSubFormat.includes("SENTENCE") ||
        selectedSubFormat.includes("KEYWORD"));

    const newQ: QuestionDraft = {
      id: `q-manual-${Date.now()}`,
      prompt: "",
      questionType: isSpeaking
        ? "AUDIO_RESPONSE"
        : isSentenceWriting
        ? "FILL_IN_BLANK"
        : isWriting
        ? "ESSAY"
        : "MULTIPLE_CHOICE",
      options: isSpeaking || isWriting ? [] : ["", "", "", ""],
      correctAnswer: "",
    };
    setQuestions([...questions, newQ]);
  };

  const handleUpdateQuestion = (id: string, field: keyof QuestionDraft, val: any) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        const updated = { ...q, [field]: val };
        if (
          assignmentType === "SPEAKING" &&
          speakingMode === "SHADOWING" &&
          field === "prompt"
        ) {
          updated.correctAnswer = val;
        }
        return updated;
      })
    );
  };

  const handleDeleteQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const defaultSubFormatFor = (skill: SkillKey, mode: SpeakingModeKey): string => {
    if (skill === "SPEAKING") {
      if (mode === "PART_2") return "SPEAKING_PART_2";
      if (mode === "PART_3") return "SPEAKING_PART_3";
      return mode === "SHADOWING" ? "SPEAKING_SHADOWING" : "SPEAKING_QA";
    }
    const subs = SUB_PARTS_CONFIG[skill] || [];
    return subs[0]?.code || "";
  };

  const activeGroupKey = groupKeyOf(
    assignmentType,
    assignmentType === "SPEAKING" ? speakingMode : "QA"
  );

  const snapshotGroups = (): ImportGroup[] =>
    importGroups.map((g) =>
      g.key === activeGroupKey
        ? {
            ...g,
            questions,
            passage: g.skill === "LISTENING" ? mainTranscript : readingPassageText,
            audioUrl: g.skill === "LISTENING" ? mainAudioUrl : g.audioUrl,
          }
        : g
    );

  const loadGroup = (g: ImportGroup) => {
    setAssignmentType(g.skill);
    setSpeakingMode(g.speakingMode);
    setSelectedSubFormat(defaultSubFormatFor(g.skill, g.speakingMode));
    setQuestions(g.questions);
    setReadingPassageText(g.skill === "LISTENING" ? "" : g.passage);
    setMainTranscript(g.skill === "LISTENING" ? g.passage : "");
    setMainAudioUrl(g.skill === "LISTENING" ? g.audioUrl : "");
  };

  const handleSwitchGroup = (key: string) => {
    if (key === activeGroupKey) return;
    const synced = snapshotGroups();
    setImportGroups(synced);
    const target = synced.find((g) => g.key === key);
    if (target) loadGroup(target);
  };

  const applyImportResult = (result: ImportResult) => {
    setImportReport(result.report);
    if (result.groups.length === 0) return;
    setImportGroups(result.groups);
    setAiError(null);
    setSynthesizeAudioError(null);
    setAudioUploadSuccess(null);
    loadGroup(result.groups[0]);
    setStep(2);
  };

  const handleImportExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rows = await readSpreadsheetFile(file);
      if (rows.length === 0) {
        setImportReport({
          source: "EXCEL",
          totalRows: 0,
          imported: 0,
          errors: ["File Excel trống hoặc Sheet đầu không có dữ liệu."],
          warnings: [],
        });
        return;
      }
      applyImportResult(parseExcelRows(rows, assignmentType, speakingMode));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sai cấu trúc file";
      setImportReport({
        source: "EXCEL",
        totalRows: 0,
        imported: 0,
        errors: [`Lỗi đọc Excel: ${message}`],
        warnings: [],
      });
    } finally {
      e.target.value = "";
    }
  };

  const handleQuickParseText = () => {
    if (!rawText.trim()) {
      alert("Chưa có nội dung văn bản.");
      return;
    }
    applyImportResult(parseRawText(rawText, assignmentType, speakingMode));
  };

  const handleChangeQuestionType = (
    id: string,
    newType: QuestionDraft["questionType"]
  ) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id || q.questionType === newType) return q;
        if (newType === "MULTIPLE_CHOICE") {
          const opts = q.options.length > 0 ? [...q.options] : [];
          while (opts.length < 4) opts.push("");
          return {
            ...q,
            questionType: newType,
            options: opts,
            correctAnswer: opts.includes(q.correctAnswer) ? q.correctAnswer : "",
          };
        }
        if (newType === "TRUE_FALSE") {
          return {
            ...q,
            questionType: newType,
            options: ["TRUE", "FALSE", "NOT GIVEN"],
            correctAnswer: normalizeTrueFalse(q.correctAnswer) || "TRUE",
          };
        }
        return { ...q, questionType: newType, options: [] };
      })
    );
  };

  const handleAddOption = (id: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id && q.options.length < 6 ? { ...q, options: [...q.options, ""] } : q
      )
    );
  };

  const handleRemoveOption = (id: string, optionIndex: number) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id || q.options.length <= 2) return q;
        const removed = q.options[optionIndex];
        return {
          ...q,
          options: q.options.filter((_, i) => i !== optionIndex),
          correctAnswer: q.correctAnswer === removed ? "" : q.correctAnswer,
        };
      })
    );
  };

  const validateQuestions = (qs: QuestionDraft[], prefix: string): string[] => {
    const issues: string[] = [];
    qs.forEach((q, i) => {
      const tag = `${prefix}Câu ${i + 1}`;
      if (!q.prompt.trim()) issues.push(`${tag}: thiếu đề bài.`);
      if (q.questionType === "MULTIPLE_CHOICE") {
        const filled = q.options.filter((o) => o.trim());
        if (filled.length < 2) {
          issues.push(`${tag}: cần >= 2 lựa chọn.`);
        }
        if (!q.correctAnswer.trim() || !filled.includes(q.correctAnswer)) {
          issues.push(`${tag}: thiếu đáp án đúng khớp lựa chọn.`);
        }
      } else if (q.questionType === "TRUE_FALSE") {
        if (!normalizeTrueFalse(q.correctAnswer)) {
          issues.push(`${tag}: đáp án phải là TRUE / FALSE / NOT GIVEN.`);
        }
      } else if (q.questionType === "FILL_IN_BLANK" && !q.correctAnswer.trim()) {
        issues.push(`${tag}: thiếu đáp án điền từ.`);
      } else if (q.questionType === "MATCHING" && !q.correctAnswer.trim()) {
        issues.push(`${tag}: thiếu từ/nghĩa ghép cặp.`);
      }
    });
    return issues;
  };

  const handleGoToScheduleStep = () => {
    const synced = importGroups.length > 1 ? snapshotGroups() : [];
    const issues =
      synced.length > 1
        ? synced.flatMap((g) => validateQuestions(g.questions, `[${g.skill}] `))
        : validateQuestions(questions, "");

    if (questions.length === 0 && synced.length <= 1) {
      alert("Cần ít nhất 1 câu hỏi.");
      return;
    }
    if (issues.length > 0) {
      alert(
        `Cần sửa ${issues.length} lỗi:\n\n${issues
          .slice(0, 12)
          .join("\n")}${issues.length > 12 ? "\n..." : ""}`
      );
      return;
    }
    setStep(3);
  };

  const handleSynthesizeNeuralAudio = async () => {
    const textToSynthesize = (
      mainTranscript || questions.map((q) => q.prompt).join(". ")
    ).trim();
    if (!textToSynthesize) {
      setSynthesizeAudioError(
        "Cần nhập script nghe hoặc câu hỏi trước khi tạo audio."
      );
      return;
    }
    setSynthesizeAudioError(null);
    setAudioUploadSuccess(null);
    setIsSynthesizingTts(true);
    try {
      const res = await teacherApi.synthesizeAudio({
        text: textToSynthesize,
        voice: ttsVoice,
        speed: `${ttsSpeed}x`,
      });
      const url = res.data?.data || (res as any).data;
      if (url) {
        setMainAudioUrl(url);
        setAudioUploadSuccess("Đã tạo audio");
        setSynthesizeAudioError(null);
      }
    } catch (e: any) {
      const errMsg =
        e.response?.data?.message ||
        (e.code === "ECONNABORTED" || e.message?.includes("timeout")
          ? "Hết thời gian tạo audio. Bấm 'Thử tạo lại ngay'."
          : e.message || "Không tạo được audio.");
      setSynthesizeAudioError(errMsg);
    } finally {
      setIsSynthesizingTts(false);
    }
  };

  const handleUploadMainAudio = async (file: File) => {
    if (!file) return;
    setIsUploadingAudio(true);
    setAudioUploadSuccess(null);
    setSynthesizeAudioError(null);
    try {
      const res = await teacherApi.uploadAudioFile(file);
      const url = res.data?.data || (res as any).data;
      if (url) {
        setMainAudioUrl(url);
        setAudioUploadSuccess("Đã tải audio lên");
      }
    } catch (e: any) {
      setSynthesizeAudioError(
        "Lỗi tải audio: " + (e.response?.data?.message || e.message)
      );
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const resolvePlayableUrl = (url?: string) => {
    if (!url) return "";
    if (
      url.startsWith("http://") ||
      url.startsWith("https://") ||
      url.startsWith("blob:") ||
      url.startsWith("data:")
    ) {
      return url;
    }
    const base = (import.meta as any).env?.VITE_API_BASE_URL || "";
    return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const togglePlayMainAudio = () => {
    if (!mainAudioUrl) return;
    if (isPlayingMainAudio) {
      const audioElem = document.getElementById(
        "main-assignment-audio"
      ) as HTMLAudioElement;
      if (audioElem) {
        audioElem.pause();
        audioElem.currentTime = 0;
      }
      setIsPlayingMainAudio(false);
    } else {
      const resolved = resolvePlayableUrl(mainAudioUrl);
      let audioElem = document.getElementById(
        "main-assignment-audio"
      ) as HTMLAudioElement;
      if (!audioElem) {
        audioElem = new Audio(resolved);
        audioElem.id = "main-assignment-audio";
        document.body.appendChild(audioElem);
      } else {
        audioElem.src = resolved;
      }
      audioElem.onended = () => setIsPlayingMainAudio(false);
      audioElem.onerror = () => {
        setIsPlayingMainAudio(false);
        setSynthesizeAudioError("Không phát được audio");
      };
      audioElem
        .play()
        .then(() => setIsPlayingMainAudio(true))
        .catch(() => setIsPlayingMainAudio(false));
    }
  };

  const handlePreviewTranscriptAi = async () => {
    if (playingPreviewId === "main-transcript") {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setPlayingPreviewId(null);
      return;
    }
    const textToRead =
      mainTranscript.trim() || questions.map((q) => q.prompt).join(". ");
    if (!textToRead) {
      setSynthesizeAudioError("Chưa có script để nghe thử.");
      return;
    }
    setSynthesizeAudioError(null);
    setPlayingPreviewId("main-transcript");
    try {
      let urlToPlay = mainAudioUrl;
      if (!urlToPlay) {
        const res = await teacherApi.synthesizeAudio({
          text: textToRead,
          voice: ttsVoice,
          speed: `${ttsSpeed}x`,
        });
        urlToPlay = res.data?.data || (res as any).data;
        if (urlToPlay) {
          setMainAudioUrl(urlToPlay);
          setQuestions((prev) =>
            prev.map((q) => ({ ...q, referenceAudioUrl: urlToPlay }))
          );
        }
      }
      if (urlToPlay) {
        const audio = new Audio(resolvePlayableUrl(urlToPlay));
        previewAudioRef.current = audio;
        audio.onended = () => setPlayingPreviewId(null);
        audio.onerror = () => setPlayingPreviewId(null);
        await audio.play();
      } else {
        setPlayingPreviewId(null);
      }
    } catch (e: any) {
      setPlayingPreviewId(null);
      setSynthesizeAudioError(
        "Lỗi nghe thử: " + (e.response?.data?.message || e.message)
      );
    }
  };

  const handlePreviewAudio = async (q: QuestionDraft) => {
    if (playingPreviewId === q.id) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setPlayingPreviewId(null);
      return;
    }

    if (assignmentType === "LISTENING" || assignmentType === "SPEAKING") {
      const textToSpeak = (
        assignmentType === "SPEAKING"
          ? q.prompt
          : q.transcript || mainTranscript || q.prompt
      )
        .replace(/\[.*?\]/g, "")
        .replaceAll("_+", "blank")
        .trim();
      if (!textToSpeak) return;

      setPlayingPreviewId(q.id);
      try {
        let playUrl =
          q.referenceAudioUrl || (assignmentType === "LISTENING" ? mainAudioUrl : "");
        if (playUrl && playUrl.includes("translate.google")) {
          playUrl = "";
        }
        if (!playUrl) {
          const res = await teacherApi.synthesizeAudio({
            text: textToSpeak,
            voice: ttsVoice,
            speed: `${ttsSpeed}x`,
          });
          playUrl = res.data?.data || (res as any).data;
          if (playUrl) {
            handleUpdateQuestion(q.id, "referenceAudioUrl", playUrl);
          }
        }
        if (playUrl) {
          const audio = new Audio(resolvePlayableUrl(playUrl));
          previewAudioRef.current = audio;
          audio.onended = () => setPlayingPreviewId(null);
          audio.onerror = () => setPlayingPreviewId(null);
          await audio.play();
        } else {
          setPlayingPreviewId(null);
        }
      } catch (e) {
        console.warn("Lỗi phát thử audio:", e);
        setPlayingPreviewId(null);
      }
      return;
    }

    const rawTarget = q.targetWord || q.correctAnswer || q.prompt;
    const cleanWord = rawTarget
      .replace(/\[.*?\]/g, "")
      .replace(/[^a-zA-Z\s-]/g, "")
      .trim();
    const reliableUrl = cleanWord
      ? `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(
          cleanWord
        )}&type=2`
      : "";

    let playUrl = q.referenceAudioUrl;
    if (!playUrl || playUrl.includes("api.dictionaryapi.dev")) {
      playUrl = reliableUrl;
      if (reliableUrl) {
        handleUpdateQuestion(q.id, "referenceAudioUrl", reliableUrl);
      }
    }

    setPlayingPreviewId(q.id);
    if (playUrl) {
      const audio = new Audio(playUrl);
      previewAudioRef.current = audio;
      audio.onended = () => setPlayingPreviewId(null);
      audio.onerror = () => setPlayingPreviewId(null);
      audio.play().catch(() => setPlayingPreviewId(null));
    } else {
      setPlayingPreviewId(null);
    }
  };

  const handleFinalSave = async () => {
    if (!title.trim()) {
      alert("Thiếu tiêu đề bài tập.");
      return;
    }

    const synced = importGroups.length > 1 ? snapshotGroups() : [];
    const payloads: SavePayload[] =
      synced.length > 1
        ? synced.map((g) => ({
            skill: g.skill,
            shadowing: g.skill === "SPEAKING" && g.speakingMode === "SHADOWING",
            speakingMode: g.speakingMode,
            questions: g.questions,
            readingPassage: g.skill === "LISTENING" ? "" : g.passage,
            listeningScript: g.skill === "LISTENING" ? g.passage : "",
            audioUrl: g.skill === "LISTENING" ? g.audioUrl : "",
            subFormat: defaultSubFormatFor(g.skill, g.speakingMode),
            title: `${title.trim()} - ${g.skill}${
              g.skill === "SPEAKING"
                ? g.speakingMode === "SHADOWING"
                  ? " Shadowing"
                  : g.speakingMode === "PART_2"
                  ? " IELTS Part 2"
                  : g.speakingMode === "PART_3"
                  ? " IELTS Part 3"
                  : " Hỏi đáp"
                : ""
            }`,
          }))
        : [
            {
              skill: assignmentType,
              shadowing:
                assignmentType === "SPEAKING" &&
                (selectedSubFormat === "SPEAKING_SHADOWING" ||
                  selectedSubFormat.includes("SHADOWING") ||
                  (!selectedSubFormat.includes("PART_2") &&
                    !selectedSubFormat.includes("PART_3") &&
                    !selectedSubFormat.includes("QA") &&
                    speakingMode === "SHADOWING")),
              speakingMode:
                assignmentType === "SPEAKING"
                  ? selectedSubFormat.includes("PART_2")
                    ? "PART_2"
                    : selectedSubFormat.includes("PART_3")
                    ? "PART_3"
                    : selectedSubFormat.includes("SHADOWING") ||
                      (!selectedSubFormat.includes("QA") && speakingMode === "SHADOWING")
                    ? "SHADOWING"
                    : "QA"
                  : undefined,
              questions,
              readingPassage: readingPassageText,
              listeningScript: mainTranscript,
              audioUrl: mainAudioUrl,
              subFormat: selectedSubFormat,
              title: title.trim(),
            },
          ];

    const activePayloads = payloads.filter((p) => p.questions.length > 0);
    if (activePayloads.length === 0) {
      alert("Chưa có câu hỏi để lưu (quay lại Bước 2).");
      return;
    }
    const issues = activePayloads.flatMap((p) =>
      validateQuestions(p.questions, activePayloads.length > 1 ? `[${p.skill}] ` : "")
    );
    if (issues.length > 0) {
      alert(
        `Cần sửa ${issues.length} lỗi:\n\n${issues
          .slice(0, 12)
          .join("\n")}${issues.length > 12 ? "\n..." : ""}`
      );
      return;
    }

    if (mode === "EDIT" && initialData?.id) {
      setIsSaving(true);
      try {
        const p = activePayloads[0];
        const updatePayload = {
          classroomId: classId,
          title: title.trim(),
          description: `${
            p.readingPassage.trim() ? `[READING PASSAGE]\n${p.readingPassage.trim()}\n\n` : ""
          }${description}`,
          skillType: p.skill,
          timeLimitMinutes: timeLimitMinutes > 0 ? timeLimitMinutes : estimatedMinutes,
          maxAllowedErrorPercent: maxAllowedErrorPercent,
          passScore: (100 - maxAllowedErrorPercent) / 10,
          maxAttempts: maxAttempts > 0 ? maxAttempts : 3,
          dueDate: new Date(dueDate).toISOString(),
          audioUrl: p.skill === "LISTENING" ? p.audioUrl || undefined : undefined,
          listeningScript:
            p.skill === "LISTENING" ? p.listeningScript || undefined : undefined,
          questions: p.questions.map((q) => {
            const validShadowSource =
              q.correctAnswer && !isGradingRubricOrMetaText(q.correctAnswer)
                ? q.correctAnswer
                : q.prompt;
            const cleanShadowText = p.shadowing
              ? (validShadowSource || q.prompt || "").trim()
              : q.prompt.trim();

            const matchingOption = q.options.find((opt, idx) => {
              const letter = String.fromCharCode(65 + idx);
              return (
                letter === (q.correctAnswer || "").trim().toUpperCase() ||
                opt.trim().toLowerCase() === (q.correctAnswer || "").trim().toLowerCase()
              );
            });

            const resolvedCorrectAnswer =
              q.questionType === "MULTIPLE_CHOICE"
                ? matchingOption?.trim() || (q.correctAnswer || "").trim()
                : q.questionType === "TRUE_FALSE"
                ? normalizeTrueFalse(q.correctAnswer) || "TRUE"
                : p.shadowing
                ? cleanShadowText
                : (q.correctAnswer || "").trim();

            return {
              promptText: p.shadowing ? cleanShadowText : q.prompt.trim(),
              questionType: q.questionType,
              correctAnswer: resolvedCorrectAnswer,
              mediaUrl:
                p.skill === "VOCABULARY" || (p.skill === "SPEAKING" && p.shadowing)
                  ? q.referenceAudioUrl || undefined
                  : undefined,
              transcript:
                p.skill === "VOCABULARY" || (p.skill === "SPEAKING" && p.shadowing)
                  ? q.transcript || undefined
                  : undefined,
              explanation: q.explanation || "",
              points: q.points || 1,
              options:
                q.questionType === "MULTIPLE_CHOICE"
                  ? q.options
                      .filter((opt) => opt.trim().length > 0)
                      .map((optText, optIdx) => ({
                        optionText: optText.trim(),
                        isCorrect:
                          optText.trim().toLowerCase() === resolvedCorrectAnswer.toLowerCase() ||
                          String.fromCharCode(65 + optIdx) === resolvedCorrectAnswer.toUpperCase() ||
                          Boolean(matchingOption && optText.trim() === matchingOption.trim()),
                      }))
                  : q.questionType === "TRUE_FALSE"
                  ? [
                      {
                        optionText: "TRUE",
                        isCorrect: resolvedCorrectAnswer === "TRUE",
                      },
                      {
                        optionText: "FALSE",
                        isCorrect: resolvedCorrectAnswer === "FALSE",
                      },
                      {
                        optionText: "NOT GIVEN",
                        isCorrect: resolvedCorrectAnswer === "NOT GIVEN",
                      },
                    ]
                  : q.questionType === "MATCHING"
                  ? [
                      {
                        optionText: (q.prompt || "").trim(),
                        matchText: (q.correctAnswer || "").trim(),
                        isCorrect: true,
                      },
                    ]
                  : [],
            };
          }),
        };

        await teacherApi.updateAssignment(initialData.id, updatePayload);
        alert(`Đã cập nhật "${title.trim()}".`);
        onAssignmentCreated?.();
        onSuccess?.();
        onClose();
      } catch (err: any) {
        const errorMsg =
          err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          "Lỗi cập nhật bài tập.";
        alert(`Lỗi cập nhật:\n${errorMsg}`);
        console.error(err);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // CREATE mode: Chấp nhận yêu cầu ngay, đóng modal để giáo viên làm việc khác và xử lý ngầm
    const normalizePlanDate = (val: any): string => {
      if (!val) return "";
      if (Array.isArray(val) && val.length >= 3) {
        const [y, m, d] = val;
        return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      }
      const str = String(val).trim();
      return str.includes("T") ? str.split("T")[0] : str;
    };

    const capturedClassId = classId;
    const capturedTitle = title.trim();
    const capturedDescription = description;
    const capturedScheduledDate = scheduledDate;
    const capturedSelectedPlanId = selectedPlanId;
    const capturedDailyPlans = dailyPlans;
    const capturedDueDateIso = dueDate
      ? new Date(dueDate).toISOString()
      : new Date(Date.now() + 86400000).toISOString();
    const capturedEstimatedMinutes = estimatedMinutes;
    const capturedTimeLimitMinutes = timeLimitMinutes;
    const capturedMaxAllowedErrorPercent = maxAllowedErrorPercent;
    const capturedMaxAttempts = maxAttempts;
    const capturedAiLevel = aiLevel;
    const capturedDifficulty = difficulty;
    const capturedTargetStudents = targetStudents;
    const capturedPayloads = activePayloads;
    const capturedRefreshCallback = onSuccess || onAssignmentCreated;
    const taskKey = `assign-plan-${capturedClassId}-${Date.now()}`;

    notifyTeacherTaskStatus({
      status: "PROCESSING",
      taskKey,
      title: "Đang gán bài tập...",
      message: `Đang xử lý "${capturedTitle}" (${capturedScheduledDate}).`,
      classroomId: capturedClassId,
      targetUrl: `/teacher/classrooms/${capturedClassId}/plans`,
    });

    setIsSaving(false);
    onClose();

    try {
      let targetPlan: any = null;
      if (capturedSelectedPlanId && capturedSelectedPlanId !== "NEW_DAY") {
        targetPlan = capturedDailyPlans.find((p: any) => p.id === capturedSelectedPlanId) || null;
        if (
          targetPlan?.scheduledDate &&
          capturedScheduledDate &&
          normalizePlanDate(targetPlan.scheduledDate) !== capturedScheduledDate
        ) {
          targetPlan = null;
        }
      }
      let planItemBase = targetPlan?.items?.length || 0;
      let addedItems = 0;

      for (const p of capturedPayloads) {
        const createdAssign: any = await teacherApi.createAssignment({
          classroomId: capturedClassId,
          title: p.title,
          description: `${
            p.readingPassage.trim() ? `[READING PASSAGE]\n${p.readingPassage.trim()}\n\n` : ""
          }${capturedDescription}\n\n[Loại: ${p.skill}${
            p.skill === "SPEAKING"
              ? p.speakingMode === "PART_2"
                ? " - IELTS Part 2 (Cue Card)"
                : p.speakingMode === "PART_3"
                ? " - IELTS Part 3 (Discussion)"
                : p.shadowing
                ? " - Shadowing"
                : " - Hỏi Đáp Phỏng Vấn"
              : ""
          }] [Trình độ: ${capturedAiLevel}] [Độ khó: ${capturedDifficulty}] [Dự kiến: ${capturedEstimatedMinutes}p] [Đối tượng: ${
            capturedTargetStudents === "ALL" ? "Tất cả học sinh" : "Học sinh cần cải thiện"
          }]`,
          skillType: p.skill,
          timeLimitMinutes:
            capturedTimeLimitMinutes > 0 ? capturedTimeLimitMinutes : capturedEstimatedMinutes,
          maxAllowedErrorPercent: capturedMaxAllowedErrorPercent,
          passScore: (100 - capturedMaxAllowedErrorPercent) / 10,
          maxAttempts: capturedMaxAttempts > 0 ? capturedMaxAttempts : 3,
          dueDate: capturedDueDateIso,
          audioUrl: p.skill === "LISTENING" ? p.audioUrl || undefined : undefined,
          listeningScript:
            p.skill === "LISTENING" ? p.listeningScript || undefined : undefined,
          questions: p.questions.map((q) => {
            const validShadowSource =
              q.correctAnswer && !isGradingRubricOrMetaText(q.correctAnswer)
                ? q.correctAnswer
                : q.prompt;
            const cleanShadowText = p.shadowing
              ? (validShadowSource || q.prompt || "").trim()
              : q.prompt.trim();

            const matchingOption = q.options.find((opt, idx) => {
              const letter = String.fromCharCode(65 + idx);
              return (
                letter === (q.correctAnswer || "").trim().toUpperCase() ||
                opt.trim().toLowerCase() === (q.correctAnswer || "").trim().toLowerCase()
              );
            });

            const resolvedCorrectAnswer =
              q.questionType === "MULTIPLE_CHOICE"
                ? matchingOption?.trim() || (q.correctAnswer || "").trim()
                : q.questionType === "TRUE_FALSE"
                ? normalizeTrueFalse(q.correctAnswer) || "TRUE"
                : p.shadowing
                ? cleanShadowText
                : (q.correctAnswer || "").trim();

            return {
              promptText: p.shadowing ? cleanShadowText : q.prompt.trim(),
              questionType: q.questionType,
              correctAnswer: resolvedCorrectAnswer,
              mediaUrl:
                p.skill === "VOCABULARY" || (p.skill === "SPEAKING" && p.shadowing)
                  ? q.referenceAudioUrl || undefined
                  : undefined,
              transcript:
                p.skill === "VOCABULARY" || (p.skill === "SPEAKING" && p.shadowing)
                  ? q.transcript || undefined
                  : undefined,
              explanation: q.explanation || "",
              points: q.points,
              options:
                q.questionType === "MULTIPLE_CHOICE"
                  ? q.options
                      .filter((opt) => opt.trim().length > 0)
                      .map((opt, optIndex) => {
                        const trimmed = opt.trim();
                        const letter = String.fromCharCode(65 + optIndex);
                        const isCorrect =
                          trimmed.toLowerCase() ===
                            (q.correctAnswer || "").trim().toLowerCase() ||
                          letter === (q.correctAnswer || "").trim().toUpperCase() ||
                          (matchingOption && trimmed === matchingOption.trim());
                        return {
                          optionText: trimmed,
                          isCorrect: !!isCorrect,
                        };
                      })
                  : q.questionType === "TRUE_FALSE"
                  ? [
                      {
                        optionText: "TRUE",
                        isCorrect: resolvedCorrectAnswer === "TRUE",
                      },
                      {
                        optionText: "FALSE",
                        isCorrect: resolvedCorrectAnswer === "FALSE",
                      },
                      {
                        optionText: "NOT GIVEN",
                        isCorrect: resolvedCorrectAnswer === "NOT GIVEN",
                      },
                    ]
                  : q.questionType === "MATCHING"
                  ? [
                      {
                        optionText: (q.prompt || "").trim(),
                        matchText: (q.correctAnswer || "").trim(),
                        isCorrect: true,
                      },
                    ]
                  : [],
            };
          }),
        });

        const assignId =
          createdAssign.data?.data?.id || createdAssign.data?.id || createdAssign.id;
        if (!assignId) {
          throw new Error("Thiếu ID bài tập từ máy chủ.");
        }

        if (!targetPlan) {
          const plansRes: any = await teacherApi.getDailyPlans(capturedClassId);
          const existingPlans = plansRes.data?.data || [];
          targetPlan = existingPlans.find(
            (pl: any) => normalizePlanDate(pl.scheduledDate) === capturedScheduledDate
          );

          if (!targetPlan) {
            const maxDayNum = existingPlans.reduce(
              (max: number, pl: any) => Math.max(max, Number(pl?.dayNumber) || 0),
              0
            );
            const nextDayNumber = Math.max(existingPlans.length + 1, maxDayNum + 1);
            const newDayRes: any = await teacherApi.createDailyPlan(capturedClassId, {
              dayNumber: nextDayNumber,
              title: `DAY ${nextDayNumber}: ${capturedTitle}`,
              scheduledDate: capturedScheduledDate,
              estimatedMinutes: capturedEstimatedMinutes,
            });
            targetPlan = newDayRes.data?.data || newDayRes.data;
          }
          planItemBase = targetPlan?.items?.length || 0;
        }

        if (!targetPlan?.id) {
          throw new Error("Không tìm/tạo được Ngày học trong lộ trình.");
        }

        const subs = SUB_PARTS_CONFIG[p.skill] || [];
        const currentSub = subs.find((s) => s.code === p.subFormat) || subs[0];
        const subLabel = currentSub ? currentSub.shortLabel : p.skill;

        const skillIcons: Record<string, string> = {
          GRAMMAR: "🧩",
          LISTENING: "🎧",
          READING: "📖",
          VOCABULARY: "📚",
          SPEAKING: "🎙️",
          WRITING: "✍️",
        };
        const skillIcon = skillIcons[p.skill] || "📝";
        const sectionName = `${skillIcon} ${p.skill}: ${subLabel}`;

        addedItems += 1;
        await teacherApi.addPlanItem(targetPlan.id, {
          sectionName,
          title: p.title,
          itemType: p.skill,
          orderIndex: planItemBase + addedItems,
          assignmentId: assignId,
        });
      }

      if (addedItems === 0) {
        throw new Error("Không gắn được bài tập vào Ngày học.");
      }

      capturedRefreshCallback?.();
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("daily-plan-updated", {
            detail: { classId: capturedClassId, planId: targetPlan?.id },
          })
        );
      }

      const dayLabel = targetPlan?.dayNumber ? `Day ${targetPlan.dayNumber} (${capturedScheduledDate})` : `ngày ${capturedScheduledDate}`;
      notifyTeacherTaskStatus({
        status: "SUCCESS",
        taskKey,
        title: "Đã gán bài tập",
        message:
          capturedPayloads.length > 1
            ? `Đã lưu ${capturedPayloads.length} bài tập vào ${dayLabel}.`
            : `Đã gắn "${capturedTitle}" vào ${dayLabel}.`,
        classroomId: capturedClassId,
        targetUrl: `/teacher/classrooms/${capturedClassId}/plans`,
        referenceId: targetPlan?.id || null,
      });
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Lỗi tạo và gán bài tập.";
      console.error("Lỗi gán bài tập vào lộ trình:", err);
      notifyTeacherTaskStatus({
        status: "ERROR",
        taskKey,
        title: "Lỗi gán bài tập - Cần gán lại",
        message: `Không gắn được "${capturedTitle}" (${capturedScheduledDate}): ${errorMsg}.`,
        classroomId: capturedClassId,
        targetUrl: `/teacher/classrooms/${capturedClassId}/plans`,
      });
    }
  };

  return {
    step,
    setStep,
    creationSource,
    setCreationSource,
    isSynthesizingTts,
    ttsVoice,
    setTtsVoice,
    ttsSpeed,
    setTtsSpeed,
    synthesizeAudioError,
    setSynthesizeAudioError,
    rawText,
    setRawText,
    mainAudioUrl,
    setMainAudioUrl,
    mainTranscript,
    setMainTranscript,
    readingPassageText,
    setReadingPassageText,
    isUploadingAudio,
    audioUploadSuccess,
    isPlayingMainAudio,
    assignmentType,
    setAssignmentType,
    speakingMode,
    setSpeakingMode,
    writingTaskType,
    setWritingTaskType,
    readingPassageIelts,
    setReadingPassageIelts,
    selectedSubFormat,
    setSelectedSubFormat,
    globalResources,
    dailyPlans,
    selectedResourceIds,
    setSelectedResourceIds,
    selectedPlanId,
    setSelectedPlanId,
    aiTopic,
    setAiTopic,
    aiLevel,
    setAiLevel,
    aiQuestionCount,
    setAiQuestionCount,
    isGeneratingAi,
    aiError,
    setAiError,
    questions,
    setQuestions,
    title,
    setTitle,
    description,
    setDescription,
    scheduledDate,
    setScheduledDate,
    startTime,
    setStartTime,
    dueDate,
    setDueDate,
    targetStudents,
    setTargetStudents,
    difficulty,
    setDifficulty,
    estimatedMinutes,
    setEstimatedMinutes,
    timeLimitMinutes,
    setTimeLimitMinutes,
    maxAllowedErrorPercent,
    setMaxAllowedErrorPercent,
    maxAttempts,
    setMaxAttempts,
    status,
    setStatus,
    isSaving,
    importReport,
    setImportReport,
    importGroups,
    showCheatSheetModal,
    setShowCheatSheetModal,
    playingPreviewId,
    currentLevelFormats,
    activeGroupKey,
    handleSelectSubFormat,
    handleSelectLevel,
    handleGenerateAiQuestions,
    handleAddBlankQuestion,
    handleUpdateQuestion,
    handleDeleteQuestion,
    handleSwitchGroup,
    handleImportExcelFile,
    handleQuickParseText,
    handleChangeQuestionType,
    handleAddOption,
    handleRemoveOption,
    handleGoToScheduleStep,
    handleSynthesizeNeuralAudio,
    handleUploadMainAudio,
    togglePlayMainAudio,
    handlePreviewTranscriptAi,
    handlePreviewAudio,
    handleFinalSave,
    handleDownloadFullExcelTemplate: () => downloadExcelTemplate(),
    handleDownloadSkillExcelTemplate: () => downloadSkillExcelTemplate(assignmentType),
  };
}
