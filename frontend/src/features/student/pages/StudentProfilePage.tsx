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
  TrendingUp,
  AlertTriangle,
  BookOpen,
  Headphones,
  Mic,
  RefreshCw,
  Target,
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
      const res: any = await axiosClient.get("/api/v1/notifications?page=0&size=30");
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
          if ((!existing.isRead && item.isRead) || (!existing.recipientUserId && item.recipientUserId)) {
            dedupMap.set(key, { ...item, isRead: Boolean(existing.isRead || item.isRead) });
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
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
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
    { label: "Listening", name: "Nghe", value: profile?.listeningScore || 0, icon: Headphones, color: "text-sky-500", barColor: "bg-sky-500" },
    { label: "Speaking", name: "Nói", value: profile?.speakingScore || 0, icon: Mic, color: "text-indigo-600", barColor: "bg-indigo-600" },
    { label: "Reading", name: "Đọc", value: profile?.readingScore || 0, icon: BookOpen, color: "text-emerald-500", barColor: "bg-emerald-500" },
    { label: "Writing", name: "Viết", value: profile?.writingScore || 0, icon: Award, color: "text-purple-500", barColor: "bg-purple-500" },
    { label: "Grammar", name: "Ngữ pháp", value: profile?.grammarScore || 0, icon: ShieldCheck, color: "text-amber-500", barColor: "bg-amber-500" },
    { label: "Vocabulary", name: "Từ vựng", value: profile?.vocabularyScore || 0, icon: Sparkles, color: "text-rose-500", barColor: "bg-rose-500" },
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


  if (loading) {
    return (
      <div className="p-12 text-center text-sm font-semibold text-slate-500">
        Đang nạp hồ sơ học viên...
      </div>
    );
  }

  return (
    <div className="max-w-[1350px] mx-auto bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[750px]">
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[750px]">
        {/* ================= CỘT TRÁI: THÔNG TIN TỔNG QUAN, 6 NÚT TABS & ẢNH CHÂN DUNG ================= */}
        <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between bg-white dark:bg-[#111827]">
          <div>
            <div className="text-center space-y-1 mb-6">
              <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Trang cá nhân:{" "}
                <span className="text-indigo-600 dark:text-indigo-400">{displayName}</span> (
                {displayPhone})
              </h1>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {displayPhone}
              </p>
              <div className="text-xs text-slate-600 dark:text-slate-400 italic pt-0.5">
                <span className="font-bold not-italic text-slate-800 dark:text-slate-200">
                  Khóa:
                </span>{" "}
                {firstCourse?.className || "Chưa tham gia"}{" "}
                <span className="font-bold not-italic text-slate-800 dark:text-slate-200 ml-3">
                  Lớp:
                </span>{" "}
                {firstCourse?.level || ""}
              </div>
            </div>

            {/* 5 Nút Menu chức năng */}
            <div className="grid grid-cols-3 gap-2.5 mb-6">
              {[
                {
                  id: "notifications",
                  label: "Thông báo",
                  icon: Bell,
                  color: "text-sky-600 dark:text-sky-400",
                },
                {
                  id: "info",
                  label: "Thông tin",
                  icon: Info,
                  color: "text-blue-600 dark:text-blue-400",
                },
                {
                  id: "security",
                  label: "Mật khẩu & bảo mật",
                  icon: ShieldCheck,
                  color: "text-rose-600 dark:text-rose-400",
                },
                {
                  id: "courses",
                  label: "Lịch học",
                  icon: Calendar,
                  color: "text-indigo-600 dark:text-indigo-400",
                },
                {
                  id: "skills",
                  label: "Năng lực (Radar)",
                  icon: Sparkles,
                  color: "text-amber-500 dark:text-amber-400",
                },
              ].map((item) => {
                const IconComponent = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id as any)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      isActive
                        ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-[#1e293b] shadow-sm ring-2 ring-indigo-500/20"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-[#162033] hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <IconComponent
                      size={20}
                      className={`mb-1.5 ${item.color}`}
                    />
                    <span
                      className={`text-[11px] font-bold leading-tight ${
                        isActive
                          ? "text-indigo-700 dark:text-indigo-300"
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

          {/* Khung ảnh chân dung với Base64 & onError Fallback */}
          <div className="flex flex-col items-center">
            <div className="relative w-full max-w-[280px] aspect-[3/4] rounded-2xl overflow-hidden bg-slate-50 dark:bg-[#0b1120] border-2 border-slate-300 dark:border-slate-700 text-slate-400 shadow-md group">
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
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white z-10 backdrop-blur-sm">
                  <Loader2 size={32} className="animate-spin text-indigo-400 mb-2" />
                  <span className="text-xs font-bold">Đang tải ảnh lên...</span>
                </div>
              )}

              {/* Lớp phủ đổi ảnh đại diện */}
              {!isUploadingAvatar && (
                <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer backdrop-blur-[2px]">
                  <Camera size={28} className="mb-1 text-indigo-300" />
                  <span className="text-xs font-bold">Đổi ảnh đại diện</span>
                  <span className="text-[10px] text-slate-300 mt-0.5">JPG, PNG, WEBP (tối đa 5MB)</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </label>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-2 font-medium">
              Ảnh hồ sơ học viên chính thức (Nhấp để đổi)
            </p>
          </div>

        </div>

        {/* ================= CỘT PHẢI: CHI TIẾT TỪNG TAB ================= */}
        <div className="lg:col-span-7 flex flex-col justify-between bg-white dark:bg-[#111827]">
          {/* TAB 1: FORM THÔNG TIN CÁ NHÂN */}
          {activeTab === "info" && (
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 px-8 py-3.5 bg-slate-50 dark:bg-[#162033] border-b border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                  <Info size={16} />
                  <span>Thông tin</span>
                </div>

                <form
                  onSubmit={handleSaveProfile}
                  className="p-8 space-y-4 max-w-xl"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Họ
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tên
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Số điện thoại
                    </label>
                    <input
                      type="text"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      disabled
                      className="w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-500 cursor-not-allowed"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Trình độ hiện tại (Theo lớp học)
                      </label>
                      <input
                        type="text"
                        value={
                          firstCourse?.level
                            ? `Cấp độ ${firstCourse.level}`
                            : "Chưa cấu hình theo lớp"
                        }
                        disabled
                        className="w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold text-indigo-700 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Mục tiêu đầu ra
                      </label>
                      <input
                        type="text"
                        name="targetCefr"
                        value={formData.targetCefr}
                        onChange={handleChange}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </form>
              </div>

              {/* Nút "Lưu lại" màu xanh lá */}
              <div className="p-8 border-t border-slate-100 flex items-center justify-between">
                {saveSuccess ? (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                    <CheckCircle2 size={16} /> Đã cập nhật thành công!
                  </span>
                ) : (
                  <span />
                )}

                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-700 px-6 py-2.5 text-xs font-bold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save size={15} />
                  <span>{isSaving ? "Đang lưu..." : "Lưu lại"}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: BIỂU ĐỒ RADAR 6 KỸ NĂNG CHUẨN XÁC */}
          {activeTab === "skills" && (
            <div className="p-8 space-y-6">
              {/* Header Tab Năng Lực & Nút Làm Mới */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                      Biểu Đồ Năng Lực 6 Kỹ Năng
                    </h3>
                    <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      Chuẩn CEFR &amp; AI
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Đồng bộ điểm tích lũy từ kết quả bài tập &amp; hệ thống chấm AI
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRefreshSkills}
                    disabled={isRefreshingSkills}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw
                      size={13}
                      className={isRefreshingSkills ? "animate-spin text-indigo-600" : ""}
                    />
                    <span>{isRefreshingSkills ? "Đang đồng bộ..." : "Đồng bộ lại"}</span>
                  </button>
                </div>
              </div>

              {/* 3 Thẻ Tóm Tắt Năng Lực */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-3.5">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Tổng điểm tích lũy
                  </span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                      {totalSkillScore.toFixed(1)}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">pts</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-3.5">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Kỹ năng dẫn đầu
                  </span>
                  <div className="mt-1 flex items-center gap-1.5">
                    {strongestSkill && (
                      <>
                        <strongestSkill.icon size={16} className={strongestSkill.color} />
                        <span className="text-sm font-bold text-slate-800 dark:text-white">
                          {strongestSkill.name}
                        </span>
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          ({strongestSkill.value.toFixed(1)} pts)
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-3.5">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Độ cân bằng năng lực
                  </span>
                  <div className="mt-1 flex items-center gap-1.5">
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
                            return `${center + radius * scale * Math.cos(angle)},${center + radius * scale * Math.sin(angle)}`;
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
                    {radarCoords.map((coord, index) => {
                      return (
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
                      );
                    })}

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
                        className="fill-indigo-600 dark:fill-indigo-400 stroke-white dark:stroke-[#111827] stroke-2"
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
                        <div className="flex items-center justify-between text-xs font-semibold mb-1">
                          <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                            <IconComp size={14} className={s.color} />
                            <span>{s.name}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({s.label})
                            </span>
                          </span>
                          <span className="text-slate-800 dark:text-white font-bold">
                            {s.value.toFixed(1)}{" "}
                            <span className="text-[10px] text-slate-400 font-normal">pts</span>
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${s.barColor} transition-all duration-500 rounded-full`}
                            style={{ width: `${Math.max(pct, s.value > 0 ? 5 : 0)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Lộ Trình AI Đề Xuất Tối Ưu Thông Minh */}
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/70 to-white dark:from-indigo-950/40 dark:to-slate-900/60 p-5 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs text-indigo-950 dark:text-indigo-200">
                    <Compass size={17} className="text-indigo-600 dark:text-indigo-400" />
                    <span className="text-sm">Lộ Trình AI Đề Xuất Tối Ưu</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                    <Sparkles size={11} /> AI Adaptive Advisor
                  </span>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {profile?.aiRecommendedPath && !profile.aiRecommendedPath.includes("Đọc và Từ vựng")
                    ? profile.aiRecommendedPath
                    : isImbalanced
                    ? `Bạn đang có thế mạnh vượt trội ở kỹ năng ${strongestSkill.name} (${strongestSkill.value.toFixed(1)} pts). Tuy nhiên, các kỹ năng nền tảng như Từ vựng (${skillsList.find(s => s.label === "Vocabulary")?.value.toFixed(1)} pts), Nghe (${skillsList.find(s => s.label === "Listening")?.value.toFixed(1)} pts) và Ngữ pháp (${skillsList.find(s => s.label === "Grammar")?.value.toFixed(1)} pts) đang ở mức sơ khai, tạo ra sự chênh lệch lớn trong biểu đồ năng lực. Nếu thiếu vốn từ vựng và khả năng nghe hiểu, kỹ năng Nói sẽ sớm chạm trần và khó phản xạ tự nhiên trong giao tiếp thực tế.`
                    : `Hồ sơ năng lực của bạn đang phát triển tốt ở kỹ năng ${strongestSkill.name} (${strongestSkill.value.toFixed(1)} pts). Hãy tiếp tục hoàn thành các bài tập hàng ngày để kéo đều các kỹ năng còn lại lên mức tương đương.`}
                </p>

                {/* 3 Hành Động Đề Xuất Khắc Phục */}
                <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/40 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
                      Ưu tiên 1 • Cấp bách
                    </span>
                    <p className="font-semibold text-slate-800 dark:text-white text-[11px]">
                      Ôn 20-30 Flashcards / Ngày
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Tăng tốc vốn từ vựng Spaced Repetition để bổ trợ ngữ âm &amp; đọc hiểu.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                    <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider block">
                      Ưu tiên 2 • Bổ trợ
                    </span>
                    <p className="font-semibold text-slate-800 dark:text-white text-[11px]">
                      Luyện Nghe &amp; Shadowing
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Tạo đòn bẩy phản xạ nghe để củng cố kỹ năng Nói đang vượt trội.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                      Ưu tiên 3 • Bứt phá
                    </span>
                    <p className="font-semibold text-slate-800 dark:text-white text-[11px]">
                      Ngữ pháp &amp; Viết câu B1+
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Củng cố cấu trúc câu hoàn chỉnh để nâng dải điểm tổng thể.
                    </p>
                  </div>
                </div>

                {/* Nút điều hướng bài tập */}
                {firstCourse?.classId && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => navigate(`/student/courses/${firstCourse.classId}/daily-plan`)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition cursor-pointer"
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
            <div className="p-8 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-3">
                Lớp Học Đang Tham Gia
              </h3>
              {courses.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Bạn chưa được ghi danh vào lớp học nào.
                </p>
              ) : (
                courses.map((c) => (
                  <div
                    key={c.classId}
                    className="border border-slate-200 rounded-xl p-4 flex items-center justify-between"
                  >
                    <div>
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {c.level}
                      </span>
                      <h4 className="text-sm font-bold text-slate-800 mt-1">
                        {c.className}
                      </h4>
                      <p className="text-xs text-slate-500">
                        Giảng viên: {c.teacherName}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded">
                      {c.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: MẬT KHẨU & BẢO MẬT */}
          {activeTab === "security" && (
            <div className="p-8 space-y-4 max-w-md">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-3 flex items-center gap-2">
                <Lock size={16} className="text-rose-600" /> Đổi Mật Khẩu
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mật khẩu hiện tại
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full rounded border border-slate-300 p-2 text-xs focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mật khẩu mới
                  </label>
                  <input
                    type="password"
                    placeholder="Tối thiểu 8 ký tự..."
                    className="w-full rounded border border-slate-300 p-2 text-xs focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Xác nhận mật khẩu mới
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full rounded border border-slate-300 p-2 text-xs focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => alert("Đã cập nhật mật khẩu thành công!")}
                  className="rounded bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-700 cursor-pointer"
                >
                  Cập nhật mật khẩu
                </button>
              </div>
            </div>
          )}

          {/* TAB 6: THÔNG BÁO */}
          {activeTab === "notifications" && (
            <div className="p-8 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Bell size={18} className="text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Thông Báo Đã Nhận
                  </h3>
                  {notifications.filter((n) => !n.isRead).length > 0 && (
                    <span className="ml-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                      {notifications.filter((n) => !n.isRead).length} chưa đọc
                    </span>
                  )}
                </div>
                {notifications.some((n) => !n.isRead) && (
                  <button
                    type="button"
                    onClick={handleMarkAllNotificationsRead}
                    className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition cursor-pointer"
                  >
                    <Check size={14} />
                    Đánh dấu tất cả đã đọc
                  </button>
                )}
              </div>

              {notificationsLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500 gap-2">
                  <Loader2 size={24} className="animate-spin text-indigo-600" />
                  <p className="text-xs">Đang tải thông báo...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  <Bell size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-medium">Bạn chưa có thông báo nào từ hệ thống hoặc giảng viên.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {notifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleMarkNotificationRead(item.id, item.targetUrl)}
                      className={`group relative flex items-start gap-3 rounded-xl border p-4 transition cursor-pointer ${
                        item.isRead
                          ? "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800/40 opacity-80"
                          : "border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 shadow-xs"
                      }`}
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                        <Bell size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black uppercase ${
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
                              {new Date(item.createdAt).toLocaleString("vi-VN", {
                                hour: "2-digit",
                                minute: "2-digit",
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words">
                          {item.message || item.content || "Không có nội dung chi tiết"}
                        </p>
                        {item.targetUrl && (
                          <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                            <span>Chi tiết liên kết</span>
                            <ExternalLink size={12} />
                          </div>
                        )}
                      </div>
                      {!item.isRead && (
                        <div className="shrink-0 flex items-center self-center pl-2">
                          <span
                            className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400"
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
