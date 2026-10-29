// src/features/teacher/pages/TeacherClassroomsPage.tsx
import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  ChevronRight,
  LayoutGrid,
  List,
  FolderKanban,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Card, Badge, Button, Input, EmptyState, SkeletonCard } from "@/components/ui";

export default function TeacherClassroomsPage() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassroomItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [levelFilter, setLevelFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"GRID" | "TABLE">("GRID");

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

      const matchStatus =
        statusFilter === "ALL" ||
        (cls.status && cls.status.toUpperCase() === statusFilter.toUpperCase());

      return matchSearch && matchLevel && matchStatus;
    });
  }, [classes, searchTerm, levelFilter, statusFilter]);

  const totalStudents = classes.reduce(
    (sum, c) => sum + (c.currentStudentsCount || 0),
    0,
  );
  const openClassesCount = classes.filter((c) => c.status === "OPEN").length;
  const planningClassesCount = classes.filter((c) => c.status === "PLANNING").length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-20 bg-slate-100 dark:bg-slate-900 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 dark:bg-slate-900/60 px-2.5 py-0.5 text-xs font-bold text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 mb-2">
            <FolderKanban className="h-3.5 w-3.5" />
            <span>Quản Lý Giảng Dạy &amp; Lộ Trình</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <GraduationCap className="h-7 w-7 text-blue-700 dark:text-blue-400" />
            Lớp Học Phụ Trách
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Quản lý kế hoạch học tập theo ngày, điểm danh học sinh và kiểm duyệt bài nộp.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 self-start md:self-center">
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e1526] p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode("GRID")}
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                viewMode === "GRID"
                  ? "bg-blue-800 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <LayoutGrid size={14} />
              <span>Lưới</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("TABLE")}
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                viewMode === "TABLE"
                  ? "bg-blue-800 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <List size={14} />
              <span>Bảng</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Tổng số lớp phụ trách
            </p>
            <p className="text-2xl font-black text-blue-700 dark:text-blue-400 mt-1 font-mono tabular-nums">
              {classes.length}
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-slate-900/60 text-blue-700 dark:text-blue-400 flex items-center justify-center">
            <BookOpen size={20} />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Tổng số học viên
            </p>
            <p className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1 font-mono tabular-nums">
              {totalStudents}
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
            <Users size={20} />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Đang mở hoạt động
            </p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono tabular-nums">
              {openClassesCount}
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Đang lên kế hoạch
            </p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono tabular-nums">
              {planningClassesCount}
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Clock size={20} />
          </div>
        </Card>
      </div>

      {/* 3. Search & Filter Bar */}
      <Card className="p-3.5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex-1 max-w-md">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên lớp hoặc mô tả khóa học..."
            startIcon={<Search size={15} />}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter Pills */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-900 p-1 text-xs border border-slate-200/80 dark:border-slate-800">
            {[
              { id: "ALL", label: "Tất cả" },
              { id: "OPEN", label: "Đang mở" },
              { id: "PLANNING", label: "Chuẩn bị mở" },
              { id: "CLOSED", label: "Đã đóng" },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-bold transition select-none cursor-pointer ${
                  statusFilter === st.id
                    ? "bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-slate-400 shrink-0" />
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0b1120] px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600 transition cursor-pointer"
            >
              <option value="ALL">Tất cả trình độ CEFR</option>
              <option value="A1">A1 (Beginner)</option>
              <option value="A2">A2 (Elementary)</option>
              <option value="B1">B1 (Intermediate)</option>
              <option value="B2">B2 (Upper-Intermediate)</option>
              <option value="C1">C1 (Advanced)</option>
              <option value="C2">C2 (Proficiency)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* 4. Classroom Display */}
      {filteredClasses.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={28} />}
          title={
            classes.length === 0
              ? "Bạn chưa được phân công phụ trách lớp học nào."
              : "Không tìm thấy lớp học phù hợp với bộ lọc tìm kiếm."
          }
          description="Hãy thử thay đổi từ khóa hoặc chọn lại bộ lọc trạng thái và trình độ CEFR."
        />
      ) : viewMode === "GRID" ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredClasses.map((cls) => {
            const maxCap = cls.maxStudents || 30;
            const currentCap = cls.currentStudentsCount || 0;
            const fillPercent = Math.min(100, Math.round((currentCap / maxCap) * 100));

            return (
              <Card
                key={cls.id}
                hoverable
                className="flex flex-col justify-between p-5"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="primary" size="sm">
                      <Sparkles size={11} className="mr-1" />
                      CEFR {cls.level || "General"}
                    </Badge>
                    <Badge
                      variant={
                        cls.status === "OPEN"
                          ? "success"
                          : cls.status === "PLANNING"
                          ? "warning"
                          : "neutral"
                      }
                      size="sm"
                      dot
                    >
                      {cls.status === "OPEN"
                        ? "Đang mở"
                        : cls.status === "PLANNING"
                        ? "Chuẩn bị mở"
                        : "Đã đóng"}
                    </Badge>
                  </div>

                  <div>
                    <Link
                      to={`/teacher/classrooms/${cls.id}/plans`}
                      className="block text-base font-bold text-slate-900 dark:text-slate-100 hover:text-blue-700 dark:hover:text-blue-400 transition truncate"
                    >
                      {cls.name}
                    </Link>
                    <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {cls.description || "Chưa có mô tả chi tiết cho lớp học này."}
                    </p>
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-100 dark:border-slate-800/80 pt-4 space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center font-medium text-slate-500 dark:text-slate-400">
                        <Users size={13} className="mr-1 text-blue-600" /> Sĩ số
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 font-mono tabular-nums">
                        {currentCap}/{maxCap} HV ({fillPercent}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-800 transition-all duration-300"
                        style={{ width: `${fillPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="primary"
                      size="xs"
                      onClick={() => navigate(`/teacher/classrooms/${cls.id}/plans`)}
                      leftIcon={<Calendar size={13} />}
                    >
                      Lộ trình
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => navigate(`/teacher/classrooms/${cls.id}/students`)}
                      leftIcon={<Users size={13} />}
                    >
                      DS Học viên
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    size="xs"
                    className="w-full justify-between"
                    onClick={() => navigate(`/teacher/classrooms/${cls.id}`)}
                    leftIcon={<BookOpen size={13} className="text-blue-700 dark:text-blue-400" />}
                    rightIcon={<ChevronRight size={13} />}
                  >
                    <span>Bài giảng &amp; Video HLS</span>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Data Table View */
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Tên Lớp Học &amp; Mô Tả</th>
                  <th className="py-3 px-4 text-center">Trình Độ</th>
                  <th className="py-3 px-4 text-center">Trạng Thái</th>
                  <th className="py-3 px-4">Sĩ Số</th>
                  <th className="py-3 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {filteredClasses.map((cls) => {
                  const maxCap = cls.maxStudents || 30;
                  const currentCap = cls.currentStudentsCount || 0;
                  const fillPercent = Math.min(100, Math.round((currentCap / maxCap) * 100));

                  return (
                    <tr
                      key={cls.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="py-3.5 px-4 max-w-xs">
                        <Link
                          to={`/teacher/classrooms/${cls.id}/plans`}
                          className="font-bold text-slate-900 dark:text-slate-100 hover:text-blue-700 dark:hover:text-blue-400 transition block truncate"
                        >
                          {cls.name}
                        </Link>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {cls.description || "Chưa có mô tả chi tiết"}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Badge variant="primary" size="sm">
                          {cls.level || "General"}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Badge
                          variant={
                            cls.status === "OPEN"
                              ? "success"
                              : cls.status === "PLANNING"
                              ? "warning"
                              : "neutral"
                          }
                          size="sm"
                          dot
                        >
                          {cls.status === "OPEN"
                            ? "Đang mở"
                            : cls.status === "PLANNING"
                            ? "Chuẩn bị mở"
                            : "Đã đóng"}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 w-44">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-bold text-slate-800 dark:text-slate-200 font-mono tabular-nums">
                            {currentCap}/{maxCap} HV
                          </span>
                          <span className="text-slate-400 font-mono">{fillPercent}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-800"
                            style={{ width: `${fillPercent}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            variant="primary"
                            size="xs"
                            onClick={() => navigate(`/teacher/classrooms/${cls.id}/plans`)}
                          >
                            Lộ trình
                          </Button>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => navigate(`/teacher/classrooms/${cls.id}/students`)}
                          >
                            Học viên
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => navigate(`/teacher/classrooms/${cls.id}`)}
                          >
                            Học liệu
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
