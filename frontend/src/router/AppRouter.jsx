import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import RequireAuth from "../auth/RequireAuth";
import InspeccionesList from "../pages/InspeccionesList";
import InspeccionDetail from "../pages/InspeccionDetail";
import ChangePassword from "../pages/ChangePassword";
import RequireRole from "../auth/RequireRole";
import AdminUsuarios from "../pages/AdminUsuarios";
import Pendientes from "../pages/Pendientes";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<RequireAuth />}>
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/pendientes" element={<Pendientes />} />

          <Route element={<RequireRole roles={["ADMIN_PRINCIPAL", "ADMIN"]} />}>
            <Route path="/admin/usuarios" element={<AdminUsuarios />} />
          </Route>

          <Route path="/" element={<Navigate to="/inspecciones" replace />} />
          <Route path="/inspecciones" element={<InspeccionesList />} />
          <Route path="/inspecciones/:id" element={<InspeccionDetail />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
