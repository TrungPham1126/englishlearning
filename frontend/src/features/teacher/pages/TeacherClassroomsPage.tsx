import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { teacherApi } from "../api/teacherApi";
import type { ClassroomItem } from "../api/teacherApi";
import {
  BookOpen,
  Calendar,
  Users,
  Search,
  Filter,
  GraduationCap,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  Loader2,
} from "lucide-react";

export default function TeacherClassroomsPage() {
  const [classes, setClasses] = useState<ClassroomItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [levelFilter, setLevelFilter] = useState<string>("ALL");

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const res: any = await teacherApi.getAssignedClasses();
      const list = res.data?.data || res.data;
      if (Array.isArray(list)) {
        setClasses(list);
      } else {
        setClasses([]);
      }
    } catch (err) {
      console.error("Lỗi khi tải danh sách lớp học:", err);
      setClasses([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredClasses = useMemo(() => {
    return classes.filter((cls) => {
      const matchSearch =
        cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cls.description && cls.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchLevel =
        levelFilter === "ALL" ||
        (cls.level && cls.level.toUpperCase() === levelFilter.toUpperCase());

      return matchSearch && matchLevel;
    });
  }, [classes, searchTerm, levelFilter]);

  const totalStudents = classes.reduce(
    (sum, c) => sum + (c.currentStudentsCount || 0),
    0,
  );
  const openClassesCount = classes.filter((c) => c.status === "OPEN").length;

  if (loading) {
    return (
      <div className="flex h-72 flex-col items-center justify-center space-y-3 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <p className="text-xs">Đang tải danh sách lớp học phụ trách...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-indigo-400" />
            Lớp Học Phụ Trách
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Quản lý lộ trình học tập, giao nhiệm vụ và đồng hành cùng học viên
          </p>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-slate-300">
            <span className="text-slate-500">Tổng số lớp:</span>
            <strong className="text-white font-bold">{classes.length}</strong>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-300">
            <span className="text-emerald-500">Đang mở:</span>
            <strong className="font-bold">{openClassesCount}</strong>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-indigo-300">
            <span className="text-indigo-400">Tổng học viên:</span>
            <strong className="font-bold">{totalStudents}</strong>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 shadow-md">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Tìm tên lớp hoặc nội dung mô tả..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-700/60 bg-slate-800/80 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-500 shrink-0" />
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="w-full sm:w-auto rounded-xl border border-slate-700/60 bg-slate-800/80 px-3 py-2 text-xs font-medium text-white outline-none focus:border-indigo-500 transition"
          >
            <option value="ALL">Tất cả trình độ</option>
            <option value="A1">Trình độ A1</option>
            <option value="A2">Trình độ A2</option>
            <option value="B1">Trình độ B1</option>
            <option value="B2">Trình độ B2</option>
            <option value="C1">Trình độ C1</option>
            <option value="C2">Trình độ C2</option>
          </select>
        </div>
      </div>

      {/* Classroom Cards Grid */}
      {filteredClasses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center text-slate-500 text-xs">
          {classes.length === 0
            ? "Bạn chưa được phân công phụ trách lớp học nào."
            : "Không tìm thấy lớp học phù hợp với bộ lọc tìm kiếm."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredClasses.map((cls) => (
            <div
              key={cls.id}
              className="group flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg transition-all hover:border-slate-700 hover:shadow-xl hover:shadow-indigo-500/5 backdrop-blur-sm"
            >
              <div className="space-y-3">
                {/* Level & Status Badges */}
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-bold text-indigo-300">
                    <Sparkles className="mr-1 h-3 w-3" />
                    {cls.level || "Tiêu chuẩn"}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                      cls.status === "OPEN"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : cls.status === "PLANNING"
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                          : "border-slate-700 bg-slate-800 text-slate-400"
                    }`}
                  >
                    <ShieldCheck className="mr-1 h-3 w-3" />
                    {cls.status === "OPEN"
                      ? "Đang mở"
                      : cls.status === "PLANNING"
                        ? "Chuẩn bị mở"
                        : "Đã đóng"}
                  </span>
                </div>

                {/* Class Name */}
                <Link
                  to={`/teacher/classrooms/${cls.id}/plans`}
                  className="block text-base font-bold text-white transition hover:text-indigo-400"
                >
                  {cls.name}
                </Link>

                <p className="line-clamp-2 text-xs text-slate-400 leading-relaxed">
                  {cls.description || "Chưa có mô tả chi tiết cho lớp học này."}
                </p>
              </div>

              {/* Sĩ số & Action Links */}
              <div className="mt-5 border-t border-slate-800/80 pt-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center text-slate-500">
                    <Users className="mr-1.5 h-3.5 w-3.5" /> Sĩ số hiện tại
                  </span>
                  <span className="font-semibold text-slate-200">
                    {cls.currentStudentsCount}
                    {cls.maxStudents ? ` / ${cls.maxStudents}` : ""} học viên
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to={`/teacher/classrooms/${cls.id}/plans`}
                    className="flex items-center justify-center space-x-1 rounded-xl bg-indigo-600 px-3 py-2 text-center text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-500"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Lộ trình</span>
                  </Link>
                  <Link
                    to={`/teacher/classrooms/${cls.id}/students`}
                    className="flex items-center justify-center space-x-1 rounded-xl border border-slate-800 bg-slate-800/80 px-3 py-2 text-center text-xs font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white"
                  >
                    <Users className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Học viên</span>
                  </Link>
                </div>

                <Link
                  to={`/teacher/classrooms/${cls.id}`}
                  className="flex items-center justify-center space-x-1.5 w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Bài giảng, Video & Tài liệu</span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}