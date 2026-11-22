import React, { useEffect, useMemo, useState } from "react";
import {
  X,
  Plus,
  Trash2,
  Sparkles,
  Library,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";
import {
  teacherApi,
  type AiExamSectionConfig,
  type QuestionBankItem,
} from "../../api/teacherApi";

export interface ExamOptionDraft {
  optionText: string;
  matchText?: string;
  isCorrect: boolean;
}

export interface ExamQuestionDraft {
  skillType: string;
  questionType: string;
  promptText: string;
  mediaUrl?: string;
  transcript?: string;
  correctAnswer?: string;
  explanation?: string;
  points: number;
  options: ExamOptionDraft[];
}

interface ExamBuilderModalProps {
  classId: string;
  initialExam?: any | null;
  onClose: () => void;
  onSaved: () => void;
}

const SKILL_OPTIONS = [
  { id: "READING", label: "Reading" },
  { id: "LISTENING", label: "Listening" },
  { id: "GRAMMAR", label: "Grammar" },
  { id: "VOCABULARY", label: "Vocabulary" },
  { id: "WRITING", label: "Writing" },
  { id: "SPEAKING", label: "Speaking" },
];

const QUESTION_TYPE_OPTIONS = [
  { id: "MULTIPLE_CHOICE", label: "Trắc nghiệm" },
  { id: "TRUE_FALSE", label: "Đúng / Sai" },
  { id: "FILL_IN_BLANK", label: "Điền khuyết" },
  { id: "MATCHING", label: "Nối cặp" },
  { id: "ESSAY", label: "Viết luận" },
  { id: "AUDIO_RESPONSE", label: "Ghi âm nói" },
];

const AI_FORMAT_OPTIONS = [
  { id: "MIXED", label: "Đa dạng" },
  ...QUESTION_TYPE_OPTIONS,
];

function parseExamSkills(raw: any): string[] {
  if (Array.isArray(raw)) return raw.map((s) => String(s).toUpperCase());
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
  }
  return ["READING"];
}

function defaultOptionsForType(qType: string): ExamOptionDraft[] {
  if (qType === "TRUE_FALSE") {
    return [
      { optionText: "True", isCorrect: true },
      { optionText: "False", isCorrect: false },
    ];
  }
  if (qType === "MULTIPLE_CHOICE") {
    return [
      { optionText: "Đáp án A", isCorrect: true },
      { optionText: "Đáp án B", isCorrect: false },
      { optionText: "Đáp án C", isCorrect: false },
      { optionText: "Đáp án D", isCorrect: false },
    ];
  }
  if (qType === "MATCHING") {
    return [
      { optionText: "Vế 1", matchText: "Đáp án 1", isCorrect: true },
      { optionText: "Vế 2", matchText: "Đáp án 2", isCorrect: true },
    ];
  }
  return [];
}

function createEmptyQuestion(skillType = "READING", questionType = "MULTIPLE_CHOICE"): ExamQuestionDraft {
  return {
    skillType,
    questionType,
    promptText: "",
    transcript: "",
    correctAnswer: "",
    explanation: "",
    points: questionType === "ESSAY" || questionType === "AUDIO_RESPONSE" ? 10 : 1,
    options: defaultOptionsForType(questionType),
  };
}

