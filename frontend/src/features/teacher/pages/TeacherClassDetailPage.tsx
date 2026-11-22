import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Plus,
  BookOpen,
  Video,
  FileText,
  Bell,
  Send,
  Upload,
  CheckCircle2,
  Trash2,
  AlertCircle,
  Loader2,
  Inbox,
  FileCode,
  Calendar,
  Eye,
  PlayCircle,
  BookA,
  BookOpenCheck,
} from "lucide-react";
import { teacherApi, type LessonItem } from "../api/teacherApi";
import ClassroomHeaderNav from "../components/ClassroomHeaderNav";

export default function TeacherClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();

  // Điều khiển sub-tab: "lessons" | "announcements"
  const [activeSubTab, setActiveSubTab] = useState<"lessons" | "announcements">("lessons");

  // Dữ liệu bài giảng
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState<boolean>(true);
  const [lessonsError, setLessonsError] = useState<string | null>(null);

  // Modal tạo bài giảng
  const [showLessonModal, setShowLessonModal] = useState<boolean>(false);
  const [lessonTitle, setLessonTitle] = useState<string>("");
  const [lessonObjectives, setLessonObjectives] = useState<string>("");
  const [isCreatingLesson, setIsCreatingLesson] = useState<boolean>(false);

  // Quản lý upload file & video
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [dragOverLessonId, setDragOverLessonId] = useState<string | null>(null);
  const [uploadTypeLabel, setUploadTypeLabel] = useState<"VIDEO_HLS" | "DOCUMENT">("VIDEO_HLS");
  const [uploadFeedback, setUploadFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const docInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // Quản lý thông báo lớp học
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [annLoading, setAnnLoading] = useState<boolean>(true);
  const [annTitle, setAnnTitle] = useState<string>("");
  const [annContent, setAnnContent] = useState<string>("");
  const [sendingAnn, setSendingAnn] = useState<boolean>(false);
  const [annFeedback, setAnnFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (classId) {
      loadLessons();
      loadAnnouncements();
    }
  }, [classId]);

  const loadLessons = async () => {
    try {
      setLessonsLoading(true);
      setLessonsError(null);
      const res = await teacherApi.getClassLessons(classId!);
      const raw = res?.data?.data || res?.data;
      if (Array.isArray(raw)) {
        setLessons(raw);
      } else {
        setLessons([]);
      }
    } catch (err: any) {
      console.error("Lỗi khi tải danh sách bài học:", err);
      setLessonsError("Tải bài giảng thất bại.");
      setLessons([]);
    } finally {
      setLessonsLoading(false);
    }
  };

  const loadAnnouncements = async () => {
    try {
      setAnnLoading(true);
      const res = await teacherApi.getClassAnnouncements(classId!);
      const raw = res?.data?.data?.content || res?.data?.data || res?.data?.content || res?.data;
      if (Array.isArray(raw)) {
        setAnnouncements(raw);
      } else {
        setAnnouncements([]);
      }
    } catch (err) {
      console.error("Lỗi khi tải thông báo lớp:", err);
      setAnnouncements([]);
    } finally {
      setAnnLoading(false);
    }
  };

  // Kích hoạt chọn file tài liệu
  const triggerDocUpload = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    setUploadTypeLabel("DOCUMENT");
    setUploadFeedback(null);
    docInputRef.current?.click();
  };

  // Kích hoạt chọn file video
  const triggerVideoUpload = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    setUploadTypeLabel("VIDEO_HLS");
    setUploadFeedback(null);
    videoInputRef.current?.click();
  };

  const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024;

  const uploadAssetToLesson = async (
    lessonId: string,
    file: File,
    kind: "VIDEO_HLS" | "DOCUMENT",
  ) => {
    if (file.size <= 0) {
      setUploadFeedback({
        type: "error",
        message: `File "${file.name}" đang bị rỗng, vui lòng chọn file hợp lệ.`,
      });
      return;
    }

    if (kind === "VIDEO_HLS" && file.size > MAX_VIDEO_SIZE_BYTES) {
      setUploadFeedback({
        type: "error",
        message: `Video "${file.name}" vượt quá giới hạn tối đa 500MB.`,
      });
      return;
    }

    try {
      setSelectedLessonId(lessonId);
      setUploadTypeLabel(kind);
      setIsUploading(true);
      setUploadProgress(0);
      setUploadFeedback(null);

      if (kind === "VIDEO_HLS") {
        await teacherApi.uploadLessonVideo(lessonId, file, (percent) => {
          setUploadProgress(percent);
        });
        setUploadFeedback({
          type: "success",
          message: `Đã tải video "${file.name}". Đang mã hóa HLS.`,
        });
      } else {
        await teacherApi.uploadLessonDocument(lessonId, file);
        setUploadFeedback({
          type: "success",
          message: `Đã tải tài liệu "${file.name}".`,
        });
      }
      await loadLessons();
    } catch (err: any) {
      console.error(
        kind === "VIDEO_HLS" ? "Lỗi upload video:" : "Lỗi upload tài liệu:",
        err,
      );
      const serverMessage = err?.response?.data?.message;
      const networkFallback =
        !err?.response
          ? `Không thể kết nối máy chủ khi tải "${file.name}". Hãy kiểm tra backend đang chạy, đăng nhập lại hoặc thử file ≤ 500MB.`
          : `Tải ${kind === "VIDEO_HLS" ? "video" : "tài liệu"} "${file.name}" thất bại.`;
      setUploadFeedback({
        type: "error",
        message: serverMessage || networkFallback,
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setSelectedLessonId(null);
      if (docInputRef.current) docInputRef.current.value = "";
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

  // Xử lý kéo thả trực tiếp file Video HLS hoặc Tài liệu vào thẻ bài giảng
  const handleLessonDrop = async (e: React.DragEvent<HTMLDivElement>, lessonId: string) => {
    e.preventDefault();
    setDragOverLessonId(null);
    const file = e.dataTransfer.files?.[0];
    if (!file || isUploading) return;

    const isVideo =
      file.type.startsWith("video/") || /\.(mp4|mov|mkv|webm|avi)$/i.test(file.name);
    await uploadAssetToLesson(lessonId, file, isVideo ? "VIDEO_HLS" : "DOCUMENT");
  };

  // Xử lý upload tài liệu
  const handleDocFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedLessonId) return;
    await uploadAssetToLesson(selectedLessonId, file, "DOCUMENT");
  };

  // Xử lý upload video
  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedLessonId) return;
    await uploadAssetToLesson(selectedLessonId, file, "VIDEO_HLS");
  };

  // Thêm bài giảng mới
  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonTitle.trim()) return;

    try {
      setIsCreatingLesson(true);
      const payload = {
        title: lessonTitle.trim(),
        objectives: lessonObjectives.trim(),
        orderIndex: lessons.length + 1,
      };

      await teacherApi.createLesson(classId!, payload);
      setShowLessonModal(false);
      setLessonTitle("");
      setLessonObjectives("");
      setUploadFeedback({
        type: "success",
        message: "Đã tạo bài giảng.",
      });
      await loadLessons();
    } catch (err: any) {
      console.error("Lỗi tạo bài giảng:", err);
      alert(err.response?.data?.message || "Tạo bài giảng thất bại.");
    } finally {
      setIsCreatingLesson(false);
    }
  };

  // Xóa bài giảng
  const handleDeleteLesson = async (lessonId: string, title: string) => {
    if (!window.confirm(`Xóa bài giảng "${title}"?`)) {
      return;
    }

    try {
      await teacherApi.deleteLesson(lessonId);
      setUploadFeedback({
        type: "success",
        message: `Đã xóa bài giảng "${title}".`,
      });
      await loadLessons();
    } catch (err: any) {
      console.error("Lỗi xóa bài giảng:", err);
      alert(err.response?.data?.message || "Xóa bài giảng thất bại.");
    }
  };

  // Gửi thông báo lớp
  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = annTitle.trim();
    const content = annContent.trim();
    if (!title || !content) return;

    try {
      setSendingAnn(true);
      setAnnFeedback(null);
      await teacherApi.createClassAnnouncement(classId!, {
        title,
        content,
      });

      setAnnTitle("");
      setAnnContent("");
      setAnnFeedback({
        type: "success",
        message: "Đã gửi thông báo lớp.",
      });
      await loadAnnouncements();
    } catch (err: any) {
      console.error("Lỗi phát thông báo:", err);
      setAnnFeedback({
        type: "error",
        message:
          err.response?.data?.message ||
          err.message ||
          "Gửi thông báo thất bại.",
      });
    } finally {
      setSendingAnn(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={docInputRef}
        onChange={handleDocFileChange}
        accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp,.mp3,.wav,.m4a,.ogg"
        className="hidden"
      />
      <input
        type="file"
        ref={videoInputRef}
        onChange={handleVideoFileChange}
        accept="video/*"
        className="hidden"
      />

      {/* Unified Classroom Header & Sub-Nav */}
      <ClassroomHeaderNav
        classId={classId!}
        activeTab="details"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubTab("lessons")}
              className={`flex items-center space-x-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                activeSubTab === "lessons"
                  ? "bg-blue-800 text-white shadow-xs"
                  : "border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Bài giảng ({lessons.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab("announcements")}
              className={`flex items-center space-x-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                activeSubTab === "announcements"
                  ? "bg-blue-800 text-white shadow-xs"
                  : "border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Bell className="h-3.5 w-3.5" />
              <span>Thông báo ({announcements.length})</span>
            </button>
          </div>
        }
      />

      {/* Global Action Feedback Alerts */}
      {uploadFeedback && (
        <div
          className={`flex items-center justify-between rounded-xl border p-4 text-xs font-medium transition ${
            uploadFeedback.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
          }`}
        >
          <div className="flex items-center space-x-2">
            {uploadFeedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
            )}
            <span>{uploadFeedback.message}</span>
          </div>
          <button
            onClick={() => setUploadFeedback(null)}
            className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Thanh trạng thái xử lý bất đồng bộ (Async HLS Video Transcoding / Document Storage) */}
      {isUploading && (
        <div className="rounded-xl bg-blue-50/90 dark:bg-slate-900/40 border border-blue-200 dark:border-blue-600/30 p-4 space-y-3 shadow-sm animate-in fade-in">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5 font-bold text-blue-800 dark:text-blue-300">
              <Loader2 className="h-4 w-4 animate-spin text-blue-700 dark:text-blue-400" />
              <span>
                {uploadTypeLabel === "VIDEO_HLS"
                  ? uploadProgress > 0 && uploadProgress < 100
                    ? `Đang tải video (${uploadProgress}%)...`
                    : "Đang tải video & mã hóa HLS..."
                  : "Đang tải tài liệu..."}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-600/20 text-blue-800 dark:text-blue-300 text-[10px] font-bold uppercase tracking-wider">
              {uploadTypeLabel === "VIDEO_HLS" && uploadProgress > 0
                ? `${uploadProgress}%`
                : "Đang xử lý"}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-blue-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full bg-brand-600 transition-all duration-200 ${
                uploadProgress > 0 ? "" : "w-2/3 animate-pulse"
              }`}
              style={uploadProgress > 0 ? { width: `${uploadProgress}%` } : undefined}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600 dark:text-slate-400 pt-0.5">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>1. Tải lên</span>
            </div>
            <div className="flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              <span>
                {uploadTypeLabel === "VIDEO_HLS"
                  ? "2. Mã hóa HLS"
                  : "2. Lưu trữ"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700" />
              <span>3. Hoàn tất</span>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-TAB 1: BÀI GIẢNG & TÀI LIỆU, VIDEO                            */}
      {/* ================================================================= */}
      {activeSubTab === "lessons" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
              <BookOpen className="h-4 w-4 mr-2 text-blue-700 dark:text-blue-400" />
              Bài giảng &amp; Tài liệu
            </h2>
            <button
              onClick={() => setShowLessonModal(true)}
              className="inline-flex items-center space-x-2 rounded-xl bg-blue-800 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-600 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Tạo bài giảng</span>
            </button>
          </div>

          {/* Loading State */}
          {lessonsLoading && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-12 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
              <p className="text-xs">Đang tải...</p>
            </div>
          )}

          {/* Error State */}
          {!lessonsLoading && lessonsError && (
            <div className="flex items-center space-x-3 rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-xs text-red-600 dark:text-red-300">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-500 dark:text-red-400" />
              <div>
                <p className="font-semibold">{lessonsError}</p>
                <button
                  onClick={loadLessons}
                  className="mt-2 text-blue-700 dark:text-blue-400 underline hover:text-blue-600"
                >
                  Thử lại
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!lessonsLoading && !lessonsError && lessons.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-[#162033] text-slate-400 mb-3">
                <BookOpen className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Chưa có bài giảng</h3>
              <button
                onClick={() => setShowLessonModal(true)}
                className="mt-3 inline-flex items-center space-x-2 rounded-xl bg-blue-800 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-600 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Tạo bài giảng</span>
              </button>
            </div>
          )}

          {/* Lessons List */}
          {!lessonsLoading && !lessonsError && lessons.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              {lessons.map((lesson, idx) => {
                const isDragActive = dragOverLessonId === lesson.id;
                const isCurrentLessonUploading = isUploading && selectedLessonId === lesson.id;

                return (
                  <div
                    key={lesson.id}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverLessonId !== lesson.id) setDragOverLessonId(lesson.id);
                    }}
                    onDragLeave={() => setDragOverLessonId(null)}
                    onDrop={(e) => handleLessonDrop(e, lesson.id)}
                    className={`rounded-xl border p-5 transition-all shadow-xs space-y-4 ${
                      isDragActive
                        ? "border-2 border-dashed border-blue-600 bg-blue-50/50 dark:bg-slate-900/30 ring-4 ring-blue-600/10"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-start sm:items-center space-x-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-600/10 text-xs font-extrabold text-blue-700 dark:text-blue-400 border border-blue-200/70 dark:border-blue-600/20">
                          #{lesson.orderIndex || idx + 1}
                        </span>
                        <div>
                          <button
                            type="button"
                            onClick={() => navigate(`/teacher/classrooms/${classId}/lessons/${lesson.id}`)}
                            className="text-left font-bold text-slate-900 dark:text-white hover:text-blue-700 dark:hover:text-blue-400 text-sm sm:text-base transition cursor-pointer"
                          >
                            {lesson.title}
                          </button>
                          {lesson.objectives && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                              {lesson.objectives}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {lesson.hasVideo ? (
                          <span
                            className={`flex items-center rounded-lg px-2.5 py-1 font-bold border ${
                              lesson.videoStatus === "APPROVED"
                                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                                : lesson.videoStatus === "REJECTED"
                                  ? "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20"
                                  : lesson.videoStatus === "PROCESSING" || lesson.videoStatus === "DRAFT"
                                    ? "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/20"
                                    : lesson.videoStatus === "PENDING_REVIEW" || lesson.videoStatus === "READY"
                                      ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20"
                                      : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                            }`}
                          >
                            <Video className="h-3.5 w-3.5 mr-1.5" />
                            {lesson.videoStatus === "APPROVED"
                              ? "Video đã duyệt"
                              : lesson.videoStatus === "REJECTED"
                                ? "Video bị từ chối"
                                : lesson.videoStatus === "PROCESSING" || lesson.videoStatus === "DRAFT"
                                  ? "Đang xử lý HLS"
                                  : lesson.videoStatus === "PENDING_REVIEW" || lesson.videoStatus === "READY"
                                    ? "Video chờ duyệt"
                                    : "Có Video HLS"}
                          </span>
                        ) : (
                          <span className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-slate-500 dark:text-slate-400 font-medium">
                            Chưa có video
                          </span>
                        )}

                        <span className="flex items-center rounded-lg bg-blue-50 dark:bg-blue-600/10 px-2.5 py-1 font-bold text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-600/20 tabular-nums">
                          <FileText className="h-3.5 w-3.5 mr-1.5" />
                          {lesson.documentsCount || 0} tài liệu
                        </span>

                        {typeof lesson.vocabulariesCount === "number" && (
                          <span className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                            <BookA className="h-3.5 w-3.5 mr-1 text-blue-700 dark:text-blue-400" />
                            {lesson.vocabulariesCount} từ vựng
                          </span>
                        )}

                        {typeof lesson.grammarTopicsCount === "number" && (
                          <span className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                            <BookOpenCheck className="h-3.5 w-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                            {lesson.grammarTopicsCount} ngữ pháp
                          </span>
                        )}

                        {lesson.hasVideo && (
                          <button
                            type="button"
                            onClick={() => navigate(`/teacher/classrooms/${classId}/lessons/${lesson.id}`)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700 dark:text-emerald-300 transition cursor-pointer"
                          >
                            <PlayCircle className="h-3.5 w-3.5" />
                            <span>Xem video</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => navigate(`/teacher/classrooms/${classId}/lessons/${lesson.id}`)}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-800 hover:bg-blue-700 px-3 py-1 font-semibold text-white shadow-xs transition cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Xem &amp; Chỉnh sửa</span>
                        </button>

                        <button
                          onClick={() => handleDeleteLesson(lesson.id, lesson.title)}
                          title="Xóa bài giảng"
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 transition ml-1 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {lesson.videoStatus === "REJECTED" && lesson.videoRejectionReason && (
                      <div className="rounded-lg border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/20 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                        <strong>Video bị từ chối:</strong> {lesson.videoRejectionReason}
                      </div>
                    )}

                    {/* Interactive Drag & Drop Upload Zones for Document & HLS Video */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => triggerDocUpload(lesson.id)}
                        disabled={isUploading}
                        className="group flex items-center justify-between rounded-xl border border-dashed border-blue-300 dark:border-blue-600/30 bg-blue-50/40 dark:bg-slate-900/20 hover:bg-blue-50 dark:hover:bg-slate-900/40 hover:border-blue-600 px-4 py-3 text-left transition cursor-pointer disabled:opacity-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-800/10 text-blue-700 dark:text-blue-400 group-hover:scale-105 transition-transform">
                            {isCurrentLessonUploading && uploadTypeLabel === "DOCUMENT" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              Tải tài liệu
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              Kéo thả PDF, Word, Slide
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-md bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-600/30">
                          Chọn file
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => triggerVideoUpload(lesson.id)}
                        disabled={isUploading}
                        className="group flex items-center justify-between rounded-xl border border-dashed border-rose-300 dark:border-rose-500/30 bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-500 px-4 py-3 text-left transition cursor-pointer disabled:opacity-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:scale-105 transition-transform">
                            {isCurrentLessonUploading && uploadTypeLabel === "VIDEO_HLS" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Video className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              Tải video (HLS)
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              MP4, MOV • Mã hóa HLS
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-md bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
                          Chọn video
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-TAB 2: THÔNG BÁO LỚP HỌC                                      */}
      {/* ================================================================= */}
      {activeSubTab === "announcements" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-4 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center">
                <Send className="h-4 w-4 mr-2 text-blue-700 dark:text-blue-400" />
                Gửi thông báo
              </h2>

              {annFeedback && (
                <div
                  className={`flex items-center space-x-2 rounded-xl border p-3 text-xs ${
                    annFeedback.type === "success"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
                  }`}
                >
                  {annFeedback.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
                  )}
                  <span>{annFeedback.message}</span>
                </div>
              )}

              <form onSubmit={handleSendAnnouncement} className="space-y-3">
                <div>
                  <label className="text-xs text-slate-700 dark:text-slate-300 block mb-1 font-medium">
                    Tiêu đề:
                  </label>
                  <input
                    type="text"
                    placeholder="Nhập tiêu đề..."
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b1120] p-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-600 transition"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-700 dark:text-slate-300 block mb-1 font-medium">
                    Nội dung:
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Nhập nội dung..."
                    value={annContent}
                    onChange={(e) => setAnnContent(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b1120] p-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-600 transition"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={sendingAnn}
                  className="w-full flex items-center justify-center space-x-2 rounded-xl bg-blue-800 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-600 transition disabled:opacity-50"
                >
                  {sendingAnn ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Đang gửi...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Gửi thông báo</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center">
                <Bell className="h-4 w-4 mr-2 text-blue-700 dark:text-blue-400" />
                Thông báo đã gửi ({announcements.length})
              </h2>
              <button
                onClick={loadAnnouncements}
                className="text-xs text-blue-700 dark:text-blue-400 hover:text-blue-600"
              >
                Làm mới
              </button>
            </div>

            {annLoading && (
              <div className="flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-10 text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
                <span className="text-xs">Đang tải...</span>
              </div>
            )}

            {!annLoading && announcements.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-10 text-center">
                <Inbox className="h-8 w-8 text-slate-400 mb-2" />
                <p className="text-xs text-slate-500 dark:text-slate-400">Chưa có thông báo.</p>
              </div>
            )}

            {!annLoading && announcements.length > 0 && (
              <div className="space-y-3">
                {announcements.map((ann, idx) => (
                  <div
                    key={ann.id || idx}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-2 hover:border-slate-300 dark:hover:border-slate-700 transition shadow-sm"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900 dark:text-white text-sm">
                        {ann.title}
                      </span>
                      <span className="text-slate-500">
                        {ann.createdAt
                          ? new Date(ann.createdAt).toLocaleString("vi-VN")
                          : "Gần đây"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                      {ann.message || ann.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL THÊM BÀI GIẢNG                                             */}
      {/* ================================================================= */}
      {showLessonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-elevated space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Tạo bài giảng</h2>
            <form onSubmit={handleCreateLesson} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">
                  Tên bài giảng:
                </label>
                <input
                  type="text"
                  placeholder="VD: Unit 3: Conditionals"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b1120] p-2.5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">
                  Mục tiêu:
                </label>
                <textarea
                  rows={3}
                  placeholder="Kỹ năng, từ vựng, ngữ pháp..."
                  value={lessonObjectives}
                  onChange={(e) => setLessonObjectives(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b1120] p-2.5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowLessonModal(false)}
                  className="rounded-xl bg-slate-100 dark:bg-[#162033] px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isCreatingLesson}
                  className="inline-flex items-center space-x-1.5 rounded-xl bg-blue-800 px-4 py-2 font-semibold text-white hover:bg-blue-600 shadow-xs transition disabled:opacity-50"
                >
                  {isCreatingLesson ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>Lưu</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}