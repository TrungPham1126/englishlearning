import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  X,
  Calendar,
  Clock,
  Plus,
  Edit3,
  Trash2,
  Eye,
  CheckCircle,
  AlertTriangle,
  Headphones,
  Mic,
  BookOpen,
  PenTool,
  HelpCircle,
  RefreshCw,
  Layers,
  FileQuestion,
  Info,
} from "lucide-react";
import { teacherApi } from "../../api/teacherApi";
import type { DailyPlanItem } from "./dailyPlanTypes";

interface DailyPlanItemModalProps {
  isOpen: boolean;
  editingPlan: DailyPlanItem | null;
  dayNumber: number;
  setDayNumber: (n: number) => void;
  title: string;
  setTitle: (t: string) => void;
  scheduledDate: string;
  setScheduledDate: (d: string) => void;
  estimatedMinutes: number;
  setEstimatedMinutes: (m: number) => void;
  classAssignments: any[];
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
  onViewAssignment?: (assignmentOrId: any) => void;
  onEditAssignment?: (assignmentOrId: any) => void;
  onDeleteAssignment?: (assignmentId: string, title?: string) => void;
  onAttachAssignmentToDay?: (planId: string, assignment: any) => Promise<void>;
  onCreateNewAssignmentForDay?: (scheduledDate: string) => void;
  onRefresh?: () => void;
}

