import { useCallback, useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import useOnlineStatus from "../../hooks/useOnlineStatus";
import http from "../../api/http";
import { getPendingCounts, syncInspeccionesQueue } from "../../utils/offlineQueue";

export default function DashboardLayout({ title, actions, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 900px)").matches);
  const online = useOnlineStatus();
  const [pending, setPending] = useState({ total: 0, uploads: 0, mutations: 0, inspecciones: 0 });
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
    if (!online) return;
    if (pending.total <= 0) return;
    if (syncing) return;
    handleSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, pending.total, syncing]);

  const headerActions = (
    <div className="topbar-global-actions">
      <span className={`badge ${online ? "conn-online" : "conn-offline"}`}>
        {online ? "Conectado" : "Sin conexion"}
      </span>
      <span className="badge">Pendientes: {pending.total}</span>
      <button
        type="button"
        className="btn btn-outline"
        onClick={handleSync}
        disabled={!online || pending.total <= 0 || syncing}
      >
        {syncing ? "Sincronizando..." : "Sincronizar"}
      </button>
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
