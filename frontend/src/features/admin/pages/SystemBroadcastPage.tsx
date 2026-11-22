// src/features/admin/pages/SystemBroadcastPage.tsx
import { useState, useEffect, useRef } from "react";
import { adminApi } from "@/features/admin/api/adminApi";
import { resolveAvatarUrl } from "@/lib/avatar";
import {
  Radio,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  History,
  RefreshCw,
  Users,
  Bell,
  ExternalLink,
  School,
  User,
  Globe,
  Search,
  X,
  Layers,
  FileText,
  GraduationCap,
} from "lucide-react";

type ScopeType = "SYSTEM" | "ROLE" | "CLASSROOM" | "INDIVIDUAL";

interface RecipientItem {
  id: string;
  fullName: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

interface ClassroomItem {
  id: string;
  name: string;
  joinCode?: string;
  teacherName?: string;
  studentCount?: number;
}

export default function SystemBroadcastPage() {
  const [scope, setScope] = useState<ScopeType>("SYSTEM");
  const [targetRole, setTargetRole] = useState("ROLE_STUDENT");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedRecipient, setSelectedRecipient] =
    useState<RecipientItem | null>(null);

  // Search recipients
  const [searchQuery, setSearchQuery] = useState("");
  const [recipientResults, setRecipientResults] = useState<RecipientItem[]>([]);
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Classroom list
  const [classrooms, setClassrooms] = useState<ClassroomItem[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);

  // Form fields
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [notificationType, setNotificationType] = useState("ANNOUNCEMENT");
  const [actionType, setActionType] = useState("TEXT_ANNOUNCEMENT");
  const [targetUrl, setTargetUrl] = useState("");

  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // History
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Initial loads
  useEffect(() => {
    loadHistory();
    loadClassrooms();
  }, []);

