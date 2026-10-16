import { useEffect, useState } from "react";
import type { FormEvent, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { studentApi } from "@/features/student/api/studentApi";
import type {
  StudentSkillProfile,
  MyCourseResponse,
} from "@/features/student/types";
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

  // Form State
  const [formData, setFormData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
    phone: user?.phone || "",
    currentLevel: user?.currentLevel || "A2",
    targetCefr: user?.targetCefr || "B2 (IELTS 6.0+)",
  });

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
      });

      if (accessToken) {
        setAuth(accessToken, updatedUser);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      alert("Không thể lưu thông tin, vui lòng kiểm tra lại!");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (user && accessToken) {
          setAuth(accessToken, { ...user, avatarUrl: base64String });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const firstCourse = courses[0];
  const displayName =
    `${user?.lastName || ""} ${user?.firstName || ""}`.trim() || "Học viên";
  const displayPhone = user?.phone || "Chưa cập nhật SĐT";

  // 6 Kỹ năng cho Tab Radar
  const skills = [
    { label: "Listening", value: profile?.listeningScore || 0 },
    { label: "Speaking", value: profile?.speakingScore || 0 },
    { label: "Reading", value: profile?.readingScore || 0 },
    { label: "Writing", value: profile?.writingScore || 0 },
    { label: "Grammar", value: profile?.grammarScore || 0 },
    { label: "Vocabulary", value: profile?.vocabularyScore || 0 },
  ];

  const chartSize = 260;
  const center = chartSize / 2;
  const radius = 90;
  const totalAxes = skills.length;
  const radarPoints = skills
    .map((skill, index) => {
      const angle = ((Math.PI * 2) / totalAxes) * index - Math.PI / 2;
      const r = (Math.min(skill.value * 2, 100) / 100) * radius;
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
    })
    .join(" ");

  if (loading) {
    return (
      <div className="p-12 text-center text-sm font-semibold text-slate-500">
        Đang nạp hồ sơ học viên...
      </div>
    );
  }

  return (
    <div className="max-w-[1350px] mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[750px]">
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[750px]">
        {/* ================= CỘT TRÁI: THÔNG TIN TỔNG QUAN, 6 NÚT TABS & ẢNH CHÂN DUNG ================= */}
        <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-slate-200 p-6 flex flex-col justify-between bg-slate-50/40">
          <div>
            <div className="text-center space-y-1 mb-6">
              <h1 className="text-base font-bold text-slate-800 tracking-tight">
                Trang cá nhân:{" "}
                <span className="text-indigo-900">{displayName}</span> (
                {displayPhone})
              </h1>
              <p className="text-xs font-semibold text-slate-500">
                {displayPhone}
              </p>
              <div className="text-xs text-slate-600 italic pt-0.5">
                <span className="font-bold not-italic text-slate-700">
                  Khóa:
                </span>{" "}
                {firstCourse?.className || "Chưa tham gia"}{" "}
                <span className="font-bold not-italic text-slate-700 ml-3">
                  Lớp:
                </span>{" "}
                {firstCourse?.level || ""}
              </div>
            </div>

            {/* 6 Nút Menu chức năng */}
            <div className="grid grid-cols-3 gap-2.5 mb-6">
              {[
                {
                  id: "notifications",
                  label: "Thông báo",
                  icon: Bell,
                  color: "text-sky-600",
                },
                {
                  id: "info",
                  label: "Thông tin",
                  icon: Info,
                  color: "text-blue-600",
                },
                {
                  id: "security",
                  label: "Mật khẩu & bảo mật",
                  icon: ShieldCheck,
                  color: "text-rose-600",
                },
                {
                  id: "courses",
                  label: "Lịch học",
                  icon: Calendar,
                  color: "text-indigo-600",
                },
                {
                  id: "skills",
                  label: "Năng lực (Radar)",
                  icon: Sparkles,
                  color: "text-amber-500",
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
                        ? "border-indigo-600 bg-white shadow-sm ring-2 ring-indigo-500/20"
                        : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <IconComponent
                      size={20}
                      className={`mb-1.5 ${item.color}`}
                    />
                    <span
                      className={`text-[11px] font-bold leading-tight ${isActive ? "text-indigo-900" : "text-slate-700"}`}
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
            <div className="relative w-full max-w-[280px] aspect-[3/4] rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-200 shadow-md group">
              {user?.avatarUrl && !avatarError ? (
                <img
                  src={user.avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400">
                  <UserIcon size={64} className="opacity-40 mb-2" />
                  <span className="text-xs font-semibold">Chưa có ảnh thẻ</span>
                </div>
              )}

              {/* Lớp phủ đổi ảnh đại diện */}
              <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer backdrop-blur-[2px]">
                <Camera size={26} className="mb-1" />
                <span className="text-xs font-semibold">Tải ảnh đại diện</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </label>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 font-medium">
              Ảnh hồ sơ học viên chính thức
            </p>
          </div>
        </div>

        {/* ================= CỘT PHẢI: CHI TIẾT TỪNG TAB ================= */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          {/* TAB 1: FORM THÔNG TIN CÁ NHÂN */}
          {activeTab === "info" && (
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 px-8 py-3.5 border-b border-slate-200 bg-slate-50/60 text-sky-700 text-xs font-bold">
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

          {/* TAB 2: BIỂU ĐỒ RADAR 6 KỸ NĂNG */}
          {activeTab === "skills" && (
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-sm font-bold text-slate-800">
                  Biểu Đồ Năng Lực 6 Kỹ NĂNG
                </h3>
                <span className="text-xs text-slate-400">
                  Đồng bộ từ bài tập &amp; nộp bài
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="flex justify-center">
                  <svg
                    width={chartSize}
                    height={chartSize}
                    className="overflow-visible"
                  >
                    {[0.25, 0.5, 0.75, 1].map((scale, i) => (
                      <polygon
                        key={i}
                        points={skills
                          .map((_, index) => {
                            const angle =
                              ((Math.PI * 2) / totalAxes) * index - Math.PI / 2;
                            return `${center + radius * scale * Math.cos(angle)},${center + radius * scale * Math.sin(angle)}`;
                          })
                          .join(" ")}
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth="1"
                      />
                    ))}
                    {skills.map((skill, index) => {
                      const angle =
                        ((Math.PI * 2) / totalAxes) * index - Math.PI / 2;
                      const x = center + radius * Math.cos(angle);
                      const y = center + radius * Math.sin(angle);
                      const labelX = center + (radius + 18) * Math.cos(angle);
                      const labelY = center + (radius + 12) * Math.sin(angle);
                      return (
                        <g key={index}>
                          <line
                            x1={center}
                            y1={center}
                            x2={x}
                            y2={y}
                            stroke="#cbd5e1"
                            strokeWidth="1"
                          />
                          <text
                            x={labelX}
                            y={labelY}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="text-[10px] font-bold fill-slate-600 uppercase"
                          >
                            {skill.label}
                          </text>
                        </g>
                      );
                    })}
                    <polygon
                      points={radarPoints}
                      fill="rgba(99, 102, 241, 0.25)"
                      stroke="#4f46e5"
                      strokeWidth="2"
                    />
                  </svg>
                </div>

                <div className="space-y-3">
                  {skills.map((s) => (
                    <div key={s.label}>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-slate-700">{s.label}</span>
                        <span className="text-indigo-600 font-bold">
                          {s.value.toFixed(1)} pts
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 transition-all duration-300"
                          style={{ width: `${Math.min(s.value * 2, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs text-indigo-900">
                  <Compass size={16} className="text-indigo-600" />
                  <span>Lộ Trình AI Đề Xuất Tối Ưu</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {profile?.aiRecommendedPath ||
                    "Bạn đang làm tốt ở kỹ năng Đọc và Từ vựng. Hãy tăng cường luyện tập các bài kiểm tra Speaking để AI chấm sửa phát âm và nâng dải điểm tổng thể."}
                </p>
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
            <div className="p-8 space-y-3">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-3">
                Thông Báo Đã Nhận
              </h3>
              <div className="space-y-2">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                  <p className="font-bold text-slate-800">
                    Chào mừng bạn gia nhập nền tảng học tiếng Anh
                  </p>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Bắt đầu học lộ trình và ôn tập Flashcard mỗi ngày.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
