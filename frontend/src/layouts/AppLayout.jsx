import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { clearAuth, getUser } from "../auth/auth.storage";
import useOnlineStatus from "../hooks/useOnlineStatus";

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const user = getUser();
  const { online } = useOnlineStatus(); // si tu hook retorna otro nombre, dime y lo ajusto

  const isAdmin = ["ADMIN", "ADMIN_PRINCIPAL"].includes(String(user?.rol || "").toUpperCase());

  function logout() {
    clearAuth();
    navigate("/login", { replace: true });
  }

  return (
    <div className="appShell">
      {/* mobile overlay */}
      <div className={`overlay ${open ? "show" : ""}`} onClick={() => setOpen(false)} />

      {/* Sidebar */}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <div className="logo">SI</div>
          <div className="brandText">
            <div className="brandTitle">Sistema de Gestión de Inspecciones</div>
          </div>
        </div>

        <nav className="nav">
          <div className="navSection">Operación</div>

          <NavLink className="navItem" to="/inspecciones" onClick={() => setOpen(false)}>
            <span className="navIcon">📋</span>
            <span>Inspecciones</span>
          </NavLink>

          <NavLink className="navItem" to="/pendientes" onClick={() => setOpen(false)}>
            <span className="navIcon">⏰</span>
            <span>Pendientes</span>
          </NavLink>

          {isAdmin && (
            <>
              <div className="navSection">Administración</div>
              <NavLink className="navItem" to="/admin/usuarios" onClick={() => setOpen(false)}>
                <span className="navIcon">👤</span>
                <span>Usuarios</span>
              </NavLink>
            </>
          )}

          <div className="navSection">Cuenta</div>
          <NavLink className="navItem" to="/change-password" onClick={() => setOpen(false)}>
            <span className="navIcon">🔑</span>
            <span>Cambiar clave</span>
          </NavLink>

          <button className="navItem danger" onClick={logout}>
            <span className="navIcon">🚪</span>
            <span>Cerrar sesión</span>
          </button>
        </nav>

        <div className="sidebarFooter">
          <div className="chip">{online ? "ONLINE" : "OFFLINE"}</div>
          <div className="userMini">
            <div className="uTop">{user?.dni || "-"}</div>
            <div className="uBot">{user?.rol || "-"}</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        <header className="topbar">
          <button className="burger" onClick={() => setOpen(true)} aria-label="Abrir menú">
            ☰
          </button>

          <div className="topbarTitle">SISTEMA DE GESTION DE INSPECCIONES</div>

          <div className="topbarRight">
            <span className={`statusDot ${online ? "ok" : "bad"}`} />
            <span className="statusText">{online ? "Online" : "Offline"}</span>

            <div className="userPill">
              <div className="userAvatar">{(user?.dni || "U").slice(0, 1)}</div>
              <div className="userMeta">
                <div className="userDni">{user?.dni || "-"}</div>
                <div className="userRol">{user?.rol || "-"}</div>
              </div>
            </div>
          </div>
        </header>

        <section className="content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
