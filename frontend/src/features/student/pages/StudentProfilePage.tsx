import { useEffect, useState } from "react";
import type { FormEvent, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { studentApi } from "@/features/student/api/studentApi";
import type {
  StudentSkillProfile,
  MyCourseResponse,
} from "@/features/student/types";
import { axiosClient } from "@/lib/axiosClient";
import { resolveAvatarUrl } from "@/lib/avatar";
import {
  Bell,
  Info,
  ShieldCheck,
  Calendar,
  Award,
  Sparkles,
  Save,
  Camera,
  User as UserIcon,
  CheckCircle2,
  Lock,
  Compass,
  Loader2,
  Check,
  ExternalLink,
  ArrowRight,
  AlertTriangle,
  BookOpen,
  Headphones,
  Mic,
  RefreshCw,
  Target,
  Mail,
  Phone,
  GraduationCap,
} from "lucide-react";

export default function StudentProfilePage() {
  const navigate = useNavigate();
  const { user, setAuth, accessToken } = useAuthStore();
  const [activeTab, setActiveTab] = useState<
    "info" | "skills" | "courses" | "security" | "notifications"
  >("info");

  const [profile, setProfile] = useState<StudentSkillProfile | null>(null);
  const [courses, setCourses] = useState<MyCourseResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRefreshingSkills, setIsRefreshingSkills] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
    phone: user?.phone || "",
    currentLevel: user?.currentLevel || "A2",
    targetCefr: user?.targetCefr || "B2 (IELTS 6.0+)",
  });

  // Notification State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const fetchNotifications = async () => {
    try {
      setNotificationsLoading(true);
      const res: any = await axiosClient.get(
        "/api/v1/notifications?page=0&size=30",
      );
      const rawData = res.data?.data ?? res.data;
      const rawList = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.content)
        ? rawData.content
        : [];

      const dedupMap = new Map<string, any>();
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
    } catch (err) {
      console.error("Lỗi khi tải thông báo:", err);
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (activeTab === "notifications") {
      fetchNotifications();
    }
  }, [activeTab]);

  const handleMarkAllNotificationsRead = async () => {
    try {
      await axiosClient.put("/api/v1/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      try {
        await axiosClient.patch("/api/v1/notifications/read-all");
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleMarkNotificationRead = async (id: string, targetUrl?: string) => {
    try {
      await axiosClient.put(`/api/v1/notifications/${id}/read`);
    } catch {
      try {
        await axiosClient.patch(`/api/v1/notifications/${id}/read`);
      } catch (e) {
        console.error(e);
      }
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    if (targetUrl) {
      if (targetUrl.startsWith("http")) {
        window.open(targetUrl, "_blank");
      } else {
        navigate(targetUrl);
      }
    }
  };

  // Reset lỗi avatar khi user thay đổi URL
  useEffect(() => {
    setAvatarError(false);
  }, [user?.avatarUrl]);

  // Tải dữ liệu thực từ Backend Spring Boot
  useEffect(() => {
    Promise.all([
      studentApi.getSkillProfile().catch(() => null),
      studentApi.getMyCourses().catch(() => []),
    ])
      .then(([skillData, courseData]) => {
        setProfile(skillData);
        setCourses(Array.isArray(courseData) ? courseData : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setSaveSuccess(false);
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updatedUser = await studentApi.updateProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        currentLevel: formData.currentLevel,
        targetCefr: formData.targetCefr,
        avatarUrl: user?.avatarUrl,
      });

      if (accessToken) {
        setAuth(accessToken, {
          ...updatedUser,
          avatarUrl: updatedUser?.avatarUrl || user?.avatarUrl,
        });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      alert("Không thể lưu thông tin, vui lòng kiểm tra lại!");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn file hình ảnh hợp lệ (JPEG, PNG, WEBP, GIF).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Dung lượng file tối đa là 5MB.");
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const resData: any = await studentApi.updateAvatar(file);
      const newAvatarUrl =
        typeof resData === "string" ? resData : resData?.avatarUrl;
      if (accessToken && user) {
        if (typeof resData === "object" && resData !== null && resData.id) {
          setAuth(accessToken, resData);
        } else if (newAvatarUrl) {
          setAuth(accessToken, { ...user, avatarUrl: newAvatarUrl });
        }
      }
      setAvatarError(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error("Lỗi tải ảnh đại diện:", err);
      alert(
        err?.response?.data?.message ||
          "Không thể tải ảnh đại diện, vui lòng thử lại!",
      );
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const firstCourse = courses[0];
  const displayName =
    `${user?.lastName || ""} ${user?.firstName || ""}`.trim() || "Học viên";
  const displayPhone = user?.phone || "Chưa cập nhật SĐT";

  // 6 Kỹ năng chuẩn xác
  const skillsList = [
    {
      label: "Listening",
      name: "Nghe",
      value: profile?.listeningScore || 0,
      icon: Headphones,
      color: "text-sky-500",
      barColor: "bg-sky-500",
    },
    {
      label: "Speaking",
      name: "Nói",
      value: profile?.speakingScore || 0,
      icon: Mic,
      color: "text-blue-700 dark:text-blue-400",
      barColor: "bg-blue-800",
    },
    {
      label: "Reading",
      name: "Đọc",
      value: profile?.readingScore || 0,
      icon: BookOpen,
      color: "text-emerald-500",
      barColor: "bg-emerald-500",
    },
    {
      label: "Writing",
      name: "Viết",
      value: profile?.writingScore || 0,
      icon: Award,
      color: "text-blue-600",
      barColor: "bg-blue-600",
    },
    {
      label: "Grammar",
      name: "Ngữ pháp",
      value: profile?.grammarScore || 0,
      icon: ShieldCheck,
      color: "text-amber-500",
      barColor: "bg-amber-500",
    },
    {
      label: "Vocabulary",
      name: "Từ vựng",
      value: profile?.vocabularyScore || 0,
      icon: Sparkles,
      color: "text-rose-500",
      barColor: "bg-rose-500",
    },
  ];

  const totalSkillScore = skillsList.reduce((acc, s) => acc + s.value, 0);
  const maxSkillScore = Math.max(...skillsList.map((s) => s.value), 0);
  const sortedSkills = [...skillsList].sort((a, b) => b.value - a.value);
  const strongestSkill = sortedSkills[0];
  const weakestSkills = sortedSkills.filter((s) => s.value <= 3.0);
  const isImbalanced = strongestSkill.value >= 10.0 && weakestSkills.length >= 2;

  // Radar SVG Math
  const chartSize = 280;
  const center = chartSize / 2;
  const radius = 95;
  const totalAxes = skillsList.length;

  const maxAxisVal = Math.max(50, Math.ceil(maxSkillScore / 10) * 10);
  const radarCoords = skillsList.map((skill, index) => {
    const angle = ((Math.PI * 2) / totalAxes) * index - Math.PI / 2;
    const ratio = skill.value > 0 ? Math.min(skill.value / maxAxisVal, 1.0) : 0;
    const r = Math.max(skill.value > 0 ? 8 : 2, ratio * radius);
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
      axisX: center + radius * Math.cos(angle),
      axisY: center + radius * Math.sin(angle),
      labelX: center + (radius + 24) * Math.cos(angle),
      labelY: center + (radius + 14) * Math.sin(angle),
      ...skill,
    };
  });

  const radarPoints = radarCoords.map((c) => `${c.x},${c.y}`).join(" ");

  const handleRefreshSkills = async () => {
    try {
      setIsRefreshingSkills(true);
      const data = await studentApi.getSkillProfile();
      setProfile(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshingSkills(false);
    }
  };

  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-sm font-semibold text-slate-500 dark:text-slate-400 gap-3">
        <Loader2 className="animate-spin text-blue-700 dark:text-blue-400" size={32} />
        <span>Đang nạp hồ sơ năng lực học viên...</span>
      </div>
    );
  }

  return (
    <div className="max-w-[1350px] mx-auto space-y-6 pb-10">
      {/* Page Top Header Banner */}
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-600/15 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-600/30 shadow-2xs">
            <GraduationCap size={24} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Hồ Sơ Học Viên:{" "}
                <span className="text-blue-700 dark:text-blue-400">
                  {displayName}
                </span>
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-500/30">
                <CheckCircle2 size={12} /> Đang hoạt động
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                <strong className="text-slate-700 dark:text-slate-200">Khóa học:</strong>{" "}
                {firstCourse?.className || "Chưa tham gia"}
              </span>
              <span>•</span>
              <span>
                <strong className="text-slate-700 dark:text-slate-200">Cấp độ:</strong>{" "}
                {firstCourse?.level || formData.currentLevel}
              </span>
              <span>•</span>
              <span>
                <strong className="text-slate-700 dark:text-slate-200">SĐT:</strong>{" "}
                {displayPhone}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-center">
          <div className="rounded-xl border border-amber-200/80 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/10 px-4 py-2 text-right">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Điểm Năng Lực Tích Lũy
            </span>
            <span className="text-lg font-black text-amber-600 dark:text-amber-400">
              {totalSkillScore.toFixed(1)} pts
            </span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= CỘT TRÁI: MENU TABS & ẢNH CHÂN DUNG ================= */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card Menu Điều Hướng 5 Tabs */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] p-5 shadow-sm">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3.5 px-1">
              Danh Mục Quản Lý Hồ Sơ
            </h2>
            <div
              role="tablist"
              aria-label="Quản lý tài khoản và năng lực"
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2.5"
            >
              {[
                {
                  id: "info",
                  label: "Thông tin cá nhân",
                  icon: Info,
                  color: "text-blue-700 dark:text-blue-400",
                },
                {
                  id: "skills",
                  label: "Năng lực (Radar)",
                  icon: Sparkles,
                  color: "text-amber-500 dark:text-amber-400",
                },
                {
                  id: "courses",
                  label: "Lịch & Lớp học",
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
                  label: "Mật khẩu & Bảo mật",
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
                    className={`relative flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all duration-200 cursor-pointer ${
                      isActive
                        ? "border-blue-700 dark:border-blue-600 bg-blue-50/70 dark:bg-blue-600/15 shadow-sm ring-2 ring-blue-600/15"
                        : "border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-[#162033] hover:bg-slate-100/70 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="absolute top-2 right-2 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white">
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    )}
                    <IconComponent size={20} className={`mb-1.5 ${item.color}`} />
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

          {/* Card Khung Ảnh Chân Dung */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] p-6 shadow-sm flex flex-col items-center">
            <div className="relative w-full max-w-[240px] aspect-[3/4] rounded-xl overflow-hidden bg-slate-100 dark:bg-[#0b1120] border-2 border-slate-200 dark:border-slate-700/80 text-slate-400 shadow-md group">
              {user?.avatarUrl && !avatarError ? (
                <img
                  src={resolveAvatarUrl(user.avatarUrl)}
                  alt={displayName}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0b1120] text-slate-400">
                  <UserIcon size={64} className="opacity-40 mb-2" />
                  <span className="text-xs font-semibold">Chưa có ảnh thẻ</span>
                </div>
              )}

              {/* Lớp phủ khi đang upload */}
              {isUploadingAvatar && (
                <div className="absolute inset-0 bg-slate-900/75 flex flex-col items-center justify-center text-white z-10 backdrop-blur-sm">
                  <Loader2
                    size={32}
                    className="animate-spin text-blue-400 mb-2"
                  />
                  <span className="text-xs font-bold">Đang tải ảnh lên...</span>
                </div>
              )}

              {/* Lớp phủ đổi ảnh đại diện */}
              {!isUploadingAvatar && (
                <label className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-white cursor-pointer backdrop-blur-[2px]">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-800 text-white shadow-md mb-2">
                    <Camera size={22} />
                  </div>
                  <span className="text-xs font-bold">Đổi ảnh đại diện</span>
                  <span className="text-[10px] text-slate-200 mt-0.5">
                    JPG, PNG, WEBP (tối đa 5MB)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </label>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 font-medium text-center">
              Ảnh hồ sơ học viên chính thức (Di chuột hoặc chạm để thay đổi)
            </p>
          </div>
        </div>

        {/* ================= CỘT PHẢI: CHI TIẾT TỪNG TAB ================= */}
        <div className="lg:col-span-8 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] shadow-sm overflow-hidden min-h-[620px] flex flex-col justify-between">
          {/* TAB 1: FORM THÔNG TIN CÁ NHÂN */}
          {activeTab === "info" && (
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between px-6 sm:px-8 py-4 bg-slate-50/80 dark:bg-[#162033] border-b border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400">
                      <Info size={16} />
                    </div>
                    <div>
                      <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        Thông Tin Hồ Sơ Học Viên
                      </h2>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Cập nhật thông tin liên hệ và mục tiêu đầu ra CEFR của bạn
                      </p>
                    </div>
                  </div>
                </div>

                <form
                  onSubmit={handleSaveProfile}
                  className="p-6 sm:p-8 space-y-5 max-w-2xl"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Họ và đệm
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                          <UserIcon size={15} />
                        </span>
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleChange}
                          disabled={isSaving}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#0b1120] pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none transition disabled:opacity-60"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Tên gọi
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                          <UserIcon size={15} />
                        </span>
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleChange}
                          disabled={isSaving}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#0b1120] pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none transition disabled:opacity-60"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Số điện thoại liên hệ
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                          <Phone size={15} />
                        </span>
                        <input
                          type="text"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          disabled={isSaving}
                          placeholder="Nhập số điện thoại..."
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#0b1120] pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none transition disabled:opacity-60"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Địa chỉ Email (Định danh)
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                          <Mail size={15} />
                        </span>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          disabled
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/70 pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-75"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Trình độ hiện tại (Theo lớp học)
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-blue-600">
                          <Award size={15} />
                        </span>
                        <input
                          type="text"
                          value={
                            firstCourse?.level
                              ? `Cấp độ ${firstCourse.level}`
                              : "Chưa cấu hình theo lớp"
                          }
                          disabled
                          className="w-full rounded-xl border border-blue-200/70 dark:border-blue-600/30 bg-blue-50/50 dark:bg-slate-900/20 pl-10 pr-3.5 py-2.5 text-xs font-bold text-blue-800 dark:text-blue-300 cursor-not-allowed"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Mục tiêu đầu ra (Target CEFR)
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-emerald-500">
                          <Target size={15} />
                        </span>
                        <input
                          type="text"
                          name="targetCefr"
                          value={formData.targetCefr}
                          onChange={handleChange}
                          disabled={isSaving}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#0b1120] pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none transition disabled:opacity-60"
                        />
                      </div>
                    </div>
                  </div>
                </form>
              </div>

              {/* Footer Action Bar */}
              <div className="px-6 sm:px-8 py-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0d1322]/60 flex items-center justify-between gap-4">
                {saveSuccess ? (
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 animate-in fade-in duration-200">
                    <CheckCircle2 size={15} /> Đã cập nhật thông tin thành công!
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    Nhấn Lưu thay đổi sau khi chỉnh sửa hồ sơ
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 px-6 py-2.5 text-xs font-semibold text-white shadow-sm transition cursor-pointer disabled:opacity-60 disabled:pointer-events-none"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Save size={15} />
                      <span>Lưu thay đổi</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: BIỂU ĐỒ RADAR 6 KỸ NĂNG CHUẨN XÁC */}
          {activeTab === "skills" && (
            <div className="p-6 sm:p-8 space-y-6">
              {/* Header Tab Năng Lực & Nút Làm Mới */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      Biểu Đồ Năng Lực 6 Kỹ Năng
                    </h3>
                    <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-slate-900/60 px-2.5 py-0.5 text-[10px] font-bold text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                      Chuẩn CEFR &amp; AI
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Đồng bộ điểm tích lũy từ kết quả bài tập &amp; hệ thống chấm AI
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRefreshSkills}
                    disabled={isRefreshingSkills}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw
                      size={13}
                      className={
                        isRefreshingSkills ? "animate-spin text-blue-700" : ""
                      }
                    />
                    <span>
                      {isRefreshingSkills ? "Đang đồng bộ..." : "Đồng bộ lại"}
                    </span>
                  </button>
                </div>
              </div>

              {/* 3 Thẻ Tóm Tắt Năng Lực */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-4">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Tổng điểm tích lũy
                  </span>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-blue-700 dark:text-blue-400">
                      {totalSkillScore.toFixed(1)}
                    </span>
                    <span className="text-xs text-slate-400 font-bold">pts</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-4">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Kỹ năng dẫn đầu
                  </span>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {strongestSkill && (
                      <>
                        <strongestSkill.icon
                          size={16}
                          className={strongestSkill.color}
                        />
                        <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                          {strongestSkill.name}
                        </span>
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                          ({strongestSkill.value.toFixed(1)} pts)
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-4">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Độ cân bằng năng lực
                  </span>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {isImbalanced ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                        <AlertTriangle size={14} /> Lệch kỹ năng đáng kể
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={14} /> Phát triển hài hòa
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Phần đồ thị Radar và Danh sách tiến trình */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                {/* SVG Radar Polygon */}
                <div className="flex justify-center py-2">
                  <svg
                    width={chartSize}
                    height={chartSize}
                    className="overflow-visible"
                  >
                    {/* Concentric Web Polygons */}
                    {[0.25, 0.5, 0.75, 1].map((scale, i) => (
                      <polygon
                        key={i}
                        points={skillsList
                          .map((_, index) => {
                            const angle =
                              ((Math.PI * 2) / totalAxes) * index - Math.PI / 2;
                            return `${center + radius * scale * Math.cos(angle)},${
                              center + radius * scale * Math.sin(angle)
                            }`;
                          })
                          .join(" ")}
                        fill="none"
                        stroke="currentColor"
                        className="text-slate-200 dark:text-slate-800"
                        strokeWidth="1"
                        strokeDasharray={scale < 1 ? "2 2" : undefined}
                      />
                    ))}

                    {/* Radial Axes & Axis Labels */}
                    {radarCoords.map((coord, index) => (
                      <g key={index}>
                        <line
                          x1={center}
                          y1={center}
                          x2={coord.axisX}
                          y2={coord.axisY}
                          stroke="currentColor"
                          className="text-slate-300 dark:text-slate-700"
                          strokeWidth="1"
                        />
                        <text
                          x={coord.labelX}
                          y={coord.labelY}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="text-[10px] font-bold fill-slate-600 dark:fill-slate-300 uppercase tracking-wider"
                        >
                          {coord.label}
                        </text>
                      </g>
                    ))}

                    {/* Filled Radar Area */}
                    <polygon
                      points={radarPoints}
                      fill="rgba(99, 102, 241, 0.28)"
                      stroke="#6366f1"
                      strokeWidth="2.5"
                      className="transition-all duration-500 ease-out"
                    />

                    {/* Data Points / Circle markers */}
                    {radarCoords.map((coord, index) => (
                      <circle
                        key={index}
                        cx={coord.x}
                        cy={coord.y}
                        r={coord.value > 0 ? 4.5 : 3}
                        className="fill-blue-600 dark:fill-blue-400 stroke-white dark:stroke-[#111827] stroke-2"
                      />
                    ))}
                  </svg>
                </div>

                {/* Progress Bars for 6 Skills */}
                <div className="space-y-3.5">
                  {skillsList.map((s) => {
                    const IconComp = s.icon;
                    const pct = Math.min((s.value / maxAxisVal) * 100, 100);
                    return (
                      <div key={s.label}>
                        <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                          <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                            <IconComp size={14} className={s.color} />
                            <span>{s.name}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({s.label})
                            </span>
                          </span>
                          <span className="text-slate-900 dark:text-white font-extrabold">
                            {s.value.toFixed(1)}{" "}
                            <span className="text-[10px] text-slate-400 font-normal">
                              pts
                            </span>
                          </span>
                        </div>
                        <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${s.barColor} transition-all duration-500 rounded-full`}
                            style={{
                              width: `${Math.max(pct, s.value > 0 ? 5 : 0)}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Lộ Trình AI Đề Xuất Tối Ưu Thông Minh */}
              <div className="rounded-xl border border-blue-200/80 dark:border-blue-900/40 bg-white dark:bg-surface-card p-5 space-y-3.5 shadow-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs text-blue-950 dark:text-blue-200">
                    <Compass
                      size={18}
                      className="text-blue-700 dark:text-blue-400"
                    />
                    <span className="text-sm font-extrabold">
                      Lộ Trình AI Đề Xuất Tối Ưu
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">
                    <Sparkles size={11} /> AI Adaptive Advisor
                  </span>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {profile?.aiRecommendedPath &&
                  !profile.aiRecommendedPath.includes("Đọc và Từ vựng")
                    ? profile.aiRecommendedPath
                    : isImbalanced
                    ? `Bạn đang có thế mạnh vượt trội ở kỹ năng ${
                        strongestSkill.name
                      } (${strongestSkill.value.toFixed(
                        1,
                      )} pts). Tuy nhiên, các kỹ năng nền tảng như Từ vựng (${skillsList
                        .find((s) => s.label === "Vocabulary")
                        ?.value.toFixed(1)} pts), Nghe (${skillsList
                        .find((s) => s.label === "Listening")
                        ?.value.toFixed(1)} pts) và Ngữ pháp (${skillsList
                        .find((s) => s.label === "Grammar")
                        ?.value.toFixed(
                          1,
                        )} pts) đang ở mức sơ khai, tạo ra sự chênh lệch lớn trong biểu đồ năng lực. Nếu thiếu vốn từ vựng và khả năng nghe hiểu, kỹ năng Nói sẽ sớm chạm trần và khó phản xạ tự nhiên trong giao tiếp thực tế.`
                    : `Hồ sơ năng lực của bạn đang phát triển tốt ở kỹ năng ${
                        strongestSkill.name
                      } (${strongestSkill.value.toFixed(
                        1,
                      )} pts). Hãy tiếp tục hoàn thành các bài tập hàng ngày để kéo đều các kỹ năng còn lại lên mức tương đương.`}
                </p>

                {/* 3 Hành Động Đề Xuất Khắc Phục */}
                <div className="pt-2 border-t border-blue-100 dark:border-blue-900/40 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs space-y-1">
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
                      Ưu tiên 1 • Cấp bách
                    </span>
                    <p className="font-bold text-slate-900 dark:text-white text-xs">
                      Luyện 20-30 Từ vựng / Ngày
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Tăng tốc vốn từ vựng Spaced Repetition để bổ trợ ngữ âm &amp;
                      đọc hiểu.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs space-y-1">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                      Ưu tiên 2 • Bổ trợ
                    </span>
                    <p className="font-bold text-slate-900 dark:text-white text-xs">
                      Luyện Nghe &amp; Shadowing
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Tạo đòn bẩy phản xạ nghe để củng cố kỹ năng Nói đang vượt
                      trội.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs space-y-1">
                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">
                      Ưu tiên 3 • Bứt phá
                    </span>
                    <p className="font-bold text-slate-900 dark:text-white text-xs">
                      Ngữ pháp &amp; Viết câu B1+
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Củng cố cấu trúc câu hoàn chỉnh để nâng dải điểm tổng thể.
                    </p>
                  </div>
                </div>

                {/* Nút điều hướng bài tập */}
                {firstCourse?.classId && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/student/courses/${firstCourse.classId}/daily-plan`,
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-800 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-800 transition cursor-pointer"
                    >
                      <span>Đến Lộ Trình Luyện Tập Hàng Ngày</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: LỊCH HỌC */}
          {activeTab === "courses" && (
            <div className="p-6 sm:p-8 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Lớp Học Đang Tham Gia
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Danh sách các khóa học bạn đã được ghi danh chính thức
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 dark:bg-blue-600/15 px-3 py-1 text-xs font-bold text-blue-700 dark:text-blue-400">
                  {courses.length} khóa học
                </span>
              </div>

              {courses.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
                  <Calendar
                    size={32}
                    className="mx-auto mb-2 text-slate-400 opacity-50"
                  />
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Bạn chưa được ghi danh vào lớp học nào.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {courses.map((c) => (
                    <div
                      key={c.classId}
                      className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-[#162033] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-blue-300 dark:hover:border-blue-600/40 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-600/20 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-600/30">
                            {c.level}
                          </span>
                          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-200/70 dark:border-emerald-500/30">
                            {c.status}
                          </span>
                        </div>
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white pt-1">
                          {c.className}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Giảng viên phụ trách:{" "}
                          <strong className="text-slate-700 dark:text-slate-200">
                            {c.teacherName}
                          </strong>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/student/courses/${c.classId}/daily-plan`)
                        }
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-800 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-800 transition cursor-pointer shrink-0"
                      >
                        <span>Vào Lộ Trình Ngày</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MẬT KHẨU & BẢO MẬT */}
          {activeTab === "security" && (
            <div className="p-6 sm:p-8 space-y-5 max-w-lg">
              <div className="border-b border-slate-200/80 dark:border-slate-800 pb-4">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Lock size={18} className="text-rose-600 dark:text-rose-400" />
                  <span>Đổi Mật Khẩu &amp; Bảo Mật Tài Khoản</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Sử dụng mật khẩu mạnh tối thiểu 8 ký tự để bảo vệ tài khoản học
                  tập
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Mật khẩu hiện tại
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#0b1120] px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Mật khẩu mới
                  </label>
                  <input
                    type="password"
                    placeholder="Tối thiểu 8 ký tự..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#0b1120] px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Xác nhận mật khẩu mới
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#0b1120] px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => alert("Đã cập nhật mật khẩu thành công!")}
                    className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition cursor-pointer"
                  >
                    <ShieldCheck size={15} />
                    <span>Cập nhật mật khẩu</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: THÔNG BÁO */}
          {activeTab === "notifications" && (
            <div className="p-6 sm:p-8 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <Bell
                    size={18}
                    className="text-blue-700 dark:text-blue-400"
                  />
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                    Thông Báo Đã Nhận
                  </h3>
                  {unreadNotificationsCount > 0 && (
                    <span className="ml-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                      {unreadNotificationsCount} chưa đọc
                    </span>
                  )}
                </div>
                {notifications.some((n) => !n.isRead) && (
                  <button
                    type="button"
                    onClick={handleMarkAllNotificationsRead}
                    className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition cursor-pointer"
                  >
                    <Check size={14} />
                    Đánh dấu tất cả đã đọc
                  </button>
                )}
              </div>

              {notificationsLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500 gap-2">
                  <Loader2 size={24} className="animate-spin text-blue-700" />
                  <p className="text-xs">Đang tải thông báo...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  <Bell size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-medium">
                    Bạn chưa có thông báo nào từ hệ thống hoặc giảng viên.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
                  {notifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() =>
                        handleMarkNotificationRead(item.id, item.targetUrl)
                      }
                      className={`group relative flex items-start gap-3.5 rounded-xl border p-4 transition-all cursor-pointer ${
                        item.isRead
                          ? "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800/40 opacity-85"
                          : "border-blue-200/80 dark:border-blue-900/50 bg-blue-50/50 dark:bg-slate-900/25 hover:bg-blue-50/80 dark:hover:bg-slate-900/40 shadow-2xs"
                      }`}
                    >
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400">
                        <Bell size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase ${
                                item.classroomId
                                  ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400"
                                  : "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400"
                              }`}
                            >
                              {item.classroomId ? "[Lớp học]" : "[Hệ thống]"}
                            </span>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {item.title}
                            </h4>
                          </div>
                          {item.createdAt && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                              {new Date(item.createdAt).toLocaleString(
                                "vi-VN",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                },
                              )}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words">
                          {item.message ||
                            item.content ||
                            "Không có nội dung chi tiết"}
                        </p>
                        {item.targetUrl && (
                          <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-400">
                            <span>Chi tiết liên kết</span>
                            <ExternalLink size={12} />
                          </div>
                        )}
                      </div>
                      {!item.isRead && (
                        <div className="shrink-0 flex items-center self-center pl-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full bg-blue-800 dark:bg-blue-400"
                            title="Chưa đọc"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
