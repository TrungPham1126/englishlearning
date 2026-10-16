// src/features/teacher/pages/TeacherGradingPage.tsx
import React, { useState, useEffect, useMemo } from "react";
import {
  CheckCircle,
  Clock,
  Search,
  Award,
  Send,
  Eye,
  Loader2,
  BookOpen,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Mic,
  Volume2,
  PenTool,
  Filter,
  CheckSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { teacherApi } from "../api/teacherApi";
import type { ClassroomItem } from "../api/teacherApi";

export default function TeacherGradingPage() {
  const [classes, setClasses] = useState<ClassroomItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const [submissionDetail, setSubmissionDetail] = useState<any | null>(null);

  const [inputScore, setInputScore] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "COMPLETED">("ALL");

  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingGrade, setSavingGrade] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // 1. Tải danh sách lớp
  useEffect(() => {
    setLoadingClasses(true);
    teacherApi
      .getAssignedClasses()
      .then((res: any) => {
        const list = res.data?.data || [];
        setClasses(list);
        if (list.length > 0) setSelectedClassId(list[0].id);
      })
      .catch((err) => {
        console.error("Lỗi tải lớp học:", err);
      })
      .finally(() => setLoadingClasses(false));
  }, []);

  // 2. Tải danh sách bài tập khi chọn Lớp
  useEffect(() => {
    if (selectedClassId) {
      setLoadingAssignments(true);
      teacherApi
        .getClassAssignments(selectedClassId)
        .then((res: any) => {
          const list = res.data?.data || [];
          setAssignments(list);
          if (list.length > 0) {
            setSelectedAssignmentId(list[0].id);
          } else {
            setSelectedAssignmentId("");
            setSubmissions([]);
            setSelectedSub(null);
            setSubmissionDetail(null);
          }
        })
        .catch((err) => {
          console.error("Lỗi tải bài tập:", err);
          setAssignments([]);
        })
        .finally(() => setLoadingAssignments(false));
    }
  }, [selectedClassId]);

  // 3. Tải danh sách bài nộp khi chọn Bài Tập
  useEffect(() => {
    if (selectedAssignmentId) {
      setLoadingSubmissions(true);
      teacherApi
        .getSubmissionsForGrading(selectedAssignmentId)
        .then((res: any) => {
          const list = res.data?.data || [];
          setSubmissions(list);
          if (list.length > 0) {
            handleSelectSubmission(list[0]);
          } else {
            setSelectedSub(null);
            setSubmissionDetail(null);
          }
        })
        .catch((err) => {
          console.error("Lỗi tải bài nộp:", err);
          setSubmissions([]);
        })
        .finally(() => setLoadingSubmissions(false));
    }
  }, [selectedAssignmentId]);

  // 4. Lấy chi tiết bài nộp khi Click vào danh sách bên trái
  const handleSelectSubmission = async (sub: any) => {
    setSelectedSub(sub);
    setLoadingDetail(true);
    setSaveSuccess(null);
    try {
      const res: any = await teacherApi.getSubmissionDetail(sub.attemptId);
      const detail = res.data?.data;
      setSubmissionDetail(detail);
      setInputScore(detail?.score !== null && detail?.score !== undefined ? String(detail.score) : "");
      setFeedback(detail?.teacherFeedback || "");
    } catch (err) {
      console.error("Lỗi tải chi tiết bài làm:", err);
      alert("Không thể tải chi tiết bài làm của học sinh.");
    } finally {
      setLoadingDetail(false);
    }
  };

  // 5. Submit chấm điểm
  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub) return;
    const parsedScore = parseFloat(inputScore);
    if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > 10) {
      alert("Vui lòng nhập điểm số hợp lệ từ 0 đến 10.");
      return;
    }

    try {
      setSavingGrade(true);
      setSaveSuccess(null);
      await teacherApi.gradeSubmission(selectedSub.attemptId, {
        score: parsedScore,
        feedback,
      });

      setSaveSuccess(`Đã lưu điểm ${parsedScore} và gửi nhận xét cho học viên.`);

      // Cập nhật state nội bộ
      setSubmissions((prev) =>
        prev.map((item) =>
          item.attemptId === selectedSub.attemptId
            ? { ...item, score: parsedScore, status: "COMPLETED" }
            : item,
        ),
      );
      setSelectedSub((prev: any) => ({
        ...prev,
        score: parsedScore,
        status: "COMPLETED",
      }));
      setSubmissionDetail((prev: any) => ({
        ...prev,
        score: parsedScore,
        teacherFeedback: feedback,
        status: "COMPLETED",
      }));
    } catch (err: any) {
      console.error("Lỗi chấm điểm:", err);
      alert(err.response?.data?.message || "Lỗi khi chấm điểm.");
    } finally {
      setSavingGrade(false);
    }
  };

  // Helper phân tích Feedback AI (JSON hoặc văn bản thường)
  const parseAiFeedback = (feedbackStr: string | null) => {
    if (!feedbackStr) return null;
    try {
      const parsed = JSON.parse(feedbackStr);
      if (typeof parsed === "object") return parsed;
    } catch {
      // Plain string
    }
    return { generalFeedback: feedbackStr };
  };

  // Lọc theo search và trạng thái
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      const matchesSearch =
        s.studentName.toLowerCase().includes(search.toLowerCase()) ||
        s.studentEmail.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === "PENDING") {
        return s.status !== "COMPLETED";
      }
      if (statusFilter === "COMPLETED") {
        return s.status === "COMPLETED";
      }
      return true;
    });
  }, [submissions, search, statusFilter]);

  const pendingCount = submissions.filter((s) => s.status !== "COMPLETED").length;
  const completedCount = submissions.filter((s) => s.status === "COMPLETED").length;

  return (
    <div className="space-y-6">
      {/* Top Header & Selectors */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Award className="h-6 w-6 text-amber-400" />
            Trung Tâm Chấm Bài & Đánh Giá
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Xem bài nộp của học sinh, kết quả tự động từ AI và chấm điểm thủ công
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Lựa chọn Lớp học */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 font-medium">Lớp:</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="rounded-xl border border-slate-700/80 bg-slate-800/90 px-3.5 py-2 text-xs font-medium text-white outline-none focus:border-indigo-500 transition shadow-sm"
            >
              {loadingClasses ? (
                <option value="">Đang tải lớp học...</option>
              ) : classes.length === 0 ? (
                <option value="">Chưa có lớp phụ trách</option>
              ) : (
                classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.level || "Chưa set level"})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Lựa chọn Bài tập */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 font-medium">Bài tập:</label>
            <select
              value={selectedAssignmentId}
              onChange={(e) => setSelectedAssignmentId(e.target.value)}
              disabled={assignments.length === 0}
              className="rounded-xl border border-slate-700/80 bg-slate-800/90 px-3.5 py-2 text-xs font-medium text-white outline-none focus:border-indigo-500 transition shadow-sm disabled:opacity-50"
            >
              {loadingAssignments ? (
                <option value="">Đang tải bài tập...</option>
              ) : assignments.length === 0 ? (
                <option value="">Không có bài tập nào</option>
              ) : (
                assignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} ({a.skillType || "General"})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ============================================================= */}
        {/* CỘT TRÁI: BỘ LỌC VÀ DANH SÁCH BÀI NỘP                        */}
        {/* ============================================================= */}
        <div className="lg:col-span-5 space-y-3.5">
          {/* Status Tabs */}
          <div className="flex rounded-xl border border-slate-800 bg-slate-900/80 p-1 text-xs">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`flex-1 rounded-lg py-1.5 font-medium transition ${
                statusFilter === "ALL"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Tất cả ({submissions.length})
            </button>
            <button
              onClick={() => setStatusFilter("PENDING")}
              className={`flex-1 rounded-lg py-1.5 font-medium transition ${
                statusFilter === "PENDING"
                  ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Chờ chấm ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter("COMPLETED")}
              className={`flex-1 rounded-lg py-1.5 font-medium transition ${
                statusFilter === "COMPLETED"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Đã chấm ({completedCount})
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc email học viên..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/80 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* List of submissions */}
          <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
            {loadingSubmissions ? (
              <div className="p-10 text-center text-slate-400 flex flex-col items-center justify-center">
                <Loader2 className="animate-spin h-6 w-6 text-indigo-500 mb-2" />
                <span className="text-xs">Đang tải danh sách bài nộp...</span>
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center text-slate-500 text-xs">
                {submissions.length === 0
                  ? "Chưa có học sinh nào nộp bài tập này."
                  : "Không tìm thấy học sinh phù hợp với bộ lọc."}
              </div>
            ) : (
              filteredSubmissions.map((sub) => {
                const isSelected = selectedSub?.attemptId === sub.attemptId;
                const isCompleted = sub.status === "COMPLETED";

                return (
                  <div
                    key={sub.attemptId}
                    onClick={() => handleSelectSubmission(sub)}
                    className={`cursor-pointer rounded-2xl border p-4 transition shadow-sm ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/30"
                        : "border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-300 font-bold text-xs border border-indigo-500/20">
                          {sub.studentName?.charAt(0) || "U"}
                        </div>
                        <div>
                          <h3 className="font-semibold text-white text-xs sm:text-sm">
                            {sub.studentName}
                          </h3>
                          <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                            {sub.studentEmail}
                          </p>
                        </div>
                      </div>

                      {isCompleted ? (
                        <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20 shrink-0">
                          {sub.score !== null && sub.score !== undefined
                            ? `${sub.score} đ`
                            : "Đã chấm"}
                        </span>
                      ) : (
                        <span className="rounded-lg bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-400 border border-amber-500/20 shrink-0">
                          Chờ chấm
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/80 pt-2">
                      <span className="flex items-center">
                        <Clock className="h-3 w-3 mr-1 text-slate-400" />
                        Nộp:{" "}
                        {sub.submittedAt
                          ? new Date(sub.submittedAt).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              day: "2-digit",
                              month: "2-digit",
                            })
                          : "Gần đây"}
                      </span>
                      {sub.attemptNumber && (
                        <span>Lần nộp #{sub.attemptNumber}</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ============================================================= */}
        {/* CỘT PHẢI: CHI TIẾT BÀI LÀM & KHU VỰC CHẤM ĐIỂM                 */}
        {/* ============================================================= */}
        <div className="lg:col-span-7">
          {!selectedSub ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center text-slate-500 flex flex-col items-center justify-center min-h-[450px]">
              <BookOpen className="h-12 w-12 mb-3 opacity-30 text-indigo-400" />
              <h3 className="text-sm font-semibold text-slate-300">Chưa chọn bài nộp</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Chọn một học viên từ danh sách bên trái để xem nội dung làm bài, kết quả chấm tự động của AI và nhập điểm số.
              </p>
            </div>
          ) : loadingDetail ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-12 text-center text-slate-400 flex flex-col items-center justify-center min-h-[450px]">
              <Loader2 className="animate-spin h-8 w-8 text-indigo-500 mb-3" />
              <p className="text-xs">Đang tải chi tiết bài làm của học sinh...</p>
            </div>
          ) : (
            submissionDetail && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-6 shadow-xl backdrop-blur-md">
                {/* Header chi tiết bài làm */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-white">
                      {submissionDetail.assignmentTitle}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Học sinh:{" "}
                      <strong className="text-slate-200">
                        {selectedSub.studentName}
                      </strong>{" "}
                      ({selectedSub.studentEmail})
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {submissionDetail.score !== null &&
                      submissionDetail.score !== undefined && (
                        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-right">
                          <span className="block text-[10px] uppercase tracking-wider text-indigo-400 font-bold">
                            Điểm hiện tại
                          </span>
                          <span className="text-lg font-black text-indigo-300">
                            {submissionDetail.score} / 10
                          </span>
                        </div>
                      )}
                  </div>
                </div>

                {/* Overall AI Feedback Banner (nếu có) */}
                {submissionDetail.aiFeedback && (
                  <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 space-y-1.5">
                    <div className="flex items-center text-xs font-bold text-purple-300">
                      <Sparkles className="mr-1.5 h-4 w-4 text-purple-400" />
                      Đánh Giá Tổng Quan Từ AI (AI Evaluator)
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                      {submissionDetail.aiFeedback}
                    </p>
                  </div>
                )}

                {/* Danh sách câu hỏi và bài làm */}
                <div className="space-y-4 max-h-[460px] overflow-y-auto pr-2">
                  {submissionDetail.questions && submissionDetail.questions.length > 0 ? (
                    submissionDetail.questions.map((q: any, i: number) => {
                      const aiEval = parseAiFeedback(q.evalFeedback);

                      return (
                        <div
                          key={q.id || i}
                          className="rounded-xl border border-slate-800/90 bg-slate-950/70 p-4 space-y-3 transition hover:border-slate-700"
                        >
                          {/* Câu hỏi & điểm số thành phần */}
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs sm:text-sm font-semibold text-slate-200">
                              <span className="text-indigo-400 font-bold mr-1">
                                Câu {i + 1}:
                              </span>
                              {q.promptText}
                            </p>
                            <span className="shrink-0 rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                              {q.questionType || "TỰ LUẬN"}
                            </span>
                          </div>

                          {/* Media đề bài (nếu có Audio đề bài nghe) */}
                          {q.mediaUrl && (
                            <div className="rounded-lg bg-slate-900 p-2.5 border border-slate-800">
                              <span className="text-[11px] text-slate-400 font-medium flex items-center mb-1">
                                <Volume2 className="h-3.5 w-3.5 mr-1 text-emerald-400" />
                                Audio đề bài (Listening):
                              </span>
                              <audio
                                src={q.mediaUrl}
                                controls
                                className="h-8 w-full"
                              />
                            </div>
                          )}

                          {/* Bài làm của học sinh */}
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-semibold text-slate-400">
                              Bài làm của học viên:
                            </span>

                            {q.studentAnswer ? (
                              <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-mono">
                                {q.studentAnswer}
                              </div>
                            ) : q.audioUrl ? (
                              <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 space-y-2">
                                <div className="flex items-center text-xs text-indigo-400 font-semibold">
                                  <Mic className="h-4 w-4 mr-1 text-indigo-400" />
                                  File âm thanh Speaking / Shadowing của học viên:
                                </div>
                                <audio
                                  src={q.audioUrl}
                                  controls
                                  className="h-9 w-full"
                                />
                              </div>
                            ) : (
                              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-xs text-rose-400 italic">
                                Học sinh bỏ trống hoặc chưa hoàn thành câu này.
                              </div>
                            )}
                          </div>

                          {/* Đáp án chuẩn (nếu có) */}
                          {q.correctAnswer && (
                            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              <span>Đáp án chuẩn: <strong>{q.correctAnswer}</strong></span>
                            </div>
                          )}

                          {/* AI Feedback Accordion / Box cho câu này */}
                          {aiEval && (
                            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 space-y-2 text-xs">
                              <div className="flex items-center justify-between text-indigo-300 font-semibold text-[11px]">
                                <span className="flex items-center">
                                  <Sparkles className="h-3.5 w-3.5 mr-1 text-indigo-400" />
                                  AI Phân Tích & Gợi Ý Chấm Điểm
                                </span>
                                {aiEval.bandScore && (
                                  <span className="rounded bg-indigo-500/20 px-2 py-0.5 font-bold text-indigo-300">
                                    Band: {aiEval.bandScore}
                                  </span>
                                )}
                              </div>

                              {aiEval.generalFeedback && (
                                <p className="text-slate-300 leading-relaxed">
                                  {aiEval.generalFeedback}
                                </p>
                              )}

                              {aiEval.grammarCorrections && (
                                <div className="text-[11px] text-amber-300 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                                  <strong className="block mb-0.5 text-amber-400">Góp ý ngữ pháp:</strong>
                                  {Array.isArray(aiEval.grammarCorrections)
                                    ? aiEval.grammarCorrections.join("; ")
                                    : String(aiEval.grammarCorrections)}
                                </div>
                              )}

                              {aiEval.pronunciationNotes && (
                                <div className="text-[11px] text-cyan-300 bg-cyan-500/10 p-2 rounded-lg border border-cyan-500/20">
                                  <strong className="block mb-0.5 text-cyan-400">Phát âm & Ngữ điệu:</strong>
                                  {aiEval.pronunciationNotes}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      Không có danh sách câu hỏi chi tiết.
                    </div>
                  )}
                </div>

                {/* Thông báo lưu thành công */}
                {saveSuccess && (
                  <div className="flex items-center space-x-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span>{saveSuccess}</span>
                  </div>
                )}

                {/* ===================================================== */}
                {/* FORM CHẤM ĐIỂM VÀ LƯU NHẬN XÉT                       */}
                {/* ===================================================== */}
                <form
                  onSubmit={handleSaveGrade}
                  className="space-y-4 pt-4 border-t border-slate-800"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300 flex items-center">
                        <Award className="h-4 w-4 mr-1.5 text-amber-400" />
                        Điểm chính thức (Thang 10):
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400">Gợi ý nhanh:</span>
                        {[10, 9, 8.5, 8, 7, 6].map((scorePreset) => (
                          <button
                            key={scorePreset}
                            type="button"
                            onClick={() => setInputScore(String(scorePreset))}
                            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-300 hover:border-indigo-500 hover:text-white transition"
                          >
                            {scorePreset}
                          </button>
                        ))}
                      </div>
                    </div>

                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      placeholder="Nhập điểm từ 0.0 đến 10.0..."
                      value={inputScore}
                      onChange={(e) => setInputScore(e.target.value)}
                      className="w-full max-w-xs rounded-xl border border-slate-700/80 bg-slate-800/80 px-3.5 py-2 text-sm text-white font-bold outline-none focus:border-indigo-500 transition"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300 block">
                        Nhận xét & Hướng dẫn sửa bài cho học sinh:
                      </label>
                      <div className="flex items-center gap-1.5">
                        {[
                          "Làm bài rất tốt!",
                          "Cần chú ý thì động từ",
                          "Phát âm rõ ràng hơn",
                        ].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() =>
                              setFeedback((prev) =>
                                prev ? `${prev}. ${chip}` : chip,
                              )
                            }
                            className="rounded-md bg-slate-800/60 border border-slate-700/60 px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200 transition"
                          >
                            + {chip}
                          </button>
                        ))}
                      </div>
                    </div>

                    <textarea
                      rows={3}
                      placeholder="Ghi chú chi tiết cho học sinh về điểm mạnh, lỗi sai và cách khắc phục..."
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      className="w-full rounded-xl border border-slate-700/80 bg-slate-800/80 p-3 text-xs text-white outline-none focus:border-indigo-500 transition placeholder-slate-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={savingGrade}
                      className="inline-flex items-center space-x-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition disabled:opacity-50"
                    >
                      {savingGrade ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Đang lưu kết quả...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          <span>Lưu Kết Quả & Gửi Nhận Xét</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
