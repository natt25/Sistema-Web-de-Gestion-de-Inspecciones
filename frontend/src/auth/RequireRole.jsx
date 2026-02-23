import { Navigate, Outlet } from "react-router-dom";
import { getUser } from "./auth.storage";

export default function RequireRole({ roles = [] }) {
  const user = getUser();
  const rol = String(user?.rol || "").toUpperCase();
  if (import.meta.env.DEV) {
    console.log("[RequireRole] check", {
      rol,
      roles,
    });
  }

  if (!rol) return <Navigate to="/login" replace />;

  const allowed = roles.map(r => String(r).toUpperCase());
  if (!allowed.includes(rol)) return <Navigate to="/inspecciones" replace />;

  return <Outlet />;
}