export const ExamBuilderModal: React.FC<ExamBuilderModalProps> = ({
  classId,
  initialExam,
  onClose,
  onSaved,
}) => {
  const isEditing = Boolean(initialExam?.id);

  const [title, setTitle] = useState<string>(initialExam?.title || "");
  const [description, setDescription] = useState<string>(initialExam?.description || "");
  const [listeningScript, setListeningScript] = useState<string>(initialExam?.listeningScript || "");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(
    initialExam?.timeLimitMinutes || 45,
  );
  const [passScore, setPassScore] = useState<number>(initialExam?.passScore ?? 5);
  const [maxAttempts, setMaxAttempts] = useState<number>(initialExam?.maxAttempts || 1);
  const [strictFullscreen, setStrictFullscreen] = useState<boolean>(
    initialExam?.strictFullscreen !== undefined ? Boolean(initialExam.strictFullscreen) : true,
  );
  const [maxViolations, setMaxViolations] = useState<number>(initialExam?.maxViolations || 3);

  const [examSkills, setExamSkills] = useState<string[]>(() =>
    initialExam?.examSkills
      ? parseExamSkills(initialExam.examSkills)
      : initialExam?.skillType
        ? [String(initialExam.skillType).toUpperCase()]
        : ["READING", "GRAMMAR", "WRITING"],
  );

  const [questions, setQuestions] = useState<ExamQuestionDraft[]>(() => {
    if (Array.isArray(initialExam?.questions) && initialExam.questions.length > 0) {
      return initialExam.questions.map((q: any) => ({
        skillType: String(q.skillType || initialExam.skillType || "READING").toUpperCase(),
        questionType: String(q.questionType || "MULTIPLE_CHOICE").toUpperCase(),
        promptText: q.promptText || "",
        mediaUrl: q.mediaUrl || "",
        transcript: q.transcript || "",
        correctAnswer: q.correctAnswer || "",
        explanation: q.explanation || "",
        points: q.points ?? 1,
        options: Array.isArray(q.options)
          ? q.options.map((opt: any) => ({
              optionText: opt.optionText || "",
              matchText: opt.matchText || "",
              isCorrect: Boolean(opt.isCorrect),
            }))
          : [],
      }));
    }
    return [createEmptyQuestion("READING", "MULTIPLE_CHOICE")];
  });

  // Công cụ nguồn câu hỏi (AI Sinh Đề / Ngân hàng câu hỏi)
  const [activeTool, setActiveTool] = useState<"NONE" | "AI" | "BANK">("NONE");
  const [aiTopic, setAiTopic] = useState<string>("Đời sống, Công nghệ & Học tập");
  const [aiLevel, setAiLevel] = useState<string>("B1");
  const [aiInstructions, setAiInstructions] = useState<string>("");
  const [aiSections, setAiSections] = useState<AiExamSectionConfig[]>([
    { skillType: "READING", questionFormat: "MULTIPLE_CHOICE", questionCount: 4, pointsPerQuestion: 1 },
    { skillType: "GRAMMAR", questionFormat: "MIXED", questionCount: 4, pointsPerQuestion: 1 },
    { skillType: "WRITING", questionFormat: "ESSAY", questionCount: 1, pointsPerQuestion: 5 },
  ]);
  const [generatingAi, setGeneratingAi] = useState<boolean>(false);

  const [bankItems, setBankItems] = useState<QuestionBankItem[]>([]);
  const [loadingBank, setLoadingBank] = useState<boolean>(false);
  const [bankSearch, setBankSearch] = useState<string>("");
  const [bankSkillFilter, setBankSkillFilter] = useState<string>("ALL");

  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeTool !== "BANK" || bankItems.length > 0) return;
    setLoadingBank(true);
    teacherApi
      .getQuestionBank(classId)
      .then((res) => setBankItems(res.data?.data || []))
      .catch((err) => {
        console.error("Lỗi tải ngân hàng câu hỏi:", err);
        setErrorMsg("Lỗi tải ngân hàng câu hỏi.");
      })
      .finally(() => setLoadingBank(false));
  }, [activeTool, bankItems.length, classId]);

  const filteredBankItems = useMemo(() => {
    return bankItems.filter((item) => {
      if (
        bankSkillFilter !== "ALL" &&
        String(item.skillType || "").toUpperCase() !== bankSkillFilter
      ) {
        return false;
      }
      if (bankSearch.trim()) {
        const kw = bankSearch.toLowerCase();
        return (
          item.promptText.toLowerCase().includes(kw) ||
          item.assignmentTitle.toLowerCase().includes(kw)
        );
      }
      return true;
    });
  }, [bankItems, bankSearch, bankSkillFilter]);

  const toggleSkill = (skillId: string) => {
    setExamSkills((prev) => {
      if (prev.includes(skillId)) {
        if (prev.length === 1) return prev;
        return prev.filter((s) => s !== skillId);
      }
      return [...prev, skillId];
    });
  };

  const ensureSkillSelected = (skillId?: string | null) => {
    if (!skillId) return;
    const upper = skillId.toUpperCase();
    setExamSkills((prev) => (prev.includes(upper) ? prev : [...prev, upper]));
  };

  const handleGenerateAiExam = async () => {
    if (aiSections.length === 0) {
      setErrorMsg("Cần ít nhất 1 phần kỹ năng.");
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setGeneratingAi(true);
    try {
      const res = await teacherApi.generateExamDraft({
        title: title.trim() || undefined,
        topic: aiTopic.trim() || "Comprehensive English Assessment",
        targetCefr: aiLevel,
        customInstructions: aiInstructions.trim() || undefined,
        sections: aiSections,
      });
      const draft = res.data?.data;
      if (!draft) {
        setErrorMsg("AI không trả về dữ liệu.");
        return;
      }
      if (!title.trim() && draft.title) setTitle(draft.title);
      if (!description.trim() && draft.description) setDescription(draft.description);
      if (!listeningScript.trim() && draft.listeningScript) {
        setListeningScript(draft.listeningScript);
      }
      if (Array.isArray(draft.examSkills) && draft.examSkills.length > 0) {
        setExamSkills(draft.examSkills.map((s) => s.toUpperCase()));
      }

      const generatedQuestions: ExamQuestionDraft[] = (draft.questions || []).map((q) => ({
        skillType: String(q.skillType || "READING").toUpperCase(),
        questionType: String(q.questionType || "MULTIPLE_CHOICE").toUpperCase(),
        promptText: q.promptText || "",
        transcript: q.transcript || "",
        correctAnswer: q.correctAnswer || "",
        explanation: q.explanation || "",
        points: q.points ?? 1,
        options: Array.isArray(q.options)
          ? q.options.map((o) => ({
              optionText: o.optionText || "",
              matchText: o.matchText || "",
              isCorrect: Boolean(o.isCorrect),
            }))
          : [],
      }));

      setQuestions((prev) => {
        const hasOnlyEmptyPlaceholder =
          prev.length === 1 && !prev[0].promptText.trim();
        return hasOnlyEmptyPlaceholder
          ? generatedQuestions
          : [...prev, ...generatedQuestions];
      });
      setSuccessMsg(
        `AI đã tạo ${generatedQuestions.length} câu hỏi.`,
      );
      setActiveTool("NONE");
    } catch (err: any) {
      console.error("AI Exam Generator error:", err);
      setErrorMsg(
        err?.response?.data?.message ||
          "Lỗi AI tạo đề. Thử lại sau.",
      );
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleImportFromBank = (item: QuestionBankItem) => {
    const newQ: ExamQuestionDraft = {
      skillType: String(item.skillType || "READING").toUpperCase(),
      questionType: String(item.questionType || "MULTIPLE_CHOICE").toUpperCase(),
      promptText: item.promptText,
      mediaUrl: item.mediaUrl || "",
      transcript: item.transcript || "",
      correctAnswer: item.correctAnswer || "",
      explanation: item.explanation || "",
      points: item.points ?? 1,
      options: Array.isArray(item.options)
        ? item.options.map((o) => ({
            optionText: o.optionText || "",
            matchText: o.matchText || "",
            isCorrect: Boolean(o.isCorrect),
          }))
        : [],
    };
    ensureSkillSelected(newQ.skillType);
    setQuestions((prev) => {
      const isPlaceholder = prev.length === 1 && !prev[0].promptText.trim();
      return isPlaceholder ? [newQ] : [...prev, newQ];
    });
    setSuccessMsg(`Đã thêm câu hỏi từ "${item.assignmentTitle}".`);
  };

  const updateQuestion = (index: number, patch: Partial<ExamQuestionDraft>) => {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== index) return q;
        const next = { ...q, ...patch };
        if (patch.questionType && patch.questionType !== q.questionType) {
          if (
            patch.questionType === "ESSAY" ||
            patch.questionType === "AUDIO_RESPONSE" ||
            patch.questionType === "FILL_IN_BLANK"
          ) {
            next.options = [];
          } else if (next.options.length === 0 || patch.questionType === "TRUE_FALSE") {
            next.options = defaultOptionsForType(patch.questionType);
          }
        }
        return next;
      }),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!title.trim()) {
      setErrorMsg("Thiếu tên bài thi.");
      return;
    }
    const validQuestions = questions.filter((q) => q.promptText.trim().length > 0);
    if (validQuestions.length === 0) {
      setErrorMsg("Cần ít nhất 1 câu hỏi.");
      return;
    }

    const derivedSkills = Array.from(
      new Set([
        ...examSkills,
        ...validQuestions.map((q) => q.skillType).filter(Boolean),
      ]),
    );

    const payload = {
      title: title.trim(),
      description: description.trim(),
      classroomId: classId,
      skillType: derivedSkills[0] || "READING",
      isExam: true,
      examSkills: derivedSkills,
      strictFullscreen,
      maxViolations: Math.max(1, Number(maxViolations) || 3),
      timeLimitMinutes: Math.max(5, Number(timeLimitMinutes) || 45),
      passScore: Number(passScore) || 5,
      maxAttempts: Math.max(1, Number(maxAttempts) || 1),
      listeningScript: listeningScript.trim() || null,
      questions: validQuestions.map((q) => ({
        promptText: q.promptText.trim(),
        questionType: q.questionType,
        skillType: q.skillType,
        mediaUrl: q.mediaUrl?.trim() || null,
        transcript: q.transcript?.trim() || null,
        correctAnswer: q.correctAnswer?.trim() || null,
        explanation: q.explanation?.trim() || null,
        points: Number(q.points) > 0 ? Number(q.points) : 1,
        options:
          q.options && q.options.length > 0
            ? q.options
                .filter((o) => o.optionText.trim())
                .map((o) => ({
                  optionText: o.optionText.trim(),
                  matchText: o.matchText?.trim() || null,
                  isCorrect: Boolean(o.isCorrect),
                }))
            : [],
      })),
    };

    try {
      setSaving(true);
      if (isEditing && initialExam?.id) {
        await teacherApi.updateAssignment(initialExam.id, payload);
      } else {
        await teacherApi.createAssignment(payload);
      }
      onSaved();
    } catch (err: any) {
      console.error("Lỗi lưu bài thi:", err);
      setErrorMsg(
        err?.response?.data?.message || "Lưu bài thi thất bại.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-5">
      <div className="w-full max-w-5xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col max-h-[94vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-950 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              {isEditing ? "Sửa bài thi" : "Tạo bài thi"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1. Thông tin bài thi & Quy chế thi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tên bài thi *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Kiểm tra giữa kỳ I"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-600"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Mô tả / Hướng dẫn
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Nội quy hoặc hướng dẫn làm bài..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Thời gian (phút)
                </label>
                <input
                  type="number"
                  min={5}
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Điểm đạt (/10)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={10}
                  value={passScore}
                  onChange={(e) => setPassScore(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Lượt thi
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Anti-cheat settings */}
            <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-3 flex flex-col justify-between gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-indigo-900 dark:text-indigo-200">
                <input
                  type="checkbox"
                  checked={strictFullscreen}
                  onChange={(e) => setStrictFullscreen(e.target.checked)}
                  className="h-4 w-4 rounded accent-indigo-600"
                />
                <span>Toàn màn hình (chống rời tab)</span>
              </label>
              <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                <span>Vi phạm tối đa:</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={maxViolations}
                  onChange={(e) => setMaxViolations(Number(e.target.value))}
                  className="w-16 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5 text-xs font-bold text-center text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* 2. Kỹ năng kiểm tra */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Kỹ năng ({examSkills.length}):
            </label>
            <div className="flex flex-wrap gap-2">
              {SKILL_OPTIONS.map((skill) => {
                const selected = examSkills.includes(skill.id);
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => toggleSkill(skill.id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition cursor-pointer ${
                      selected
                        ? "bg-blue-700 border-blue-700 text-white shadow-2xs"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-500"
                    }`}
                  >
                    {selected ? "✓ " : "+ "}
                    {skill.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. AI Sinh Đề & Ngân hàng câu hỏi Bar */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setActiveTool((t) => (t === "AI" ? "NONE" : "AI"))}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold border transition cursor-pointer ${
                activeTool === "AI"
                  ? "bg-indigo-700 border-indigo-700 text-white"
                  : "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100"
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span>AI sinh đề</span>
              {activeTool === "AI" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            <button
              type="button"
              onClick={() => setActiveTool((t) => (t === "BANK" ? "NONE" : "BANK"))}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold border transition cursor-pointer ${
                activeTool === "BANK"
                  ? "bg-emerald-700 border-emerald-700 text-white"
                  : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
              }`}
            >
              <Library className="h-4 w-4" />
              <span>Ngân hàng câu hỏi</span>
              {activeTool === "BANK" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Panel AI Sinh Đề Thi */}
          {activeTool === "AI" && (
            <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-indigo-900 dark:text-indigo-200 mb-1">
                    Chủ đề *
                  </label>
                  <input
                    type="text"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    placeholder="VD: Technology, Career..."
                    className="w-full rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-indigo-900 dark:text-indigo-200 mb-1">
                    CEFR
                  </label>
                  <select
                    value={aiLevel}
                    onChange={(e) => setAiLevel(e.target.value)}
                    className="w-full rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                  >
                    {["A1", "A2", "B1", "B2", "C1"].map((lv) => (
                      <option key={lv} value={lv}>
                        {lv}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200">
                    Cấu trúc đề AI:
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setAiSections((prev) => [
                        ...prev,
                        {
                          skillType: "LISTENING",
                          questionFormat: "MULTIPLE_CHOICE",
                          questionCount: 3,
                          pointsPerQuestion: 1,
                        },
                      ])
                    }
                    className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer"
                  >
                    + Thêm phần
                  </button>
                </div>

                {aiSections.map((sec, sIdx) => (
                  <div
                    key={sIdx}
                    className="grid grid-cols-12 gap-2 items-center bg-white dark:bg-slate-900 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900/50"
                  >
                    <select
                      value={sec.skillType}
                      onChange={(e) =>
                        setAiSections((prev) =>
                          prev.map((item, idx) =>
                            idx === sIdx ? { ...item, skillType: e.target.value } : item,
                          ),
                        )
                      }
                      className="col-span-4 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs"
                    >
                      {SKILL_OPTIONS.map((sk) => (
                        <option key={sk.id} value={sk.id}>
                          {sk.label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={sec.questionFormat}
                      onChange={(e) =>
                        setAiSections((prev) =>
                          prev.map((item, idx) =>
                            idx === sIdx ? { ...item, questionFormat: e.target.value } : item,
                          ),
                        )
                      }
                      className="col-span-4 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs"
                    >
                      {AI_FORMAT_OPTIONS.map((fmt) => (
                        <option key={fmt.id} value={fmt.id}>
                          {fmt.label}
                        </option>
                      ))}
                    </select>

                    <div className="col-span-2 flex items-center gap-1 text-[11px]">
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={sec.questionCount}
                        onChange={(e) =>
                          setAiSections((prev) =>
                            prev.map((item, idx) =>
                              idx === sIdx
                                ? { ...item, questionCount: Math.max(1, Number(e.target.value)) }
                                : item,
                            ),
                          )
                        }
                        className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs font-bold text-center"
                      />
                      <span>câu</span>
                    </div>

                    <div className="col-span-1 flex items-center gap-1 text-[11px]">
                      <input
                        type="number"
                        step="0.5"
                        min={0.5}
                        value={sec.pointsPerQuestion ?? 1}
                        onChange={(e) =>
                          setAiSections((prev) =>
                            prev.map((item, idx) =>
                              idx === sIdx
                                ? { ...item, pointsPerQuestion: Number(e.target.value) }
                                : item,
                            ),
                          )
                        }
                        className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-1 py-1 text-xs text-center"
                        title="Điểm mỗi câu"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setAiSections((prev) => prev.filter((_, idx) => idx !== sIdx))
                      }
                      className="col-span-1 text-rose-500 hover:text-rose-600 flex justify-center"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 items-center justify-between pt-1">
                <input
                  type="text"
                  value={aiInstructions}
                  onChange={(e) => setAiInstructions(e.target.value)}
                  placeholder="Yêu cầu thêm cho AI (VD: IELTS Academic)..."
                  className="w-full sm:flex-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                />
                <button
                  type="button"
                  disabled={generatingAi}
                  onClick={handleGenerateAiExam}
                  className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-50 cursor-pointer"
                >
                  {generatingAi ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Đang tạo đề...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Tạo đề bằng AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Panel Ngân hàng câu hỏi của lớp */}
          {activeTool === "BANK" && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={bankSearch}
                    onChange={(e) => setBankSearch(e.target.value)}
                    placeholder="Tìm câu hỏi..."
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 py-1.5 text-xs"
                  />
                </div>
                <select
                  value={bankSkillFilter}
                  onChange={(e) => setBankSkillFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                >
                  <option value="ALL">Mọi kỹ năng</option>
                  {SKILL_OPTIONS.map((sk) => (
                    <option key={sk.id} value={sk.id}>
                      {sk.id}
                    </option>
                  ))}
                </select>
              </div>

              {loadingBank ? (
                <div className="py-6 text-center text-xs text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-1 text-emerald-600" />
                  Đang tải...
                </div>
              ) : filteredBankItems.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-500">
                  Không có câu hỏi phù hợp.
                </p>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {filteredBankItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-bold">
                          <span className="rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-1.5 py-0.5">
                            {item.skillType || "GENERAL"}
                          </span>
                          <span className="rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5">
                            {item.questionType}
                          </span>
                          <span className="text-slate-400 truncate max-w-xs">
                            Từ: {item.assignmentTitle}
                          </span>
                        </div>
                        <p className="text-xs text-slate-800 dark:text-slate-200 line-clamp-2">
                          {item.promptText}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleImportFromBank(item)}
                        className="shrink-0 rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-600 cursor-pointer"
                      >
                        + Chọn
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. Danh sách câu hỏi trong đề thi */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Câu hỏi ({questions.length})
              </h3>
              <button
                type="button"
                onClick={() =>
                  setQuestions((prev) => [
                    ...prev,
                    createEmptyQuestion(examSkills[0] || "READING", "MULTIPLE_CHOICE"),
                  ])
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-600 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Thêm câu hỏi</span>
              </button>
            </div>

            {questions.map((q, qIdx) => (
              <div
                key={qIdx}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-blue-700 text-white px-2.5 py-0.5 text-xs font-extrabold">
                      Câu {qIdx + 1}
                    </span>

                    <select
                      value={q.skillType}
                      onChange={(e) => {
                        ensureSkillSelected(e.target.value);
                        updateQuestion(qIdx, { skillType: e.target.value });
                      }}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold"
                    >
                      {SKILL_OPTIONS.map((sk) => (
                        <option key={sk.id} value={sk.id}>
                          {sk.id}
                        </option>
                      ))}
                    </select>

                    <select
                      value={q.questionType}
                      onChange={(e) =>
                        updateQuestion(qIdx, { questionType: e.target.value })
                      }
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold"
                    >
                      {QUESTION_TYPE_OPTIONS.map((qt) => (
                        <option key={qt.id} value={qt.id}>
                          {qt.label}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-slate-500">Điểm:</span>
                      <input
                        type="number"
                        step="0.5"
                        min={0.5}
                        value={q.points}
                        onChange={(e) =>
                          updateQuestion(qIdx, { points: Number(e.target.value) || 1 })
                        }
                        className="w-16 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-bold text-center"
                      />
                    </div>
                  </div>

                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setQuestions((prev) => prev.filter((_, idx) => idx !== qIdx))
                      }
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Xóa
                    </button>
                  )}
                </div>

                <textarea
                  rows={2}
                  value={q.promptText}
                  onChange={(e) => updateQuestion(qIdx, { promptText: e.target.value })}
                  placeholder="Nội dung câu hỏi / đề bài..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
                />

                {(q.skillType === "LISTENING" || q.questionType === "AUDIO_RESPONSE") && (
                  <input
                    type="text"
                    value={q.transcript || ""}
                    onChange={(e) => updateQuestion(qIdx, { transcript: e.target.value })}
                    placeholder="Transcript đọc mẫu (tự tạo TTS)..."
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                  />
                )}

                {q.questionType === "FILL_IN_BLANK" && (
                  <input
                    type="text"
                    value={q.correctAnswer || ""}
                    onChange={(e) => updateQuestion(qIdx, { correctAnswer: e.target.value })}
                    placeholder="Đáp án đúng..."
                    className="w-full rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                  />
                )}

                {q.options && q.options.length > 0 && (
                  <div className="space-y-1.5 pl-2 border-l-2 border-blue-200 dark:border-blue-900">
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-2">
                        <input
                          type={q.questionType === "MATCHING" ? "checkbox" : "radio"}
                          name={`q-correct-${qIdx}`}
                          checked={opt.isCorrect}
                          onChange={() =>
                            updateQuestion(qIdx, {
                              options: q.options.map((item, idx) =>
                                q.questionType === "MATCHING"
                                  ? idx === oIdx
                                    ? { ...item, isCorrect: !item.isCorrect }
                                    : item
                                  : { ...item, isCorrect: idx === oIdx },
                              ),
                            })
                          }
                          title="Đáp án đúng"
                          className="h-4 w-4 accent-emerald-600 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={opt.optionText}
                          onChange={(e) =>
                            updateQuestion(qIdx, {
                              options: q.options.map((item, idx) =>
                                idx === oIdx ? { ...item, optionText: e.target.value } : item,
                              ),
                            })
                          }
                          placeholder={`Đáp án ${oIdx + 1}`}
                          className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs"
                        />
                        {q.questionType === "MATCHING" && (
                          <input
                            type="text"
                            value={opt.matchText || ""}
                            onChange={(e) =>
                              updateQuestion(qIdx, {
                                options: q.options.map((item, idx) =>
                                  idx === oIdx ? { ...item, matchText: e.target.value } : item,
                                ),
                              })
                            }
                            placeholder="Vế nối"
                            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <span>{isEditing ? "Cập nhật" : "Xuất bản"}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
