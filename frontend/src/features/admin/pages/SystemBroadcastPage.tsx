// src/features/admin/pages/SystemBroadcastPage.tsx
import { useState, useEffect } from "react";
import { adminApi } from "@/features/admin/api/adminApi";
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
} from "lucide-react";

export default function SystemBroadcastPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [notificationType, setNotificationType] = useState("SYSTEM_ALERT");
  const [targetAudience, setTargetAudience] = useState("ALL");
  const [targetUrl, setTargetUrl] = useState("");

  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Lịch sử phát thông báo
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

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
        message: "Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo.",
      });
      return;
    }

    try {
      setIsSending(true);
      setFeedback(null);

      const resolvedUrl = targetUrl.trim() || "/student/courses";
      const resolvedType = notificationType === "SYSTEM_ALERT" ? "SYSTEM_ALERT" : "ANNOUNCEMENT";
      const payload = {
        title: trimmedTitle,
        message: trimmedMessage,
        content: trimmedMessage,
        type: resolvedType,
        notificationType: resolvedType,
        targetAudience: targetAudience || "ALL",
        targetUrl: resolvedUrl,
        redirectUrl: resolvedUrl,
      };

      await adminApi.broadcastNotification(payload);

      setFeedback({
        type: "success",
        message: "Đã phát thông báo thành công đến toàn hệ thống!",
      });

      // Reset form
      setTitle("");
      setMessage("");
      setTargetUrl("");

      // Cập nhật lại lịch sử thông báo
      await loadHistory();
    } catch (err: any) {
      console.error("Lỗi khi phát thông báo:", err);
      setFeedback({
        type: "error",
        message:
          err.response?.data?.message ||
          err.message ||
          "Lỗi khi phát thông báo toàn hệ thống. Vui lòng thử lại.",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Clean Open Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200 dark:border-slate-800/80 bg-transparent">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/50 mb-2">
            <Radio size={14} />
            <span>Kênh Truyền Thông Toàn Hệ Thống</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Phát Thông Báo Toàn Hệ Thống
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tin nhắn sẽ được đẩy realtime tới tất cả User (qua RabbitMQ & WebSocket)
          </p>
        </div>
      </div>

      {/* Main Grid: Form Phát Thông Báo & Lịch Sử */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form phát thông báo (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#111827] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Send className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Soạn Thông Báo Mới</h2>
          </div>

          {feedback && (
            <div
              className={`p-4 rounded-xl flex items-center gap-3 text-sm font-semibold border ${
                feedback.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                  : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 size={20} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle size={20} className="shrink-0 text-red-600 dark:text-red-400" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          <form onSubmit={handleSendBroadcast} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Users size={14} className="text-indigo-600 dark:text-indigo-400" />
                  Đối tượng nhận
                </label>
                <select
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-600 font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-[#0b1120] text-xs"
                >
                  <option value="ALL">Tất cả người dùng</option>
                  <option value="STUDENT">Chỉ học viên (Students)</option>
                  <option value="TEACHER">Chỉ giảng viên (Teachers)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Bell size={14} className="text-rose-600 dark:text-rose-400" />
                  Loại thông báo
                </label>
                <select
                  value={notificationType}
                  onChange={(e) => setNotificationType(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-600 font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-[#0b1120] text-xs"
                >
                  <option value="SYSTEM_ALERT">Cảnh báo hệ thống (SYSTEM_ALERT)</option>
                  <option value="ANNOUNCEMENT">Thông báo chung (ANNOUNCEMENT)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Tiêu đề thông báo <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-600 bg-slate-50 dark:bg-[#0b1120] text-slate-900 dark:text-white font-bold text-xs"
                placeholder="VD: Bảo trì hệ thống định kỳ vào 22h tối nay"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nội dung chi tiết <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-600 bg-slate-50 dark:bg-[#0b1120] text-slate-900 dark:text-white text-xs leading-relaxed"
                placeholder="Nhập nội dung cần truyền đạt đến toàn bộ người dùng..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Link điều hướng (URL) - Tùy chọn
              </label>
              <input
                type="text"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-600 bg-slate-50 dark:bg-[#0b1120] text-slate-900 dark:text-white text-xs"
                placeholder="VD: /student/courses hoặc /student/dashboard"
              />
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="w-full flex justify-center items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white p-3.5 rounded-xl font-black text-sm transition shadow-lg shadow-rose-600/20 disabled:opacity-50 mt-2 cursor-pointer"
            >
              {isSending ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>ĐANG PHÁT THÔNG BÁO...</span>
                </>
              ) : (
                <>
                  <Send size={18} />
                  <span>PHÁT THÔNG BÁO NGAY</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Lịch sử phát thông báo (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#111827] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Lịch Sử Thông Báo ({history.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={loadHistory}
              disabled={historyLoading}
              title="Làm mới lịch sử"
              className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition disabled:opacity-50"
            >
              <RefreshCw size={16} className={historyLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {historyLoading ? (
            <div className="flex flex-col items-center justify-center p-8 text-slate-400 space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              <span className="text-xs">Đang tải lịch sử thông báo...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-slate-400 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <Bell size={28} className="text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-medium">Chưa có thông báo toàn hệ thống nào được phát.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {history.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0b1120] hover:bg-white dark:hover:bg-slate-900 transition space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.type === "SYSTEM_ALERT"
                          ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                          : "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300"
                      }`}
                    >
                      {item.type || "SYSTEM_ALERT"}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleString("vi-VN")
                        : "Vừa xong"}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                    {item.title}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line line-clamp-3">
                    {item.message}
                  </p>

                  {(item.targetUrl || item.redirectUrl) && (
                    <div className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium pt-1">
                      <ExternalLink size={12} />
                      <span className="truncate max-w-[240px]">
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
