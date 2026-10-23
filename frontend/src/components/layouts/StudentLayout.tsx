// src/components/layouts/StudentLayout.tsx
import { useState, useRef, useEffect } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
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
} from "lucide-react";
import ThemeToggle from "@/components/common/ThemeToggle";

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
    ? (user as any).fullName || `${user.lastName || ""} ${user.firstName || ""}`.trim() || "Học viên"
    : "Học viên";

  const getInitials = () => {
    const rawFullName =
      (user as any)?.fullName ||
      `${user?.lastName || ""} ${user?.firstName || ""}`.trim();
    if (!rawFullName) return "U";
    const nameParts = rawFullName.split(/\s+/);
    // Lấy chữ cái đầu tiên (ví dụ "Nguyễn Học Viên" -> "N")
    return nameParts[0].charAt(0).toUpperCase();
  };
  const avatarFallback = getInitials();

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2.5 text-slate-700 dark:text-slate-200 transition-colors duration-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 focus:outline-none cursor-pointer"
      >
        {user?.avatarUrl && !imgError ? (
          <img
            src={resolveAvatarUrl(user.avatarUrl)}
            alt={displayName}
            className="w-9 h-9 rounded-full object-cover border-2 border-indigo-500/30 shadow-sm"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-bold flex items-center justify-center text-sm shadow-sm border border-white/20">
            {avatarFallback}
          </div>
        )}
        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 max-w-[130px] truncate">
          {displayName}
        </span>
        {isOpen ? (
          <ChevronUp size={14} className="text-slate-500 dark:text-slate-400" />
        ) : (
          <ChevronDown size={14} className="text-slate-500 dark:text-slate-400" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#121a2d] p-4 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 border border-indigo-500/30 text-lg font-bold text-white shadow-sm">
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

            <div className="truncate">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {displayName}
              </h4>
              <p className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                <Mail size={12} /> {user?.email}
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200/70 dark:border-indigo-500/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  <ShieldCheck size={11} />{" "}
                  {user?.roles?.[0]?.replace("ROLE_", "") || "HỌC VIÊN"}
                </span>
              </div>
            </div>
          </div>

          <div className="py-3 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <BookOpen size={14} className="text-indigo-600 dark:text-indigo-400" />
                Khóa học tham gia:
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {courseCount} lớp
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Award size={14} className="text-amber-500" />
                Tổng điểm tích lũy:
              </span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                {totalScore} pts
              </span>
            </div>

            {user?.phone && (
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Phone size={14} className="text-slate-400" />
                  Số điện thoại:
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {user.phone}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-slate-100 dark:border-slate-800/80 pt-3">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate("/student/profile");
              }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <UserCheck size={13} /> Trang cá nhân
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-500/10 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white dark:hover:bg-rose-600 dark:hover:text-white transition cursor-pointer"
            >
              <LogOut size={13} /> Đăng xuất
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
          if ((!existing.isRead && item.isRead) || (!existing.recipientUserId && item.recipientUserId)) {
            dedupMap.set(key, { ...item, isRead: Boolean(existing.isRead || item.isRead) });
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

    // Định kỳ lấy thông báo mới mỗi 30 giây
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
        prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
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
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#121a2d] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100 transition-colors duration-200 focus:outline-none cursor-pointer"
        title="Thông báo hệ thống"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-[#070b14] animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-84 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#121a2d] p-4 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5 mb-2.5">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                Thông Báo ({notifications.length})
              </h4>
              {unreadCount > 0 && (
                <span className="bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                  {unreadCount} mới
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                <Check size={12} /> Đánh dấu đã đọc
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto space-y-2 custom-scrollbar">
            {isLoading && notifications.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-4">
                Đang tải thông báo...
              </p>
            ) : notifications.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-4">
                Không có thông báo nào.
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`rounded-xl p-2.5 text-xs transition cursor-pointer ${
                    n.isRead
                      ? "bg-slate-50/50 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                      : "bg-indigo-50/80 dark:bg-indigo-500/15 border border-indigo-200/80 dark:border-indigo-500/30 text-slate-900 dark:text-slate-100 hover:bg-indigo-100/70 dark:hover:bg-indigo-500/25"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${
                          n.classroomId
                            ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400"
                            : "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400"
                        }`}
                      >
                        {n.classroomId ? "[Lớp học]" : "[Hệ thống]"}
                      </span>
                      <p className={`font-bold text-xs truncate ${n.isRead ? "text-slate-800 dark:text-slate-200" : "text-indigo-950 dark:text-indigo-200"}`}>
                        {n.title}
                      </p>
                    </div>
                    {!n.isRead && (
                      <span className="h-2 w-2 rounded-full bg-rose-600 shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 mt-1 leading-relaxed">
                    {n.message || n.content || "Không có nội dung chi tiết"}
                  </p>
                  {n.createdAt && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 block">
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

// 3. Layout Chính Của Học Viên (Đồng bộ chuẩn Obsidian SaaS)
export default function StudentLayout() {
  const navigate = useNavigate();

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors duration-200 ${
      isActive
        ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400"
        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100"
    }`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200 ease-in-out">
      {/* Sticky Top Navbar */}
      <header className="h-16 sticky top-0 z-30 bg-white/80 dark:bg-[#070b14]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 px-6 lg:px-10 flex items-center justify-between transition-colors duration-200 ease-in-out">
        <div className="flex items-center gap-8">
          {/* Brand Logo + Role Badge */}
          <div
            onClick={() => navigate("/student/courses")}
            className="flex items-center gap-3 select-none cursor-pointer"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/20">
              <GraduationCap size={20} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-tight leading-none text-slate-900 dark:text-slate-100">
                  ELP LEARNING
                </span>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200/70 dark:border-indigo-500/30">
                  Học Viên
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Cổng Thông Tin Học Viên
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-2">
            <NavLink to="/student/courses" className={navItemClass}>
              <BookOpen size={16} className="text-indigo-600 dark:text-indigo-400" />
              <span>Khóa Học Của Tôi</span>
            </NavLink>

            <NavLink to="/student/submissions" className={navItemClass}>
              <Video size={16} className="text-rose-500 dark:text-rose-400" />
              <span>Submission &amp; AI</span>
            </NavLink>

            <NavLink to="/student/profile" className={navItemClass}>
              <PieChart size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span>Hồ Sơ Năng Lực</span>
            </NavLink>
          </nav>
        </div>

        {/* Right Controls: ThemeToggle + Bell + Profile */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <NotificationBell />
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />
          <StudentProfileMenu />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 lg:p-8 max-w-[1400px] w-full mx-auto bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 transition-colors duration-200">
        <Outlet />
      </main>
    </div>
  );
}
