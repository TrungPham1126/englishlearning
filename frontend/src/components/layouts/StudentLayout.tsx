// src/components/layouts/StudentLayout.tsx
import { useState, useRef, useEffect } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { axiosClient } from "@/lib/axiosClient";
import { resolveAvatarUrl } from "@/lib/avatar";
import {
  BookOpen,
  PieChart,
  Bell,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  Award,
  UserCheck,
  LogOut,
  ShieldCheck,
  Check,
  Video,
  GraduationCap,
  Menu,
  X,
  Mic,
} from "lucide-react";
import ThemeToggle from "@/components/common/ThemeToggle";
import { StreakBadge } from "@/components/common/StreakBadge";
import { NotificationBell } from "@/components/notification/NotificationBell";

// 1. Component Dropdown Hồ sơ học viên
function StudentProfileMenu() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [courseCount, setCourseCount] = useState<number>(0);
  const [totalScore, setTotalScore] = useState<string>("0.0");
  const [imgError, setImgError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setImgError(false);
  }, [user?.avatarUrl]);

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      axiosClient
        .get("/api/student/classrooms/my-courses")
        .then((res: any) => {
          const list = res.data?.data || res.data || [];
          setCourseCount(Array.isArray(list) ? list.length : 0);
        })
        .catch(() => {});

      axiosClient
        .get("/api/v1/analytics/my-profile")
        .then((res: any) => {
          const p = res.data?.data || res.data;
          if (p) {
            const sum =
              (p.listeningScore || 0) +
              (p.speakingScore || 0) +
              (p.readingScore || 0) +
              (p.writingScore || 0) +
              (p.grammarScore || 0) +
              (p.vocabularyScore || 0);
            setTotalScore(sum.toFixed(1));
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleLogout = async () => {
    try {
      await axiosClient.post("/api/v1/auth/logout");
    } catch {
      // Ignore
    } finally {
      logout();
      navigate("/login");
    }
  };

  const displayName = user
    ? (user as any).fullName ||
      `${user.lastName || ""} ${user.firstName || ""}`.trim() ||
      "Học viên"
    : "Học viên";

  const getInitials = () => {
    const rawFullName =
      (user as any)?.fullName ||
      `${user?.lastName || ""} ${user?.firstName || ""}`.trim();
    if (!rawFullName) return "U";
    const nameParts = rawFullName.split(/\s+/);
    return nameParts[0].charAt(0).toUpperCase();
  };
  const avatarFallback = getInitials();

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Mở menu tài khoản học viên"
        className="flex items-center gap-2.5 rounded-xl border border-transparent hover:border-slate-200/80 dark:hover:border-slate-800 py-1 pl-1.5 pr-3 text-slate-700 dark:text-slate-200 transition-all duration-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-blue-600/20 cursor-pointer"
      >
        {user?.avatarUrl && !imgError ? (
          <img
            src={resolveAvatarUrl(user.avatarUrl)}
            alt={displayName}
            className="w-9 h-9 rounded-xl object-cover border-2 border-blue-600/30 shadow-sm"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-brand-600 text-white font-bold flex items-center justify-center text-sm shadow-sm border border-white/20">
            {avatarFallback}
          </div>
        )}
        <div className="hidden sm:flex flex-col items-start text-left">
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 max-w-[130px] truncate leading-tight">
            {displayName}
          </span>
          <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 leading-tight">
            Học viên
          </span>
        </div>
        {isOpen ? (
          <ChevronUp size={14} className="text-slate-500 dark:text-slate-400" />
        ) : (
          <ChevronDown size={14} className="text-slate-500 dark:text-slate-400" />
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-3 w-80 rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-xl p-4 shadow-card shadow-slate-900/10 dark:shadow-black/50 z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center gap-3.5 border-b border-slate-100 dark:border-slate-800/80 pb-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-600 border border-blue-600/30 text-lg font-bold text-white shadow-sm">
              {user?.avatarUrl && !imgError ? (
                <img
                  src={resolveAvatarUrl(user.avatarUrl)}
                  alt={displayName}
                  className="h-full w-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                avatarFallback
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
                {displayName}
              </h4>
              <p className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                <Mail size={12} className="shrink-0" />
                <span className="truncate">{user?.email}</span>
              </p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 dark:bg-blue-600/15 border border-blue-200/70 dark:border-blue-600/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">
                  <ShieldCheck size={11} />{" "}
                  {user?.roles?.[0]?.replace("ROLE_", "") || "HỌC VIÊN"}
                </span>
              </div>
            </div>
          </div>

          <div className="py-3.5 space-y-2.5 text-xs">
            <div className="flex items-center justify-between rounded-xl bg-slate-50/80 dark:bg-slate-800/50 px-3 py-2 text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-2 font-medium">
                <BookOpen size={14} className="text-blue-700 dark:text-blue-400" />
                Khóa học tham gia:
              </span>
              <span className="font-extrabold text-slate-900 dark:text-slate-100">
                {courseCount} lớp
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-amber-50/60 dark:bg-amber-500/10 px-3 py-2 text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-2 font-medium">
                <Award size={14} className="text-amber-500" />
                Tổng điểm tích lũy:
              </span>
              <span className="font-extrabold text-amber-600 dark:text-amber-400">
                {totalScore} pts
              </span>
            </div>

            {user?.phone && (
              <div className="flex items-center justify-between px-3 py-1 text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-2">
                  <Phone size={14} className="text-slate-400" />
                  Số điện thoại:
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {user.phone}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5 border-t border-slate-100 dark:border-slate-800/80 pt-3.5">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate("/student/profile");
              }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/70 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <UserCheck size={14} /> Trang cá nhân
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-500/10 py-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white dark:hover:bg-rose-600 dark:hover:text-white transition-all cursor-pointer"
            >
              <LogOut size={14} /> Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 2. Layout Chính Của Học Viên (Chuẩn EdTech SaaS hiện đại)
export default function StudentLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isTakingTest = location.pathname.includes("/take");

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Tải trước (Prefetch) trang Bài nộp & Lộ trình ngày trong thời gian rảnh
  useEffect(() => {
    const idleTimer = setTimeout(() => {
      import("@/features/student/pages/SpeakingAiEvaluationPage");
      import("@/features/student/pages/DailyHomeworkPage");
    }, 1000);
    return () => clearTimeout(idleTimer);
  }, []);

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 select-none touch-manipulation ${
      isActive
        ? "bg-blue-800 text-white shadow-xs font-bold"
        : "text-slate-700 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800/80 hover:text-slate-950 dark:hover:text-slate-100 font-bold"
    }`;

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-950 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200 ease-in-out student-portal" data-portal="student">
      {/* Sticky Top Navbar */}
      <header className="h-16 sticky top-0 z-30 bg-white/90 dark:bg-[#070b14]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-3.5 sm:px-6 lg:px-8 flex items-center justify-between shadow-xs transition-colors duration-200 ease-in-out">
        <div className="flex items-center gap-2.5 sm:gap-3 lg:gap-6">
          {/* Mobile Hamburger Button - Chuẩn kích thước chạm 44x44px */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? "Đóng menu điều hướng" : "Mở menu điều hướng"}
            aria-expanded={mobileMenuOpen}
            className="flex md:hidden h-11 w-11 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e1526] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition cursor-pointer touch-manipulation"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          {/* Brand Logo + Role Badge */}
          <div
            onClick={() => navigate("/student/courses")}
            className="flex items-center gap-2.5 select-none cursor-pointer group"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-800 text-white shadow-xs transition-transform duration-150 group-hover:scale-105">
              <GraduationCap size={18} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold tracking-tight leading-none text-slate-900 dark:text-slate-100">
                  ELP LEARNING
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-blue-50 dark:bg-slate-900/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
                  Học Viên
                </span>
              </div>
              <span className="text-[10px] text-slate-700 dark:text-slate-400 font-semibold mt-0.5">
                Học Tiếng Anh
              </span>
            </div>
          </div>

          {/* Desktop Navigation Pills */}
          <nav
            aria-label="Điều hướng chính"
            className="hidden md:flex items-center gap-1 rounded-xl bg-slate-100/90 dark:bg-[#0e1526] p-1 border border-slate-200/80 dark:border-slate-800"
          >
            <NavLink to="/student/courses" className={navItemClass}>
              <BookOpen size={14} />
              <span>Khóa Học Của Tôi</span>
            </NavLink>

            <NavLink
              to="/student/submissions"
              className={navItemClass}
              onMouseEnter={() => {
                import("@/features/student/pages/SpeakingAiEvaluationPage");
              }}
            >
              <Video size={14} />
              <span>Bài Nộp</span>
            </NavLink>

            <NavLink to="/student/profile" className={navItemClass}>
              <PieChart size={14} />
              <span>Hồ Sơ Năng Lực</span>
            </NavLink>
          </nav>
        </div>

        {/* Right Controls: Streak + AI Quota + ThemeToggle + Bell + Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <StreakBadge />
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 mx-0.5" />
          <ThemeToggle />
          <NotificationBell />
          <div className="hidden sm:block h-5 w-px bg-slate-200 dark:bg-slate-800" />
          <StudentProfileMenu />
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <nav
          aria-label="Điều hướng di động"
          className="md:hidden sticky top-16 z-20 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0e1526]/95 backdrop-blur-md px-4 py-3 space-y-2 shadow-lg animate-in slide-in-from-top-2 duration-150"
        >
          {/* Mobile Status Row */}
          <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-100 dark:border-slate-800/80">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-400">Trạng thái học viên</span>
            <div className="flex items-center gap-2">
              <StreakBadge />
            </div>
          </div>

          <NavLink to="/student/courses" className={navItemClass}>
            <BookOpen size={16} />
            <span>Khóa Học Của Tôi</span>
          </NavLink>

          <NavLink
            to="/student/submissions"
            className={navItemClass}
            onTouchStart={() => {
              import("@/features/student/pages/SpeakingAiEvaluationPage");
            }}
          >
            <Video size={16} />
            <span>Bài Nộp & Luyện Âm AI</span>
          </NavLink>

          <NavLink to="/student/profile" className={navItemClass}>
            <PieChart size={16} />
            <span>Hồ Sơ Năng Lực</span>
          </NavLink>
        </nav>
      )}

      {/* Main Content Area - Thêm padding dưới để không bị Bottom Nav che phủ trên mobile */}
      <main
        className={`flex-1 p-3.5 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto bg-transparent text-slate-900 dark:text-slate-100 transition-colors duration-200 ${
          isTakingTest ? "pb-4" : "pb-24 md:pb-8"
        }`}
      >
        <Outlet />
      </main>

      {/* Mobile Thumbs-First Bottom Navigation Bar (Ẩn khi đang làm bài thi CBT để tránh đè nút nộp) */}
      {!isTakingTest && (
        <nav
          aria-label="Thanh điều hướng dưới di động"
          className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-[#070b14]/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800/90 px-3 py-1.5 shadow-lg safe-area-bottom"
        >
          <div className="grid grid-cols-3 gap-1">
            <NavLink
              to="/student/courses"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-h-[48px] py-1 px-1 rounded-xl transition-all select-none touch-manipulation ${
                  isActive
                    ? "text-blue-800 dark:text-blue-400 font-bold bg-blue-50/80 dark:bg-blue-950/40"
                    : "text-slate-500 dark:text-slate-400 font-medium hover:text-slate-800 dark:hover:text-slate-200"
                }`
              }
            >
              <BookOpen size={18} />
              <span className="text-[10px] mt-1 tracking-tight leading-none">Khóa Học</span>
            </NavLink>

            <NavLink
              to="/student/submissions"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-h-[48px] py-1 px-1 rounded-xl transition-all select-none touch-manipulation ${
                  isActive
                    ? "text-blue-800 dark:text-blue-400 font-bold bg-blue-50/80 dark:bg-blue-950/40"
                    : "text-slate-700 dark:text-slate-400 font-semibold hover:text-slate-950 dark:hover:text-slate-200"
                }`
              }
            >
              <Mic size={18} />
              <span className="text-[10px] mt-1 tracking-tight leading-none">Luyện Nói</span>
            </NavLink>

            <NavLink
              to="/student/profile"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-h-[48px] py-1 px-1 rounded-xl transition-all select-none touch-manipulation ${
                  isActive
                    ? "text-blue-800 dark:text-blue-400 font-bold bg-blue-50/80 dark:bg-blue-950/40"
                    : "text-slate-700 dark:text-slate-400 font-semibold hover:text-slate-950 dark:hover:text-slate-200"
                }`
              }
            >
              <PieChart size={18} />
              <span className="text-[10px] mt-1 tracking-tight leading-none">Hồ Sơ</span>
            </NavLink>
          </div>
        </nav>
      )}
    </div>
  );
}
