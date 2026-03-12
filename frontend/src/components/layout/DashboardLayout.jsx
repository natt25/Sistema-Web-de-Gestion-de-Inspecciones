import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import useOnlineStatus from "../../hooks/useOnlineStatus";
import http from "../../api/http";
import { contarPendientes } from "../../api/pendientes.api";
import { getUser } from "../../auth/auth.storage";
import { getPendingCounts, syncInspeccionesQueue } from "../../utils/offlineQueue";

export default function DashboardLayout({ title, actions, children }) {
  const location = useLocation();
  const user = getUser();
  const esInvitado = String(user?.rol || "").trim().toUpperCase() === "INVITADO";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 900px)").matches);
  const online = useOnlineStatus();
  const [pending, setPending] = useState({ total: 0, uploads: 0, mutations: 0, inspecciones: 0 });
  const [pendientesCount, setPendientesCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Solo actualiza estado si los contadores realmente cambiaron.
  const refreshPending = useCallback(async () => {
    const counts = await getPendingCounts();
    setPending((prev) => {
      if (
        prev.total === counts.total
        && prev.uploads === counts.uploads
        && prev.mutations === counts.mutations
        && prev.inspecciones === counts.inspecciones
      ) {
        return prev;
      }
      return counts;
    });
  }, []);

  const refreshPendientesCount = useCallback(async () => {
    if (esInvitado) {
      setPendientesCount(0);
      return;
    }
    try {
      const data = await contarPendientes({ dias: null, solo_mias: 1, estado: "ALL" });
      setPendientesCount(Number(data?.total || 0));
    } catch {
      setPendientesCount(0);
    }
  }, [esInvitado]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    // Refresca al montar y cuando cambia online, sin depender de `pending`.
    refreshPending();
  }, [online, refreshPending]);

  useEffect(() => {
    refreshPendientesCount();
  }, [refreshPendientesCount, location.pathname]);

  useEffect(() => {
    const onFocus = () => {
      refreshPendientesCount();
    };

    const t = setInterval(onFocus, 60000);
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshPendientesCount]);

  useEffect(() => {
    if (!isMobile || !sidebarOpen) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, sidebarOpen]);

  async function handleSync() {
    if (esInvitado) return;
    if (!online || pending.total <= 0 || syncing) return;
    setSyncing(true);
    try {
      await syncInspeccionesQueue(http);
    } finally {
      await refreshPending();
      setSyncing(false);
    }
  }

  useEffect(() => {
    if (esInvitado) return;
    if (!online) return;
    if (pending.total <= 0) return;
    if (syncing) return;
    handleSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, pending.total, syncing, esInvitado]);

  const headerActions = (
    <div className="topbar-global-actions">
      <span className={`badge ${online ? "conn-online" : "conn-offline"}`}>
        {online ? "Conectado" : "Sin conexion"}
      </span>
      {esInvitado ? <span className="badge">Modo invitado / solo lectura</span> : <span className="badge">Pendientes: {pendientesCount}</span>}
      {actions}
    </div>
  );

  function toggleSidebar() {
    if (!isMobile) return;
    setSidebarOpen((v) => !v);
  }

  return (
    <div className="app-shell">
      <div className={`sidebar ${isMobile ? "sidebar-mobile" : ""} ${isMobile && sidebarOpen ? "open" : ""}`}>
        <Sidebar onNavigate={() => isMobile && setSidebarOpen(false)} />
      </div>

      {isMobile && sidebarOpen ? (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-hidden={!sidebarOpen} />
      ) : null}

      <div>
        <Topbar title={title} actions={headerActions} onToggle={toggleSidebar} showHamburger={isMobile} />
        <main className="content dashboard-content">{children}</main>
      </div>
    </div>
  );
}
