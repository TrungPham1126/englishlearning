import React from "react";
import {
  GraduationCap,
  Info,
  Target,
  Calendar,
  Bell,
  ShieldCheck,
  User as UserIcon,
  Camera,
  Loader2,
} from "lucide-react";
import { resolveAvatarUrl } from "@/lib/avatar";

interface ProfileHeaderCardProps {
  displayName: string;
  displayPhone: string;
  firstCourse?: any;
  currentLevel: string;
  totalSkillScore: number;
  activeTab: "info" | "skills" | "courses" | "security" | "notifications";
  setActiveTab: (tab: "info" | "skills" | "courses" | "security" | "notifications") => void;
  unreadNotificationsCount: number;
  avatarUrl?: string | null;
  avatarError: boolean;
  setAvatarError: (err: boolean) => void;
  isUploadingAvatar: boolean;
  onAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ProfileHeaderCard: React.FC<ProfileHeaderCardProps> = ({
  displayName,
  displayPhone,
  firstCourse,
  currentLevel,
  totalSkillScore,
  activeTab,
  setActiveTab,
  unreadNotificationsCount,
  avatarUrl,
  avatarError,
  setAvatarError,
  isUploadingAvatar,
  onAvatarChange,
}) => {
  return (
    <div className="space-y-6">
      {/* Top Banner Bar */}
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-600/15 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-600/30 shadow-2xs">
            <GraduationCap size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
              {displayName}
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span>{firstCourse?.className || "Chưa có lớp"}</span>
              <span>•</span>
              <span>{firstCourse?.level || currentLevel}</span>
              <span>•</span>
              <span className="tabular-nums">{displayPhone}</span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200/80 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/10 px-3.5 py-2 text-right shrink-0 self-start md:self-center">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            Năng lực
          </span>
          <span className="text-base font-black tabular-nums text-amber-600 dark:text-amber-400">
            {totalSkillScore.toFixed(1)}đ
          </span>
        </div>
      </div>

      {/* Tabs Menu & Photo Card */}
      <div className="space-y-5">
        {/* Navigation Tabs */}
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] p-4 shadow-sm">
          <div
            role="tablist"
            aria-label="Quản lý tài khoản và năng lực"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2"
          >
            {[
              {
                id: "info",
                label: "Hồ sơ",
                icon: Info,
                color: "text-blue-700 dark:text-blue-400",
              },
              {
                id: "skills",
                label: "Năng lực",
                icon: Target,
                color: "text-amber-500 dark:text-amber-400",
              },
              {
                id: "courses",
                label: "Lớp học",
                icon: Calendar,
                color: "text-emerald-600 dark:text-emerald-400",
              },
              {
                id: "notifications",
                label: "Thông báo",
                icon: Bell,
                color: "text-sky-600 dark:text-sky-400",
                badge: unreadNotificationsCount,
              },
              {
                id: "security",
                label: "Mật khẩu",
                icon: ShieldCheck,
                color: "text-rose-600 dark:text-rose-400",
              },
            ].map((item) => {
              const IconComponent = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`relative flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "border-blue-700 dark:border-blue-600 bg-blue-50/70 dark:bg-blue-600/15 shadow-sm ring-2 ring-blue-600/15"
                      : "border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-[#162033] hover:bg-slate-100/70 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black tabular-nums text-white">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                  <IconComponent size={18} className={`mb-1 ${item.color}`} />
                  <span
                    className={`text-xs font-bold leading-snug ${
                      isActive
                        ? "text-blue-800 dark:text-blue-300"
                        : "text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Student Avatar Card */}
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] p-5 shadow-sm flex flex-col items-center">
          <div className="relative w-full max-w-[180px] aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-[#0b1120] border-2 border-slate-200 dark:border-slate-700/80 text-slate-400 shadow-sm group">
            {avatarUrl && !avatarError ? (
              <img
                src={resolveAvatarUrl(avatarUrl)}
                alt={displayName}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0b1120] text-slate-400">
                <UserIcon size={48} className="opacity-40 mb-1" />
                <span className="text-[11px] font-semibold">Chưa có ảnh</span>
              </div>
            )}

            {isUploadingAvatar && (
              <div className="absolute inset-0 bg-slate-900/75 flex flex-col items-center justify-center text-white z-10 backdrop-blur-sm">
                <Loader2 size={26} className="animate-spin text-blue-400 mb-1.5" />
                <span className="text-[11px] font-bold">Đang tải...</span>
              </div>
            )}

            {!isUploadingAvatar && (
              <label className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-white cursor-pointer backdrop-blur-[2px]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-800 text-white shadow-md mb-1.5">
                  <Camera size={18} />
                </div>
                <span className="text-xs font-bold">Đổi ảnh</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onAvatarChange}
                />
              </label>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeaderCard;
