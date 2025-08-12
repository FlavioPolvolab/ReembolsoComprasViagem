import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface AuthLayoutProps {
  requireAuth?: boolean;
  requireAdmin?: boolean;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({
  requireAuth = false,
  requireAdmin = false,
}) => {
  const { user, isLoading, isAdmin } = useAuth();
  const location = useLocation();

  if (requireAuth && !user && !isLoading) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (
    !requireAuth &&
    user &&
    (location.pathname === "/login" || location.pathname === "/signup")
  ) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default AuthLayout;
