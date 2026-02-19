import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import RequireAuth from "../auth/RequireAuth";
import InspeccionesList from "../pages/InspeccionesList";
import InspeccionDetail from "../pages/InspeccionDetail";
import ChangePassword from "../pages/ChangePassword";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<RequireAuth />}>
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/" element={<Navigate to="/inspecciones" replace />} />
          <Route path="/inspecciones" element={<InspeccionesList />} />
          <Route path="/inspecciones/:id" element={<InspeccionDetail />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
