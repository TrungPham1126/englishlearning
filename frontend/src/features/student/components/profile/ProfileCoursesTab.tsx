import React from "react";
import { Calendar, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { MyCourseResponse } from "@/features/student/types";

interface ProfileCoursesTabProps {
  courses: MyCourseResponse[];
}

export const ProfileCoursesTab: React.FC<ProfileCoursesTabProps> = ({ courses }) => {
  const navigate = useNavigate();

  return (
    <div className="p-6 sm:p-8 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            Lớp Học Đang Tham Gia
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Danh sách các khóa học bạn đã được ghi danh chính thức
          </p>
        </div>
        <span className="rounded-md bg-blue-50 dark:bg-blue-600/15 px-3 py-1 text-xs font-bold text-blue-700 dark:text-blue-400">
          {courses.length} khóa học
        </span>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
          <Calendar
            size={32}
            className="mx-auto mb-2 text-slate-400 opacity-50"
          />
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Bạn chưa được ghi danh vào lớp học nào.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map((c) => (
            <div
              key={c.classId}
              className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-[#162033] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-blue-300 dark:hover:border-blue-600/40 transition"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-600/20 px-2.5 py-0.5 rounded-md border border-blue-200 dark:border-blue-600/30">
                    {c.level}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 px-2.5 py-0.5 rounded-md border border-emerald-200/70 dark:border-emerald-500/30">
                    {c.status}
                  </span>
                </div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white pt-1">
                  {c.className}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Giảng viên phụ trách:{" "}
                  <strong className="text-slate-700 dark:text-slate-200">
                    {c.teacherName}
                  </strong>
                </p>
                {c.progressPercentage !== undefined && (
                  <div className="pt-2 w-full max-w-xs">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      <span>Tiến độ hoàn thành:</span>
                      <span className="text-blue-700 dark:text-blue-400 font-extrabold">{c.progressPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(c.progressPercentage > 0 ? 5 : 0, c.progressPercentage))}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate(`/student/courses/${c.classId}/daily-plan`)
                }
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-800 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer shrink-0"
              >
                <span>Vào Lộ Trình Ngày</span>
                <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProfileCoursesTab;
