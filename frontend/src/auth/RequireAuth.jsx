import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getToken, getUser } from "./auth.storage";

export default function RequireAuth() {
  const location = useLocation();
  const token = getToken();
  const user = getUser();

  if (!token) return <Navigate to="/login" replace state={{ from: location }} />;

  // Si no tenemos user guardado, deja pasar (o podrías redirigir a login)
  // Mejor: si token existe pero no user, igual deja pasar por ahora.
  const mustChange = !!user?.debe_cambiar_password;

  if (mustChange && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}
