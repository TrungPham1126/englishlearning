import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { teacherApi } from "../api/teacherApi";
import {
  Users,
  BookOpen,
  FileCheck,
  TrendingUp,
  Award,
  Clock,
  ArrowUpRight,
  Sparkles,
  Loader2,
} from "lucide-react";

export default function TeacherDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    teacherApi
      .getTeacherDashboardStats()
      .then((res: any) => {
        setData(res.data?.data || res.data);
      })
      .catch((err) => {
        console.error("Lỗi lấy dữ liệu Dashboard:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-700 dark:text-blue-400" />
        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">
          Đang tổng hợp dữ liệu học tập...
        </p>
      </div>
    );
  }

  // Khởi tạo mảng stats từ data API
  const stats = [
    {
      label: "Lớp học phụ trách",
      value: data?.totalClasses || 0,
      subText: "Đang hoạt động",
      icon: BookOpen,
      color: "from-blue-500/15 to-blue-500/15",
      textColor: "text-blue-600 dark:text-blue-400",
      border: "border-slate-200 dark:border-blue-500/30",
    },
    {
      label: "Tổng học viên",
      value: data?.totalStudents || 0,
      subText: "Trên toàn bộ các lớp",
      icon: Users,
      color: "from-emerald-500/15 to-teal-500/15",
      textColor: "text-emerald-600 dark:text-emerald-400",
      border: "border-slate-200 dark:border-emerald-500/30",
    },
    {
      label: "Bài chờ chấm",
      value: data?.pendingGrading || 0,
      subText: "Nhiệm vụ ưu tiên cao",
      icon: FileCheck,
      color: "from-amber-500/15 to-orange-500/15",
      textColor: "text-amber-600 dark:text-amber-400",
      border: "border-slate-200 dark:border-amber-500/30",
      actionLink: "/teacher/grading",
    },
    {
      label: "Tỷ lệ hoàn thành TB",
      value: `${data?.avgCompletionRate || 0}%`,
      subText: "Tiến độ học tập",
      icon: TrendingUp,
      color: "from-blue-500/15 to-pink-500/15",
      textColor: "text-blue-700 dark:text-blue-400",
      border: "border-slate-200 dark:border-blue-500/30",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200 dark:border-slate-800/80 bg-transparent">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center space-x-2 rounded-full border border-blue-200 dark:border-blue-600/20 bg-blue-50 dark:bg-blue-600/10 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>ELP Educator Portal • Fall 2026</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
            Chào mừng trở lại, Giảng viên!
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tổng hợp dữ liệu học tập, tiến độ làm bài và đề xuất phân tích điểm yếu học viên từ trợ lý AI.
          </p>
        </div>
      </div>

      {/* Grid thống kê 4 ô */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className={`relative overflow-hidden rounded-xl border bg-white dark:bg-[#121a2d] p-5 shadow-xs transition hover:shadow-md ${item.border}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {item.label}
                </span>
                <div
                  className={`rounded-xl p-2.5 bg-gradient-to-br ${item.color}`}
                >
                  <Icon className={`h-5 w-5 ${item.textColor}`} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {item.value}
                </span>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {item.subText}
                </p>
              </div>
              {item.actionLink && (
                <Link
                  to={item.actionLink}
                  className="mt-3 flex items-center text-xs font-bold text-blue-700 dark:text-blue-400 hover:underline"
                >
                  <span>Chấm bài ngay</span>
                  <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Biểu đồ phân tích kỹ năng & Việc cần làm */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121a2d] p-6 space-y-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
                <Award className="h-5 w-5 mr-2 text-blue-700 dark:text-blue-400" />
                Thống Kê Điểm Năng Lực &amp; Điểm Yếu Học Viên
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Điểm trung bình theo 4 kỹ năng được phân tích tự động
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {data?.skills?.map((s: any, i: number) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {s.skill}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                      {s.status}
                    </span>
                    <span className="font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-slate-800 px-2 py-0.5 rounded">
                      {s.score} / 10
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800/80 rounded-full h-2">
                  <div
                    className={`${s.barColor} h-2 rounded-full transition-all duration-500`}
                    style={{ width: `${(s.score / 10) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-blue-200 dark:border-blue-600/20 bg-blue-50/60 dark:bg-blue-600/5 p-4 text-xs text-slate-700 dark:text-slate-300 flex items-start space-x-3">
            <Sparkles className="h-5 w-5 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-blue-800 dark:text-blue-300 block mb-0.5">
                Khuyến nghị từ trợ lý AI cho giáo viên:
              </span>
              Học viên đang gặp trở ngại lớn nhất ở kỹ năng Nói (Speaking
              Fluency) và Viết (Coherence). Hãy giao thêm các bài tập bổ trợ tại Lộ trình học của lớp.
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121a2d] p-6 space-y-4 shadow-xs">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
              <Clock className="h-5 w-5 mr-2 text-blue-700 dark:text-blue-400" />
              Công Việc Cần Xử Lý
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Nhiệm vụ ưu tiên trong ngày
            </p>
          </div>
          <div className="space-y-3">
            {data?.tasks?.map((task: any) => (
              <div
                key={task.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#0d1322] p-3.5 space-y-1.5 hover:border-blue-300 dark:hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900 dark:text-white truncate pr-2">
                    {task.title}
                  </span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold text-[10px] whitespace-nowrap">
                    {task.due}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {task.className}
                </p>
              </div>
            ))}
          </div>
          <div className="pt-2">
            <Link
              to="/teacher/classrooms"
              className="w-full flex items-center justify-center space-x-2 rounded-xl bg-blue-800 py-2.5 text-xs font-semibold text-white hover:bg-blue-600 transition shadow-sm"
            >
              <span>Vào Danh Sách Lớp Học</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