export const DailyPlanItemModal: React.FC<DailyPlanItemModalProps> = ({
  isOpen,
  editingPlan,
  dayNumber,
  setDayNumber,
  title,
  setTitle,
  scheduledDate,
  setScheduledDate,
  estimatedMinutes,
  setEstimatedMinutes,
  classAssignments,
  onClose,
  onSave,
  onViewAssignment,
  onEditAssignment,
  onDeleteAssignment,
  onAttachAssignmentToDay,
  onCreateNewAssignmentForDay,
  onRefresh,
}) => {
  const [dbAssignments, setDbAssignments] = useState<any[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState<boolean>(false);
  const [selectedAttachId, setSelectedAttachId] = useState<string>("");
  const [attaching, setAttaching] = useState<boolean>(false);

  // Tải danh sách bài tập của ngày này trực tiếp từ Database
  const fetchDayAssignmentsFromDb = useCallback(async () => {
    if (!editingPlan?.id) {
      setDbAssignments([]);
      return;
    }
    try {
      setLoadingAssignments(true);
      const res = await teacherApi.getDayAssignments(editingPlan.id);
      if (res.data?.data) {
        setDbAssignments(res.data.data);
      }
    } catch {
      // Endpoint fallback
      setDbAssignments([]);
    } finally {
      setLoadingAssignments(false);
    }
  }, [editingPlan?.id]);

  useEffect(() => {
    if (isOpen && editingPlan) {
      fetchDayAssignmentsFromDb();
    } else {
      setDbAssignments([]);
    }
  }, [isOpen, editingPlan, fetchDayAssignmentsFromDb]);

  // Hợp nhất dữ liệu bài tập từ DB endpoint + editingPlan.items + classAssignments
  const dayAssignments = useMemo(() => {
    if (!editingPlan) return [];

    const map = new Map<string, any>();

    // 1. Dữ liệu từ API getDayAssignments (chuẩn DB)
    dbAssignments.forEach((a) => {
      if (a?.id) map.set(a.id, a);
    });

    // 2. Dữ liệu từ editingPlan.items
    (editingPlan.items || []).forEach((it: any) => {
      const a = it.assignment || classAssignments.find((ca) => ca.id === it.assignmentId);
      if (a?.id && !map.has(a.id)) {
        map.set(a.id, a);
      } else if (it.id && !it.assignmentId && !map.has(it.id)) {
        map.set(it.id, {
          id: it.id,
          title: it.title,
          skillType: it.itemType || "VOCABULARY",
          timeLimitMinutes: 15,
          maxAttempts: 3,
          passScore: 8.0,
          maxAllowedErrorPercent: 20.0,
          isPlanItem: true,
        });
      }
    });

    // 3. Dữ liệu từ classAssignments khớp scheduledDate hoặc Day title
    classAssignments.forEach((ca: any) => {
      if (map.has(ca.id)) return;
      const dateMatch =
        ca.dueDate && scheduledDate && ca.dueDate.startsWith(scheduledDate);
      const titleMatch =
        ca.title &&
        editingPlan.dayNumber &&
        (ca.title.toLowerCase().includes(`day ${editingPlan.dayNumber}`) ||
          ca.title.toLowerCase().includes(`ngày ${editingPlan.dayNumber}`));
      if (dateMatch || titleMatch) {
        map.set(ca.id, ca);
      }
    });

    return Array.from(map.values());
  }, [dbAssignments, editingPlan, classAssignments, scheduledDate]);

  // Danh sách các bài tập chưa gán vào Day này để giáo viên chọn thêm
  const availableToAttach = useMemo(() => {
    const existingIds = new Set(dayAssignments.map((a) => a.id));
    return classAssignments.filter((ca) => !existingIds.has(ca.id));
  }, [classAssignments, dayAssignments]);

  const handleAttach = async () => {
    if (!selectedAttachId || !editingPlan?.id) return;
    const target = classAssignments.find((a) => a.id === selectedAttachId);
    if (!target) return;

    try {
      setAttaching(true);
      if (onAttachAssignmentToDay) {
        await onAttachAssignmentToDay(editingPlan.id, target);
      } else {
        await teacherApi.addPlanItem(editingPlan.id, {
          sectionName: "Bài tập ngày",
          title: target.title,
          itemType: target.skillType || "ASSIGNMENT",
          orderIndex: dayAssignments.length + 1,
          assignmentId: target.id,
        });
      }
      setSelectedAttachId("");
      await fetchDayAssignmentsFromDb();
      onRefresh?.();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Lỗi khi gắn bài tập vào Day!");
    } finally {
      setAttaching(false);
    }
  };

  const getSkillBadge = (skill: string) => {
    switch ((skill || "").toUpperCase()) {
      case "READING":
        return (
          <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <BookOpen className="h-3 w-3" /> Reading
          </span>
        );
      case "LISTENING":
        return (
          <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <Headphones className="h-3 w-3" /> Listening
          </span>
        );
      case "SPEAKING":
        return (
          <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Mic className="h-3 w-3" /> Speaking
          </span>
        );
      case "WRITING":
        return (
          <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <PenTool className="h-3 w-3" /> Writing
          </span>
        );
      case "VOCABULARY":
      case "VOCAB":
        return (
          <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <BookOpen className="h-3 w-3" /> Vocab
          </span>
        );
      case "GRAMMAR":
        return (
          <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Layers className="h-3 w-3" /> Grammar
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
            <FileQuestion className="h-3 w-3" /> {skill || "Quiz"}
          </span>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-elevated text-slate-900 dark:text-slate-100 overflow-hidden">
        
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-600/20 font-black text-sm">
              {editingPlan ? `D${editingPlan.dayNumber}` : "+"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingPlan ? `Chỉnh Sửa Day ${editingPlan.dayNumber}` : "Thêm Ngày Học Mới"}
                </h2>
                {editingPlan && (
                  <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    {dayAssignments.length} bài tập từ Database
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {editingPlan
                  ? "Xem và quản lý các thông số đề bài, thời gian, giới hạn sai và đáp án của ngày này"
                  : "Thiết lập thông tin ngày học mới trong lộ trình đào tạo"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* SECTION 1: Cấu hình thông tin Ngày học */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                1. Thông tin Ngày học (Lộ trình)
              </span>
              <span className="text-xs text-slate-400">
                Hạn mở: <b className="text-slate-700 dark:text-slate-200">{scheduledDate || "Chưa đặt"}</b>
              </span>
            </div>

            <form onSubmit={onSave} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-3">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Day thứ:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={dayNumber}
                    onChange={(e) => setDayNumber(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600 font-semibold"
                    required
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Ngày mở bài (Deadline):
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
                    required
                  />
                </div>
                <div className="sm:col-span-5">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Thời lượng ước tính (phút):
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="5"
                      value={estimatedMinutes}
                      onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600 pl-8"
                      required
                    />
                    <Clock className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Tiêu đề ngày học:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ví dụ: DAY 1: Core Office Vocabulary & Workplace Communication"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600 font-medium"
                    required
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs shadow-sm transition cursor-pointer shrink-0"
                  >
                    {editingPlan ? "Lưu Thông Tin Day" : "Tạo Ngày Mới"}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* SECTION 2: DANH SÁCH BÀI TẬP CỦA NGÀY (LẤY TỪ DATABASE) */}
          {editingPlan && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    2. Danh Sách Bài Tập Của Day {editingPlan.dayNumber} ({dayAssignments.length} bài)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Dữ liệu được truy vấn trực tiếp từ bảng cơ sở dữ liệu `assignments` và `daily_plan_items`
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchDayAssignmentsFromDb}
                    disabled={loadingAssignments}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    title="Làm mới từ cơ sở dữ liệu"
                  >
                    <RefreshCw className={`h-3 w-3 ${loadingAssignments ? "animate-spin text-blue-500" : ""}`} />
                    Tải lại DB
                  </button>
                  {onCreateNewAssignmentForDay && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onCreateNewAssignmentForDay(scheduledDate);
                      }}
                      className="flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Tạo Bài Mới Cho Day Này
                    </button>
                  )}
                </div>
              </div>

              {/* LOADING OR EMPTY OR LIST */}
              {loadingAssignments ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 p-8 text-center text-slate-500">
                  <RefreshCw className="h-6 w-6 mx-auto mb-2 animate-spin text-blue-500" />
                  <p className="text-xs">Đang truy vấn bài tập của Day {editingPlan.dayNumber} từ cơ sở dữ liệu...</p>
                </div>
              ) : dayAssignments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/10 p-8 text-center space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 dark:text-amber-400">
                    <Info className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Chưa có bài tập nào được giao cho Day {editingPlan.dayNumber}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                      Bạn có thể chọn một bài tập đã có trong lớp để gắn vào ngày này, hoặc tạo bài tập mới bằng công cụ AI / File Excel.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {dayAssignments.map((assignment, index) => {
                    const qCount =
                      assignment.questions?.length ??
                      assignment.questionCount ??
                      assignment.totalQuestions ??
                      0;
                    const timeLimit = assignment.timeLimitMinutes || 15;
                    const maxError = assignment.maxAllowedErrorPercent ?? 20.0;
                    const passScore = assignment.passScore ?? 8.0;
                    const maxAttempts = assignment.maxAttempts ?? 3;

                    return (
                      <div
                        key={assignment.id || index}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#162033] p-4 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition shadow-sm space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-2.5">
                          <div className="flex items-start sm:items-center gap-2.5">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0">
                              {index + 1}
                            </span>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                {getSkillBadge(assignment.skillType || assignment.type)}
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                  {assignment.title}
                                </h4>
                              </div>
                              {assignment.description && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                                  {assignment.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* ACTION BUTTONS */}
                          <div className="flex items-center gap-1.5 self-end sm:self-center">
                            {onViewAssignment && (
                              <button
                                type="button"
                                onClick={() => onViewAssignment(assignment)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/40 dark:hover:text-blue-300 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                                title="Xem toàn bộ đề bài, audio nghe, câu hỏi & đáp án đúng"
                              >
                                <Eye className="h-3.5 w-3.5 text-blue-500" />
                                <span>Xem Đề</span>
                              </button>
                            )}

                            {onEditAssignment && (
                              <button
                                type="button"
                                onClick={() => onEditAssignment(assignment)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/40 dark:hover:text-emerald-300 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                                title="Chỉnh sửa mọi thông số: đề bài, thời gian, giới hạn sai, đáp án..."
                              >
                                <Edit3 className="h-3.5 w-3.5 text-emerald-500" />
                                <span>Chỉnh Sửa</span>
                              </button>
                            )}

                            {onDeleteAssignment && (
                              <button
                                type="button"
                                onClick={() => onDeleteAssignment(assignment.id, assignment.title)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                title="Xóa vĩnh viễn bài tập này"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* DETAILED PARAMETERS PILLS */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800/80 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
                            <Clock className="h-3 w-3 text-blue-500" />
                            Thời gian: <b>{timeLimit} phút</b>
                          </span>

                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 dark:bg-rose-950/30 px-2 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
                            <AlertTriangle className="h-3 w-3 text-rose-500" />
                            Giới hạn sai: <b>≤ {maxError}%</b>
                          </span>

                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                            <CheckCircle className="h-3 w-3 text-emerald-500" />
                            Điểm đạt chuẩn: <b>≥ {passScore}/10</b>
                          </span>

                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/30 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
                            <RefreshCw className="h-3 w-3 text-amber-500" />
                            Lượt làm: <b>{maxAttempts} lần</b>
                          </span>

                          <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 dark:bg-purple-950/30 px-2 py-1 text-[11px] font-semibold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50">
                            <HelpCircle className="h-3 w-3 text-purple-500" />
                            Số câu hỏi: <b>{qCount > 0 ? `${qCount} câu` : "Chờ cập nhật"}</b>
                          </span>

                          {assignment.audioUrl && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 dark:bg-indigo-950/30 px-2 py-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50">
                              <Headphones className="h-3 w-3 text-indigo-500" />
                              Có Audio mẫu
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* QUICK ATTACH EXISTING ASSIGNMENT INTO THIS DAY */}
              {availableToAttach.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3.5 space-y-2">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    Gắn thêm bài tập từ danh sách lớp vào Day {editingPlan.dayNumber}:
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={selectedAttachId}
                      onChange={(e) => setSelectedAttachId(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
                    >
                      <option value="">-- Chọn bài tập cần liên kết --</option>
                      {availableToAttach.map((a) => (
                        <option key={a.id} value={a.id}>
                          [{a.skillType || "ASSIGNMENT"}] {a.title} ({a.timeLimitMinutes || 15}p)
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAttach}
                      disabled={!selectedAttachId || attaching}
                      className="px-4 py-2 rounded-lg bg-blue-800 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      {attaching ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      Gắn Vào Day {editingPlan.dayNumber}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-6 py-3 bg-slate-50/50 dark:bg-slate-800/40">
          <span className="text-[11px] text-slate-400">
            {editingPlan ? `Đang chỉnh sửa Ngày ${editingPlan.dayNumber}` : "Lộ trình học theo ngày"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition shadow-sm"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
