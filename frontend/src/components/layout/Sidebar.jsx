import { NavLink, useNavigate } from "react-router-dom";
import { clearAuth } from "../../auth/auth.storage";

const items = [
  { to: "/", label: "Home", icon: "🏠" },
  { to: "/inspecciones/plantillas", label: "Inspecciones", icon: "📋" },
  { to: "/pendientes", label: "Pendientes", icon: "⏰" },
  { to: "/admin/usuarios", label: "Usuarios", icon: "👥" },
];

export default function Sidebar({ onNavigate }) {
  const navigate = useNavigate();

  function handleLogout() {
    clearAuth();
    navigate("/login", { replace: true });
    onNavigate?.();
  }

  return (
    <>
      <div className="sidebar-brand">
        <div className="sidebar-logo">SI</div>
        <div>
          <div className="sidebar-title">SSOMA</div>
          <div className="sidebar-sub">Inspecciones</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) => `sidebar-item ${isActive ? "active" : ""}`}
            onClick={onNavigate}
          >
            <span className="sidebar-icon">{it.icon}</span>
            <span>{it.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-item sidebar-logout"
          onClick={handleLogout}
        >
          <span className="sidebar-icon">🚪</span>
          <span>Cerrar sesión</span>
        </button>

        <div className="sidebar-meta">
          <div>Sistema Web de Gestión</div>
          <div>Versión 1.0</div>
        </div>
      </div>
    </>
  );
}
