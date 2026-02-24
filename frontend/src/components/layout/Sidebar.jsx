import { useLocation, useNavigate } from "react-router-dom";
import { clearAuth } from "../../auth/auth.storage";

const items = [
  { to: "/", label: "Home", icon: "🏠" },
  { to: "/inspecciones/plantillas", label: "Inspecciones", icon: "📋" },
  { to: "/pendientes", label: "Pendientes", icon: "⏰" },
  { to: "/admin/usuarios", label: "Usuarios", icon: "👥" },
];

export default function Sidebar({ onNavigate }) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (to) => {
    const p = location.pathname;
    if (to === "/") return p === "/";
    if (to === "/inspecciones/plantillas") {
      return p.startsWith("/inspecciones");
    }
    return p === to || p.startsWith(`${to}/`);
  };

  function go(to) {
    navigate(to);
    onNavigate?.();
  }

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
          <button
            key={it.to}
            type="button"
            className={`sidebar-item ${isActive(it.to) ? "active" : ""}`}
            onClick={() => go(it.to)}
          >
            <span className="sidebar-icon">{it.icon}</span>
            <span>{it.label}</span>
          </button>
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
