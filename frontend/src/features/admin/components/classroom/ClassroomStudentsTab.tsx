import React, { useState } from "react";
import { UserPlus, Users, Loader2, UserX } from "lucide-react";
import type { StudentEnrollmentItem, ClassroomResponse } from "@/features/admin/types";
import { formatScore10 } from "@/utils/scoreScale";

interface ClassroomStudentsTabProps {
  classroom: ClassroomResponse;
  enrolledStudents: StudentEnrollmentItem[];
  isProcessing: boolean;
  onEnrollStudent: (identifier: string) => Promise<boolean>;
  onRemoveStudent: (studentId: string, studentName: string) => void;
}

export const ClassroomStudentsTab: React.FC<ClassroomStudentsTabProps> = ({
  classroom,
  enrolledStudents,
  isProcessing,
  onEnrollStudent,
  onRemoveStudent,
}) => {
  const [enrollIdentifier, setEnrollIdentifier] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollIdentifier.trim()) return;
    const success = await onEnrollStudent(enrollIdentifier.trim());
    if (success) {
      setEnrollIdentifier("");
    }
  };

  return (
    <div className="space-y-6">
      {/* TOP CARDS: ENROLL FORM & CLASS CAPACITY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="mb-4">
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <UserPlus className="text-blue-700 dark:text-blue-400" size={18} /> Ghi danh học viên
            </h3>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              required
              type="text"
              value={enrollIdentifier}
              onChange={(e) => setEnrollIdentifier(e.target.value)}
              className="flex-1 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 outline-none focus:border-blue-700 text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-950"
              placeholder="Email hoặc SĐT học viên..."
            />
            <button
              type="submit"
              disabled={isProcessing || !enrollIdentifier.trim()}
              className="flex justify-center items-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer disabled:opacity-50 transition shadow-sm text-xs whitespace-nowrap"
            >
              {isProcessing && <Loader2 size={16} className="animate-spin" />}
              <span>Ghi danh</span>
            </button>
          </form>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Sĩ số
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
              {enrolledStudents.length}{" "}
              <span className="text-sm font-semibold text-slate-500">
                / {classroom.maxStudents || "∞"}
              </span>
            </div>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mt-4">
            <div
              className="bg-blue-800 dark:bg-blue-600 h-full rounded-full transition-all duration-300"
              style={{
                width: `${
                  classroom.maxStudents
                    ? Math.min(
                        100,
                        Math.round(
                          (enrolledStudents.length / classroom.maxStudents) * 100,
                        ),
                      )
                    : 50
                }%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* BOTTOM TABLE: ENROLLED STUDENTS LIST */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Users className="text-blue-700 dark:text-blue-400" size={18} /> Học viên ({enrolledStudents.length})
            </h3>
          </div>
        </div>

        {enrolledStudents.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <Users size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">Chưa có học viên</h4>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black border-b border-slate-200 dark:border-slate-700">
                  <th className="p-4 pl-6">Học viên</th>
                  <th className="p-4">Liên hệ</th>
                  <th className="p-4">Ngày ghi danh</th>
                  <th className="p-4 text-center">Tiến độ</th>
                  <th className="p-4 text-center">Điểm TB</th>
                  <th className="p-4 pr-6 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {enrolledStudents.map((st) => {
                  const studentName =
                    st.fullName ||
                    `${st.lastName || ""} ${st.firstName || ""}`.trim() ||
                    st.email;
                  const completion = st.completionRate ?? 0;
                  return (
                    <tr key={st.studentId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-xs shadow-inner">
                            {studentName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">{studentName}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 text-slate-600 dark:text-slate-300 text-xs">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{st.email}</div>
                        {st.phone && <div className="text-slate-400 mt-0.5">{st.phone}</div>}
                      </td>

                      <td className="p-4 text-slate-500 dark:text-slate-400 text-xs">
                        {st.enrolledAt ? new Date(st.enrolledAt).toLocaleDateString("vi-VN") : "—"}
                      </td>

                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{completion}%</span>
                          <div className="w-20 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                            <div
                              className="bg-emerald-500 h-full rounded-full"
                              style={{ width: `${completion}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            {st.completedTasks ?? 0}/{st.totalTasks ?? 0} bài
                          </span>
                        </div>
                      </td>

                      <td className="p-4 text-center">
                        <span className="font-black text-slate-900 dark:text-white text-sm">
                          {formatScore10(st.averageScore, "—")}
                        </span>
                      </td>

                      <td className="p-4 pr-6 text-right">
                        <button
                          onClick={() => onRemoveStudent(st.studentId, studentName)}
                          disabled={isProcessing}
                          title="Xóa khỏi lớp"
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                        >
                          <UserX size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassroomStudentsTab;
