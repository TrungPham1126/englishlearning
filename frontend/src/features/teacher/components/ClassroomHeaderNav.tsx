import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Users,
  BookOpen,
  GraduationCap,
  Sparkles,
  Layers,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { teacherApi, type ClassroomItem } from "../api/teacherApi";

interface ClassroomHeaderNavProps {
  classId: string;
  activeTab?: "plans" | "students" | "details";
  classroom?: ClassroomItem | null;
  actions?: React.ReactNode;
}

export default function ClassroomHeaderNav({
  classId,
  activeTab,
  classroom: initialClassroom,
  actions,
}: ClassroomHeaderNavProps) {
  const location = useLocation();
  const [classroom, setClassroom] = useState<ClassroomItem | null>(
    initialClassroom || null,
  );
  const [loading, setLoading] = useState<boolean>(!initialClassroom);

  useEffect(() => {
    if (initialClassroom) {
      setClassroom(initialClassroom);
      setLoading(false);
      return;
    }

    if (classId) {
      let isMounted = true;
      teacherApi
        .getClassDetail(classId)
        .then((res: any) => {
          if (isMounted) {
            const data = res?.data?.data || res?.data;
            if (data && typeof data === "object") {
              setClassroom(data);
            }
          }
        })
        .catch((err) => {
          console.warn("Không thể tải thông tin lớp học:", err);
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [classId, initialClassroom]);

  // Tự động suy luận tab hiện tại nếu không truyền qua prop
  const currentTab =
    activeTab ||
    (location.pathname.includes("/plans")
      ? "plans"
      : location.pathname.includes("/students")
        ? "students"
        : "details");

  const tabs = [
    {
      id: "plans",
      label: "Lộ Trình & Giao Bài",
      path: `/teacher/classrooms/${classId}/plans`,
      icon: Calendar,
      desc: "Quản lý bài tập theo ngày & ma trận tiến độ",
    },
    {
      id: "students",
      label: "Học Viên & Điểm Số",
      path: `/teacher/classrooms/${classId}/students`,
      icon: Users,
      desc: "Theo dõi thành tích, chuyên cần & quota AI",
    },
    {
      id: "details",
      label: "Bài Giảng & Tài Liệu",
      path: `/teacher/classrooms/${classId}`,
      icon: BookOpen,
      desc: "Upload tài liệu PDF, video bài giảng & thông báo",
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950/40 p-5 shadow-xl backdrop-blur-md">
      {/* Top Breadcrumb & Action Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start space-x-3.5">
          <Link
            to="/teacher/classrooms"
            title="Quay lại danh sách lớp học"
            className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-800/80 text-slate-300 transition-all hover:border-indigo-500 hover:bg-indigo-600 hover:text-white hover:shadow-lg hover:shadow-indigo-500/20"
          >
            <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
          </Link>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center text-xs font-semibold uppercase tracking-wider text-indigo-400">
                <GraduationCap className="mr-1 h-3.5 w-3.5" />
                Không gian lớp học
              </span>
              <ChevronRight className="h-3 w-3 text-slate-600" />
              <span className="text-xs text-slate-400 font-medium">
                {classroom?.name || "Chi tiết lớp học"}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                {classroom?.name || (loading ? "Đang tải lớp học..." : "Lớp học")}
              </h1>

              {classroom?.level && (
                <span className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-bold text-indigo-300">
                  <Sparkles className="mr-1 h-3 w-3" />
                  {classroom.level}
                </span>
              )}

              {classroom?.status && (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                    classroom.status === "OPEN"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : classroom.status === "PLANNING"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        : "border-slate-700 bg-slate-800 text-slate-400"
                  }`}
                >
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  {classroom.status === "OPEN"
                    ? "Đang mở"
                    : classroom.status === "PLANNING"
                      ? "Chuẩn bị mở"
                      : "Đã đóng"}
                </span>
              )}

              {classroom && typeof classroom.currentStudentsCount === "number" && (
                <span className="inline-flex items-center text-xs text-slate-400">
                  <Users className="mr-1 h-3.5 w-3.5 text-slate-500" />
                  {classroom.currentStudentsCount}
                  {classroom.maxStudents ? ` / ${classroom.maxStudents}` : ""}{" "}
                  học viên
                </span>
              )}
            </div>

            {classroom?.description && (
              <p className="mt-1 line-clamp-1 text-xs text-slate-400">
                {classroom.description}
              </p>
            )}
          </div>
        </div>

        {/* Custom Actions (e.g. Tạo ngày học mới, Soạn bài giảng) */}
        {actions && (
          <div className="flex shrink-0 items-center gap-2.5">{actions}</div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="mt-5 border-t border-slate-800/80 pt-3">
        <nav className="flex flex-wrap items-center gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;

            return (
              <Link
                key={tab.id}
                to={tab.path}
                className={`group relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "border border-slate-800/60 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:bg-slate-800/70 hover:text-slate-200"
                }`}
              >
                <Icon
                  className={`h-4 w-4 transition-colors ${
                    isActive
                      ? "text-white"
                      : "text-slate-400 group-hover:text-indigo-400"
                  }`}
                />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

