import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import RequireAuth from "../auth/RequireAuth";
import RequireRole from "../auth/RequireRole";

import PlantillasInspeccion from "../pages/PlantillasInspeccion";
import InspeccionNueva from "../pages/InspeccionNueva";
import InspeccionForm from "../pages/InspeccionForm";

import InspeccionesList from "../pages/InspeccionesList";
import InspeccionDetail from "../pages/InspeccionDetail";
import ChangePassword from "../pages/ChangePassword";
import Pendientes from "../pages/Pendientes";
import AdminUsuarios from "../pages/AdminUsuarios";
import Perfil from "../pages/Perfil";
import Home from "../pages/Home";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* ✅ Rutas protegidas */}
        <Route path="/" element={<RequireAuth />}>
          {/* ✅ primera pantalla al logear */}
          <Route index element={<Navigate to="home" replace />} />

          <Route path="home" element={<Home />} />
          <Route path="change-password" element={<ChangePassword />} />
          <Route path="pendientes" element={<Pendientes />} />
          <Route path="perfil" element={<Perfil />} />

          <Route path="inspecciones/plantillas" element={<PlantillasInspeccion />} />
          <Route path="inspecciones/nueva" element={<InspeccionNueva />} />
          <Route path="inspecciones/nueva/:idPlantilla" element={<InspeccionForm />} />

          <Route path="inspecciones" element={<InspeccionesList />} />
          <Route path="inspecciones/:id" element={<InspeccionDetail />} />

          <Route element={<RequireRole roles={["ADMIN_PRINCIPAL", "ADMIN"]} />}>
            <Route path="admin/usuarios" element={<AdminUsuarios />} />
          </Route>
        </Route>

        {/* ✅ Fallback */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
}