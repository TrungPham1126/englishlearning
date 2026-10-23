// src/features/admin/pages/VideoModerationPage.tsx
import { useEffect, useState } from "react";
import { adminApi } from "@/features/admin/api/adminApi";
import type { VideoModerationItem } from "@/features/admin/types";
import VideoPlayer from "@/features/student/components/VideoPlayer";
import {
  Loader2,
  Video,
  CheckCircle2,
  XCircle,
  PlayCircle,
  FileVideo,
  AlertCircle,
  Clock,
  Check,
  X,
  MessageSquare,
  School,
  BookOpen,
} from "lucide-react";

export default function VideoModerationPage() {
  const [videos, setVideos] = useState<VideoModerationItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING_REVIEW");
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Modal / Reject state
  const [rejectingVideo, setRejectingVideo] = useState<VideoModerationItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Preview video modal
  const [previewingVideo, setPreviewingVideo] = useState<VideoModerationItem | null>(null);

  const fetchVideos = async (status = statusFilter) => {
    setLoading(true);
    try {
      const res = await adminApi.getVideos(status);
      setVideos(res);
    } catch (err) {
      console.error("Lỗi tải danh sách video", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos(statusFilter);
  }, [statusFilter]);

  const handleApprove = async (video: VideoModerationItem) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn PHÊ DUYỆT video "${video.originalFileName}" để học viên có thể xem bài giảng?`,
      )
    )
      return;
    setIsProcessing(true);
    try {
      await adminApi.reviewVideo(video.id, true);
      alert("Đã phê duyệt video thành công!");
      fetchVideos(statusFilter);
    } catch (err) {
      alert("Lỗi khi phê duyệt video");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingVideo || !rejectReason.trim()) return;
    setIsProcessing(true);
    try {
      await adminApi.reviewVideo(rejectingVideo.id, false, rejectReason.trim());
      alert("Đã từ chối video và gửi lý do cho giáo viên!");
      setRejectingVideo(null);
      setRejectReason("");
      fetchVideos(statusFilter);
    } catch (err) {
      alert("Lỗi khi từ chối video");
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={12} /> Chờ Kiểm Duyệt
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} /> Đã Phê Duyệt
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle size={12} /> Bị Từ Chối
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* 1. CLEAN OPEN HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200 dark:border-slate-800/80 bg-transparent">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/50 mb-2">
            <Video size={14} />
            <span>Kiểm Duyệt Nội Dung</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Duyệt Video Bài Giảng Của Giáo Viên
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Kiểm tra chất lượng video, nội dung giảng dạy trước khi cho phép học viên truy cập bài học.
          </p>
        </div>
      </div>

      {/* 2. FILTER TABS */}
      <div className="flex items-center gap-2 bg-white dark:bg-[#111827] p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto transition-colors">
        <button
          onClick={() => setStatusFilter("PENDING_REVIEW")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            statusFilter === "PENDING_REVIEW"
              ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Chờ Kiểm Duyệt
        </button>
        <button
          onClick={() => setStatusFilter("APPROVED")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            statusFilter === "APPROVED"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Đã Phê Duyệt
        </button>
        <button
          onClick={() => setStatusFilter("REJECTED")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            statusFilter === "REJECTED"
              ? "bg-rose-600 text-white shadow-md shadow-rose-600/20"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Bị Từ Chối
        </button>
        <button
          onClick={() => setStatusFilter("ALL")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            statusFilter === "ALL"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Tất Cả Video
        </button>
      </div>

      {/* 3. VIDEOS LIST / GRID */}
      {loading ? (
        <div className="p-20 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="animate-spin text-indigo-600 mb-2" size={32} />
          <p className="text-xs font-semibold">Đang tải danh sách video...</p>
        </div>
      ) : videos.length === 0 ? (
        <div className="bg-white dark:bg-[#111827] p-16 rounded-3xl border border-slate-200 dark:border-slate-800 text-center shadow-sm transition-colors">
          <CheckCircle2 size={56} className="text-emerald-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">
            {statusFilter === "PENDING_REVIEW"
              ? "Hiện không có video nào cần kiểm duyệt!"
              : "Không có video trong danh mục này."}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Tất cả các video đã được xử lý hoặc chưa có lượt tải lên mới từ giáo viên.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {videos.map((vid) => (
            <div
              key={vid.id}
              className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col hover:border-slate-300 dark:hover:border-slate-700 transition"
            >
              {/* Video Player / Preview Area */}
              <div className="bg-black aspect-video relative flex items-center justify-center overflow-hidden">
                {vid.hlsPlaylistUrl ? (
                  <VideoPlayer videoId={vid.id} streamUrl={vid.hlsPlaylistUrl} />
                ) : (
                  <div className="text-slate-400 flex flex-col items-center">
                    <PlayCircle size={48} className="text-white/40 mb-2" />
                    <span className="text-xs font-semibold">Đang xử lý luồng HLS</span>
                  </div>
                )}
              </div>

              {/* Video Info Details */}
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2 truncate">
                      <FileVideo size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                      {vid.originalFileName}
                    </h3>
                    {getStatusBadge(vid.status)}
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    {vid.lesson && (
                      <div className="flex items-center gap-2">
                        <BookOpen size={14} className="text-slate-400" />
                        <span>
                          Bài giảng: <strong className="text-slate-800 dark:text-white">{vid.lesson.title}</strong>
                        </span>
                      </div>
                    )}
                    {vid.lesson?.classroom && (
                      <div className="flex items-center gap-2">
                        <School size={14} className="text-slate-400" />
                        <span>
                          Lớp học: <strong className="text-slate-800 dark:text-white">{vid.lesson.classroom.name}</strong>
                        </span>
                      </div>
                    )}
                    {vid.uploadedBy && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">Tải lên bởi:</span>
                        <strong className="text-indigo-700 dark:text-indigo-400">
                          {vid.uploadedBy.lastName} {vid.uploadedBy.firstName} ({vid.uploadedBy.email})
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Rejection Reason Display */}
                  {vid.status === "REJECTED" && vid.rejectionReason && (
                    <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs text-rose-800 dark:text-rose-300">
                      <strong>Lý do từ chối:</strong> {vid.rejectionReason}
                    </div>
                  )}
                </div>

                {/* Actions Bar */}
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-slate-400">
                    {vid.createdAt ? new Date(vid.createdAt).toLocaleDateString("vi-VN") : ""}
                  </span>

                  {vid.status === "PENDING_REVIEW" && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setRejectingVideo(vid)}
                        disabled={isProcessing}
                        className="px-4 py-2 bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/25 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                      >
                        <X size={14} /> Từ Chối
                      </button>
                      <button
                        onClick={() => handleApprove(vid)}
                        disabled={isProcessing}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                      >
                        <Check size={14} /> Phê Duyệt
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: TỪ CHỐI KÈM LÝ DO */}
      {rejectingVideo && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-[#162033]">
              <h2 className="text-base font-black text-rose-700 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle size={18} /> Từ Chối Phê Duyệt Video
              </h2>
              <button
                onClick={() => setRejectingVideo(null)}
                className="text-slate-400 hover:text-rose-500 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-[#162033] p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <span className="text-slate-500 dark:text-slate-400 block">Tên video:</span>
                <strong className="text-slate-800 dark:text-white block mt-0.5">{rejectingVideo.originalFileName}</strong>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Lý do từ chối (Gửi thông báo tới giáo viên)
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="VD: Âm thanh bị rè, nội dung chưa bám sát giáo trình bài học..."
                  className="w-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 rounded-xl p-3 outline-none focus:border-rose-500 text-xs font-medium"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRejectingVideo(null)}
                  className="px-4 py-2 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || !rejectReason.trim()}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 cursor-pointer disabled:opacity-50 text-xs shadow-sm"
                >
                  {isProcessing && <Loader2 size={14} className="animate-spin" />} Xác Nhận Từ Chối
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

