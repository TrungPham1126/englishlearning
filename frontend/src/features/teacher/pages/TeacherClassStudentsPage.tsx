// src/features/teacher/pages/TeacherClassStudentsPage.tsx
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { teacherApi } from "../api/teacherApi";
import ClassroomHeaderNav from "../components/ClassroomHeaderNav";
import {
  ArrowLeft,
  Search,
  AlertTriangle,
  Mail,
  Phone,
  Sparkles,
  X,
  Cpu,
  Ban,
  Check,
} from "lucide-react";

export default function TeacherClassStudentsPage() {
  const { classId } = useParams<{ classId: string }>();
  const [students, setStudents] = useState<any[]>([]);
  const [aiQuotas, setAiQuotas] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  useEffect(() => {
    if (classId) {
      loadData();
    }
  }, [classId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resStudents, resQuota]: any = await Promise.allSettled([
        teacherApi.getClassStudents(classId!),
        teacherApi.getAiQuotas(),
      ]);

      let quotas = [];
      if (resQuota.status === "fulfilled" && resQuota.value?.data) {
        quotas = resQuota.value.data?.data || [];
      }
      setAiQuotas(quotas);

      if (resStudents.status === "fulfilled" && resStudents.value?.data) {
        const rawData = resStudents.value.data?.data || [];
        // Map dữ liệu thật, mặc định 0 nếu BE chưa trả đủ progress
        const mapped = rawData.map((item: any) => {
          const quotaInfo = quotas.find(
            (q: any) => q.studentId === item.student?.id,
          ) || { dailyUsed: 0, dailyLimit: 20, isBlocked: false };
          return {
            studentId: item.student?.id || item.id,
            fullName: item.student?.user
              ? `${item.student.user.firstName} ${item.student.user.lastName}`
              : "Học viên",
            email: item.student?.user?.email || "N/A",
            phone: item.student?.user?.phone || "N/A",
            enrolledAt: item.enrolledAt
              ? new Date(item.enrolledAt).toLocaleDateString("vi-VN")
              : "N/A",
            completedTasks: item.completedTasks || 0,
            totalTasks: item.totalTasks || 0,
            completionRate: item.completionRate || 0,
            averageScore: item.averageScore || 0,
            weaknesses: item.weaknesses || [],
            aiQuota: quotaInfo,
            attendanceScore: item.attendanceScore || 0,
            totalStudyMinutes: item.totalStudyMinutes || 0,
            dailyProgressDetails: item.dailyProgressDetails || [],
          };
        });
        setStudents(mapped);
      }
    } catch (err) {
      console.error("Lỗi khi tải danh sách học sinh:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Unified Classroom Header & Sub-Nav */}
      <ClassroomHeaderNav
        classId={classId!}
        activeTab="students"
        actions={
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Tìm tên hoặc email học viên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-700/60 bg-slate-800/80 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:bg-slate-800 transition"
            />
          </div>
        }
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center text-slate-400">
          Đang tải dữ liệu học sinh & AI Quota...
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 p-12 text-center text-slate-500">
          Chưa có học viên nào đăng ký lớp học này.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-900/90 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-6 py-4">Học viên</th>
                  <th className="px-6 py-4 text-center">Tiến độ & Tỷ lệ</th>
                  <th className="px-6 py-4 text-center">Điểm TB</th>
                  <th className="px-6 py-4 text-center">
                    Trạng Thái AI (Rate Limit)
                  </th>
                  <th className="px-6 py-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredStudents.map((student) => (
                  <tr
                    key={student.studentId}
                    className="hover:bg-slate-800/30 transition"
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">
                        {student.fullName}
                      </div>
                      <div className="text-xs text-slate-500 mb-1">
                        {student.email}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Gia nhập: {student.enrolledAt}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-block w-36">
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-slate-400">
                            {student.completedTasks}/{student.totalTasks} bài
                          </span>
                          <span
                            className={`font-bold ${student.completionRate >= 75 ? "text-emerald-400" : student.completionRate > 0 ? "text-amber-400" : "text-slate-500"}`}
                          >
                            {student.completionRate}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${student.completionRate >= 75 ? "bg-emerald-500" : student.completionRate > 0 ? "bg-amber-500" : "bg-slate-700"}`}
                            style={{ width: `${student.completionRate}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center rounded-lg bg-indigo-500/10 px-3 py-1 text-sm font-black text-indigo-400 border border-indigo-500/20">
                        {student.averageScore}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {student.aiQuota.isBlocked ? (
                        <span className="inline-flex items-center text-[11px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-1 rounded font-bold uppercase">
                          <Ban className="w-3 h-3 mr-1" /> Khóa AI
                        </span>
                      ) : (
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-bold text-indigo-300 flex items-center">
                            <Cpu className="w-3.5 h-3.5 mr-1 text-indigo-400" />{" "}
                            {student.aiQuota.dailyUsed} /{" "}
                            {student.aiQuota.dailyLimit}
                          </span>
                          <span className="text-[10px] text-slate-500 mt-0.5">
                            Lượt dùng hôm nay
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedStudent(student)}
                        className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-indigo-600 hover:text-white transition shadow"
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 font-bold text-lg border border-indigo-500/30">
                  {selectedStudent.fullName.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {selectedStudent.fullName}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {selectedStudent.email} • {selectedStudent.phone}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 text-center">
                <span className="text-[11px] text-slate-500 block mb-1">
                  Điểm TB
                </span>
                <span className="text-xl font-black text-indigo-400">
                  {selectedStudent.averageScore} / 10
                </span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 text-center">
                <span className="text-[11px] text-slate-500 block mb-1">
                  Đã Nộp
                </span>
                <span className="text-xl font-black text-white">
                  {selectedStudent.completedTasks} /{" "}
                  {selectedStudent.totalTasks}
                </span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 text-center">
                <span className="text-[11px] text-slate-500 block mb-1">
                  AI Limit (Hôm nay)
                </span>
                {selectedStudent.aiQuota.isBlocked ? (
                  <span className="text-base font-black text-rose-400 uppercase mt-1 block">
                    Bị Chặn
                  </span>
                ) : (
                  <span className="text-xl font-black text-emerald-400">
                    {selectedStudent.aiQuota.dailyUsed}/
                    {selectedStudent.aiQuota.dailyLimit}
                  </span>
                )}
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 text-center">
                <span className="text-[11px] text-slate-500 block mb-1">
                  Chuyên Cần
                </span>
                <span className="text-xl font-black text-amber-400">
                  {selectedStudent.attendanceScore || 0}%
                </span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 text-center">
                <span className="text-[11px] text-slate-500 block mb-1">
                  Tổng T.Gian
                </span>
                <span className="text-xl font-black text-cyan-400">
                  {Math.floor((selectedStudent.totalStudyMinutes || 0) / 60)}h {(selectedStudent.totalStudyMinutes || 0) % 60}m
                </span>
              </div>
            </div>

            {selectedStudent.dailyProgressDetails && selectedStudent.dailyProgressDetails.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 space-y-4">
                <div className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Chi Tiết Tiến Độ Từng Ngày</span>
                  <span className="text-xs font-normal normal-case text-slate-500 bg-slate-900 px-2 py-1 rounded">7 ngày gần nhất</span>
                </div>
                
                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-900 text-xs font-bold uppercase text-slate-500 border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Ngày</th>
                        <th className="px-4 py-3 text-center">Bài tập hoàn thành</th>
                        <th className="px-4 py-3 text-center">Thời gian học</th>
                        <th className="px-4 py-3 text-center">Điểm số trung bình</th>
                        <th className="px-4 py-3 text-right">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {selectedStudent.dailyProgressDetails.map((detail: any, index: number) => (
                        <tr key={index} className="hover:bg-slate-900/50 transition">
                          <td className="px-4 py-3 font-semibold text-slate-300">{detail.date}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-md px-2 py-0.5 text-xs font-bold min-w-[2rem]">
                              {detail.completedTasks}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-cyan-400 font-medium">
                            {detail.studyMinutes} phút
                          </td>
                          <td className="px-4 py-3 text-center text-emerald-400 font-bold">
                            {detail.score}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {detail.completedTasks > 0 ? (
                              <span className="inline-flex items-center gap-1 text-emerald-500 text-xs font-semibold">
                                <Check size={14} /> Hoạt động
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-600 text-xs font-semibold">
                                Vắng mặt
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-3">
              <div className="flex items-center text-xs font-bold text-indigo-300">
                <Sparkles className="h-4 w-4 mr-1.5 text-indigo-400" /> Điểm Yếu Cần Cải Thiện (AI Phân Tích)
              </div>
              {selectedStudent.weaknesses.length === 0 ? (
                <div className="text-xs text-slate-400 italic">
                  Học viên chưa có đủ dữ liệu để AI đánh giá.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedStudent.weaknesses.map((w: string, i: number) => (
                    <div
                      key={i}
                      className="flex items-center rounded-lg bg-slate-900/80 px-3 py-2 text-xs border border-slate-800 text-rose-400"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 mr-2 shrink-0" />
                      {w}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedStudent(null)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
