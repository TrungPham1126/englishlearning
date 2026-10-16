// src/components/StudentProfileMenu.tsx
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { studentApi } from "@/features/student/api/studentApi";
import { axiosClient } from "@/lib/axiosClient";
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

  const displayName = user ? `${user.lastName} ${user.firstName}` : "Học viên";
  const avatarFallback = user?.firstName
    ? user.firstName.charAt(0).toUpperCase()
    : "U";

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
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-white transition hover:bg-white/10 focus:outline-none"
      >
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/60 bg-indigo-600 font-bold text-xs shadow-inner">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            avatarFallback
          )}
        </div>
        <span className="text-xs font-semibold text-white/90 max-w-[130px] truncate">
          {displayName}
        </span>
        {isOpen ? (
          <ChevronUp size={14} className="text-white/70" />
        ) : (
          <ChevronDown size={14} className="text-white/70" />
        )}
      </button>

      {/* Popup Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
          {/* Thông tin User Header */}
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-50 border border-indigo-200 text-lg font-black text-indigo-700">
              {avatarFallback}
            </div>
            <div className="truncate">
              <h4 className="text-sm font-bold text-slate-800 truncate">
                {displayName}
              </h4>
              <p className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
                <Mail size={12} /> {user?.email}
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                  <ShieldCheck size={11} />{" "}
                  {user?.roles?.[0]?.replace("ROLE_", "") || "STUDENT"}
                </span>
              </div>
            </div>
          </div>

          {/* Dữ liệu thực từ Database */}
          <div className="py-3 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5">
                <BookOpen size={14} className="text-indigo-600" />
                Khóa học đang tham gia:
              </span>
              <span className="font-bold text-slate-800">
                {courseCount} lớp
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5">
                <Award size={14} className="text-amber-500" />
                Tổng điểm năng lực:
              </span>
              <span className="font-bold text-amber-600">{totalScore} pts</span>
            </div>

            {user?.phone && (
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Phone size={14} className="text-slate-400" />
                  Số điện thoại:
                </span>
                <span className="font-medium text-slate-700">{user.phone}</span>
              </div>
            )}
          </div>

          {/* 2 Nút hành động */}
          <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate("/student/profile");
              }}
              className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              <UserCheck size={13} /> Trang cá nhân
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition"
            >
              <LogOut size={13} /> Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
