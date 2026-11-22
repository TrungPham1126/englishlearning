import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  Pencil,
  Play,
  RefreshCw,
  Trash2,
  Upload,
  Video,
  X,
  AlertCircle,
  BookA,
  BookOpenCheck,
} from "lucide-react";
import VideoPlayer, { resolveVideoSources } from "@/features/student/components/VideoPlayer";
import {
  teacherApi,
  type LessonDetailItem,
  type LessonItem,
  type LessonVideoItem,
} from "../api/teacherApi";
import { TeacherLessonDocumentsTab } from "../components/lesson/TeacherLessonDocumentsTab";
import { TeacherLessonVocabularyTab } from "../components/lesson/TeacherLessonVocabularyTab";
import { TeacherLessonGrammarTab } from "../components/lesson/TeacherLessonGrammarTab";

type DetailTab = "overview" | "docs" | "vocab" | "grammar";

const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024;

function getVideoStatusBadge(status?: string | null) {
  switch (status) {
    case "APPROVED":
      return {
        label: "Video đã duyệt",
        cls: "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      };
    case "PENDING_REVIEW":
    case "READY":
      return {
        label: "Chờ duyệt",
        cls: "border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300",
      };
    case "PROCESSING":
    case "DRAFT":
      return {
        label: "Đang xử lý HLS",
        cls: "border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300",
      };
    case "REJECTED":
      return {
        label: "Bị từ chối",
        cls: "border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300",
      };
    default:
      return {
        label: status || "Có video",
        cls: "border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
      };
  }
}

export default function TeacherLessonDetailPage() {
  const { classId, lessonId } = useParams<{ classId?: string; lessonId: string }>();
  const navigate = useNavigate();
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const [lesson, setLesson] = useState<LessonDetailItem | null>(null);
  const [video, setVideo] = useState<LessonVideoItem | null>(null);
  const [playlist, setPlaylist] = useState<LessonItem[]>([]);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Video upload/delete states
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoFeedback, setVideoFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Edit lesson modal state
  const [isEditLessonOpen, setIsEditLessonOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editOrderIndex, setEditOrderIndex] = useState<number>(1);
  const [editObjectives, setEditObjectives] = useState("");
  const [editContent, setEditContent] = useState("");
  const [savingLesson, setSavingLesson] = useState(false);

  const loadData = useCallback(async () => {
    if (!lessonId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [lessonRes, videoRes] = await Promise.all([
        teacherApi.getLessonDetail(lessonId),
        teacherApi.getLessonVideo(lessonId).catch(() => ({ data: { data: null } })),
      ]);

      const lessonData: LessonDetailItem | null =
        (lessonRes as any)?.data?.data || (lessonRes as any)?.data || null;
      const videoData: LessonVideoItem | null =
        (videoRes as any)?.data?.data ?? null;

      if (!lessonData) {
        setLoadError("Không tìm thấy thông tin bài giảng.");
        setLesson(null);
        return;
      }

      setLesson({
        ...lessonData,
        documents: Array.isArray(lessonData.documents) ? lessonData.documents : [],
        vocabularies: Array.isArray(lessonData.vocabularies) ? lessonData.vocabularies : [],
        grammarTopics: Array.isArray(lessonData.grammarTopics) ? lessonData.grammarTopics : [],
      });
      setVideo(videoData);

      const resolvedClassId = classId || lessonData.classId;
      if (resolvedClassId) {
        try {
          const listRes = await teacherApi.getClassLessons(resolvedClassId);
          const listData = (listRes as any)?.data?.data || (listRes as any)?.data || [];
          setPlaylist(
            Array.isArray(listData)
              ? [...listData].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
              : [],
          );
        } catch {
          setPlaylist([]);
        }
      }
    } catch (err: any) {
      setLoadError(
        err?.response?.data?.message || "Không thể tải chi tiết bài giảng.",
      );
    } finally {
      setLoading(false);
    }
  }, [classId, lessonId]);

  const refreshLessonDetailOnly = useCallback(async () => {
    if (!lessonId) return;
    const [lessonRes, videoRes] = await Promise.all([
      teacherApi.getLessonDetail(lessonId),
      teacherApi.getLessonVideo(lessonId).catch(() => ({ data: { data: null } })),
    ]);
    const lessonData: LessonDetailItem | null =
      (lessonRes as any)?.data?.data || (lessonRes as any)?.data || null;
    if (lessonData) {
      setLesson({
        ...lessonData,
        documents: Array.isArray(lessonData.documents) ? lessonData.documents : [],
        vocabularies: Array.isArray(lessonData.vocabularies) ? lessonData.vocabularies : [],
        grammarTopics: Array.isArray(lessonData.grammarTopics) ? lessonData.grammarTopics : [],
      });
    }
    const videoData: LessonVideoItem | null = (videoRes as any)?.data?.data ?? null;
    setVideo(videoData);
  }, [lessonId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openEditLessonModal = () => {
    if (!lesson) return;
    setEditTitle(lesson.title || "");
    setEditOrderIndex(lesson.orderIndex ?? 1);
    setEditObjectives(lesson.objectives || "");
    setEditContent(lesson.content || "");
    setIsEditLessonOpen(true);
  };

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonId || !editTitle.trim()) return;
    setSavingLesson(true);
    try {
      await teacherApi.updateLesson(lessonId, {
        title: editTitle.trim(),
        orderIndex: Number(editOrderIndex) || 1,
        objectives: editObjectives.trim(),
        content: editContent.trim(),
      });
      setIsEditLessonOpen(false);
      await loadData();
      setVideoFeedback({
        type: "success",
        message: "Đã cập nhật thông tin bài giảng.",
      });
    } catch (err: any) {
      setVideoFeedback({
        type: "error",
        message: err?.response?.data?.message || "Cập nhật bài giảng thất bại.",
      });
    } finally {
      setSavingLesson(false);
    }
  };

  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !lessonId) return;
    e.target.value = "";

    if (file.size <= 0) {
      setVideoFeedback({ type: "error", message: `File "${file.name}" bị rỗng.` });
      return;
    }
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      setVideoFeedback({
        type: "error",
        message: `Video "${file.name}" vượt quá giới hạn tối đa 500MB.`,
      });
      return;
    }

    setIsUploadingVideo(true);
    setUploadProgress(0);
    setVideoFeedback(null);
    try {
      await teacherApi.uploadLessonVideo(lessonId, file, (pct) => setUploadProgress(pct));
      await refreshLessonDetailOnly();
      setVideoFeedback({
        type: "success",
        message: `Đã tải lên video "${file.name}". Hệ thống đang xử lý HLS.`,
      });
    } catch (err: any) {
      setVideoFeedback({
        type: "error",
        message: err?.response?.data?.message || "Tải video thất bại.",
      });
    } finally {
      setIsUploadingVideo(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteVideo = async () => {
    if (!video?.id) return;
    if (!window.confirm("Xóa video bài giảng hiện tại? Bạn có thể tải video mới thay thế sau đó.")) {
      return;
    }
    setVideoFeedback(null);
    try {
      await teacherApi.deleteVideo(video.id);
      setVideo(null);
      await loadData();
      setVideoFeedback({
        type: "success",
        message: "Đã xóa video bài giảng.",
      });
    } catch (err: any) {
      setVideoFeedback({
        type: "error",
        message: err?.response?.data?.message || "Xóa video thất bại.",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-500 dark:text-slate-400 gap-3">
        <Loader2 className="animate-spin text-blue-700 dark:text-blue-400" size={28} />
        <span className="text-xs font-semibold">Đang tải nội dung bài giảng...</span>
      </div>
    );
  }

  if (loadError || !lesson) {
    return (
      <div className="max-w-3xl mx-auto rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/20 p-6 text-center space-y-3">
        <AlertCircle className="mx-auto text-rose-600 dark:text-rose-400" size={28} />
        <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
          {loadError || "Không tìm thấy bài giảng."}
        </p>
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={() => void loadData()}
            className="rounded-xl bg-blue-800 hover:bg-blue-700 text-white px-4 py-2 text-xs font-semibold cursor-pointer"
          >
            Thử lại
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  const effectiveClassId = classId || lesson.classId;
  const {
    isProcessing: isVideoProcessing,
    streamUrl: videoStreamUrl,
    rawUrl: videoRawUrl,
  } = resolveVideoSources(video);
  const videoStatusMeta = getVideoStatusBadge(video?.status);

  return (
    <div className="max-w-[1400px] mx-auto space-y-5 pb-12">
      <input
        ref={videoInputRef}
        type="file"
        onChange={handleVideoFileChange}
        accept="video/*"
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() =>
              navigate(
                effectiveClassId
                  ? `/teacher/classrooms/${effectiveClassId}`
                  : "/teacher/videos",
              )
            }
            aria-label="Quay lại danh sách bài giảng"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:border-blue-600 hover:bg-blue-800 hover:text-white transition cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-bold text-blue-700 dark:text-blue-400">
                Bài #{lesson.orderIndex}
              </span>
              <span>•</span>
              <span>Quản lý nội dung &amp; học liệu bài giảng</span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
              {lesson.title}
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={openEditLessonModal}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] hover:border-blue-600 hover:text-blue-700 dark:hover:text-blue-400 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs transition cursor-pointer"
        >
          <Pencil size={14} />
          <span>Sửa bài giảng</span>
        </button>
      </div>

      {videoFeedback && (
        <div
          className={`flex items-center justify-between rounded-xl border p-3.5 text-xs font-medium ${
            videoFeedback.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {videoFeedback.type === "success" ? (
              <CheckCircle2 size={15} className="shrink-0" />
            ) : (
              <AlertCircle size={15} className="shrink-0" />
            )}
            <span>{videoFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setVideoFeedback(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* CỘT TRÁI: Video + Tabs Nội dung */}
        <div className="lg:col-span-8 space-y-5">
          {/* Video Card */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <Video size={16} className="text-blue-700 dark:text-blue-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {video?.originalFileName || "Video bài giảng"}
                </span>
                {video && (
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold ${videoStatusMeta.cls}`}
                  >
                    {videoStatusMeta.label}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={isUploadingVideo}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-800 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  {isUploadingVideo ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Upload size={13} />
                  )}
                  <span>
                    {isUploadingVideo
                      ? uploadProgress > 0
                        ? `Đang tải (${uploadProgress}%)...`
                        : "Đang xử lý..."
                      : video
                        ? "Thay video mới"
                        : "Tải video"}
                  </span>
                </button>

                {video && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteVideo()}
                    aria-label="Xóa video bài giảng"
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 px-2.5 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 transition cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Xóa video</span>
                  </button>
                )}
              </div>
            </div>

            {video?.status === "REJECTED" && video.rejectionReason && (
              <div className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/30 border-b border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>
                  <strong>Lý do từ chối:</strong> {video.rejectionReason}
                </span>
              </div>
            )}

            <div className="p-0">
              {isVideoProcessing ? (
                <div className="aspect-video bg-slate-900 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <Clock size={36} className="text-sky-400" />
                  <p className="text-sm font-semibold text-slate-200">
                    Video đang được mã hóa HLS...
                  </p>
                  <button
                    type="button"
                    onClick={() => void refreshLessonDetailOnly()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 text-xs font-semibold transition cursor-pointer"
                  >
                    <RefreshCw size={13} />
                    <span>Làm mới trạng thái</span>
                  </button>
                </div>
              ) : videoStreamUrl && video?.id ? (
                <VideoPlayer
                  videoId={video.id}
                  streamUrl={videoStreamUrl}
                  rawUrl={videoRawUrl}
                  enableProgressSync={false}
                />
              ) : (
                <div className="aspect-video bg-slate-900 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-slate-300 border border-white/10">
                    <Play size={22} className="translate-x-0.5" />
                  </div>
                  <p className="text-sm font-medium text-slate-300">
                    Bài giảng này chưa có video.
                  </p>
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={isUploadingVideo}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 text-xs font-semibold transition cursor-pointer"
                  >
                    <Upload size={14} />
                    <span>Tải video bài giảng</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 4-Tab Content Card */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden shadow-xs">
            <div className="flex border-b border-slate-200 dark:border-slate-800 px-3 bg-slate-50/70 dark:bg-slate-900/50 overflow-x-auto">
              {[
                { id: "overview" as const, label: "Tổng quan", icon: BookOpen },
                {
                  id: "docs" as const,
                  label: `Tài liệu (${lesson.documents.length})`,
                  icon: FileText,
                },
                {
                  id: "vocab" as const,
                  label: `Từ vựng (${lesson.vocabularies.length})`,
                  icon: BookA,
                },
                {
                  id: "grammar" as const,
                  label: `Ngữ pháp (${lesson.grammarTopics.length})`,
                  icon: BookOpenCheck,
                },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 py-3 px-4 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
                      activeTab === tab.id
                        ? "border-blue-700 text-blue-800 dark:border-blue-400 dark:text-blue-400 bg-white dark:bg-[#111827]"
                        : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    <Icon size={14} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="p-5 md:p-6">
              {activeTab === "overview" && (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                        {lesson.title}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Mục tiêu: {lesson.objectives || "Chưa có mục tiêu bài học."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openEditLessonModal}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer shrink-0"
                    >
                      <Pencil size={12} />
                      <span>Chỉnh sửa</span>
                    </button>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4 text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">
                    {lesson.content || "Chưa có mô tả nội dung chi tiết cho bài giảng này."}
                  </div>
                </div>
              )}

              {activeTab === "docs" && (
                <TeacherLessonDocumentsTab
                  lessonId={lesson.id}
                  documents={lesson.documents}
                  onRefresh={refreshLessonDetailOnly}
                />
              )}

              {activeTab === "vocab" && (
                <TeacherLessonVocabularyTab
                  lessonId={lesson.id}
                  vocabularies={lesson.vocabularies}
                  onRefresh={refreshLessonDetailOnly}
                />
              )}

              {activeTab === "grammar" && (
                <TeacherLessonGrammarTab
                  lessonId={lesson.id}
                  grammarTopics={lesson.grammarTopics}
                  onRefresh={refreshLessonDetailOnly}
                />
              )}
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: Danh sách bài giảng trong lớp */}
        <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs overflow-hidden sticky top-24">
          <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <BookOpen size={15} className="text-blue-700 dark:text-blue-400" />
              <span>Danh sách bài giảng</span>
            </h3>
            <span className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {playlist.length} bài
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[580px] overflow-y-auto">
            {playlist.length === 0 ? (
              <p className="p-4 text-xs text-slate-500 text-center">
                Chưa có bài giảng khác trong lớp.
              </p>
            ) : (
              playlist.map((item, idx) => {
                const isCurrent = item.id === lessonId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      navigate(
                        effectiveClassId
                          ? `/teacher/classrooms/${effectiveClassId}/lessons/${item.id}`
                          : `/teacher/lessons/${item.id}`,
                      )
                    }
                    className={`w-full text-left p-3.5 flex items-center justify-between gap-2 transition cursor-pointer ${
                      isCurrent
                        ? "bg-blue-800 text-white"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-extrabold tabular-nums ${
                            isCurrent ? "text-blue-200" : "text-slate-400"
                          }`}
                        >
                          {String(item.orderIndex ?? idx + 1).padStart(2, "0")}
                        </span>
                        <span className="text-xs font-bold truncate">
                          {item.title}
                        </span>
                      </div>
                      <div
                        className={`flex flex-wrap items-center gap-2 text-[10px] ${
                          isCurrent ? "text-blue-100" : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {item.hasVideo && <span>Video</span>}
                        <span className="tabular-nums">
                          {item.documentsCount ?? 0} tài liệu
                        </span>
                        <span className="tabular-nums">
                          {item.vocabulariesCount ?? 0} từ vựng
                        </span>
                        <span className="tabular-nums">
                          {item.grammarTopicsCount ?? 0} ngữ pháp
                        </span>
                      </div>
                    </div>
                    <ChevronRight
                      size={15}
                      className={isCurrent ? "text-white shrink-0" : "text-slate-400 shrink-0"}
                    />
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal Sửa Bài Giảng */}
      {isEditLessonOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-elevated space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Chỉnh sửa bài giảng
              </h3>
              <button
                type="button"
                onClick={() => setIsEditLessonOpen(false)}
                aria-label="Đóng hộp thoại sửa bài giảng"
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveLesson} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Thứ tự
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editOrderIndex}
                    onChange={(e) => setEditOrderIndex(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b1120] px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tên bài giảng *
                  </label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b1120] px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mục tiêu bài học
                </label>
                <textarea
                  rows={2}
                  value={editObjectives}
                  onChange={(e) => setEditObjectives(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b1120] px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nội dung chi tiết
                </label>
                <textarea
                  rows={4}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b1120] px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditLessonOpen(false)}
                  className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingLesson}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-800 hover:bg-blue-700 px-4 py-2 font-semibold text-white shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {savingLesson && <Loader2 size={14} className="animate-spin" />}
                  <span>Lưu bài giảng</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
