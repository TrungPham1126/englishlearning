import { useState, useEffect } from "react";
import type { ChangeEvent } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import {
  LayoutDashboard,
  BookOpen,
  LogOut,
  GraduationCap,
  Award,
  Sparkles,
  Camera,
  Menu,
  X,
} from "lucide-react";
import axiosClient from "@/lib/axiosClient";
import { resolveAvatarUrl } from "@/lib/avatar";
import ThemeToggle from "@/components/common/ThemeToggle";

export default function TeacherLayout() {
  const { user, setAuth, accessToken, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [imgError, setImgError] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [user?.avatarUrl]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !accessToken) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axiosClient.post("/api/v1/users/avatar", formData);
      const avatarUrl = res.data?.data;
      if (avatarUrl) {
        setAuth(accessToken, { ...user, avatarUrl });
        setImgError(false);
      }
    } catch {
      alert("Không thể cập nhật ảnh đại diện!");
    } finally {
      e.target.value = "";
    }
  };

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
    `flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150 select-none ${
      isActive
        ? "bg-blue-800 text-white font-bold shadow-xs"
        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100"
    }`;

  const userInitials = (() => {
    const rawFullName =
      (user as any)?.fullName ||
      `${user?.lastName || ""} ${user?.firstName || ""}`.trim();
    if (!rawFullName) return "G";
    const nameParts = rawFullName.split(/\s+/);
    return nameParts[0].charAt(0).toUpperCase();
  })();

  return (
    <div className="flex h-screen bg-[#f8fafc] dark:bg-[#070b14] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200 ease-in-out overflow-hidden">
      {/* Mobile Backdrop */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-68 bg-white dark:bg-[#0d1322] border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between shrink-0 shadow-sm transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          {/* Logo Header */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200/80 dark:border-slate-800/80 gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-800 shadow-xs text-white">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div className="truncate">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-slate-100 truncate">
                    ELP TEACHER
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-blue-50 dark:bg-slate-900/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
                    <Sparkles size={9} /> Giảng Viên
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block truncate">
                  Không Gian Giảng Dạy &amp; Chấm Điểm
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="Đóng thanh bên"
              className="lg:hidden rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5" aria-label="Điều hướng giảng viên">
            <p className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              Quản Lý Giảng Dạy
            </p>
            <NavLink to="/teacher/dashboard" className={navLinkClass}>
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              <span>Tổng quan (Dashboard)</span>
            </NavLink>

            <NavLink to="/teacher/classrooms" className={navLinkClass}>
              <BookOpen className="h-4 w-4 shrink-0" />
              <span>Lớp học phụ trách</span>
            </NavLink>

            <NavLink to="/teacher/grading" className={navLinkClass}>
              <Award className="h-4 w-4 shrink-0" />
              <span>Chấm bài &amp; Đánh giá</span>
            </NavLink>
          </nav>
        </div>

        {/* User Footer Profile */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#070b14]/50 transition-colors duration-200">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-[#111827] p-2.5 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <label
                title="Nhấp để đổi ảnh đại diện"
                className="relative w-10 h-10 shrink-0 rounded-xl overflow-hidden cursor-pointer group shadow-sm"
              >
                {user?.avatarUrl && !imgError ? (
                  <img
                    src={resolveAvatarUrl(user.avatarUrl)}
                    alt="Avatar"
                    className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-brand-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                    {userInitials}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Camera size={14} />
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </label>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                  {user?.lastName} {user?.firstName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {user?.email || "Giảng viên"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleLogout}
                title="Đăng xuất"
                aria-label="Đăng xuất"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200/80 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white dark:hover:bg-rose-600 dark:hover:text-white transition-all duration-200 shrink-0 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area with Sticky Top Header */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f8fafc] dark:bg-[#070b14] text-slate-900 dark:text-slate-100 transition-colors duration-200">
        {/* Sticky Top Navbar */}
        <header className="h-16 shrink-0 sticky top-0 z-20 bg-white/80 dark:bg-[#070b14]/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 sm:px-6 md:px-8 flex items-center justify-between shadow-2xs transition-colors duration-200">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Mở thanh điều hướng"
              className="lg:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-300"
            >
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-2 rounded-xl bg-blue-50/70 dark:bg-blue-600/10 px-3 py-1.5 border border-blue-100 dark:border-blue-600/20">
              <GraduationCap
                size={16}
                className="text-blue-700 dark:text-blue-400"
              />
              <span className="text-xs font-bold text-blue-950 dark:text-blue-300">
                Cổng Thông Tin Giảng Viên
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-transparent text-slate-900 dark:text-slate-100 custom-scrollbar transition-colors duration-200">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
