// src/components/layouts/PublicLayout.tsx
import { Outlet, Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";

export default function PublicLayout() {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated && user) {
    const isAdmin = user.roles.includes("ROLE_ADMIN");
    const isTeacher = user.roles.includes("ROLE_TEACHER");

    if (isAdmin) {
      return <Navigate to="/admin/users" replace />;
    } else if (isTeacher) {
      return <Navigate to="/teacher/classrooms" replace />;
    } else {
      return <Navigate to="/student/courses" replace />;
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <Outlet />
    </div>
  );
}
