import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { clearAuth, getUser } from "../../auth/auth.storage";
import { contarPendientes } from "../../api/pendientes.api";

export default function Sidebar({ onNavigate }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const rol = String(user?.rol || "").trim().toUpperCase();
  const [pendientesCount, setPendientesCount] = useState(0);

  const items = useMemo(
    () => [
      { to: "/home", label: "Home", icon: "🏠" },
      { to: "/inspecciones/plantillas", label: "Inspecciones", icon: "📋" },
      ...(rol !== "INVITADO" ? [{ to: "/mis-inspecciones", label: "Mis inspecciones", icon: "🗂️" }] : []),
      ...(rol !== "INVITADO" ? [{ to: "/pendientes", label: "Pendientes", icon: "⏰" }] : []),
      ...((rol === "ADMIN_PRINCIPAL" || rol === "ADMIN")
        ? [{ to: "/admin/usuarios", label: "Usuarios", icon: "👥" }]
        : []),
    ],
    [rol]
  );

  const isActive = (to) => {
    const path = location.pathname;
    if (to === "/home") return path === "/home";
    if (to === "/inspecciones/plantillas") return path.startsWith("/inspecciones");
    return path === to || path.startsWith(`${to}/`);
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

  const loadCount = useCallback(async () => {
    if (rol === "INVITADO") {
      setPendientesCount(0);
      return;
    }

    try {
      const data = await contarPendientes({ dias: null, solo_mias: 1, estado: "ALL" });
      setPendientesCount(Number(data?.total || 0));
    } catch {
      setPendientesCount(0);
    }
  }, [rol]);

  useEffect(() => {
    let alive = true;

    const safeLoad = async () => {
      if (rol === "INVITADO") {
        if (alive) setPendientesCount(0);
        return;
      }

      try {
        const data = await contarPendientes({ dias: null, solo_mias: 1, estado: "ALL" });
        if (!alive) return;
        setPendientesCount(Number(data?.total || 0));
      } catch {
        if (!alive) return;
        setPendientesCount(0);
      }
    };

    safeLoad();

    const onFocus = () => {
      safeLoad();
    };

    const timer = setInterval(onFocus, 60000);
    window.addEventListener("focus", onFocus);

    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadCount, location.pathname, rol]);

  const itemsWithBadge = useMemo(
    () =>
      items.map((item) => (item.to === "/pendientes" ? { ...item, badge: pendientesCount } : item)),
    [items, pendientesCount]
  );

  return (
    <>
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <svg viewBox="0 0 64 64" width="28" height="28">
            <rect x="10" y="6" width="34" height="50" rx="8" fill="rgba(255,122,26,.15)" />
            <rect x="14" y="10" width="34" height="50" rx="8" fill="rgba(255,122,26,.25)" />
            <rect x="20" y="18" width="18" height="4" rx="2" fill="#ff7a1a" />
            <rect x="20" y="28" width="14" height="4" rx="2" fill="#ff7a1a" />
            <rect x="20" y="38" width="10" height="4" rx="2" fill="#ff7a1a" />
            <circle cx="48" cy="44" r="10" fill="#ff7a1a" />
            <path
              d="M42 44l3 3 6-7"
              fill="none"
              stroke="#fff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <div className="sidebar-title">
            SISTEMA DE <br />
            GESTION DE <br />
            INSPECCIONES
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {itemsWithBadge.map((item) => (
          <button
            key={item.to}
            type="button"
            className={`sidebar-item ${isActive(item.to) ? "active" : ""}`}
            onClick={() => go(item.to)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="sidebar-icon">{item.icon}</span>
              <span>{item.label}</span>
            </span>

            {item.to === "/pendientes" && Number(item.badge) > 0 ? (
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
                  color: "#fff",
                  boxShadow: "0 2px 8px rgba(0,0,0,.18)",
                }}
              >
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="sidebar-item sidebar-logout" onClick={handleLogout}>
          <span className="sidebar-icon">🚪</span>
          <span>Cerrar sesion</span>
        </button>

        <div className="sidebar-meta">
          <div>AQP INDUSTRIAL SERVICE</div>
          <div>Version 1.0</div>
        </div>
      </div>
    </>
  );
}
