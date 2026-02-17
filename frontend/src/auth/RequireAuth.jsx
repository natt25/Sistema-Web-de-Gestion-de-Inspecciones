import { Navigate, Outlet } from "react-router-dom";
import { getToken } from "./auth.storage";

export default function RequireAuth() {
  const token = getToken();
  if (!token) return <Navigate to="/login" />;
  return <Outlet />;
}
