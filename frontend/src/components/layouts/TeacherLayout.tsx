import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import {
  LayoutDashboard,
  BookOpen,
  LogOut,
  GraduationCap,
  Award,
} from "lucide-react";
import axiosClient from "@/lib/axiosClient";
import ThemeToggle from "@/components/common/ThemeToggle";

export default function TeacherLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await axiosClient.post("/api/v1/auth/logout");
    } catch {
      // Bỏ qua lỗi mạng khi logout
    } finally {
      logout();
      navigate("/login");
    }
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
      isActive
        ? "bg-indigo-600 text-white font-semibold shadow-lg shadow-indigo-600/30"
        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/80 hover:text-slate-900 dark:hover:text-white"
    }`;

  const userInitials =
    (user?.firstName?.charAt(0) || "") + (user?.lastName?.charAt(0) || "T");

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800/80 flex flex-col justify-between shrink-0 transition-colors duration-200">
        <div>
          {/* Logo Header */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-md shadow-indigo-600/20 text-white">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div className="truncate">
                <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white block truncate">
                  ELP Educator Hub
                </span>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium block">
                  Cổng Giảng Viên
                </span>
              </div>
            </div>
            <ThemeToggle />
          </div>

          {/* Navigation Links */}
          <nav className="p-3.5 space-y-1.5">
            <NavLink to="/teacher/dashboard" className={navLinkClass}>
              <LayoutDashboard className="h-4 w-4" />
              <span>Tổng quan (Dashboard)</span>
            </NavLink>

            <NavLink to="/teacher/classrooms" className={navLinkClass}>
              <BookOpen className="h-4 w-4" />
              <span>Lớp học phụ trách</span>
            </NavLink>

            <NavLink to="/teacher/grading" className={navLinkClass}>
              <Award className="h-4 w-4" />
              <span>Chấm bài & Đánh giá</span>
            </NavLink>
          </nav>
        </div>

        {/* User Footer Profile */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/40 transition-colors duration-200">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/20 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-300 font-bold text-xs uppercase">
              {userInitials || "GV"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {user?.email || "Giảng viên"}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Đăng xuất"
            className="text-slate-400 hover:text-rose-500 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-200">
        <Outlet />
      </main>
    </div>
  );
}