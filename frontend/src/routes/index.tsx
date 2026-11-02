// src/routes/index.tsx
import React, { Suspense, lazy } from "react";
import type { ComponentType } from "react";
import { createBrowserRouter, Navigate, useParams } from "react-router-dom";
import type { RouteObject } from "react-router-dom";

// Phân hệ Public nạp Eagerly để First Contentful Paint tức thì
import PublicLayout from "@/components/layouts/PublicLayout";
import LoginPage from "@/features/auth/pages/LoginPage";
import ProtectedRoute from "@/routes/ProtectedRoute";

// Loading Fallback hiển thị mượt mà khi stream các route chunk
const RouteLoadingFallback = () => (
  <div className="flex min-h-[60vh] w-full items-center justify-center p-8">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-400 dark:border-t-transparent" />
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
        Đang nạp phân hệ...
      </span>
    </div>
  </div>
);

const withSuspense = (LazyComponent: ComponentType) => (
  <Suspense fallback={<RouteLoadingFallback />}>
    <LazyComponent />
  </Suspense>
);

// Layouts được lazy-load
const StudentLayout = lazy(() => import("@/components/layouts/StudentLayout"));
const TeacherLayout = lazy(() => import("@/components/layouts/TeacherLayout"));
const AdminLayout = lazy(() => import("@/components/layouts/AdminLayout"));

// Phân hệ Admin (Lazy loaded)
const AdminDashboardPage = lazy(() => import("@/features/admin/pages/AdminDashboardPage"));
const UserManagementPage = lazy(() => import("@/features/admin/pages/UserManagementPage"));
const TeacherManagementPage = lazy(() => import("@/features/admin/pages/TeacherManagementPage"));
const StudentManagementPage = lazy(() => import("@/features/admin/pages/StudentManagementPage"));
const ClassroomManagementPage = lazy(() => import("@/features/admin/pages/ClassroomManagementPage"));
const ClassroomDetailPage = lazy(() => import("@/features/admin/pages/ClassroomDetailPage"));
const AdminLessonDetailPage = lazy(() => import("@/features/admin/pages/AdminLessonDetailPage"));
const VideoModerationPage = lazy(() => import("@/features/admin/pages/VideoModerationPage"));
const AdminReportsPage = lazy(() => import("@/features/admin/pages/AdminReportsPage"));
const SystemBroadcastPage = lazy(() => import("@/features/admin/pages/SystemBroadcastPage"));
const AuditLogPage = lazy(() => import("@/features/admin/pages/AuditLogPage"));
const AiMonitoringPage = lazy(() => import("@/features/admin/pages/AiMonitoringPage"));
const ResourceLibraryPage = lazy(() => import("@/features/admin/pages/ResourceLibraryPage"));

// Phân hệ Student (Lazy loaded)
const StudentCoursesPage = lazy(() => import("@/features/student/pages/StudentCoursesPage"));
const ClassLessonsPage = lazy(() => import("@/features/student/pages/ClassLessonsPage"));
const ClassAssignmentsPage = lazy(() => import("@/features/student/pages/ClassAssignmentsPage"));
const LessonDetailPage = lazy(() => import("@/features/student/pages/LessonDetailPage"));
const AssignmentTakePage = lazy(() => import("@/features/student/pages/AssignmentTakePage"));
const StudentProfilePage = lazy(() => import("@/features/student/pages/StudentProfilePage"));
const SpeakingAiEvaluationPage = lazy(() => import("@/features/student/pages/SpeakingAiEvaluationPage"));
const DailyHomeworkPage = lazy(() => import("@/features/student/pages/DailyHomeworkPage"));

