import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import useOnlineStatus from "../../hooks/useOnlineStatus";
import http from "../../api/http";
import { getPendingCounts, syncInspeccionesQueue } from "../../utils/offlineQueue";

export default function DashboardLayout({ title, actions, children }) {
  const [open, setOpen] = useState(false);
  const online = useOnlineStatus();
  const [pending, setPending] = useState({ total: 0, uploads: 0, mutations: 0, inspecciones: 0 });
  const [syncing, setSyncing] = useState(false);

  async function refreshPending() {
    const counts = await getPendingCounts();
    setPending(counts);
  }

  useEffect(() => {
    refreshPending();
  }, []);

  useEffect(() => {
    let timer = null;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshPending();
    };
    const handleOnlineOffline = () => refreshPending();

    timer = setInterval(refreshPending, 3000);
    window.addEventListener("online", handleOnlineOffline);
    window.addEventListener("offline", handleOnlineOffline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (timer) clearInterval(timer);
      window.removeEventListener("online", handleOnlineOffline);
      window.removeEventListener("offline", handleOnlineOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

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
    if (!online || pending.total <= 0) return;
    handleSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

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

  return (
    <div className="app-shell">
      <div className={`sidebar ${open ? "open" : ""}`}>
        <Sidebar onNavigate={() => setOpen(false)} onClose={() => setOpen(false)} />
      </div>

      <div
        className={`overlay ${open ? "show" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
        style={{ pointerEvents: open ? "auto" : "none" }}
      />

      <div>
        <Topbar
          title={title}
          actions={headerActions}
          onToggle={() => setOpen((v) => !v)}
        />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
