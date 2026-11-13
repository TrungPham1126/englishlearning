import React, { useMemo, useState } from "react";
import {
  Search,
  DatabaseZap,
  Trash2,
  FileSpreadsheet,
  Eye,
  School,
  FileAudio,
  ClipboardCheck,
  CheckCircle2,
  HardDrive,
} from "lucide-react";
import type { AdminDatabaseOverview, ClassroomDatabaseItem } from "@/features/admin/types";

interface DatabaseManagementTabProps {
  overview: AdminDatabaseOverview | null;
  exportingClassId: string | null;
  onPreviewReport: (cls: ClassroomDatabaseItem) => void;
  onDownloadExcel: (cls: ClassroomDatabaseItem) => void;
  onOpenPurgeModal: (cls: ClassroomDatabaseItem) => void;
  onOpenDeleteModal: (cls: ClassroomDatabaseItem) => void;
}

const formatKb = (kb: number) => {
  if (kb >= 1024 * 1024) return `${(kb / (1024 * 1024)).toFixed(2)} GB`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(2)} MB`;
  return `${kb} KB`;
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
    case "CANCELLED":
      return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
    case "IN_PROGRESS":
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";
    case "OPEN":
      return "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800";
    default:
      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
  }
};

export const DatabaseManagementTab: React.FC<DatabaseManagementTabProps> = ({
  overview,
  exportingClassId,
  onPreviewReport,
  onDownloadExcel,
  onOpenPurgeModal,
  onOpenDeleteModal,
}) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredClassrooms = useMemo(() => {
    const list = overview?.classrooms || [];
    return list.filter((cls) => {
      if (statusFilter !== "ALL" && cls.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchName = cls.name?.toLowerCase().includes(q);
        const matchTeacher = cls.teacherName?.toLowerCase().includes(q);
        if (!matchName && !matchTeacher) return false;
      }
      return true;
    });
  }, [overview, search, statusFilter]);

  return (
    <div className="space-y-6">
      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>Tổng Lớp Học</span>
            <School size={18} className="text-blue-700 dark:text-blue-400" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-2">
            {overview?.totalClassrooms ?? 0}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            <strong className="text-emerald-600 dark:text-emerald-400">{overview?.completedClassrooms ?? 0}</strong> lớp đã kết thúc sẵn sàng dọn dữ liệu
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>Lượt Làm Bài &amp; Thi</span>
            <ClipboardCheck size={18} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-2">
            {(overview?.totalAttempts ?? 0).toLocaleString()}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {overview?.totalAssignments ?? 0} bài tập • {overview?.totalExams ?? 0} bài thi
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>Bản Ghi DB &amp; AI Eval</span>
            <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-2">
            {((overview?.totalStudentAnswers ?? 0) + (overview?.totalAiEvaluations ?? 0)).toLocaleString()}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {overview?.totalStudentAnswers ?? 0} câu trả lời • {overview?.totalAiEvaluations ?? 0} đánh giá AI
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>Audio Speaking &amp; Dung Lượng</span>
            <HardDrive size={18} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-2">
            {formatKb(overview?.estimatedSubmissionDataKb ?? 0)}
          </div>
          <p className="text-xs text-slate-500 mt-1 inline-flex items-center gap-1">
            <FileAudio size={13} /> {overview?.totalSubmissionAudioFiles ?? 0} file audio bài nộp học viên
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto">
          {[
            { label: "Tất cả", value: "ALL" },
            { label: "Đã kết thúc (Khuyên dọn)", value: "COMPLETED" },
            { label: "Đã hủy", value: "CANCELLED" },
            { label: "Đang giảng dạy", value: "IN_PROGRESS" },
            { label: "Tuyển sinh", value: "OPEN" },
          ].map((st) => (
            <button
              key={st.value}
              type="button"
              onClick={() => setStatusFilter(st.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                statusFilter === st.value
                  ? "bg-blue-800 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên lớp, giảng viên..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b1120] text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-700"
          />
        </div>
      </div>

      {/* Per-Classroom Database Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Quản Lý Cơ Sở Dữ Liệu Theo Lớp Học ({filteredClassrooms.length})
            </h3>
            <p className="text-xs text-slate-500">
              Xuất báo cáo chi tiết lớp (.xlsx), dọn sạch bài làm học sinh khi hoàn thành khóa hoặc xóa toàn bộ lớp an toàn.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black border-b border-slate-200 dark:border-slate-700">
                <th className="p-4 pl-6">Lớp Học &amp; Giảng Viên</th>
                <th className="p-4 text-center">Trạng Thái</th>
                <th className="p-4 text-center">Sĩ Số / Đề</th>
                <th className="p-4 text-center">Bài Nộp &amp; Câu Trả Lời</th>
                <th className="p-4 text-center">Audio R2 / Dung Lượng</th>
                <th className="p-4 pr-6 text-right">Thao Tác Quản Trị</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredClassrooms.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400 italic">
                    Không có lớp học nào khớp bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredClassrooms.map((cls) => {
                  const hasStudentData =
                    cls.attemptCount > 0 ||
                    cls.answerCount > 0 ||
                    cls.dailyProgressCount > 0 ||
                    cls.videoWatchCount > 0;

                  return (
                    <tr key={cls.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                      <td className="p-4 pl-6">
                        <div className="font-black text-sm text-slate-900 dark:text-white">
                          {cls.name}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Level {cls.level} • GV: {cls.teacherName} • {cls.startDate} &rarr; {cls.endDate}
                        </div>
                      </td>

                      <td className="p-4 text-center">
                        <span className={`inline-block px-2.5 py-1 text-[10px] font-black rounded-lg uppercase border ${getStatusBadge(cls.status)}`}>
                          {cls.status}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {cls.studentCount} HV • {cls.lessonCount} bài giảng
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {cls.assignmentCount} BT • {cls.examCount} Đề thi
                        </div>
                      </td>

                      <td className="p-4 text-center">
                        <div className="font-bold text-blue-700 dark:text-blue-400">
                          {cls.attemptCount} lượt nộp • {cls.answerCount} đáp án
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {cls.aiEvaluationCount} AI eval • {cls.dailyProgressCount} tiến độ ngày
                          {cls.cheatingFlagCount > 0 && (
                            <span className="ml-1.5 text-rose-600 font-bold">
                              ({cls.cheatingFlagCount} gian lận)
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4 text-center">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {formatKb(cls.estimatedSubmissionKb)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {cls.submissionAudioCount} audio speaking
                        </div>
                      </td>

                      <td className="p-4 pr-6">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => onPreviewReport(cls)}
                            title="Xem nhanh báo cáo chi tiết lớp"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer transition"
                          >
                            <Eye size={13} /> Xem
                          </button>

                          <button
                            type="button"
                            disabled={exportingClassId === cls.id}
                            onClick={() => onDownloadExcel(cls)}
                            title="Xuất file Excel chi tiết về lớp học"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-pointer transition disabled:opacity-50"
                          >
                            <FileSpreadsheet size={13} />
                            {exportingClassId === cls.id ? "Đang xuất..." : "Xuất Excel"}
                          </button>

                          <button
                            type="button"
                            disabled={!hasStudentData}
                            onClick={() => onOpenPurgeModal(cls)}
                            title="Xóa hết dữ liệu bài làm của học viên trong lớp"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <DatabaseZap size={13} /> Dọn Bài Làm
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenDeleteModal(cls)}
                            title="Xóa vĩnh viễn lớp học và toàn bộ dữ liệu liên quan"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 cursor-pointer transition"
                          >
                            <Trash2 size={13} /> Xóa Lớp
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DatabaseManagementTab;
