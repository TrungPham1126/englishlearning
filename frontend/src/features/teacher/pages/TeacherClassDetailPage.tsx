import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
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
} from "lucide-react";
import { teacherApi, type LessonItem } from "../api/teacherApi";
import ClassroomHeaderNav from "../components/ClassroomHeaderNav";

export default function TeacherClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();

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
      setLessonsError("Không thể tải danh sách bài giảng. Vui lòng thử lại sau.");
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
    setUploadFeedback(null);
    docInputRef.current?.click();
  };

  // Kích hoạt chọn file video
  const triggerVideoUpload = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    setUploadFeedback(null);
    videoInputRef.current?.click();
  };

  // Xử lý upload tài liệu
  const handleDocFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedLessonId) return;

    try {
      setIsUploading(true);
      setUploadFeedback(null);
      await teacherApi.uploadLessonDocument(selectedLessonId, file);
      setUploadFeedback({
        type: "success",
        message: `Đã upload thành công tài liệu: "${file.name}"`,
      });
      await loadLessons();
    } catch (err: any) {
      console.error("Lỗi upload tài liệu:", err);
      setUploadFeedback({
        type: "error",
        message:
          err.response?.data?.message ||
          `Không thể upload "${file.name}". Vui lòng kiểm tra dung lượng hoặc định dạng file.`,
      });
    } finally {
      setIsUploading(false);
      setSelectedLessonId(null);
      if (docInputRef.current) docInputRef.current.value = "";
    }
  };

  // Xử lý upload video
  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedLessonId) return;

    try {
      setIsUploading(true);
      setUploadFeedback(null);
      await teacherApi.uploadLessonVideo(selectedLessonId, file);
      setUploadFeedback({
        type: "success",
        message: `Đã tải lên video bài giảng: "${file.name}". Hệ thống đang xử lý mã hóa.`,
      });
      await loadLessons();
    } catch (err: any) {
      console.error("Lỗi upload video:", err);
      setUploadFeedback({
        type: "error",
        message:
          err.response?.data?.message ||
          `Không thể tải lên video "${file.name}". Vui lòng thử lại.`,
      });
    } finally {
      setIsUploading(false);
      setSelectedLessonId(null);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
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
        message: "Đã tạo bài giảng mới thành công!",
      });
      await loadLessons();
    } catch (err: any) {
      console.error("Lỗi tạo bài giảng:", err);
      alert(err.response?.data?.message || "Không thể tạo bài giảng. Vui lòng kiểm tra lại kết nối.");
    } finally {
      setIsCreatingLesson(false);
    }
  };

  // Xóa bài giảng
  const handleDeleteLesson = async (lessonId: string, title: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bài giảng "${title}" không?`)) {
      return;
    }

    try {
      await teacherApi.deleteLesson(lessonId);
      setUploadFeedback({
        type: "success",
        message: `Đã xóa bài giảng "${title}" thành công.`,
      });
      await loadLessons();
    } catch (err: any) {
      console.error("Lỗi xóa bài giảng:", err);
      alert(err.response?.data?.message || "Không thể xóa bài giảng.");
    }
  };

  // Gửi thông báo lớp
  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;

    try {
      setSendingAnn(true);
      setAnnFeedback(null);
      await teacherApi.createClassAnnouncement(classId!, {
        title: annTitle.trim(),
        content: annContent.trim(),
      });

      setAnnTitle("");
      setAnnContent("");
      setAnnFeedback({
        type: "success",
        message: "Đã phát thông báo thành công đến toàn bộ học viên trong lớp!",
      });
      await loadAnnouncements();
    } catch (err: any) {
      console.error("Lỗi phát thông báo:", err);
      setAnnFeedback({
        type: "error",
        message:
          err.response?.data?.message ||
          "Không thể gửi thông báo tới lớp. Vui lòng thử lại sau.",
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
        accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
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
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Bài Giảng ({lessons.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab("announcements")}
              className={`flex items-center space-x-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                activeSubTab === "announcements"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white"
              }`}
            >
              <Bell className="h-3.5 w-3.5" />
              <span>Thông Báo ({announcements.length})</span>
            </button>
          </div>
        }
      />

      {/* Global Action Feedback Alerts */}
      {uploadFeedback && (
        <div
          className={`flex items-center justify-between rounded-xl border p-4 text-xs font-medium transition ${
            uploadFeedback.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          <div className="flex items-center space-x-2">
            {uploadFeedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            )}
            <span>{uploadFeedback.message}</span>
          </div>
          <button
            onClick={() => setUploadFeedback(null)}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Loading Overlay khi đang upload */}
      {isUploading && (
        <div className="flex items-center space-x-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 p-3.5 text-xs text-indigo-300">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
          <span>Hệ thống đang tải lên tệp tin và lưu trữ vào kho học liệu, vui lòng đợi trong giây lát...</span>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-TAB 1: BÀI GIẢNG & TÀI LIỆU, VIDEO                            */}
      {/* ================================================================= */}
      {activeSubTab === "lessons" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center">
                <BookOpen className="h-4 w-4 mr-2 text-indigo-400" />
                Khung Chương Trình & Tài Liệu Bài Giảng
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Các bài giảng chính thống kèm giáo án số, video bài giảng và tài liệu PDF
              </p>
            </div>
            <button
              onClick={() => setShowLessonModal(true)}
              className="inline-flex items-center space-x-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Tạo Bài Giảng Mới</span>
            </button>
          </div>

          {/* Loading State */}
          {lessonsLoading && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
              <p className="text-xs">Đang tải danh mục bài giảng của lớp...</p>
            </div>
          )}

          {/* Error State */}
          {!lessonsLoading && lessonsError && (
            <div className="flex items-center space-x-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-xs text-red-300">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
              <div>
                <p className="font-semibold">{lessonsError}</p>
                <button
                  onClick={loadLessons}
                  className="mt-2 text-indigo-400 underline hover:text-indigo-300"
                >
                  Thử tải lại
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!lessonsLoading && !lessonsError && lessons.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/80 text-slate-400 mb-3">
                <BookOpen className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-white">Chưa có bài giảng nào</h3>
              <p className="mt-1 text-xs text-slate-400 max-w-sm">
                Lớp học này chưa có khung bài giảng. Hãy nhấn "Tạo Bài Giảng Mới" để thiết lập nội dung và tải lên tài liệu học tập.
              </p>
              <button
                onClick={() => setShowLessonModal(true)}
                className="mt-4 inline-flex items-center space-x-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Soạn bài học đầu tiên</span>
              </button>
            </div>
          )}

          {/* Lessons List */}
          {!lessonsLoading && !lessonsError && lessons.length > 0 && (
            <div className="grid grid-cols-1 gap-3.5">
              {lessons.map((lesson, idx) => (
                <div
                  key={lesson.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 hover:border-slate-700 transition shadow-sm space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-start sm:items-center space-x-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-xs font-bold text-indigo-400 border border-indigo-500/20">
                        #{lesson.orderIndex || idx + 1}
                      </span>
                      <div>
                        <h3 className="font-semibold text-white text-sm sm:text-base">
                          {lesson.title}
                        </h3>
                        {lesson.objectives && (
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                            {lesson.objectives}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {lesson.hasVideo ? (
                        <span className="flex items-center rounded-lg bg-emerald-500/10 px-2.5 py-1 text-emerald-400 border border-emerald-500/20">
                          <Video className="h-3.5 w-3.5 mr-1" />
                          Đã có Video
                        </span>
                      ) : (
                        <span className="flex items-center rounded-lg bg-slate-800/80 px-2.5 py-1 text-slate-400">
                          Chưa có Video
                        </span>
                      )}

                      <span className="flex items-center rounded-lg bg-slate-800/80 px-2.5 py-1 text-slate-300 border border-slate-700/40">
                        <FileText className="h-3.5 w-3.5 mr-1 text-indigo-400" />
                        {lesson.documentsCount || 0} tài liệu
                      </span>

                      <button
                        onClick={() => handleDeleteLesson(lesson.id, lesson.title)}
                        title="Xóa bài học này"
                        className="p-1 text-slate-500 hover:text-red-400 transition ml-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Attachment Actions */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-800/80">
                    <button
                      onClick={() => triggerDocUpload(lesson.id)}
                      disabled={isUploading}
                      className="flex items-center space-x-1.5 rounded-xl border border-slate-800 bg-slate-800/70 px-3.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-700/80 transition disabled:opacity-50"
                    >
                      <Upload className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Upload Tài Liệu (PDF/Word)</span>
                    </button>

                    <button
                      onClick={() => triggerVideoUpload(lesson.id)}
                      disabled={isUploading}
                      className="flex items-center space-x-1.5 rounded-xl border border-slate-800 bg-slate-800/70 px-3.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-700/80 transition disabled:opacity-50"
                    >
                      <Video className="h-3.5 w-3.5 text-rose-400" />
                      <span>Upload Video Bài Giảng</span>
                    </button>
                  </div>
                </div>
              ))}
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
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4 shadow-xl">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center">
                  <Send className="h-4 w-4 mr-2 text-indigo-400" />
                  Phát Thông Báo Mới
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Thông báo sẽ được gửi tức thì đến chuông thông báo cá nhân của toàn bộ học viên lớp.
                </p>
              </div>

              {annFeedback && (
                <div
                  className={`flex items-center space-x-2 rounded-xl border p-3 text-xs ${
                    annFeedback.type === "success"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-red-500/30 bg-red-500/10 text-red-300"
                  }`}
                >
                  {annFeedback.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                  )}
                  <span>{annFeedback.message}</span>
                </div>
              )}

              <form onSubmit={handleSendAnnouncement} className="space-y-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1 font-medium">
                    Tiêu đề thông báo:
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Lịch nộp bài kiểm tra Speaking Tuần 3"
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-800/60 p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 block mb-1 font-medium">
                    Nội dung thông báo:
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Nhập chi tiết nội dung cần dặn dò, lưu ý hoặc dời lịch..."
                    value={annContent}
                    onChange={(e) => setAnnContent(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-800/60 p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={sendingAnn}
                  className="w-full flex items-center justify-center space-x-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition disabled:opacity-50"
                >
                  {sendingAnn ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Đang phát thông báo...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Gửi thông báo tới cả lớp</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center">
                <Bell className="h-4 w-4 mr-2 text-indigo-400" />
                Lịch Sử Thông Báo ({announcements.length})
              </h2>
              <button
                onClick={loadAnnouncements}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                Làm mới
              </button>
            </div>

            {annLoading && (
              <div className="flex items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40 p-10 text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-500 mr-2" />
                <span className="text-xs">Đang tải lịch sử thông báo...</span>
              </div>
            )}

            {!annLoading && announcements.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-10 text-center">
                <Inbox className="h-8 w-8 text-slate-500 mb-2" />
                <p className="text-xs text-slate-400">Chưa có thông báo nào được phát trong lớp này.</p>
              </div>
            )}

            {!annLoading && announcements.length > 0 && (
              <div className="space-y-3">
                {announcements.map((ann, idx) => (
                  <div
                    key={ann.id || idx}
                    className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-2 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white text-sm">
                        {ann.title}
                      </span>
                      <span className="text-slate-500">
                        {ann.createdAt
                          ? new Date(ann.createdAt).toLocaleString("vi-VN")
                          : "Gần đây"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
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
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white">Soạn Bài Giảng Mới</h2>
            <form onSubmit={handleCreateLesson} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Tên bài giảng:
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Unit 3: Conditionals & Mixed Sentences"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-800/60 p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Mục tiêu bài giảng (Objectives):
                </label>
                <textarea
                  rows={3}
                  placeholder="Mô tả kỹ năng, từ vựng hoặc điểm ngữ pháp trọng tâm..."
                  value={lessonObjectives}
                  onChange={(e) => setLessonObjectives(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-800/60 p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowLessonModal(false)}
                  className="rounded-xl bg-slate-800 px-4 py-2 font-semibold text-slate-300 hover:bg-slate-700 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isCreatingLesson}
                  className="inline-flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
                >
                  {isCreatingLesson ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>Lưu Bài Giảng</span>
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