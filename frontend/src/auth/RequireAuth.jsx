import { Navigate, Outlet, useLocation } from "react-router-dom";
import { clearAuth, getToken, getUser } from "./auth.storage";

export default function RequireAuth() {
  const location = useLocation();
  const token = getToken();
  const user = getUser();

  if (import.meta.env.DEV) {
    console.log("[RequireAuth] check", {
      path: location.pathname,
      hasToken: Boolean(token),
      hasUser: Boolean(user),
      mustChange: Boolean(user?.debe_cambiar_password),
    });
  }

  if (!token) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!user) {
    clearAuth();
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const mustChange = Boolean(user?.debe_cambiar_password);
  if (mustChange && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}
