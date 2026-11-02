import React from "react";
import {
  X,
  Bot,
  FileText,
  Edit3,
  BookOpen,
  Headphones,
  Mic,
  PenTool,
  CheckSquare,
  Check,
  AlertCircle,
  Loader2,
  ChevronRight,
  Zap,
  Type,
  FileSpreadsheet,
  UploadCloud,
  ListChecks,
} from "lucide-react";

import ImportReportBanner from "./ImportReportBanner";
import ExcelFormatCheatSheetModal from "./ExcelFormatCheatSheetModal";
import {
  downloadExcelTemplate,
  downloadSkillExcelTemplate,
} from "../utils/assignmentImport";

import {
  useCreateAssignmentForm,
  AssignmentBasicInfoForm,
  AiExerciseGeneratorPanel,
  ExcelImportSection,
  QuestionBuilderList,
  getLevelQuestionFormats,
} from "./assignment-modal";
import type { QuestionDraft } from "./assignment-modal";

// Re-export all config types & helpers for backward compatibility
export * from "./assignment-modal/assignmentModalConfig";
export type { QuestionDraft };

interface CreateAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  onAssignmentCreated?: () => void;
  onSuccess?: () => void;
  initialData?: any;
  mode?: "CREATE" | "EDIT";
  initialSkillType?: string;
  initialPlanId?: string;
  initialDate?: string;
}

