import React from "react";
import {
  X,
  FileSpreadsheet,
  Users,
  BookOpen,
  Award,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import type { ClassroomDetailedReport } from "@/features/admin/types";

interface ClassroomReportPreviewModalProps {
  report: ClassroomDetailedReport | null;
  loading: boolean;
  exporting: boolean;
  onClose: () => void;
  onDownloadExcel: (classroomId: string, classroomName: string) => void;
}

export const ClassroomReportPreviewModal: React.FC<ClassroomReportPreviewModalProps> = ({
  report,
  loading,
  exporting,
  onClose,
  onDownloadExcel,
}) => {
  if (!loading && !report) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50 dark:bg-[#0d1424]">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet size={20} className="text-emerald-600" />
              {report ? `Báo Cáo Chi Tiết: ${report.classroomName}` : "Đang tổng hợp báo cáo lớp..."}
            </h2>
            {report && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Trình độ {report.level} • Trạng thái {report.status} • GV: {report.teacherName} ({report.teacherEmail})
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {report && (
              <button
                type="button"
                disabled={exporting}
                onClick={() => onDownloadExcel(report.classroomId, report.classroomName)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer transition disabled:opacity-50"
              >
                {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                Tải Excel (.xlsx)
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
              aria-label="Đóng"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="animate-spin text-blue-700" size={32} />
              <span className="text-xs font-semibold text-slate-500">Đang truy vấn dữ liệu học tập và bài nộp...</span>
            </div>
          ) : report ? (
            <>
              {/* 4 KPI cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Sĩ Số &amp; Giáo Trình</span>
                    <Users size={15} className="text-blue-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                    {report.totalStudents} <span className="text-xs font-semibold text-slate-500">học viên</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {report.totalLessons} bài giảng • {report.totalDailyPlans} ngày lộ trình
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Bài Tập &amp; Đề Thi</span>
                    <BookOpen size={15} className="text-indigo-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                    {report.totalAttempts} <span className="text-xs font-semibold text-slate-500">lượt nộp</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {report.totalAssignments} bài tập • {report.totalExams} bài thi
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Điểm TB &amp; Hoàn Thành</span>
                    <Award size={15} className="text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                    {report.classAverageScore.toFixed(1)} <span className="text-xs font-semibold text-slate-500">/ 10</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Hoàn thành TB: {report.averageCompletionRate.toFixed(1)}%
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Giám Sát Gian Lận</span>
                    <AlertTriangle size={15} className={report.flaggedCheatingAttempts > 0 ? "text-rose-500" : "text-emerald-500"} />
                  </div>
                  <div className={`text-2xl font-black mt-2 ${report.flaggedCheatingAttempts > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}>
                    {report.flaggedCheatingAttempts}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {report.completedAttempts} bài đã hoàn tất chấm
                  </p>
                </div>
              </div>

              {/* Danh sách học viên */}
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3">
                  Bảng Tổng Hợp Kết Quả Học Viên ({report.students.length})
                </h3>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/80 text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <th className="p-3">Học Viên</th>
                        <th className="p-3 text-center">Hoàn Thành</th>
                        <th className="p-3 text-center">Bài Nộp / Thi</th>
                        <th className="p-3 text-center">Điểm TB</th>
                        <th className="p-3 text-center">Cảnh Báo Thi</th>
                        <th className="p-3 text-center">Xếp Loại</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(report.students ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-slate-400 italic">
                            Chưa có học viên ghi danh trong lớp này.
                          </td>
                        </tr>
                      ) : (
                        (report.students ?? []).map((st) => (
                          <tr key={st.studentId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                            <td className="p-3">
                              <div className="font-bold text-slate-900 dark:text-white">{st.fullName}</div>
                              <div className="text-[11px] text-slate-500">{st.email}</div>
                            </td>
                            <td className="p-3 text-center font-semibold">
                              {st.completionRate}% ({st.completedTasks}/{st.totalTasks})
                            </td>
                            <td className="p-3 text-center font-semibold">
                              {st.totalAttempts} nộp ({st.examAttempts} thi)
                            </td>
                            <td className="p-3 text-center font-black text-blue-700 dark:text-blue-400">
                              {st.averageScore.toFixed(1)}
                            </td>
                            <td className="p-3 text-center">
                              {st.cheatingFlags > 0 ? (
                                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">
                                  {st.cheatingFlags} lần
                                </span>
                              ) : (
                                <span className="text-emerald-600 inline-flex items-center gap-1 font-semibold">
                                  <CheckCircle2 size={12} /> 0
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center font-bold">{st.classification}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Chi tiết lượt nộp gần nhất */}
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3">
                  Chi Tiết Bài Nộp &amp; Kết Quả Bài Thi ({(report.submissions ?? []).length} bản ghi)
                </h3>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl max-h-64">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                      <tr className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400">
                        <th className="p-3">Học Viên</th>
                        <th className="p-3">Bài Tập / Đề Thi</th>
                        <th className="p-3 text-center">Kỹ Năng</th>
                        <th className="p-3 text-center">Điểm</th>
                        <th className="p-3 text-center">Gian Lận</th>
                        <th className="p-3">Thời Gian Nộp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(report.submissions ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-slate-400 italic">
                            Chưa có dữ liệu làm bài hoặc đã được dọn dẹp khỏi hệ thống.
                          </td>
                        </tr>
                      ) : (
                        (report.submissions ?? []).map((sub) => (
                          <tr key={sub.attemptId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                            <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                              {sub.studentName}
                            </td>
                            <td className="p-3">
                              <span className="font-bold text-slate-900 dark:text-white">{sub.assignmentTitle}</span>
                              {sub.exam && (
                                <span className="ml-2 px-1.5 py-0.5 text-[10px] font-black rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                                  BÀI THI
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">{sub.skillType}</td>
                            <td className="p-3 text-center font-black text-blue-700 dark:text-blue-400">
                              {sub.totalScore != null ? sub.totalScore.toFixed(1) : "Chờ chấm"}
                            </td>
                            <td className="p-3 text-center">
                              {sub.cheatingFlagged ? (
                                <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-bold" title={sub.cheatingReason || ""}>
                                  Gian lận ({sub.violationCount})
                                </span>
                              ) : (
                                <span className="text-slate-500">Không ({sub.violationCount})</span>
                              )}
                            </td>
                            <td className="p-3 text-slate-500">{sub.submittedAt}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ClassroomReportPreviewModal;
