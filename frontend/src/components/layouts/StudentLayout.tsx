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
  Sparkles,
} from "lucide-react";
import ThemeToggle from "@/components/common/ThemeToggle";
import { StreakBadge } from "@/components/common/StreakBadge";
import { AiQuotaIndicator } from "@/components/common/AiQuotaIndicator";

interface NotificationItem {
  id: string;
  title: string;
  message?: string;
  content?: string;
  classroomId?: string | null;
  type?: string;
  notificationType?: string;
  recipientUserId?: string | null;
  isRead: boolean;
  createdAt?: string;
  targetUrl?: string;
}

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

// 2. Component Chuông Thông báo
function NotificationBell() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const res: any = await axiosClient.get("/api/v1/notifications?page=0&size=30");
      const rawData = res.data?.data ?? res.data;
      const rawList = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.content)
        ? rawData.content
        : [];

      const dedupMap = new Map<string, NotificationItem>();
      for (const item of rawList) {
        const text = (item.message || item.content || "").trim();
        const key = `${(item.title || "").trim()}||${text}`;
        if (!dedupMap.has(key)) {
          dedupMap.set(key, item);
        } else {
          const existing = dedupMap.get(key)!;
          if (
            (!existing.isRead && item.isRead) ||
            (!existing.recipientUserId && item.recipientUserId)
          ) {
            dedupMap.set(key, {
              ...item,
              isRead: Boolean(existing.isRead || item.isRead),
            });
          }
        }
      }
      const list = Array.from(dedupMap.values());
      setNotifications(list);
      setUnreadCount(list.filter((n: NotificationItem) => !n.isRead).length);
    } catch (err) {
      console.error("Lỗi khi tải thông báo trên Header:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const interval = setInterval(fetchNotifications, 30000);

    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      clearInterval(interval);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleToggleOpen = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      fetchNotifications();
    }
  };

  const handleMarkAllAsRead = async (e: ReactMouseEvent) => {
    e.stopPropagation();
    try {
      await axiosClient.put("/api/v1/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      try {
        await axiosClient.patch("/api/v1/notifications/read-all");
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      } catch {}
    }
  };

  const handleNotificationClick = async (n: NotificationItem) => {
    if (!n.isRead) {
      try {
        await axiosClient.put(`/api/v1/notifications/${n.id}/read`);
      } catch {
        try {
          await axiosClient.patch(`/api/v1/notifications/${n.id}/read`);
        } catch {}
      }
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === n.id ? { ...item, isRead: true } : item,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    if (n.targetUrl) {
      setIsOpen(false);
      navigate(n.targetUrl);
    }
  };

  return (
    <div className="relative" ref={bellRef}>
      <button
        type="button"
        onClick={handleToggleOpen}
        aria-label="Thông báo hệ thống"
        aria-expanded={isOpen}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:bg-blue-50/60 dark:hover:bg-slate-800/70 hover:text-blue-700 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-slate-700 shadow-2xs transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 cursor-pointer"
        title="Thông báo hệ thống"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-[#070b14] animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-xl p-4 shadow-card shadow-slate-900/10 dark:shadow-black/50 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-xs">
                Thông Báo ({notifications.length})
              </h4>
              {unreadCount > 0 && (
                <span className="bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-[10px] font-black px-2 py-0.5 rounded-full">
                  {unreadCount} mới
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
              >
                <Check size={12} /> Đánh dấu đã đọc
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2 custom-scrollbar pr-0.5">
            {isLoading && notifications.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-6">
                Đang tải thông báo...
              </p>
            ) : notifications.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-6">
                Không có thông báo nào.
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`rounded-xl p-3 text-xs transition-all cursor-pointer ${
                    n.isRead
                      ? "bg-slate-50/70 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                      : "bg-blue-50/80 dark:bg-blue-600/15 border border-blue-200/80 dark:border-blue-600/30 text-slate-900 dark:text-slate-100 hover:bg-blue-100/70 dark:hover:bg-blue-600/25 shadow-2xs"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${
                          n.classroomId
                            ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400"
                            : "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400"
                        }`}
                      >
                        {n.classroomId ? "Lớp học" : "Hệ thống"}
                      </span>
                      <p
                        className={`font-bold text-xs truncate ${
                          n.isRead
                            ? "text-slate-800 dark:text-slate-200"
                            : "text-blue-950 dark:text-blue-200"
                        }`}
                      >
                        {n.title}
                      </p>
                    </div>
                    {!n.isRead && (
                      <span className="h-2 w-2 rounded-full bg-rose-600 shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 mt-1.5 leading-relaxed">
                    {n.message || n.content || "Không có nội dung chi tiết"}
                  </p>
                  {n.createdAt && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 block font-medium">
                      {new Date(n.createdAt).toLocaleString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 3. Layout Chính Của Học Viên (Chuẩn EdTech SaaS hiện đại)
export default function StudentLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 select-none ${
      isActive
        ? "bg-blue-800 text-white shadow-xs font-bold"
        : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100"
    }`;

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200 ease-in-out">
      {/* Sticky Top Navbar */}
      <header className="h-16 sticky top-0 z-30 bg-white/90 dark:bg-[#070b14]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between shadow-xs transition-colors duration-200 ease-in-out">
        <div className="flex items-center gap-3 lg:gap-6">
          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? "Đóng menu điều hướng" : "Mở menu điều hướng"}
            aria-expanded={mobileMenuOpen}
            className="flex md:hidden h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e1526] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            {mobileMenuOpen ? <X size={17} /> : <Menu size={17} />}
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
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-blue-50 dark:bg-slate-900/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
                  <Sparkles size={10} /> Học Viên
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Nền tảng Học Tiếng Anh Thông Minh
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

            <NavLink to="/student/vocabulary" className={navItemClass}>
              <Award size={14} />
              <span>Luyện Từ Vựng</span>
            </NavLink>

            <NavLink to="/student/submissions" className={navItemClass}>
              <Video size={14} />
              <span>Bài Nộp &amp; AI</span>
            </NavLink>

            <NavLink to="/student/profile" className={navItemClass}>
              <PieChart size={14} />
              <span>Hồ Sơ Năng Lực</span>
            </NavLink>
          </nav>
        </div>

        {/* Right Controls: Streak + AI Quota + ThemeToggle + Bell + Profile */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <StreakBadge />
          <AiQuotaIndicator />
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
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Trạng thái học viên</span>
            <div className="flex items-center gap-2">
              <StreakBadge />
              <AiQuotaIndicator />
            </div>
          </div>

          <NavLink to="/student/courses" className={navItemClass}>
            <BookOpen size={16} />
            <span>Khóa Học Của Tôi</span>
          </NavLink>

          <NavLink to="/student/vocabulary" className={navItemClass}>
            <Award size={16} />
            <span>Luyện Từ Vựng</span>
          </NavLink>

          <NavLink to="/student/submissions" className={navItemClass}>
            <Video size={16} />
            <span>Submission &amp; AI</span>
          </NavLink>

          <NavLink to="/student/profile" className={navItemClass}>
            <PieChart size={16} />
            <span>Hồ Sơ Năng Lực</span>
          </NavLink>
        </nav>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto bg-transparent text-slate-900 dark:text-slate-100 transition-colors duration-200">
        <Outlet />
      </main>
    </div>
  );
}
