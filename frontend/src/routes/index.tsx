// src/routes/index.tsx
import { createBrowserRouter, Navigate, useParams } from "react-router-dom";
import type { RouteObject } from "react-router-dom";

// Layouts
import AdminLessonDetailPage from "@/features/admin/pages/AdminLessonDetailPage";
import PublicLayout from "@/components/layouts/PublicLayout";
import StudentLayout from "@/components/layouts/StudentLayout";
import TeacherLayout from "@/components/layouts/TeacherLayout";
import AdminLayout from "@/components/layouts/AdminLayout";
import ProtectedRoute from "@/routes/ProtectedRoute";
import ClassroomDetailPage from "@/features/admin/pages/ClassroomDetailPage";

// Phân hệ Auth
import LoginPage from "@/features/auth/pages/LoginPage";
import RegisterPage from "@/features/auth/pages/RegisterPage";

// Phân hệ Admin
import AdminDashboardPage from "@/features/admin/pages/AdminDashboardPage";
import UserManagementPage from "@/features/admin/pages/UserManagementPage";
import TeacherManagementPage from "@/features/admin/pages/TeacherManagementPage";
import StudentManagementPage from "@/features/admin/pages/StudentManagementPage";
import ClassroomManagementPage from "@/features/admin/pages/ClassroomManagementPage";
import VideoModerationPage from "@/features/admin/pages/VideoModerationPage";
import AdminReportsPage from "@/features/admin/pages/AdminReportsPage";
import SystemBroadcastPage from "@/features/admin/pages/SystemBroadcastPage";
import AuditLogPage from "@/features/admin/pages/AuditLogPage";
import AiMonitoringPage from "@/features/admin/pages/AiMonitoringPage";
import ResourceLibraryPage from "@/features/admin/pages/ResourceLibraryPage";

// Phân hệ Student
import StudentCoursesPage from "@/features/student/pages/StudentCoursesPage";
import ClassLessonsPage from "@/features/student/pages/ClassLessonsPage";
import LessonDetailPage from "@/features/student/pages/LessonDetailPage";
import AssignmentTakePage from "@/features/student/pages/AssignmentTakePage";
import StudentProfilePage from "@/features/student/pages/StudentProfilePage";
import SpeakingAiEvaluationPage from "@/features/student/pages/SpeakingAiEvaluationPage";
import DailyHomeworkPage from "@/features/student/pages/DailyHomeworkPage";

// Phân hệ Teacher
import TeacherDashboardPage from "@/features/teacher/pages/TeacherDashboardPage";
import TeacherClassroomsPage from "@/features/teacher/pages/TeacherClassroomsPage";
import TeacherClassDetailPage from "@/features/teacher/pages/TeacherClassDetailPage";
import TeacherClassStudentsPage from "@/features/teacher/pages/TeacherClassStudentsPage";
import TeacherDailyPlanPage from "@/features/teacher/pages/TeacherDailyPlanPage";
import TeacherGradingPage from "@/features/teacher/pages/TeacherGradingPage";

// Component chuyển hướng tự động sang Daily Plan nếu có ai truy cập URL bài tập lớp cũ
const RedirectToDailyPlan = () => {
  const { classId } = useParams<{ classId: string }>();
  return <Navigate to={`/student/courses/${classId}/daily-plan`} replace />;
};

