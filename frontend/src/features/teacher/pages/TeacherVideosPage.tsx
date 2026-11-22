import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Video,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  BookOpen,
  School,
  ExternalLink,
  Upload,
  Trash2,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import VideoPlayer, { resolveVideoSources } from "@/features/student/components/VideoPlayer";
import { teacherApi, type LessonVideoItem } from "../api/teacherApi";

const STATUS_TABS = [
  { id: "ALL", label: "Tất cả" },
  { id: "PENDING_REVIEW", label: "Chờ duyệt" },
  { id: "APPROVED", label: "Đã duyệt" },
  { id: "PROCESSING", label: "Đang xử lý" },
  { id: "REJECTED", label: "Bị từ chối" },
];

function getStatusBadge(status: string) {
  switch (status) {
    case "APPROVED":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
          <CheckCircle2 size={12} /> Đã duyệt
        </span>
      );
    case "PENDING_REVIEW":
    case "READY":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
          <Clock size={12} /> Chờ duyệt
        </span>
      );
    case "PROCESSING":
    case "DRAFT":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30">
          <Clock size={12} /> Đang xử lý
        </span>
      );
    case "REJECTED":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30">
          <XCircle size={12} /> Bị từ chối
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          {status}
        </span>
      );
  }
}

export default function TeacherVideosPage() {
  const navigate = useNavigate();
  const replaceInputRef = useRef<HTMLInputElement | null>(null);

  const [videos, setVideos] = useState<LessonVideoItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [targetLessonIdForReplace, setTargetLessonIdForReplace] = useState<string | null>(null);
  const [uploadingLessonId, setUploadingLessonId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const fetchVideos = useCallback(async (status = statusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await teacherApi.getMyUploadedVideos(status);
      const list = (res as any)?.data?.data || (res as any)?.data || [];
      setVideos(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Không thể tải danh sách video của bạn.",
      );
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void fetchVideos(statusFilter);
  }, [fetchVideos, statusFilter]);

  const filteredVideos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return videos;
    return videos.filter((v) => {
      const fileName = (v.originalFileName || "").toLowerCase();
      const lessonTitle = (v.lesson?.title || "").toLowerCase();
      const classroomName = (v.lesson?.classroom?.name || "").toLowerCase();
      return (
        fileName.includes(q) ||
        lessonTitle.includes(q) ||
        classroomName.includes(q)
      );
    });
  }, [videos, searchQuery]);

  const triggerReplaceVideo = (lessonId?: string) => {
    if (!lessonId) return;
    setTargetLessonIdForReplace(lessonId);
    replaceInputRef.current?.click();
  };

  const handleReplaceFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const lessonId = targetLessonIdForReplace;
    e.target.value = "";
    if (!file || !lessonId) return;

    setUploadingLessonId(lessonId);
    setUploadProgress(0);
    try {
      await teacherApi.uploadLessonVideo(lessonId, file, (pct) => setUploadProgress(pct));
      await fetchVideos(statusFilter);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Tải video thay thế thất bại.");
    } finally {
      setUploadingLessonId(null);
      setTargetLessonIdForReplace(null);
      setUploadProgress(0);
    }
  };

  const handleDeleteVideo = async (v: LessonVideoItem) => {
    if (!window.confirm(`Xóa video "${v.originalFileName || v.lesson?.title || v.id}"?`)) {
      return;
    }
    try {
      await teacherApi.deleteVideo(v.id);
      await fetchVideos(statusFilter);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Xóa video thất bại.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <input
        ref={replaceInputRef}
        type="file"
        accept="video/*"
        onChange={handleReplaceFileSelected}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Video className="text-blue-700 dark:text-blue-400" size={26} />
            <span>Video bài giảng của tôi</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Xem lại video đã đăng tải, theo dõi trạng thái kiểm duyệt và truy cập nhanh tài liệu của từng bài học.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void fetchVideos(statusFilter)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-600 transition cursor-pointer self-start md:self-auto"
        >
          <RefreshCw size={14} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                statusFilter === tab.id
                  ? "bg-blue-800 text-white shadow-xs"
                  : "border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Tìm theo tên video, bài học, lớp..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-600"
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/20 p-4 text-xs text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void fetchVideos(statusFilter)}
            className="underline font-semibold cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-16 text-slate-500 gap-3">
          <Loader2 size={28} className="animate-spin text-blue-700 dark:text-blue-400" />
          <span className="text-xs font-semibold">Đang tải danh sách video...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredVideos.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-14 text-center space-y-2">
          <Video size={32} className="mx-auto text-slate-400" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Chưa có video nào phù hợp
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Vào lớp học và tải video lên từng bài giảng để xem trước và quản lý tại đây.
          </p>
        </div>
      )}

      {/* Video Cards Grid */}
      {!loading && !error && filteredVideos.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredVideos.map((v) => {
            const {
              isProcessing,
              streamUrl,
              rawUrl,
            } = resolveVideoSources(v);
            const cId = v.lesson?.classroom?.id;
            const lId = v.lesson?.id;
            const isReplacing = uploadingLessonId && uploadingLessonId === lId;

            return (
              <div
                key={v.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden shadow-xs flex flex-col justify-between"
              >
                <div>
                  {isProcessing ? (
                    <div className="aspect-video bg-slate-900 flex flex-col items-center justify-center gap-2 p-6 text-slate-300">
                      <Clock size={32} className="text-sky-400" />
                      <span className="text-xs font-semibold">
                        Đang xử lý mã hóa HLS...
                      </span>
                    </div>
                  ) : streamUrl ? (
                    <VideoPlayer
                      videoId={v.id}
                      streamUrl={streamUrl}
                      rawUrl={rawUrl}
                      enableProgressSync={false}
                      lazyLoad={true}
                    />
                  ) : (
                    <div className="aspect-video bg-slate-900 flex flex-col items-center justify-center gap-2 p-6 text-slate-400">
                      <Video size={32} />
                      <span className="text-xs">Video chưa có luồng phát</span>
                    </div>
                  )}

                  <div className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {v.originalFileName || "Video bài giảng"}
                      </h3>
                      {getStatusBadge(v.status)}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                      {v.lesson?.classroom?.name && (
                        <span className="inline-flex items-center gap-1">
                          <School size={13} className="text-blue-700 dark:text-blue-400" />
                          <span>{v.lesson.classroom.name}</span>
                        </span>
                      )}
                      {v.lesson?.title && (
                        <span className="inline-flex items-center gap-1">
                          <BookOpen size={13} className="text-emerald-600 dark:text-emerald-400" />
                          <span>{v.lesson.title}</span>
                        </span>
                      )}
                    </div>

                    {v.status === "REJECTED" && v.rejectionReason && (
                      <div className="rounded-lg border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/30 p-2.5 text-xs text-rose-700 dark:text-rose-300">
                        <strong>Lý do từ chối:</strong> {v.rejectionReason}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 flex flex-wrap items-center justify-between gap-2">
                  {lId ? (
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          cId
                            ? `/teacher/classrooms/${cId}/lessons/${lId}`
                            : `/teacher/lessons/${lId}`,
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-800 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-semibold transition cursor-pointer"
                    >
                      <ExternalLink size={13} />
                      <span>Xem bài học &amp; tài liệu</span>
                    </button>
                  ) : (
                    <span />
                  )}

                  <div className="flex items-center gap-1.5">
                    {lId && (
                      <button
                        type="button"
                        onClick={() => triggerReplaceVideo(lId)}
                        disabled={Boolean(uploadingLessonId)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer disabled:opacity-50"
                      >
                        {isReplacing ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Upload size={13} />
                        )}
                        <span>
                          {isReplacing ? `${uploadProgress}%` : "Thay video"}
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDeleteVideo(v)}
                      aria-label={`Xóa video ${v.originalFileName || v.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 px-2.5 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 transition cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>Xóa</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
