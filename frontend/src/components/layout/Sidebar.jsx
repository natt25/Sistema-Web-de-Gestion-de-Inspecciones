// frontend/src/components/layout/Sidebar.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { clearAuth } from "../../auth/auth.storage";
import { listarPendientes } from "../../api/pendientes.api";

const items = [
  { to: "/home", label: "Home", icon: "🏠" },
  { to: "/inspecciones/plantillas", label: "Inspecciones", icon: "📋" },
  { to: "/pendientes", label: "Pendientes", icon: "⏰" },
  { to: "/admin/usuarios", label: "Usuarios", icon: "👥" },
];

function isAccionNoCompletada(a) {
  const estado = String(a?.estado || "").trim().toUpperCase();
  // En tu Pendientes.jsx consideras COMPLETADO/CERRADO como “cerrado”
  // :contentReference[oaicite:3]{index=3}
  if (estado.includes("CERR") || estado.includes("COMPLE")) return false;
  return true; // PENDIENTE / EN PROGRESO / VENCIDO / otros
}

export default function Sidebar({ onNavigate }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [pendientesCount, setPendientesCount] = useState(0);

  const isActive = (to) => {
    const p = location.pathname;
    if (to === "/home") return p === "/home";
    if (to === "/inspecciones/plantillas") return p.startsWith("/inspecciones");
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

  // ✅ Cargar contador de pendientes SOLO MIAS
  useEffect(() => {
    let alive = true;

    async function loadCount() {
      try {
        const data = await listarPendientes({ dias: null, solo_mias: 1, estado: "ALL" });
        const rows = Array.isArray(data) ? data : [];
        const count = rows.filter(isAccionNoCompletada).length;
        if (alive) setPendientesCount(count);
      } catch {
        // si falla, no rompemos el sidebar
        if (alive) setPendientesCount(0);
      }
    }

    loadCount();

    // refresco suave (1 min). Si no lo quieres, borra esto.
    const t = setInterval(loadCount, 60000);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const itemsWithBadge = useMemo(() => {
    return items.map((it) => {
      if (it.to !== "/pendientes") return it;
      return { ...it, badge: pendientesCount };
    });
  }, [pendientesCount]);

  return (
    <>
      <div className="sidebar-brand">
        <div className="sidebar-logo">SI</div>
        <div>
          <div className="sidebar-title">SISTEMA DE GESTIÓN DE INSPECCIONES</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {itemsWithBadge.map((it) => (
          <button
            key={it.to}
            type="button"
            className={`sidebar-item ${isActive(it.to) ? "active" : ""}`}
            onClick={() => go(it.to)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="sidebar-icon">{it.icon}</span>
              <span>{it.label}</span>
            </span>

            {/* 🔔 badge a la derecha */}
            {it.to === "/pendientes" && Number(it.badge) > 0 ? (
              <span
                title="Mis acciones pendientes"
                style={{
                  minWidth: 22,
                  height: 22,
                  padding: "0 6px",
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 900,
                  background: "#ef4444",
                  color: "white",
                  boxShadow: "0 2px 8px rgba(0,0,0,.18)",
                }}
              >
                {it.badge > 99 ? "99+" : it.badge}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="sidebar-item sidebar-logout" onClick={handleLogout}>
          <span className="sidebar-icon">🚪</span>
          <span>Cerrar sesión</span>
        </button>

        <div className="sidebar-meta">
          <div>AQP INDUSTRIAL SERVICE</div>
          <div>Versión 1.0</div>
        </div>
      </div>
    </>
  );
}