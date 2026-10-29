// src/components/layouts/StudentProfileMenu.tsx
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { studentApi } from "@/features/student/api/studentApi";
import { axiosClient } from "@/lib/axiosClient";
import { resolveAvatarUrl } from "@/lib/avatar";
import type { StudentSkillProfile } from "@/features/student/types";
import {
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  BookOpen,
  Award,
  UserCheck,
  LogOut,
  ShieldCheck,
} from "lucide-react";

export default function StudentProfileMenu() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [courseCount, setCourseCount] = useState<number>(0);
  const [skillProfile, setSkillProfile] = useState<StudentSkillProfile | null>(
    null,
  );
  const menuRef = useRef<HTMLDivElement>(null);

  // Đóng menu khi nhấp ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Tải dữ liệu thật từ Backend khi mở popup
  useEffect(() => {
    if (isOpen) {
      studentApi
        .getMyCourses()
        .then((courses) => setCourseCount(courses.length))
        .catch(() => {});

      studentApi
        .getSkillProfile()
        .then((profile) => setSkillProfile(profile))
        .catch(() => {});
    }
  }, [isOpen]);

  const handleLogout = async () => {
    try {
      await axiosClient.post("/api/v1/auth/logout");
    } catch {
      // Bỏ qua lỗi mạng
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

  // Tính tổng điểm tích lũy của 6 kỹ năng
  const totalScore = skillProfile
    ? (
        skillProfile.listeningScore +
        skillProfile.speakingScore +
        skillProfile.readingScore +
        skillProfile.writingScore +
        skillProfile.grammarScore +
        skillProfile.vocabularyScore
      ).toFixed(1)
    : "0.0";

  return (
    <div className="relative" ref={menuRef}>
      {/* Nút bấm trên Topbar */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-2.5 rounded-xl border border-transparent hover:border-slate-200/80 dark:hover:border-slate-800 py-1 pl-1.5 pr-3 text-slate-700 dark:text-slate-200 transition-all duration-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 focus:outline-none cursor-pointer"
      >
        {user?.avatarUrl ? (
          <img
            src={resolveAvatarUrl(user.avatarUrl)}
            alt={displayName}
            className="w-9 h-9 rounded-xl object-cover border-2 border-blue-600/30 shadow-sm"
          />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-brand-600 text-white font-bold flex items-center justify-center text-sm shadow-sm border border-white/20">
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

      {/* Popup Dropdown */}
      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-3 w-80 rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-xl p-4 shadow-card shadow-slate-900/10 dark:shadow-black/50 z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Thông tin User Header */}
          <div className="flex items-center gap-3.5 border-b border-slate-100 dark:border-slate-800/80 pb-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-600 border border-blue-600/30 text-lg font-bold text-white shadow-sm">
              {user?.avatarUrl ? (
                <img
                  src={resolveAvatarUrl(user.avatarUrl)}
                  alt={displayName}
                  className="h-full w-full object-cover"
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
                  {user?.roles?.[0]?.replace("ROLE_", "") || "STUDENT"}
                </span>
              </div>
            </div>
          </div>

          {/* Dữ liệu thực từ Database */}
          <div className="py-3.5 space-y-2.5 text-xs">
            <div className="flex items-center justify-between rounded-xl bg-slate-50/80 dark:bg-slate-800/50 px-3 py-2 text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-2 font-medium">
                <BookOpen size={14} className="text-blue-700 dark:text-blue-400" />
                Khóa học đang tham gia:
              </span>
              <span className="font-extrabold text-slate-900 dark:text-slate-100">
                {courseCount} lớp
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-amber-50/60 dark:bg-amber-500/10 px-3 py-2 text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-2 font-medium">
                <Award size={14} className="text-amber-500" />
                Tổng điểm năng lực:
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
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {user.phone}
                </span>
              </div>
            )}
          </div>

          {/* 2 Nút hành động */}
          <div className="grid grid-cols-2 gap-2.5 border-t border-slate-100 dark:border-slate-800/80 pt-3.5">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate("/student/profile");
              }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/70 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800 transition-all cursor-pointer"
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