// Phân hệ Teacher (Lazy loaded)
const TeacherDashboardPage = lazy(() => import("@/features/teacher/pages/TeacherDashboardPage"));
const TeacherClassroomsPage = lazy(() => import("@/features/teacher/pages/TeacherClassroomsPage"));
const TeacherClassDetailPage = lazy(() => import("@/features/teacher/pages/TeacherClassDetailPage"));
const TeacherClassStudentsPage = lazy(() => import("@/features/teacher/pages/TeacherClassStudentsPage"));
const TeacherDailyPlanPage = lazy(() => import("@/features/teacher/pages/TeacherDailyPlanPage"));
const TeacherGradingPage = lazy(() => import("@/features/teacher/pages/TeacherGradingPage"));

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
        {withSuspense(StudentLayout)}
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/student/courses" replace /> },
      { path: "courses", element: withSuspense(StudentCoursesPage) },
      { path: "courses/:classId/lessons", element: withSuspense(ClassLessonsPage) },
      {
        path: "courses/:classId/assignments",
        element: withSuspense(ClassAssignmentsPage),
      },
      {
        path: "courses/:classId/daily-plan",
        element: withSuspense(DailyHomeworkPage),
      },
      { path: "lessons/:lessonId", element: withSuspense(LessonDetailPage) },
      {
        path: "assignments/:assignmentId/take",
        element: withSuspense(AssignmentTakePage),
      },
      { path: "submissions", element: withSuspense(SpeakingAiEvaluationPage) },
      { path: "speaking-ai", element: withSuspense(SpeakingAiEvaluationPage) },
      { path: "submissions/:attemptId", element: withSuspense(SpeakingAiEvaluationPage) },
      {
        path: "assignments/:assignmentId/submissions/:attemptId",
        element: withSuspense(SpeakingAiEvaluationPage),
      },
      { path: "profile", element: withSuspense(StudentProfilePage) },
      { path: "*", element: <Navigate to="/student/courses" replace /> },
    ],
  },

  // 3. Phân hệ Admin (Chỉ ROLE_ADMIN truy cập)
  {
    path: "/admin",
    element: (
      <ProtectedRoute allowedRoles={["ROLE_ADMIN"]}>
        {withSuspense(AdminLayout)}
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: "dashboard", element: withSuspense(AdminDashboardPage) },
      { path: "teachers", element: withSuspense(TeacherManagementPage) },
      { path: "students", element: withSuspense(StudentManagementPage) },
      { path: "classrooms", element: withSuspense(ClassroomManagementPage) },
      { path: "classrooms/:classId", element: withSuspense(ClassroomDetailPage) },
      { path: "lessons/:lessonId", element: withSuspense(AdminLessonDetailPage) },
      { path: "reports", element: withSuspense(AdminReportsPage) },
      { path: "video-moderation", element: withSuspense(VideoModerationPage) },

      { path: "users", element: withSuspense(UserManagementPage) },
      { path: "resource-library", element: withSuspense(ResourceLibraryPage) },
      { path: "broadcast", element: withSuspense(SystemBroadcastPage) },
      { path: "audit-logs", element: withSuspense(AuditLogPage) },
      { path: "ai-monitoring", element: withSuspense(AiMonitoringPage) },
      { path: "*", element: <Navigate to="/admin/dashboard" replace /> },
    ],
  },

  // 4. Phân hệ Teacher (Giảng viên)
  {
    path: "/teacher",
    element: (
      <ProtectedRoute allowedRoles={["ROLE_TEACHER", "ROLE_ADMIN"]}>
        {withSuspense(TeacherLayout)}
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/teacher/dashboard" replace /> },
      {
        path: "dashboard",
        element: withSuspense(TeacherDashboardPage),
      },
      {
        path: "classrooms",
        element: withSuspense(TeacherClassroomsPage),
      },
      {
        path: "classrooms/:classId",
        element: withSuspense(TeacherClassDetailPage),
      },
      {
        path: "classrooms/:classId/students",
        element: withSuspense(TeacherClassStudentsPage),
      },
      {
        path: "classrooms/:classId/plans",
        element: withSuspense(TeacherDailyPlanPage),
      },
      {
        path: "grading",
        element: withSuspense(TeacherGradingPage),
      },
      {
        path: "submissions",
        element: withSuspense(TeacherGradingPage),
      },
      {
        path: "broadcast",
        element: withSuspense(SystemBroadcastPage),
      },
      { path: "*", element: <Navigate to="/teacher/dashboard" replace /> },
    ],
  },

  // 5. Trang thông báo lỗi và Điều hướng mặc định toàn app
  {
    path: "/unauthorized",
    element: (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-8 text-center shadow-sm">
          <h2 className="text-xl font-bold text-rose-600 mb-2">
            403 - Quyền Truy Cập Bị Từ Chối
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
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