  // Handle click outside recipient search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search for recipients
  useEffect(() => {
    if (scope !== "INDIVIDUAL") return;
    const timer = setTimeout(() => {
      fetchRecipients(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, scope]);

  const fetchRecipients = async (q: string) => {
    try {
      setIsSearchingUser(true);
      const res = await adminApi.getNotificationRecipients(q);
      setRecipientResults(res || []);
    } catch (err) {
      console.error("Lỗi tìm kiếm người nhận:", err);
      setRecipientResults([]);
    } finally {
      setIsSearchingUser(false);
    }
  };

  const loadClassrooms = async () => {
    try {
      setIsLoadingClasses(true);
      const res = await adminApi.getNotificationClassrooms();
      setClassrooms(res || []);
      if (res && res.length > 0 && !selectedClassId) {
        setSelectedClassId(res[0].id);
      }
    } catch (err) {
      console.error("Lỗi khi tải danh sách lớp:", err);
      setClassrooms([]);
    } finally {
      setIsLoadingClasses(false);
    }
  };

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await adminApi.getBroadcastHistory(0, 20);
      const items = res?.content || (Array.isArray(res) ? res : []);
      setHistory(items);
    } catch (err) {
      console.error("Lỗi khi tải lịch sử phát thông báo:", err);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedMessage = message.trim();

    if (!trimmedTitle || !trimmedMessage) {
      setFeedback({
        type: "error",
        message: "Nhập đủ tiêu đề và nội dung.",
      });
      return;
    }

    if (scope === "CLASSROOM" && !selectedClassId) {
      setFeedback({
        type: "error",
        message: "Chưa chọn lớp học.",
      });
      return;
    }

    if (scope === "INDIVIDUAL" && !selectedRecipient) {
      setFeedback({
        type: "error",
        message: "Chưa chọn người nhận.",
      });
      return;
    }

    try {
      setIsSending(true);
      setFeedback(null);

      const resolvedUrl =
        targetUrl.trim() ||
        (scope === "CLASSROOM" ? "/student/courses" : "/student/dashboard");

      let payload: any = {
        title: trimmedTitle,
        message: trimmedMessage,
        content: trimmedMessage,
        type: notificationType,
        notificationType: notificationType,
        actionType: actionType,
        targetUrl: resolvedUrl,
        redirectUrl: resolvedUrl,
      };

      if (scope === "SYSTEM") {
        payload.targetAudience = "ALL";
      } else if (scope === "ROLE") {
        payload.targetAudience = targetRole;
      } else if (scope === "CLASSROOM") {
        payload.classroomId = selectedClassId;
      } else if (scope === "INDIVIDUAL") {
        payload.recipientUserId = selectedRecipient?.id;
      }

      await adminApi.broadcastNotification(payload);

      let successMsg = "Đã gửi thông báo.";
      if (scope === "SYSTEM") {
        successMsg = "Đã gửi toàn hệ thống.";
      } else if (scope === "ROLE") {
        const roleLabel =
          targetRole === "ROLE_STUDENT"
            ? "Học viên"
            : targetRole === "ROLE_TEACHER"
            ? "Giảng viên"
            : "Quản trị";
        successMsg = `Đã gửi đến ${roleLabel}.`;
      } else if (scope === "CLASSROOM") {
        const cls = classrooms.find((c) => c.id === selectedClassId);
        successMsg = `Đã gửi đến lớp "${cls?.name || "đã chọn"}".`;
      } else if (scope === "INDIVIDUAL") {
        successMsg = `Đã gửi đến ${selectedRecipient?.fullName} (${selectedRecipient?.email}).`;
      }

      setFeedback({
        type: "success",
        message: successMsg,
      });

      // Reset fields
      setTitle("");
      setMessage("");
      setTargetUrl("");
      if (scope === "INDIVIDUAL") {
        setSelectedRecipient(null);
        setSearchQuery("");
      }

      // Reload history
      await loadHistory();
    } catch (err: any) {
      console.error("Lỗi khi phát thông báo:", err);
      setFeedback({
        type: "error",
        message:
          err.response?.data?.message ||
          err.message ||
          "Gửi thông báo thất bại.",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800/80 bg-transparent">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Phát thông báo
        </h1>
      </div>

      {/* Main Grid: Form Phát Thông Báo (7 cols) & Lịch Sử (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white dark:bg-[#111827] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-600/10 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-600/20">
                <Send size={16} />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Soạn thông báo
              </h2>
            </div>
          </div>

          {feedback && (
            <div
              className={`p-4 rounded-xl flex items-start gap-3 text-xs md:text-sm font-semibold border ${
                feedback.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                  : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle size={18} className="shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
              )}
              <span className="leading-relaxed">{feedback.message}</span>
            </div>
          )}

          <form onSubmit={handleSendBroadcast} className="space-y-4">
            {/* 1. Phạm Vi Gửi (Scope Tabs) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Phạm vi gửi <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setScope("SYSTEM")}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    scope === "SYSTEM"
                      ? "bg-blue-50 dark:bg-blue-600/15 border-blue-600 dark:border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <Globe size={18} />
                  <span>Toàn hệ thống</span>
                </button>

                <button
                  type="button"
                  onClick={() => setScope("ROLE")}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    scope === "ROLE"
                      ? "bg-blue-50 dark:bg-blue-600/15 border-blue-600 dark:border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <Users size={18} />
                  <span>Vai trò</span>
                </button>

                <button
                  type="button"
                  onClick={() => setScope("CLASSROOM")}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    scope === "CLASSROOM"
                      ? "bg-blue-50 dark:bg-blue-600/15 border-blue-600 dark:border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <School size={18} />
                  <span>Lớp học</span>
                </button>

                <button
                  type="button"
                  onClick={() => setScope("INDIVIDUAL")}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    scope === "INDIVIDUAL"
                      ? "bg-blue-50 dark:bg-blue-600/15 border-blue-600 dark:border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <User size={18} />
                  <span>Cá nhân</span>
                </button>
              </div>
            </div>

            {/* 2. Cấu hình chi tiết theo từng Scope */}
            {scope === "ROLE" && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 space-y-1.5 animate-in fade-in duration-150">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Đối tượng nhận
                </label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-600 font-bold text-xs bg-white dark:bg-[#111827] text-slate-900 dark:text-white"
                >
                  <option value="ROLE_STUDENT">Học viên</option>
                  <option value="ROLE_TEACHER">Giảng viên</option>
                  <option value="ROLE_ADMIN">Quản trị viên</option>
                </select>
              </div>
            )}

            {scope === "CLASSROOM" && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Lớp học
                  </label>
                  <button
                    type="button"
                    onClick={loadClassrooms}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw size={11} className={isLoadingClasses ? "animate-spin" : ""} />
                    Làm mới
                  </button>
                </div>

                {isLoadingClasses ? (
                  <p className="text-xs text-slate-400 py-2">Đang tải...</p>
                ) : classrooms.length === 0 ? (
                  <p className="text-xs text-amber-600 py-2">Không có lớp học</p>
                ) : (
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-600 font-bold text-xs bg-white dark:bg-[#111827] text-slate-900 dark:text-white"
                  >
                    {classrooms.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.joinCode ? `(${c.joinCode})` : ""} • GV: {c.teacherName || "—"} • {c.studentCount || 0} HV
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {scope === "INDIVIDUAL" && (
              <div
                ref={searchContainerRef}
                className="relative p-3.5 rounded-xl bg-slate-50 dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 space-y-2 animate-in fade-in duration-150"
              >
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Người nhận
                </label>

                {selectedRecipient ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-600/15 border border-blue-200 dark:border-blue-600/30">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 shrink-0 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-xs overflow-hidden">
                        {selectedRecipient.avatarUrl ? (
                          <img
                            src={resolveAvatarUrl(selectedRecipient.avatarUrl)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          selectedRecipient.fullName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                            {selectedRecipient.fullName}
                          </p>
                          <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                            {selectedRecipient.role.replace("ROLE_", "")}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {selectedRecipient.email}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedRecipient(null)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Đổi người nhận"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative flex items-center">
                      <Search size={15} className="absolute left-3 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setShowUserDropdown(true);
                        }}
                        onFocus={() => setShowUserDropdown(true)}
                        placeholder="Tìm tên, email..."
                        className="w-full pl-9 pr-8 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-600 text-xs bg-white dark:bg-[#111827] text-slate-900 dark:text-white font-medium"
                      />
                      {isSearchingUser && (
                        <Loader2 size={14} className="absolute right-3 animate-spin text-blue-600" />
                      )}
                    </div>

                    {showUserDropdown && (
                      <div className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] shadow-lg z-20 custom-scrollbar p-1">
                        {recipientResults.length === 0 ? (
                          <p className="text-center text-xs text-slate-400 py-3">
                            {isSearchingUser
                              ? "Đang tìm..."
                              : "Không tìm thấy"}
                          </p>
                        ) : (
                          recipientResults.map((u) => (
                            <div
                              key={u.id}
                              onClick={() => {
                                setSelectedRecipient(u);
                                setShowUserDropdown(false);
                              }}
                              className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="h-7 w-7 shrink-0 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-[11px] overflow-hidden">
                                  {u.avatarUrl ? (
                                    <img
                                      src={resolveAvatarUrl(u.avatarUrl)}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    u.fullName.charAt(0).toUpperCase()
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    {u.fullName}
                                  </p>
                                  <p className="text-[10px] text-slate-400 truncate">
                                    {u.email}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                                {u.role.replace("ROLE_", "")}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 3. Phân loại & Hình thức thông báo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  <Bell size={13} className="text-blue-600 dark:text-blue-400" />
                  Mức độ
                </label>
                <select
                  value={notificationType}
                  onChange={(e) => setNotificationType(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-600 font-bold text-xs bg-slate-50 dark:bg-[#0b1120] text-slate-900 dark:text-white"
                >
                  <option value="ANNOUNCEMENT">Thông báo</option>
                  <option value="SYSTEM_ALERT">Cảnh báo</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  <Layers size={13} className="text-blue-600 dark:text-blue-400" />
                  Loại hành động
                </label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-600 font-bold text-xs bg-slate-50 dark:bg-[#0b1120] text-slate-900 dark:text-white"
                >
                  <option value="TEXT_ANNOUNCEMENT">Văn bản</option>
                  <option value="NEW_ASSIGNMENT">Bài tập mới</option>
                  <option value="NEW_LESSON">Bài giảng mới</option>
                  <option value="GRADED">Kết quả chấm</option>
                  <option value="AI_EVALUATION">Đánh giá AI</option>
                </select>
              </div>
            </div>

            {/* 4. Tiêu đề */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Tiêu đề <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-600 bg-slate-50 dark:bg-[#0b1120] text-slate-900 dark:text-white font-bold text-xs"
                placeholder="Nhập tiêu đề..."
              />
            </div>

            {/* 5. Nội dung chi tiết */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nội dung <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-600 bg-slate-50 dark:bg-[#0b1120] text-slate-900 dark:text-white text-xs leading-relaxed"
                placeholder="Nhập nội dung..."
              />
            </div>

            {/* 6. Link điều hướng */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                URL điều hướng
              </label>
              <input
                type="text"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-600 bg-slate-50 dark:bg-[#0b1120] text-slate-900 dark:text-white text-xs"
                placeholder="/student/courses"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSending}
              className="w-full flex justify-center items-center gap-2 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white p-3.5 rounded-xl font-black text-xs md:text-sm transition shadow-xs disabled:opacity-50 mt-2 cursor-pointer"
            >
              {isSending ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Đang gửi...</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>Gửi thông báo</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Lịch Sử Thông Báo (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#111827] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Lịch sử ({history.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={loadHistory}
              disabled={historyLoading}
              title="Làm mới"
              className="p-1.5 text-slate-500 hover:text-blue-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={15} className={historyLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {historyLoading ? (
            <div className="flex flex-col items-center justify-center p-8 text-slate-400 space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-blue-700" />
              <span className="text-xs">Đang tải...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-slate-400 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <Bell size={28} className="text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-medium">Chưa có thông báo</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1 custom-scrollbar">
              {history.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0b1120] hover:bg-white dark:hover:bg-slate-900/80 transition space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.type === "SYSTEM_ALERT"
                            ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                            : "bg-blue-100 dark:bg-slate-900/60 text-blue-800 dark:text-blue-300"
                        }`}
                      >
                        {item.type || "ANNOUNCEMENT"}
                      </span>
                      {item.actionType && (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {item.actionType}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0 font-medium">
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                          })
                        : "Vừa xong"}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                    {item.title}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line line-clamp-3">
                    {item.message}
                  </p>

                  {(item.targetUrl || item.redirectUrl) && (
                    <div className="flex items-center gap-1 text-[11px] text-blue-700 dark:text-blue-400 font-medium pt-1">
                      <ExternalLink size={12} />
                      <span className="truncate max-w-[220px]">
                        {item.targetUrl || item.redirectUrl}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