const routes: RouteObject[] = [
  // 1. Phân hệ Public (Đăng nhập, Đăng ký đã đóng chuyển hướng về Đăng nhập)
  {
    element: <PublicLayout />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <Navigate replace to="/login" /> },
    ],
  },

  // 2. Phân hệ Student (Chỉ ROLE_STUDENT truy cập)
  {
    path: "/student",
    element: (
      <ProtectedRoute allowedRoles={["ROLE_STUDENT"]}>
        <StudentLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/student/courses" replace /> },
      { path: "courses", element: <StudentCoursesPage /> },
      { path: "courses/:classId/lessons", element: <ClassLessonsPage /> },
      {
        path: "courses/:classId/assignments",
        element: <RedirectToDailyPlan />,
      },
      {
        path: "courses/:classId/daily-plan",
        element: <DailyHomeworkPage />,
      },
      { path: "lessons/:lessonId", element: <LessonDetailPage /> },
      {
        path: "assignments/:assignmentId/take",
        element: <AssignmentTakePage />,
      },
      { path: "submissions", element: <SpeakingAiEvaluationPage /> },
      { path: "submissions/:attemptId", element: <SpeakingAiEvaluationPage /> },
      {
        path: "assignments/:assignmentId/submissions/:attemptId",
        element: <SpeakingAiEvaluationPage />,
      },
      { path: "profile", element: <StudentProfilePage /> },
      { path: "*", element: <Navigate to="/student/courses" replace /> },
    ],
  },

  // 3. Phân hệ Admin (Chỉ ROLE_ADMIN truy cập)
  {
    path: "/admin",
    element: (
      <ProtectedRoute allowedRoles={["ROLE_ADMIN"]}>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: "dashboard", element: <AdminDashboardPage /> },
      { path: "teachers", element: <TeacherManagementPage /> },
      { path: "students", element: <StudentManagementPage /> },
      { path: "classrooms", element: <ClassroomManagementPage /> },
      { path: "classrooms/:classId", element: <ClassroomDetailPage /> },
      { path: "lessons/:lessonId", element: <AdminLessonDetailPage /> },
      { path: "reports", element: <AdminReportsPage /> },
      { path: "video-moderation", element: <VideoModerationPage /> },

      { path: "users", element: <UserManagementPage /> },
      { path: "resource-library", element: <ResourceLibraryPage /> },
      { path: "broadcast", element: <SystemBroadcastPage /> },
      { path: "audit-logs", element: <AuditLogPage /> },
      { path: "ai-monitoring", element: <AiMonitoringPage /> },
      { path: "*", element: <Navigate to="/admin/dashboard" replace /> },
    ],
  },

  // 4. Phân hệ Teacher (Giảng viên)
  {
    path: "/teacher",
    element: (
      <ProtectedRoute allowedRoles={["ROLE_TEACHER", "ROLE_ADMIN"]}>
        <TeacherLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/teacher/dashboard" replace /> },
      // Dashboard tổng quan thống kê lớp, điểm yếu & việc cần làm
      {
        path: "dashboard",
        element: <TeacherDashboardPage />,
      },
      // Quản lý danh sách lớp học
      {
        path: "classrooms",
        element: <TeacherClassroomsPage />,
      },
      // Quản lý chi tiết bài giảng, tài liệu, video & thông báo của lớp
      {
        path: "classrooms/:classId",
        element: <TeacherClassDetailPage />,
      },
      // Quản lý học sinh, xem tiến độ & điểm yếu của lớp
      {
        path: "classrooms/:classId/students",
        element: <TeacherClassStudentsPage />,
      },
      // Lộ trình học hàng ngày, giao bài, đặt deadline & đính kèm tài liệu
      {
        path: "classrooms/:classId/plans",
        element: <TeacherDailyPlanPage />,
      },
      // Chấm bài & xem bài làm học sinh (hỗ trợ cả grading và submissions từ sidebar)
      {
        path: "grading",
        element: <TeacherGradingPage />,
      },
      {
        path: "submissions",
        element: <TeacherGradingPage />,
      },
      { path: "*", element: <Navigate to="/teacher/dashboard" replace /> },
    ],
  },

  // 5. Trang thông báo lỗi và Điều hướng mặc định toàn app
  {
    path: "/unauthorized",
    element: (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-bold text-rose-600 mb-2">
            403 - Quyền Truy Cập Bị Từ Chối
          </h2>
          <p className="text-sm text-slate-500">
            Tài khoản hiện tại không có quyền truy cập vào phân hệ này.
          </p>
        </div>
      </div>
    ),
  },
  {
    path: "*",
    element: <Navigate to="/login" replace />,
  },
];

export const router = createBrowserRouter(routes);