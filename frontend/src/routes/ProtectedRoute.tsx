import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import type { RoleName } from "@/types/api";

interface ProtectedRouteProps {
  allowedRoles: RoleName[];
  children: ReactElement;
}

export default function ProtectedRoute({
  allowedRoles,
  children,
}: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const hasRole = user.roles.some((role) => allowedRoles.includes(role));
  if (!hasRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
