// src/features/admin/pages/SystemBroadcastPage.tsx
import { useState } from "react";
import { adminApi } from "@/features/admin/api/adminApi";
import { Radio, Send, Loader2, CheckCircle2 } from "lucide-react";

export default function SystemBroadcastPage() {
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    notificationType: "SYSTEM_ALERT",
    redirectUrl: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    try {
      await adminApi.broadcastNotification(formData);
      setSuccess(true);
      setFormData({
        title: "",
        message: "",
        notificationType: "SYSTEM_ALERT",
        redirectUrl: "",
      });
    } catch (err) {
      alert("Lỗi khi phát thông báo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
          <Radio size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-800">
            Phát Thông Báo Toàn Hệ Thống
          </h1>
          <p className="text-sm text-slate-500">
            Tin nhắn sẽ được đẩy realtime tới tất cả User (qua RabbitMQ &
            WebSocket)
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        {success && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-700 font-bold">
            <CheckCircle2 size={20} /> Đã phát thông báo thành công đến toàn hệ
            thống!
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Loại thông báo
            </label>
            <select
              value={formData.notificationType}
              onChange={(e) =>
                setFormData({ ...formData, notificationType: e.target.value })
              }
              className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-indigo-600 font-semibold text-slate-700 bg-slate-50"
            >
              <option value="SYSTEM_ALERT">
                Cảnh báo hệ thống (SYSTEM_ALERT)
              </option>
              <option value="ANNOUNCEMENT">
                Thông báo chung (ANNOUNCEMENT)
              </option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Tiêu đề
            </label>
            <input
              required
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-indigo-600 text-slate-900 font-bold"
              placeholder="VD: Cập nhật hệ thống v2.0"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Nội dung chi tiết
            </label>
            <textarea
              required
              rows={4}
              value={formData.message}
              onChange={(e) =>
                setFormData({ ...formData, message: e.target.value })
              }
              className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-indigo-600 text-slate-800"
              placeholder="Nhập nội dung cần truyền đạt..."
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Link đính kèm (URL) - Không bắt buộc
            </label>
            <input
              type="text"
              value={formData.redirectUrl}
              onChange={(e) =>
                setFormData({ ...formData, redirectUrl: e.target.value })
              }
              className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-indigo-600 text-slate-900"
              placeholder="VD: /student/courses"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white p-4 rounded-xl font-black transition disabled:opacity-50 mt-4"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Send size={20} />
            )}
            PHÁT THÔNG BÁO NGAY
          </button>
        </form>
      </div>
    </div>
  );
}
