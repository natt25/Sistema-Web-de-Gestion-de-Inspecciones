import { NavLink, useNavigate } from "react-router-dom";
import { clearAuth } from "../../auth/auth.storage";

const items = [
  { to: "/", label: "Home", icon: "🏠" },
  { to: "/inspecciones", label: "Inspecciones", icon: "📋" },
  { to: "/pendientes", label: "Pendientes", icon: "⏰" },
  { to: "/admin/usuarios", label: "Usuarios", icon: "👥" },
];

export default function Sidebar({ onNavigate }) {
  const navigate = useNavigate();
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
            <span>{it.icon}</span>
            <span>{it.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          className="sidebar-item"
          style={{ color: "#fecaca", borderColor: "rgba(239,68,68,.25)", background: "rgba(239,68,68,.08)" }}
          onClick={() => {
            clearAuth();
            navigate("/login", { replace: true });
            onNavigate?.();
          }}
        >
          <span>🚪</span>
          <span>Cerrar sesion</span>
        </button>
        <div>Sistema Web de Gestion</div>
        <div>Version 1.0</div>
      </div>
    </>
  );
}
