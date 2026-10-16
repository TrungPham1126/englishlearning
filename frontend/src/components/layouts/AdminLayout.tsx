import { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import axiosClient from "@/lib/axiosClient";
import { adminApi } from "@/features/admin/api/adminApi";
import ThemeToggle from "@/components/common/ThemeToggle";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  School,
  BarChart3,
  Video,
  Database,
  Radio,
  Activity,
  LogOut,
  Sparkles,
  UserCog,
  Cpu,
} from "lucide-react";

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [pendingVideoCount, setPendingVideoCount] = useState<number>(0);

  useEffect(() => {
    adminApi
      .getPendingVideos()
      .then((vids) => setPendingVideoCount(vids?.length || 0))
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await axiosClient.post("/api/v1/auth/logout");
    } catch {
    } finally {
      logout();
      navigate("/login");
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* SIDEBAR */}
      <aside className="w-68 bg-white dark:bg-[#0f172a] flex flex-col shadow-xl z-20 border-r border-slate-200 dark:border-slate-800 transition-colors duration-200">
        {/* Brand Header */}
        <div className="h-18 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800 gap-3 bg-slate-50 dark:bg-slate-950/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
              <GraduationCap size={22} />
            </div>
            <div className="truncate">
              <span className="font-black text-sm text-slate-900 dark:text-white tracking-wider block">
                ELP CENTER
              </span>
              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 block -mt-0.5">
                Quản Trị Trung Tâm
              </span>
            </div>
          </div>
          <ThemeToggle />
        </div>

        <nav className="flex-1 p-4 space-y-6 overflow-y-auto custom-scrollbar">
          {/* Group 1: Đào tạo & Học vụ */}
          <div>
            <p className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Hoạt động Đào tạo
            </p>
            <div className="space-y-1">
              <NavLink
                to="/admin/dashboard"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                  }`
                }
              >
                <LayoutDashboard size={18} /> Tổng Quan
              </NavLink>

              <NavLink
                to="/admin/teachers"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                  }`
                }
              >
                <GraduationCap size={18} /> Đội ngũ Giảng viên
              </NavLink>

              <NavLink
                to="/admin/students"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                  }`
                }
              >
                <Users size={18} /> Quản lý Học viên
              </NavLink>

              <NavLink
                to="/admin/classrooms"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                  }`
                }
              >
                <School size={18} /> Lớp Học & Khóa Đào Tạo
              </NavLink>

              <NavLink
                to="/admin/reports"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                  }`
                }
              >
                <BarChart3 size={18} /> Báo Cáo & Thống Kê
              </NavLink>
            </div>
          </div>

          {/* Group 2: Học liệu & Kiểm duyệt */}
          <div>
            <p className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Học Liệu & Kiểm Duyệt
            </p>
            <div className="space-y-1">
              <NavLink
                to="/admin/video-moderation"
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                  }`
                }
              >
                <span className="flex items-center gap-3">
                  <Video size={18} /> Duyệt Video Bài Giảng
                </span>
                {pendingVideoCount > 0 && (
                  <span className="bg-rose-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                    {pendingVideoCount}
                  </span>
                )}
              </NavLink>

              <NavLink
                to="/admin/resource-library"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                  }`
                }
              >
                <Database size={18} /> Kho Học Liệu Chung
              </NavLink>

              <NavLink
                to="/admin/broadcast"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                  }`
                }
              >
                <Radio size={18} /> Phát Thông Báo
              </NavLink>
            </div>
          </div>

          {/* Group 3: Quản trị Tài khoản & Hệ thống */}
          <div>
            <p className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Quản Trị Người Dùng
            </p>
            <div className="space-y-1">
              <NavLink
                to="/admin/users"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                  }`
                }
              >
                <UserCog size={18} /> Tất Cả Tài Khoản
              </NavLink>

              <NavLink
                to="/admin/audit-logs"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                  }`
                }
              >
                <Activity size={18} /> Nhật Ký Thao Tác
              </NavLink>
            </div>
          </div>

          {/* Group 4: Hệ thống & Trí tuệ nhân tạo (AI) */}
          <div>
            <p className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Hệ Thống & Trí Tuệ Nhân Tạo
            </p>
            <div className="space-y-1">
              <NavLink
                to="/admin/ai-monitoring"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                  }`
                }
              >
                <Cpu size={18} /> Giám Sát Token & AI
              </NavLink>
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-black/20">
          <div className="truncate">
            <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
              {user?.lastName} {user?.firstName}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-500 hover:text-white transition cursor-pointer"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-6 md:p-10 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
        <Outlet />
      </main>
    </div>
  );
}
