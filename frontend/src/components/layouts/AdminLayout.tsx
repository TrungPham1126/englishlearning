import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import axiosClient from "@/lib/axiosClient";
import { resolveAvatarUrl } from "@/lib/avatar";
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
  UserCog,
  Cpu,
  ShieldCheck,
  Bell,
  Camera,
  Menu,
  X,
  Sparkles,
} from "lucide-react";

export default function AdminLayout() {
  const { user, setAuth, accessToken, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingVideoCount, setPendingVideoCount] = useState<number>(0);
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

  useEffect(() => {
    adminApi
      .getPendingVideos()
      .then((vids) => setPendingVideoCount(vids?.length || 0))
      .catch(() => {});
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await axiosClient.post("/api/v1/auth/logout");
    } catch {
      // Ignore network errors on logout
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
    if (!rawFullName) return "A";
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

      {/* SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-white dark:bg-[#0d1322] flex flex-col shrink-0 border-r border-slate-200/80 dark:border-slate-800/80 shadow-sm transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200/80 dark:border-slate-800/80 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-800 flex items-center justify-center text-white shadow-xs shrink-0">
              <GraduationCap size={18} />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100 tracking-tight">
                  ELP CENTER
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-blue-50 dark:bg-slate-900/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
                  <Sparkles size={9} /> Admin
                </span>
              </div>
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block truncate">
                Cổng Quản Trị &amp; Giám Sát Hệ Thống
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

        {/* Navigation Menu */}
        <nav
          aria-label="Điều hướng quản trị viên"
          className="flex-1 p-4 space-y-6 overflow-y-auto custom-scrollbar"
        >
          {/* Group 1: Đào tạo & Học vụ */}
          <div>
            <p className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              Hoạt động Đào tạo
            </p>
            <div className="space-y-1">
              <NavLink to="/admin/dashboard" className={navLinkClass}>
                <LayoutDashboard size={18} />
                <span>Tổng Quan</span>
              </NavLink>

              <NavLink to="/admin/teachers" className={navLinkClass}>
                <GraduationCap size={18} />
                <span>Đội ngũ Giảng viên</span>
              </NavLink>

              <NavLink to="/admin/students" className={navLinkClass}>
                <Users size={18} />
                <span>Quản lý Học viên</span>
              </NavLink>

              <NavLink to="/admin/classrooms" className={navLinkClass}>
                <School size={18} />
                <span>Lớp Học &amp; Khóa Đào Tạo</span>
              </NavLink>

              <NavLink to="/admin/reports" className={navLinkClass}>
                <BarChart3 size={18} />
                <span>Báo Cáo &amp; Thống Kê</span>
              </NavLink>
            </div>
          </div>

          {/* Group 2: Học liệu & Kiểm duyệt */}
          <div>
            <p className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              Học Liệu &amp; Kiểm Duyệt
            </p>
            <div className="space-y-1">
              <NavLink
                to="/admin/video-moderation"
                className={({ isActive }) =>
                  `flex items-center justify-between px-4 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                    isActive
                      ? "bg-brand-600 text-white font-semibold shadow-sm"
                      : "text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100"
                  }`
                }
              >
                <span className="flex items-center gap-3">
                  <Video size={18} />
                  <span>Duyệt Video Bài Giảng</span>
                </span>
                {pendingVideoCount > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs animate-pulse">
                    {pendingVideoCount}
                  </span>
                )}
              </NavLink>

              <NavLink to="/admin/resource-library" className={navLinkClass}>
                <Database size={18} />
                <span>Kho Học Liệu Chung</span>
              </NavLink>

              <NavLink to="/admin/broadcast" className={navLinkClass}>
                <Radio size={18} />
                <span>Phát Thông Báo</span>
              </NavLink>
            </div>
          </div>

          {/* Group 3: Quản trị Tài khoản & Hệ thống */}
          <div>
            <p className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              Quản Trị Người Dùng
            </p>
            <div className="space-y-1">
              <NavLink to="/admin/users" className={navLinkClass}>
                <UserCog size={18} />
                <span>Tất Cả Tài Khoản</span>
              </NavLink>

              <NavLink to="/admin/audit-logs" className={navLinkClass}>
                <Activity size={18} />
                <span>Nhật Ký Thao Tác</span>
              </NavLink>
            </div>
          </div>

          {/* Group 4: Hệ thống & Trí tuệ nhân tạo (AI) */}
          <div>
            <p className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              Hệ Thống &amp; Trí Tuệ Nhân Tạo
            </p>
            <div className="space-y-1">
              <NavLink to="/admin/ai-monitoring" className={navLinkClass}>
                <Cpu size={18} />
                <span>Giám Sát Token &amp; AI</span>
              </NavLink>
            </div>
          </div>
        </nav>

        {/* Sidebar Footer: Avatar + Info + Logout */}
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
              <div className="truncate flex-1">
                <p className="font-extrabold text-xs text-slate-900 dark:text-slate-100 truncate">
                  {user?.lastName} {user?.firstName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {user?.email || "admin@elp.edu.vn"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleLogout}
                title="Đăng xuất"
                aria-label="Đăng xuất"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200/80 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white dark:hover:bg-rose-600 dark:hover:text-white transition-all duration-200 cursor-pointer"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN AREA WITH STICKY TOP HEADER */}
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
              <ShieldCheck
                size={16}
                className="text-blue-700 dark:text-blue-400"
              />
              <span className="text-xs font-bold text-blue-950 dark:text-blue-300">
                Hệ Thống Quản Trị Trung Tâm
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {pendingVideoCount > 0 && (
              <button
                type="button"
                onClick={() => navigate("/admin/video-moderation")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 hover:bg-amber-100 dark:hover:bg-amber-500/25 shadow-2xs transition cursor-pointer"
              >
                <Bell size={14} className="animate-pulse" />
                <span>{pendingVideoCount} video chờ duyệt</span>
              </button>
            )}
            <ThemeToggle />
          </div>
        </header>

        {/* Main Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-transparent text-slate-900 dark:text-slate-100 custom-scrollbar transition-colors duration-200">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
