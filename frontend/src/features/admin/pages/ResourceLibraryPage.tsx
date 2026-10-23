// src/features/admin/pages/ResourceLibraryPage.tsx
import { useEffect, useState } from "react";
import { adminApi } from "@/features/admin/api/adminApi";
import {
  Database,
  UploadCloud,
  FileText,
  Video,
  FileQuestion,
  Loader2,
  Trash2,
} from "lucide-react";

export default function ResourceLibraryPage() {
  const [activeTab, setActiveTab] = useState<"DOC" | "VIDEO" | "EXAM">("DOC");
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const fetchResources = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getGlobalResources(activeTab);
      setResources(data || []);
    } catch (err) {
      console.error("Lỗi lấy danh sách học liệu", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, [activeTab]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", activeTab);

    try {
      await adminApi.uploadGlobalResource(formData);
      alert("Tải lên Kho học liệu thành công!");
      fetchResources();
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi tải lên tài liệu");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Xác nhận xóa tài liệu này khỏi kho chung?")) return;
    try {
      await adminApi.deleteGlobalResource(id);
      alert("Đã xóa tài liệu!");
      fetchResources();
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi khi xóa tài liệu");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Clean Open Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200 dark:border-slate-800/80 bg-transparent">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/50 mb-2">
            <Database size={14} />
            <span>Kho Tri Thức & Học Liệu</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Kho Học Liệu Tập Trung (Global Bank)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tải tài liệu, video và đề thi gốc lên đây 1 lần để giáo viên toàn trung tâm tái sử dụng.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition shadow-sm cursor-pointer disabled:opacity-50 text-sm">
          {isUploading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <UploadCloud size={18} />
          )}
          Tải Tệp Lên Kho
          <input
            type="file"
            className="hidden"
            onChange={handleUpload}
            disabled={isUploading}
          />
        </label>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("DOC")}
          className={`px-6 py-3 text-sm font-black uppercase tracking-wider border-b-2 transition flex items-center gap-2 ${activeTab === "DOC" ? "border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-400" : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"}`}
        >
          <FileText size={18} /> Tài Liệu (PDF/Word)
        </button>
        <button
          onClick={() => setActiveTab("VIDEO")}
          className={`px-6 py-3 text-sm font-black uppercase tracking-wider border-b-2 transition flex items-center gap-2 ${activeTab === "VIDEO" ? "border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-400" : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"}`}
        >
          <Video size={18} /> Video Tiêu Chuẩn
        </button>
        <button
          onClick={() => setActiveTab("EXAM")}
          className={`px-6 py-3 text-sm font-black uppercase tracking-wider border-b-2 transition flex items-center gap-2 ${activeTab === "EXAM" ? "border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-400" : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"}`}
        >
          <FileQuestion size={18} /> Bộ Đề Thi (Test Bank)
        </button>
      </div>

      <div className="bg-white dark:bg-[#111827] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
        {loading ? (
          <div className="p-20 text-center">
            <Loader2
              className="animate-spin text-indigo-600 mx-auto"
              size={32}
            />
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#162033] text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black border-b border-slate-200 dark:border-slate-800">
                <th className="p-4">Tên Tệp (File Name)</th>
                <th className="p-4">Kích thước</th>
                <th className="p-4">Đã được gán (Tái sử dụng)</th>
                <th className="p-4">Ngày tải lên</th>
                <th className="p-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {resources.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-12 text-center text-slate-400 font-semibold"
                  >
                    Kho lưu trữ trống.
                  </td>
                </tr>
              ) : (
                resources.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-4 font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
                      {activeTab === "DOC" && (
                        <FileText className="text-blue-500" size={18} />
                      )}
                      {activeTab === "VIDEO" && (
                        <Video className="text-rose-500" size={18} />
                      )}
                      {activeTab === "EXAM" && (
                        <FileQuestion className="text-amber-500" size={18} />
                      )}
                      {item.name}
                    </td>
                    <td className="p-4 text-slate-500 dark:text-slate-400 font-mono text-xs">
                      {item.size}
                    </td>
                    <td className="p-4">
                      <span className="bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border border-indigo-200 dark:border-indigo-500/30">
                        {item.usedCount} Lớp học
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 dark:text-slate-400 font-mono text-xs">
                      {item.uploadedAt}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
