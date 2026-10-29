// src/features/admin/pages/ClassroomDetailPage.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { adminApi } from "@/features/admin/api/adminApi";
import { studentApi } from "@/features/student/api/studentApi";
import type { ClassroomResponse, StudentEnrollmentItem } from "@/features/admin/types";
import type { UserSummaryDto } from "@/types/api";
import type { LessonSummary } from "@/features/student/types"; // Import chuẩn xác
import {
  Loader2,
  ArrowLeft,
  Settings2,
  Shield,
  UserPlus,
  Video,
  CheckCircle,
  XCircle,
  AlertCircle,
  PlayCircle,
  FileVideo,
  BookOpen,
  Plus,
  Trash2,
  Users,
  GraduationCap,
  Calendar,
  Check,
  UserX,
  School,
} from "lucide-react";
import VideoPlayer from "@/features/student/components/VideoPlayer";

export default function ClassroomDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    "settings" | "students" | "videos" | "lessons"
  >("lessons");

  const [classroom, setClassroom] = useState<ClassroomResponse | null>(null);
  const [teachers, setTeachers] = useState<UserSummaryDto[]>([]);
  const [pendingVideos, setPendingVideos] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<StudentEnrollmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form States
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [enrollIdentifier, setEnrollIdentifier] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Video States
  const [rejectingVideoId, setRejectingVideoId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Lesson States
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [lessonForm, setLessonForm] = useState({
    title: "",
    objectives: "",
    content: "",
    orderIndex: 1,
  });

  const fetchData = async () => {
    if (!classId) return;
    setLoading(true);
    try {
      // 1. Tải thông tin lớp học và giáo viên
      const [classRes, usersRes] = await Promise.all([
        adminApi.getClassrooms(0, 100),
        adminApi.getUsers(0, 100),
      ]);

      const current = classRes.content.find((c) => c.id === classId);
      if (current) {
        setClassroom(current);
        setSelectedTeacherId(current.teacherId || "");
        setNewStatus(current.status);
      }
      setTeachers(
        usersRes.content.filter((u) => u.roles.includes("ROLE_TEACHER")),
      );

      // 2. Tải danh sách bài giảng của lớp
      let fetchedLessons: any[] = [];
      try {
        fetchedLessons = await adminApi.getLessonsByClass(classId);
        fetchedLessons.sort((a, b) => a.orderIndex - b.orderIndex);
        setLessons(fetchedLessons);
        setLessonForm((prev) => ({
          ...prev,
          orderIndex: fetchedLessons.length + 1,
        }));
      } catch (e) {
        console.warn("Lỗi tải bài giảng", e);
      }

      // 3. Tải Video chờ duyệt & Lọc theo lớp
      try {
        const videosRes = await adminApi.getPendingVideos();
        if (Array.isArray(videosRes)) {
          const lessonIds = fetchedLessons.map((l) => l.id);
          const classVideos = videosRes.filter((vid: any) => {
            if (vid.lesson?.classroom?.id === classId) return true;
            if (vid.lesson?.classId === classId) return true;
            if (vid.classroomId === classId) return true;
            if (vid.lesson?.id && lessonIds.includes(vid.lesson.id))
              return true;
            if (vid.lessonId && lessonIds.includes(vid.lessonId)) return true;
            return false;
          });
          setPendingVideos(classVideos);
        }
      } catch (videoErr) {
        setPendingVideos([]);
      }

      // 4. Tải danh sách học viên trong lớp
      try {
        const students = await adminApi.getClassStudents(classId);
        setEnrolledStudents(students);
      } catch (stErr) {
        console.warn("Lỗi tải học viên lớp", stErr);
        setEnrolledStudents([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [classId]);

  // --- HANDLERS CHO BÀI GIẢNG (LESSONS) ---
  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId) return;
    setIsProcessing(true);
    try {
      await adminApi.createLesson({ ...lessonForm, classId });
      alert("Tạo bài giảng mới thành công!");
      setIsLessonModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi tạo bài giảng");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (
      !window.confirm(
        "CẢNH BÁO: Xóa bài giảng sẽ xóa toàn bộ Từ vựng, Ngữ pháp và Video bên trong. Tiếp tục?",
      )
    )
      return;
    try {
      await adminApi.deleteLesson(lessonId);
      alert("Đã xóa bài giảng!");
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi khi xóa bài giảng");
    }
  };

  // --- CÁC HANDLERS CŨ (GÁN GV, DUYỆT VIDEO, GHI DANH...) ---
  const handleUpdateStatus = async () => {
    if (!classId || !newStatus) return;
    setIsProcessing(true);
    try {
      await adminApi.updateClassStatus(classId, newStatus);
      alert("Thành công!");
      fetchData();
    } catch (err) {
      alert("Lỗi cập nhật trạng thái");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAssignTeacher = async () => {
    if (!classId || !selectedTeacherId) return;
    setIsProcessing(true);
    try {
      await adminApi.assignTeacher(classId, selectedTeacherId);
      alert("Thành công!");
      fetchData();
    } catch (err) {
      alert("Lỗi gán giáo viên");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId || !enrollIdentifier.trim()) return;
    setIsProcessing(true);
    try {
      await adminApi.enrollStudent(classId, enrollIdentifier.trim());
      alert("Thành công!");
      setEnrollIdentifier("");
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi ghi danh");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveStudent = async (studentId: string, studentName: string) => {
    if (!classId) return;
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa học viên "${studentName}" khỏi lớp học này?`,
      )
    )
      return;
    setIsProcessing(true);
    try {
      await adminApi.removeStudentFromClass(classId, studentId);
      alert("Đã xóa học viên khỏi lớp học!");
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi khi xóa học viên khỏi lớp");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveVideo = async (id: string) => {
    if (!window.confirm("Phê duyệt video?")) return;
    setIsProcessing(true);
    try {
      await adminApi.reviewVideo(id, true);
      alert("Thành công!");
      fetchData();
    } catch (err) {
      alert("Lỗi duyệt video");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingVideoId || !rejectReason.trim()) return;
    setIsProcessing(true);
    try {
      await adminApi.reviewVideo(rejectingVideoId, false, rejectReason);
      setRejectingVideoId(null);
      setRejectReason("");
      alert("Thành công!");
      fetchData();
    } catch (err) {
      alert("Lỗi từ chối video");
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="animate-spin text-blue-700" size={32} />
      </div>
    );
  if (!classroom)
    return (
      <div className="p-10 text-center text-rose-500 font-bold">
        Không tìm thấy thông tin lớp học.
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-in fade-in zoom-in-95 duration-200">
      {/* Clean Open Header */}
      <div className="pb-6 mb-6 border-b border-slate-200 dark:border-slate-800/80 bg-transparent space-y-4">
        <button
          onClick={() => navigate("/admin/classrooms")}
          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-400 text-xs font-bold transition cursor-pointer"
        >
          <ArrowLeft size={14} /> Quay lại danh sách
        </button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-slate-900/40 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/50 mb-2">
              <School size={14} />
              <span>Chi Tiết Lớp Học</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {classroom.name}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 dark:bg-slate-900/50 text-blue-800 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900 uppercase">
              Level: {classroom.level}
            </span>
            <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-[#111827] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-sm">
              Sĩ số: {classroom.currentStudentsCount} / {classroom.maxStudents || "∞"}
            </span>
            <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-[#111827] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-sm">
              GV: {classroom.teacherName || "Chưa phân công"}
            </span>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-6 border-b border-slate-200 px-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("lessons")}
          className={`pb-3 text-sm font-black uppercase tracking-wider transition cursor-pointer border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === "lessons" ? "border-blue-700 text-blue-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          <BookOpen size={16} /> Giáo Trình & Bài Giảng
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`pb-3 text-sm font-black uppercase tracking-wider transition cursor-pointer border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === "settings" ? "border-blue-700 text-blue-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          <Settings2 size={16} /> Cấu hình chung
        </button>
        <button
          onClick={() => setActiveTab("students")}
          className={`pb-3 text-sm font-black uppercase tracking-wider transition cursor-pointer border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === "students" ? "border-blue-700 text-blue-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          <UserPlus size={16} /> Ghi danh Học viên
        </button>
        <button
          onClick={() => setActiveTab("videos")}
          className={`pb-3 text-sm font-black uppercase tracking-wider transition cursor-pointer border-b-2 flex items-center gap-2 whitespace-nowrap relative ${activeTab === "videos" ? "border-rose-600 text-rose-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          <Video size={16} /> Kiểm duyệt Video
          {pendingVideos.length > 0 && (
            <span className="absolute -top-3 -right-4 bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-sm">
              {pendingVideos.length}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB CONTENT: BÀI GIẢNG (LESSONS)                          */}
      {/* ========================================================= */}
      {activeTab === "lessons" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                Cấu trúc Giáo trình
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tạo các bài giảng (Lesson) để giảng viên có thể tải lên Video và
                Từ vựng.
              </p>
            </div>
            <button
              onClick={() => setIsLessonModalOpen(true)}
              className="flex items-center gap-2 bg-blue-800 hover:bg-blue-800 text-white px-4 py-2.5 rounded-xl font-bold transition shadow-sm cursor-pointer text-sm"
            >
              <Plus size={16} /> Thêm Bài Giảng
            </button>
          </div>

          <div className="grid gap-3">
            {lessons.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 p-12 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-slate-500 dark:text-slate-400 text-sm font-semibold">
                Lớp học này chưa có bài giảng nào. Hãy bấm "Thêm Bài Giảng" để
                bắt đầu.
              </div>
            ) : (
              lessons.map((lesson, idx) => (
                <div
                  key={lesson.id}
                  onClick={() => navigate(`/admin/lessons/${lesson.id}`)}
                  className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between group hover:border-blue-400 dark:hover:border-blue-600/50 hover:shadow-md transition cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-slate-900/60 text-blue-800 dark:text-blue-300 font-black flex items-center justify-center text-lg">
                      {lesson.orderIndex || idx + 1}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                        {lesson.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                        {lesson.objectives || "Chưa có mục tiêu bài học"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteLesson(lesson.id);
                      }}
                      className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition cursor-pointer"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL TẠO BÀI GIẢNG MỚI */}
      {isLessonModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl shadow-elevated w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
              <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                Tạo Bài Giảng Mới
              </h2>
              <button
                onClick={() => setIsLessonModalOpen(false)}
                className="text-slate-400 hover:text-rose-500 cursor-pointer"
              >
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateLesson} className="p-6 space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Thứ tự
                  </label>
                  <input
                    required
                    type="number"
                    value={lessonForm.orderIndex}
                    onChange={(e) =>
                      setLessonForm({
                        ...lessonForm,
                        orderIndex: Number(e.target.value),
                      })
                    }
                    className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-blue-700 text-sm font-bold"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tên Bài Giảng
                  </label>
                  <input
                    required
                    type="text"
                    value={lessonForm.title}
                    onChange={(e) =>
                      setLessonForm({ ...lessonForm, title: e.target.value })
                    }
                    className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-blue-700 text-sm font-bold"
                    placeholder="VD: Unit 1 - Introduction"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mục tiêu bài học (Objectives)
                </label>
                <textarea
                  rows={2}
                  value={lessonForm.objectives}
                  onChange={(e) =>
                    setLessonForm({ ...lessonForm, objectives: e.target.value })
                  }
                  className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-blue-700 text-sm"
                  placeholder="VD: Học viên nắm được từ vựng chào hỏi cơ bản..."
                />
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLessonModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white bg-blue-800 hover:bg-blue-800 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isProcessing && (
                    <Loader2 size={16} className="animate-spin" />
                  )}{" "}
                  Lưu Bài Giảng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* CÁC TAB CÒN LẠI (VIDEOS, STUDENTS, SETTINGS)              */}
      {/* ========================================================= */}

      {activeTab === "videos" && (
        <div className="space-y-6">
          {pendingVideos.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-16 rounded-xl border border-slate-200 dark:border-slate-800 text-center shadow-sm">
              <CheckCircle
                size={56}
                className="text-emerald-400 mx-auto mb-4"
              />
              <h3 className="text-xl font-bold text-slate-800">
                Không có video nào cần duyệt.
              </h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pendingVideos.map((vid) => (
                <div
                  key={vid.id}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col"
                >
                  <div className="bg-black aspect-video relative flex items-center justify-center">
                    {vid.hlsPlaylistUrl ? (
                      <VideoPlayer
                        videoId={vid.id}
                        streamUrl={vid.hlsPlaylistUrl}
                        enableProgressSync={false}
                      />
                    ) : (
                      <div className="text-white/50 flex flex-col items-center">
                        <PlayCircle size={40} />
                        <span className="mt-2 text-xs">Video lỗi</span>
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2 truncate">
                      <FileVideo className="text-rose-500 shrink-0" size={18} />{" "}
                      {vid.originalFileName}
                    </h3>
                    <div className="mt-6 pt-4 border-t border-slate-100 flex gap-3">
                      <button
                        onClick={() => handleApproveVideo(vid.id)}
                        disabled={isProcessing}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle size={16} /> Phê Duyệt
                      </button>
                      <button
                        onClick={() => setRejectingVideoId(vid.id)}
                        disabled={isProcessing}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-rose-50 text-rose-700 px-4 py-2.5 rounded-xl font-bold cursor-pointer border border-rose-200 disabled:opacity-50"
                      >
                        <XCircle size={16} /> Từ Chối
                      </button>
                    </div>
                    {rejectingVideoId === vid.id && (
                      <form
                        onSubmit={handleRejectVideo}
                        className="mt-4 p-4 bg-rose-50 border border-rose-100 rounded-xl space-y-3"
                      >
                        <textarea
                          required
                          rows={2}
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="w-full text-sm p-2.5 border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                          placeholder="Lý do từ chối..."
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setRejectingVideoId(null)}
                            className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                          >
                            Hủy
                          </button>
                          <button
                            type="submit"
                            disabled={isProcessing}
                            className="px-4 py-1.5 text-xs font-bold bg-rose-600 text-white rounded-lg cursor-pointer"
                          >
                            Gửi
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "settings" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="font-black text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Shield size={18} className="text-blue-700" /> Phân công Giảng
              viên
            </h3>
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-blue-700 text-sm font-bold text-slate-900 bg-slate-50"
            >
              <option value="" disabled>
                -- Vui lòng chọn --
              </option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.lastName} {t.firstName} ({t.email})
                </option>
              ))}
            </select>
            <button
              onClick={handleAssignTeacher}
              disabled={isProcessing || !selectedTeacherId}
              className="w-full py-3 bg-blue-800 text-white rounded-xl font-bold hover:bg-blue-800 cursor-pointer"
            >
              Lưu Giảng Viên
            </button>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="font-black text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Settings2 size={18} className="text-blue-700" /> Đổi trạng thái
              Lớp
            </h3>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-blue-700 text-sm font-bold text-slate-900 bg-slate-50"
            >
              <option value="PLANNING">Lên kế hoạch (PLANNING)</option>
              <option value="OPEN">Mở đăng ký (OPEN)</option>
              <option value="IN_PROGRESS">Đang giảng dạy (IN_PROGRESS)</option>
              <option value="COMPLETED">Đã kết thúc (COMPLETED)</option>
              <option value="CANCELLED">Hủy bỏ (CANCELLED)</option>
            </select>
            <button
              onClick={handleUpdateStatus}
              disabled={isProcessing || !newStatus}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 cursor-pointer"
            >
              Lưu Trạng Thái
            </button>
          </div>
        </div>
      )}

      {activeTab === "students" && (
        <div className="space-y-6">
          {/* TOP CARDS: ENROLL FORM & CLASS CAPACITY */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="mb-4">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <UserPlus className="text-blue-700" size={18} /> Ghi Danh Học Viên Mới
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Nhập Email hoặc Số điện thoại của tài khoản học viên để thêm vào lớp học này.
                </p>
              </div>
              <form onSubmit={handleEnrollStudent} className="flex flex-col sm:flex-row gap-3">
                <input
                  required
                  type="text"
                  value={enrollIdentifier}
                  onChange={(e) => setEnrollIdentifier(e.target.value)}
                  className="flex-1 border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-blue-700 text-sm font-bold text-slate-900"
                  placeholder="VD: student@example.com hoặc 0912345678"
                />
                <button
                  type="submit"
                  disabled={isProcessing || !enrollIdentifier.trim()}
                  className="flex justify-center items-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer disabled:opacity-50 transition shadow-sm text-xs whitespace-nowrap"
                >
                  {isProcessing && <Loader2 size={16} className="animate-spin" />} Ghi Danh Vào Lớp
                </button>
              </form>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Sĩ Số Lớp Hiện Tại
                </span>
                <div className="text-2xl font-black text-slate-900 mt-2">
                  {enrolledStudents.length}{" "}
                  <span className="text-sm font-semibold text-slate-500">
                    / {classroom.maxStudents || "∞"} học viên
                  </span>
                </div>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mt-4">
                <div
                  className="bg-blue-800 h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      classroom.maxStudents
                        ? Math.min(
                            100,
                            Math.round(
                              (enrolledStudents.length / classroom.maxStudents) * 100,
                            ),
                          )
                        : 50
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* BOTTOM TABLE: ENROLLED STUDENTS LIST */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Users className="text-blue-700" size={18} /> Danh Sách Học Viên Đang Theo Học ({enrolledStudents.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Theo dõi tiến độ hoàn thành bài tập, điểm số trung bình và quản lý danh sách lớp.
                </p>
              </div>
            </div>

            {enrolledStudents.length === 0 ? (
              <div className="p-16 text-center text-slate-500">
                <Users size={48} className="mx-auto text-slate-300 mb-3" />
                <h4 className="text-base font-bold text-slate-800">Lớp học chưa có học viên</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Sử dụng ô tìm kiếm phía trên để ghi danh học viên đầu tiên vào lớp.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black border-b border-slate-200 dark:border-slate-700">
                      <th className="p-4 pl-6">Học Viên</th>
                      <th className="p-4">Liên Hệ</th>
                      <th className="p-4">Ngày Ghi Danh</th>
                      <th className="p-4 text-center">Tiến Độ Bài Tập</th>
                      <th className="p-4 text-center">Điểm Trung Bình</th>
                      <th className="p-4 pr-6 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {enrolledStudents.map((st) => {
                      const studentName =
                        st.fullName ||
                        `${st.lastName || ""} ${st.firstName || ""}`.trim() ||
                        st.email;
                      const completion = st.completionRate ?? 0;
                      return (
                        <tr key={st.studentId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition">
                          <td className="p-4 pl-6">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-xs shadow-inner">
                                {studentName.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900">{studentName}</p>
                              </div>
                            </div>
                          </td>

                          <td className="p-4 text-slate-600 text-xs">
                            <div className="font-semibold text-slate-800">{st.email}</div>
                            {st.phone && <div className="text-slate-400 mt-0.5">{st.phone}</div>}
                          </td>

                          <td className="p-4 text-slate-500 text-xs">
                            {st.enrolledAt ? new Date(st.enrolledAt).toLocaleDateString("vi-VN") : "—"}
                          </td>

                          <td className="p-4 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-xs font-bold text-slate-800">{completion}%</span>
                              <div className="w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                                <div
                                  className="bg-emerald-500 h-full rounded-full"
                                  style={{ width: `${completion}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-slate-400 mt-0.5">
                                {st.completedTasks ?? 0}/{st.totalTasks ?? 0} bài
                              </span>
                            </div>
                          </td>

                          <td className="p-4 text-center">
                            <span className="font-black text-slate-900 text-sm">
                              {st.averageScore !== undefined && st.averageScore !== null
                                ? Number(st.averageScore).toFixed(1)
                                : "—"}
                            </span>
                          </td>

                          <td className="p-4 pr-6 text-right">
                            <button
                              onClick={() => handleRemoveStudent(st.studentId, studentName)}
                              disabled={isProcessing}
                              title="Xóa học viên khỏi lớp"
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            >
                              <UserX size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
