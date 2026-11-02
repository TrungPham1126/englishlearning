import { useEffect, useState } from "react";
import type { FormEvent, ChangeEvent } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { studentApi } from "@/features/student/api/studentApi";
import type {
  StudentSkillProfile,
  MyCourseResponse,
} from "@/features/student/types";
import { axiosClient } from "@/lib/axiosClient";
import { Loader2 } from "lucide-react";
import {
  ProfileHeaderCard,
  ProfileEditForm,
  SkillCompetencyCard,
  PasswordChangeForm,
  ProfileCoursesTab,
  ProfileNotificationsTab,
} from "@/features/student/components/profile";

export default function StudentProfilePage() {
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
    setNotificationsLoading(true);
    try {
      const res = await axiosClient.get("/api/v1/notifications");
      let rawList: any[] = [];
      if (Array.isArray(res.data)) {
        rawList = res.data;
      } else if (res.data?.data && Array.isArray(res.data.data)) {
        rawList = res.data.data;
      } else if (res.data?.content && Array.isArray(res.data.content)) {
        rawList = res.data.content;
      }
      const dedupMap = new Map();
      for (const item of rawList) {
        if (!dedupMap.has(item.id)) {
          dedupMap.set(item.id, item);
        }
      }
      setNotifications(Array.from(dedupMap.values()));
    } catch (err) {
      console.error("Lỗi khi tải thông báo:", err);
    } finally {
      setNotificationsLoading(false);
    }
  };

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
        window.location.href = targetUrl;
      }
    }
  };

  useEffect(() => {
    setAvatarError(false);
  }, [user?.avatarUrl]);

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
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch {
      alert("Lỗi khi lưu thông tin hồ sơ.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn file hình ảnh (JPG, PNG, WEBP)!");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Kích thước file không được vượt quá 5MB!");
      return;
    }

    setIsUploadingAvatar(true);
    setAvatarError(false);
    try {
      const uploadRes = await studentApi.uploadAvatar(file);
      const newAvatarUrl = uploadRes.avatarUrl;

      if (user && accessToken) {
        setAuth(accessToken, {
          ...user,
          avatarUrl: newAvatarUrl,
        });
      }
      alert("Cập nhật ảnh đại diện thành công!");
    } catch {
      alert("Lỗi tải lên ảnh đại diện.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

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
      <div className="flex h-96 flex-col items-center justify-center space-y-3">
        <Loader2 className="animate-spin text-blue-700" size={36} />
        <p className="text-xs font-semibold text-slate-500">
          Đang tải thông tin hồ sơ học viên...
        </p>
      </div>
    );
  }

  const displayName =
    `${formData.lastName} ${formData.firstName}`.trim() ||
    user?.email ||
    "Học viên";
  const displayPhone = formData.phone || "Chưa cập nhật";
  const firstCourse = courses[0];
  const totalSkillScore =
    (profile?.listeningScore || 0) +
    (profile?.readingScore || 0) +
    (profile?.writingScore || 0) +
    (profile?.grammarScore || 0) +
    (profile?.vocabularyScore || 0) +
    (profile?.pronunciationScore || 0) +
    (profile?.fluencyScore || 0);
  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-in fade-in duration-200">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 space-y-6">
          <ProfileHeaderCard
            displayName={displayName}
            displayPhone={displayPhone}
            firstCourse={firstCourse}
            currentLevel={formData.currentLevel}
            totalSkillScore={totalSkillScore}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            unreadNotificationsCount={unreadNotificationsCount}
            avatarUrl={user?.avatarUrl}
            avatarError={avatarError}
            setAvatarError={setAvatarError}
            isUploadingAvatar={isUploadingAvatar}
            onAvatarChange={handleAvatarChange}
          />
        </div>

        <div className="lg:col-span-8 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111827] shadow-sm overflow-hidden min-h-[620px] flex flex-col justify-between">
          {activeTab === "info" && (
            <ProfileEditForm
              formData={formData}
              firstCourse={firstCourse}
              isSaving={isSaving}
              saveSuccess={saveSuccess}
              onChange={handleChange}
              onSave={handleSaveProfile}
            />
          )}

          {activeTab === "skills" && (
            <SkillCompetencyCard
              profile={profile}
              firstCourse={firstCourse}
              isRefreshingSkills={isRefreshingSkills}
              onRefreshSkills={handleRefreshSkills}
            />
          )}

          {activeTab === "courses" && <ProfileCoursesTab courses={courses} />}

          {activeTab === "security" && <PasswordChangeForm />}

          {activeTab === "notifications" && (
            <ProfileNotificationsTab
              notifications={notifications}
              notificationsLoading={notificationsLoading}
              unreadNotificationsCount={unreadNotificationsCount}
              onMarkAllRead={handleMarkAllNotificationsRead}
              onMarkRead={handleMarkNotificationRead}
            />
          )}
        </div>
      </div>
    </div>
  );
}