export const CreateAssignmentModal: React.FC<CreateAssignmentModalProps> = ({
  isOpen,
  onClose,
  classId,
  onAssignmentCreated,
  onSuccess,
  initialData,
  mode = "CREATE",
  initialSkillType,
  initialPlanId,
  initialDate,
}) => {
  const form = useCreateAssignmentForm({
    isOpen,
    onClose,
    classId,
    onAssignmentCreated,
    onSuccess,
    initialData,
    mode,
    initialSkillType,
    initialPlanId,
    initialDate,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in">
      <div className="relative flex flex-col w-full max-w-5xl h-[92vh] max-h-[900px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 bg-slate-50/70 dark:bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-800 text-white shadow-sm">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                {mode === "EDIT" ? "Chỉnh Sửa Toàn Diện Bài Tập" : "Tạo & Gán Bài Tập Theo Ngày Học"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {mode === "EDIT"
                  ? `Đang chỉnh sửa: ${form.title || "Bài tập"} (Bước ${form.step}/3)`
                  : `Bước ${form.step} / 3: ${
                      form.step === 1
                        ? "Chọn Loại & Nguồn Tạo"
                        : form.step === 2
                        ? "Biên Soạn Câu Hỏi (AI / Thủ Công)"
                        : "Cấu Hình Ngày Học & Giao Lớp"
                    }`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="grid grid-cols-3 border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/60 text-xs font-bold shrink-0">
          {[
            { id: 1, title: "1. Nguồn Khởi Tạo", sub: "AI / Excel / Thủ công" },
            { id: 2, title: "2. Biên Soạn & TTS", sub: `${form.questions.length} câu hỏi & Audio` },
            { id: 3, title: "3. Lịch Học & Giao Bài", sub: "Gán vào lộ trình ngày" },
          ].map((st) => {
            const isActive = form.step === st.id;
            const isCompleted = form.step > st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  if (st.id === 1 || form.questions.length > 0) form.setStep(st.id);
                }}
                className={`py-3 px-3 transition border-r last:border-r-0 border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2.5 cursor-pointer ${
                  isActive
                    ? "bg-blue-800/10 text-blue-700 dark:text-blue-400 border-b-2 border-b-blue-600"
                    : isCompleted
                    ? "bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                <span
                  className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                    isActive
                      ? "bg-blue-800 text-white shadow-xs"
                      : isCompleted
                      ? "bg-emerald-500 text-slate-950"
                      : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                  }`}
                >
                  {isCompleted ? "✓" : st.id}
                </span>
                <div className="text-left hidden sm:block">
                  <div className="leading-tight">{st.title}</div>
                  <div className="text-[10px] opacity-75 font-normal">{st.sub}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Import report banner */}
          <ImportReportBanner
            report={form.importReport}
            groups={form.importGroups}
            activeGroupKey={form.activeGroupKey}
            onSwitchGroup={form.handleSwitchGroup}
            onClose={() => form.setImportReport(null)}
          />

          {/* AI Error banner */}
          {form.aiError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-start justify-between gap-3 text-xs text-rose-300 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <p className="font-bold text-rose-200">Lỗi tạo bài tập từ AI:</p>
                  <p className="mt-0.5 text-rose-300 leading-relaxed">{form.aiError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => form.setAiError(null)}
                className="text-rose-400 hover:text-white transition p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* STEP 1: CHỌN LOẠI & NGUỒN TẠO */}
          {form.step === 1 && (
            <div className="space-y-6">
              {/* 1. Chọn Loại Bài Tập (Skill Cards) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
                  1. Chọn Loại Bài Tập (Skill Type)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { id: "SPEAKING", label: "Speaking (Luyện Nói)", sub: "Hỗ trợ Shadowing AI", icon: Mic, color: "border-rose-500/30 text-rose-400 bg-rose-500/5" },
                    { id: "VOCABULARY", label: "Vocabulary (Từ Vựng)", sub: "Từ vựng, Ngữ cảnh & Phát âm", icon: BookOpen, color: "border-amber-500/30 text-amber-400 bg-amber-500/5" },
                    { id: "READING", label: "Reading (Đọc Hiểu)", sub: "Passage & Đa dạng câu hỏi", icon: FileText, color: "border-blue-500/30 text-blue-400 bg-blue-500/5" },
                    { id: "LISTENING", label: "Listening (Nghe Hiểu)", sub: "Audio player & Tốc độ", icon: Headphones, color: "border-emerald-500/30 text-emerald-400 bg-emerald-500/5" },
                    { id: "WRITING", label: "Writing (Viết Tự Luận)", sub: "AI Chấm Task 1 & Task 2", icon: PenTool, color: "border-sky-500/30 text-sky-400 bg-sky-500/5" },
                    { id: "GRAMMAR", label: "Grammar (Ngữ Pháp)", sub: "Điền từ & Trắc nghiệm", icon: CheckSquare, color: "border-blue-500/30 text-blue-400 bg-blue-600/5" },
                  ].map((typeItem) => {
                    const IconComp = typeItem.icon;
                    const isSelected = form.assignmentType === typeItem.id;
                    return (
                      <button
                        key={typeItem.id}
                        type="button"
                        onClick={() => {
                          const nextSubs = getLevelQuestionFormats(typeItem.id, form.aiLevel);
                          const defaultSub = nextSubs[0]?.code || "";
                          form.setAssignmentType(typeItem.id as any);
                          form.setSelectedSubFormat(defaultSub);
                          form.setReadingPassageText("");
                          form.setMainTranscript("");
                          form.setMainAudioUrl("");
                          if (typeItem.id === "SPEAKING") {
                            form.setSpeakingMode(defaultSub === "SPEAKING_SHADOWING" ? "SHADOWING" : "QA");
                          }
                          if (typeItem.id === "WRITING") {
                            form.setWritingTaskType(defaultSub === "WRITING_IELTS_TASK1" ? "TASK_1" : "TASK_2");
                          }
                        }}
                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? "border-blue-600 bg-blue-50/80 dark:bg-blue-800/15 ring-2 ring-blue-600/30"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100/80 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className={`p-2 rounded-lg border ${typeItem.color}`}>
                            <IconComp className="h-5 w-5" />
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-blue-700 dark:text-blue-400" />}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-900 dark:text-white">{typeItem.label}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{typeItem.sub}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 1.1 Chọn Trình Độ & Định Dạng Câu Hỏi */}
              <div className="rounded-xl border border-blue-200 dark:border-blue-600/30 bg-slate-50 dark:bg-slate-900/90 p-4 space-y-3 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-blue-100 dark:border-blue-600/20 pb-2.5">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                    <span className="font-bold text-xs text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                      1.1. Chọn Trình Độ &amp; Định Dạng ({form.assignmentType} • {form.aiLevel})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mr-1">Trình độ:</span>
                    {["A1", "A2", "B1", "B2", "C1", "IELTS"].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => form.handleSelectLevel(lvl)}
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition cursor-pointer ${
                          form.aiLevel === lvl
                            ? "bg-blue-800 text-white font-bold shadow-xs scale-105"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700"
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. Chọn Nguồn Tạo Bài Tập (Tabs) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
                  2. Chọn Phương Thức Khởi Tạo
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => form.setCreationSource("AI")}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      form.creationSource === "AI"
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-600/15 ring-1 ring-amber-500/50 shadow-md"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Bot className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                        <span className="text-[10px] bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold">
                          AI Auto
                        </span>
                      </div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">Tạo Bằng AI</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        AI tự động phân tích &amp; sinh bài tập chuẩn CEFR.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => form.setCreationSource("TEXT_AI")}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      form.creationSource === "TEXT_AI"
                        ? "border-sky-500 bg-sky-50 dark:bg-sky-600/15 ring-1 ring-sky-500/50 shadow-md"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Type className="h-5 w-5 text-sky-500 dark:text-sky-400" />
                        <span className="text-[10px] bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 px-1.5 py-0.5 rounded font-bold">
                          Smart Text
                        </span>
                      </div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">Dán Text Thô</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        Dán văn bản, đề thi Word/PDF, AI tự định dạng.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => form.setCreationSource("EXCEL")}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      form.creationSource === "EXCEL"
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-600/15 ring-1 ring-emerald-500/50 shadow-md"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <FileSpreadsheet className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                          Nhanh
                        </span>
                      </div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">Nhập Excel</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        Nhập file Excel (.xlsx, .csv) đa dạng cấu trúc.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => form.setCreationSource("MANUAL")}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      form.creationSource === "MANUAL"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-600/15 ring-1 ring-blue-500/50 shadow-md"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Edit3 className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                        <span className="text-[10px] bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded font-bold">
                          Tự Do
                        </span>
                      </div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">Thủ Công</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        Tự tạo câu hỏi, tải file audio cá nhân lên.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Source Panel Details */}
              {form.creationSource === "AI" && (
                <AiExerciseGeneratorPanel
                  aiTopic={form.aiTopic}
                  setAiTopic={form.setAiTopic}
                  aiLevel={form.aiLevel}
                  handleSelectLevel={form.handleSelectLevel}
                  aiQuestionCount={form.aiQuestionCount}
                  setAiQuestionCount={form.setAiQuestionCount}
                  assignmentType={form.assignmentType}
                  selectedSubFormat={form.selectedSubFormat}
                  handleSelectSubFormat={form.handleSelectSubFormat}
                  currentLevelFormats={form.currentLevelFormats}
                  readingPassageIelts={form.readingPassageIelts}
                  setReadingPassageIelts={form.setReadingPassageIelts}
                  selectedPlanId={form.selectedPlanId}
                  setSelectedPlanId={form.setSelectedPlanId}
                  dailyPlans={form.dailyPlans}
                  scheduledDate={form.scheduledDate}
                  setScheduledDate={form.setScheduledDate}
                />
              )}

              {form.creationSource === "EXCEL" && (
                <ExcelImportSection
                  assignmentType={form.assignmentType}
                  handleDownloadSkillExcelTemplate={form.handleDownloadSkillExcelTemplate}
                  handleDownloadFullExcelTemplate={form.handleDownloadFullExcelTemplate}
                  setShowCheatSheetModal={form.setShowCheatSheetModal}
                  handleImportExcelFile={form.handleImportExcelFile}
                />
              )}

              {form.creationSource === "TEXT_AI" && (
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 space-y-3.5 animate-in fade-in">
                  <div className="flex items-center justify-between gap-2 border-b border-sky-500/20 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Type className="h-4 w-4 text-sky-400" />
                      <span className="text-xs font-bold text-sky-200">
                        Dán Đề Thi Thô / Bài Đọc / Kịch Bản Nghe
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-sky-300 bg-sky-500/20 px-2 py-0.5 rounded-md">
                      Kỹ năng: {form.assignmentType}
                    </span>
                  </div>

                  <textarea
                    rows={6}
                    value={form.rawText}
                    onChange={(e) => form.setRawText(e.target.value)}
                    placeholder={`Dán nội dung đề bài vào đây...\n• Ví dụ 1: Copy đề trắc nghiệm: "Câu 1: What is the main idea...? A. ... B. ... C. ... D. ... Đáp án: A. Giải thích: ..."\n• Ví dụ 2: Dán một đoạn văn bản hoặc kịch bản nghe, AI sẽ tự động phân tích và trích xuất câu hỏi chuẩn định dạng!`}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-sky-500 focus:outline-hidden font-mono leading-relaxed"
                  />

                  <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2 border-t border-sky-500/20">
                    <button
                      type="button"
                      onClick={form.handleQuickParseText}
                      disabled={!form.rawText.trim()}
                      className="w-full sm:w-1/2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-extrabold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
                    >
                      <Zap className="h-4 w-4 text-slate-950" />
                      <span>⚡ Phân Tích Nhanh (Regex Parser)</span>
                    </button>

                    <button
                      type="button"
                      disabled={form.isGeneratingAi || !form.rawText.trim()}
                      onClick={() => form.handleGenerateAiQuestions(form.rawText)}
                      className="w-full sm:w-1/2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-extrabold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
                    >
                      {form.isGeneratingAi ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                      <span>Gemini AI Tối Ưu &amp; Tạo Câu Hỏi</span>
                    </button>
                  </div>
                </div>
              )}

              {form.creationSource === "MANUAL" && (
                <div className="rounded-xl border border-blue-500/30 bg-blue-600/5 p-4 space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <Edit3 className="h-4 w-4 text-blue-400" />
                    <span className="text-xs font-bold text-blue-200">
                      Soạn Bài Thủ Công Bằng Tay (Có Hỗ Trợ Tải File Audio Lên Từ Máy Tính)
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Bạn có thể tự tay tạo từng câu hỏi, nhập đáp án đúng, thêm giải thích chi tiết, hoặc tải lên file âm thanh (MP3, WAV) từ máy tính cho bài nghe/nói ở bước tiếp theo.
                  </p>
                  {form.assignmentType === "LISTENING" && (
                    <div className="rounded-lg bg-blue-50/60 dark:bg-slate-950/80 border border-blue-200 dark:border-blue-500/20 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-bold text-blue-800 dark:text-blue-300 block">Đính kèm File Audio Toàn Bài Nghe:</span>
                        <span className="text-[11px] text-slate-600 dark:text-slate-400">
                          {form.mainAudioUrl ? `Đã có file audio: ${form.mainAudioUrl.split("/").pop()}` : "Bạn có thể chọn file audio ngay bây giờ hoặc ở bước soạn câu hỏi."}
                        </span>
                      </div>
                      <label className="px-3 py-1.5 rounded-lg bg-blue-800 hover:bg-blue-600 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 shadow-xs">
                        {form.isUploadingAudio ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UploadCloud className="h-3.5 w-3.5" />
                        )}
                        <span>{form.mainAudioUrl ? "Thay Đổi File Audio" : "Tải lên File Audio (.mp3, .wav)"}</span>
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          disabled={form.isUploadingAudio}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) form.handleUploadMainAudio(f);
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: BIÊN SOẠN CÂU HỎI */}
          {form.step === 2 && (
            <QuestionBuilderList
              questions={form.questions}
              assignmentType={form.assignmentType}
              speakingMode={form.speakingMode}
              readingPassageText={form.readingPassageText}
              setReadingPassageText={form.setReadingPassageText}
              mainAudioUrl={form.mainAudioUrl}
              setMainAudioUrl={form.setMainAudioUrl}
              mainTranscript={form.mainTranscript}
              setMainTranscript={form.setMainTranscript}
              isUploadingAudio={form.isUploadingAudio}
              isPlayingMainAudio={form.isPlayingMainAudio}
              isSynthesizingTts={form.isSynthesizingTts}
              ttsVoice={form.ttsVoice}
              setTtsVoice={form.setTtsVoice}
              ttsSpeed={form.ttsSpeed}
              setTtsSpeed={form.setTtsSpeed}
              synthesizeAudioError={form.synthesizeAudioError}
              setSynthesizeAudioError={form.setSynthesizeAudioError}
              playingPreviewId={form.playingPreviewId}
              handleAddBlankQuestion={form.handleAddBlankQuestion}
              handleChangeQuestionType={form.handleChangeQuestionType}
              handleUpdateQuestion={form.handleUpdateQuestion}
              handleDeleteQuestion={form.handleDeleteQuestion}
              handleAddOption={form.handleAddOption}
              handlePreviewAudio={form.handlePreviewAudio}
              handleUploadMainAudio={form.handleUploadMainAudio}
              togglePlayMainAudio={form.togglePlayMainAudio}
              handleSynthesizeNeuralAudio={form.handleSynthesizeNeuralAudio}
              handlePreviewTranscriptAi={form.handlePreviewTranscriptAi}
            />
          )}

          {/* STEP 3: CẤU HÌNH GÁN BÀI & THỜI GIAN */}
          {form.step === 3 && (
            <AssignmentBasicInfoForm
              title={form.title}
              setTitle={form.setTitle}
              description={form.description}
              setDescription={form.setDescription}
              difficulty={form.difficulty}
              setDifficulty={form.setDifficulty}
              selectedPlanId={form.selectedPlanId}
              setSelectedPlanId={form.setSelectedPlanId}
              dailyPlans={form.dailyPlans}
              scheduledDate={form.scheduledDate}
              setScheduledDate={form.setScheduledDate}
              dueDate={form.dueDate}
              setDueDate={form.setDueDate}
              estimatedMinutes={form.estimatedMinutes}
              setEstimatedMinutes={form.setEstimatedMinutes}
              timeLimitMinutes={form.timeLimitMinutes}
              setTimeLimitMinutes={form.setTimeLimitMinutes}
              maxAllowedErrorPercent={form.maxAllowedErrorPercent}
              setMaxAllowedErrorPercent={form.setMaxAllowedErrorPercent}
              maxAttempts={form.maxAttempts}
              setMaxAttempts={form.setMaxAttempts}
              targetStudents={form.targetStudents}
              setTargetStudents={form.setTargetStudents}
              status={form.status}
              setStatus={form.setStatus}
            />
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50/90 dark:bg-slate-900/90 flex-wrap gap-2 shrink-0">
          {form.step > 1 ? (
            <button
              type="button"
              onClick={() => form.setStep(form.step - 1)}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Quay Lại
            </button>
          ) : (
            <span />
          )}

          {form.step === 1 && (
            <button
              type="button"
              disabled={form.isGeneratingAi}
              onClick={() => {
                if (form.creationSource === "AI") {
                  form.handleGenerateAiQuestions();
                } else if (form.creationSource === "TEXT_AI") {
                  if (!form.rawText.trim()) {
                    alert("Vui lòng dán hoặc nhập nội dung văn bản thô!");
                    return;
                  }
                  form.handleQuickParseText();
                } else if (form.creationSource === "EXCEL") {
                  alert("Vui lòng chọn File Excel ở khung bên trên để hệ thống tự động nạp câu hỏi!");
                } else {
                  if (form.questions.length === 0) {
                    form.handleAddBlankQuestion();
                  }
                  form.setStep(2);
                }
              }}
              className="flex items-center gap-1.5 rounded-lg bg-blue-800 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-600 transition cursor-pointer disabled:opacity-50"
            >
              {form.isGeneratingAi ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>AI Đang Phân Tích &amp; Tạo Câu Hỏi...</span>
                </>
              ) : (
                <>
                  <span>Tiếp Tục (Biên Soạn Câu Hỏi)</span>
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          )}

          {form.step === 2 && (
            <div className="flex items-center gap-2">
              {mode === "EDIT" && (
                <button
                  type="button"
                  disabled={form.isSaving}
                  onClick={form.handleFinalSave}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition cursor-pointer shadow-md disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  <span>{form.isSaving ? "Đang Lưu..." : "Lưu Thay Đổi Ngay"}</span>
                </button>
              )}
              <button
                type="button"
                onClick={form.handleGoToScheduleStep}
                className="flex items-center gap-1.5 rounded-lg bg-blue-800 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-600 transition cursor-pointer"
              >
                <span>{mode === "EDIT" ? "Tiếp Tục (Cấu Hình Giới Hạn Sai & Thời Gian)" : "Tiếp Tục (Cấu Hình Ngày & Giao Bài)"}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {form.step === 3 && (
            <button
              type="button"
              disabled={form.isSaving}
              onClick={form.handleFinalSave}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition cursor-pointer shadow-md disabled:opacity-50"
            >
              {form.isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{mode === "EDIT" ? "Đang Cập Nhật Bài Tập..." : "Đang Gán & Lưu Lộ Trình..."}</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>{mode === "EDIT" ? "Lưu & Cập Nhật Mọi Thay Đổi" : "Xác Nhận & Gán Vào Lộ Trình"}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Modal Hướng Dẫn Quy Cách Nhập Excel */}
      <ExcelFormatCheatSheetModal
        isOpen={form.showCheatSheetModal}
        onClose={() => form.setShowCheatSheetModal(false)}
        currentSkill={form.assignmentType}
        onDownloadSkillTemplate={downloadSkillExcelTemplate}
        onDownloadFullTemplate={downloadExcelTemplate}
      />
    </div>
  );
};

export default CreateAssignmentModal;
