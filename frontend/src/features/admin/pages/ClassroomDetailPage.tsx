import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { adminApi } from "@/features/admin/api/adminApi";
import { studentApi } from "@/features/student/api/studentApi";
import type { ClassroomResponse, StudentEnrollmentItem } from "@/features/admin/types";
import type { UserSummaryDto } from "@/types/api";
import { Loader2 } from "lucide-react";
import {
  ClassroomOverviewHeader,
  ClassroomCurriculumTab,
  ClassroomStudentsTab,
  ClassroomSettingsTab,
  ClassroomVideoReviewTab,
} from "@/features/admin/components/classroom";

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
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchData = async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const [classRes, teacherRes, videoRes, studentRes] = await Promise.all([
        adminApi.getClassrooms(0, 100),
        adminApi.getUsers(0, 100, "ROLE_TEACHER"),
        adminApi.getPendingVideos(),
        adminApi.getClassStudents(classId),
      ]);

      const found = classRes.content.find((c: ClassroomResponse) => c.id === classId);
      if (found) {
        setClassroom(found);
        setSelectedTeacherId(found.teacherId || "");
        setNewStatus(found.status || "PLANNING");
      }

      setTeachers(teacherRes.content);
      setPendingVideos(videoRes);
      setEnrolledStudents(studentRes || []);

      // Fetch lessons
      try {
        const lessonRes = await studentApi.getClassLessons(classId);
        setLessons(lessonRes || []);
      } catch {
        setLessons([]);
      }
    } catch {
      console.error("Lỗi khi tải dữ liệu chi tiết lớp học");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [classId]);

  const handleAssignTeacher = async () => {
    if (!classId || !selectedTeacherId) return;
    setIsProcessing(true);
    try {
      await adminApi.assignTeacher(classId, selectedTeacherId);
      alert("Phân công giảng viên thành công!");
      fetchData();
    } catch {
      alert("Lỗi phân công giảng viên");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!classId || !newStatus) return;
    setIsProcessing(true);
    try {
      await adminApi.updateClassStatus(classId, newStatus);
      alert("Cập nhật trạng thái thành công!");
      fetchData();
    } catch {
      alert("Lỗi cập nhật trạng thái");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateLesson = async (form: {
    title: string;
    objectives: string;
    content: string;
    orderIndex: number;
  }) => {
    if (!classId) return false;
    setIsProcessing(true);
    try {
      await adminApi.createLesson({ classId, ...form });
      alert("Tạo bài giảng thành công!");
      await fetchData();
      return true;
    } catch {
      alert("Lỗi khi tạo bài giảng");
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa bài giảng này?")) return;
    try {
      await adminApi.deleteLesson(lessonId);
      alert("Đã xóa bài giảng!");
      fetchData();
    } catch {
      alert("Lỗi khi xóa bài giảng");
    }
  };

  const handleEnrollStudent = async (identifier: string) => {
    if (!classId) return false;
    setIsProcessing(true);
    try {
      await adminApi.enrollStudent(classId, identifier);
      alert("Ghi danh học viên thành công!");
      await fetchData();
      return true;
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi khi ghi danh học viên");
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveStudent = async (studentId: string, studentName: string) => {
    if (!classId) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa học viên "${studentName}" khỏi lớp?`)) {
      return;
    }
    setIsProcessing(true);
    try {
      await adminApi.removeStudentFromClass(classId, studentId);
      alert(`Đã xóa học viên ${studentName} khỏi lớp!`);
      fetchData();
    } catch {
      alert("Lỗi khi xóa học viên khỏi lớp");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveVideo = async (id: string) => {
    setIsProcessing(true);
    try {
      await adminApi.reviewVideo(id, true);
      alert("Phê duyệt video thành công!");
      fetchData();
    } catch {
      alert("Lỗi duyệt video");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectVideo = async (id: string, reason: string) => {
    setIsProcessing(true);
    try {
      await adminApi.reviewVideo(id, false, reason);
      alert("Đã từ chối video!");
      fetchData();
      return true;
    } catch {
      alert("Lỗi từ chối video");
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="animate-spin text-blue-700" size={32} />
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className="p-10 text-center text-rose-500 font-bold">
        Không tìm thấy thông tin lớp học.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-in fade-in zoom-in-95 duration-200">
      <ClassroomOverviewHeader
        classroom={classroom}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingVideosCount={pendingVideos.length}
        onBack={() => navigate("/admin/classrooms")}
      />

      {activeTab === "lessons" && (
        <ClassroomCurriculumTab
          lessons={lessons}
          isProcessing={isProcessing}
          onDeleteLesson={handleDeleteLesson}
          onCreateLesson={handleCreateLesson}
        />
      )}

      {activeTab === "settings" && (
        <ClassroomSettingsTab
          teachers={teachers}
          selectedTeacherId={selectedTeacherId}
          setSelectedTeacherId={setSelectedTeacherId}
          newStatus={newStatus}
          setNewStatus={setNewStatus}
          isProcessing={isProcessing}
          onAssignTeacher={handleAssignTeacher}
          onUpdateStatus={handleUpdateStatus}
        />
      )}

      {activeTab === "students" && (
        <ClassroomStudentsTab
          classroom={classroom}
          enrolledStudents={enrolledStudents}
          isProcessing={isProcessing}
          onEnrollStudent={handleEnrollStudent}
          onRemoveStudent={handleRemoveStudent}
        />
      )}

      {activeTab === "videos" && (
        <ClassroomVideoReviewTab
          pendingVideos={pendingVideos}
          isProcessing={isProcessing}
          onApproveVideo={handleApproveVideo}
          onRejectVideo={handleRejectVideo}
        />
      )}
    </div>
  );
}
