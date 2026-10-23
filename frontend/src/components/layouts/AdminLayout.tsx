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
} from "lucide-react";

export default function AdminLayout() {
  const { user, setAuth, accessToken, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingVideoCount, setPendingVideoCount] = useState<number>(0);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [user?.avatarUrl]);

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
    `flex items-center gap-3 px-3.5 py-2.5 rounded-r-xl text-sm transition-colors duration-200 ${
      isActive
        ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold border-l-2 border-indigo-600 dark:border-indigo-400"
        : "text-slate-600 dark:text-slate-400 font-medium border-l-2 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100"
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
    <div className="flex h-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200 ease-in-out overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-68 bg-white dark:bg-[#0d1322] flex flex-col shrink-0 z-20 border-r border-slate-200 dark:border-slate-800/80 transition-colors duration-200 ease-in-out">
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200 dark:border-slate-800/80 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
              <GraduationCap size={20} />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-slate-900 dark:text-slate-100 tracking-tight">
                  ELP CENTER
                </span>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200/70 dark:border-indigo-500/30">
                  Admin
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block truncate">
                Hệ Thống Quản Trị
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-3.5 space-y-6 overflow-y-auto custom-scrollbar">
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
                  `flex items-center justify-between px-3.5 py-2.5 rounded-r-xl text-sm transition-colors duration-200 ${
                    isActive
                      ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold border-l-2 border-indigo-600 dark:border-indigo-400"
                      : "text-slate-600 dark:text-slate-400 font-medium border-l-2 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100"
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

        {/* Sidebar Footer: Avatar + Info + ThemeToggle + Logout */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#070b14]/50 transition-colors duration-200">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <label
                title="Nhấp để đổi ảnh đại diện"
                className="relative w-10 h-10 shrink-0 rounded-full overflow-hidden cursor-pointer group shadow-sm"
              >
                {user?.avatarUrl && !imgError ? (
                  <img
                    src={resolveAvatarUrl(user.avatarUrl)}
                    alt="Avatar"
                    className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold flex items-center justify-center text-sm shadow-sm">
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
                <p className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
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
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200/80 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white dark:hover:bg-rose-600 dark:hover:text-white transition-colors duration-200 cursor-pointer"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN AREA WITH STICKY TOP HEADER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 transition-colors duration-200">
        {/* Sticky Top Navbar */}
        <header className="h-16 shrink-0 sticky top-0 z-30 bg-white/80 dark:bg-[#070b14]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 px-6 md:px-8 flex items-center justify-between transition-colors duration-200">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={18} className="text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Hệ Thống Quản Trị Trung Tâm
            </span>
          </div>

          <div className="flex items-center gap-3">
            {pendingVideoCount > 0 && (
              <button
                type="button"
                onClick={() => navigate("/admin/video-moderation")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition cursor-pointer"
              >
                <Bell size={14} className="animate-bounce" />
                <span>{pendingVideoCount} video chờ duyệt</span>
              </button>
            )}
            <ThemeToggle />
          </div>
        </header>

        {/* Main Content Viewport */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 custom-scrollbar transition-colors duration-200">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
