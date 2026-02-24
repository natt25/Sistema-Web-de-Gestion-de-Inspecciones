import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import useOnlineStatus from "../../hooks/useOnlineStatus";
import http from "../../api/http";
import { getInspeccionesPendingCount, syncInspeccionesQueue } from "../../utils/offlineQueue";

export default function DashboardLayout({ title, actions, children }) {
  const [open, setOpen] = useState(false);
  const online = useOnlineStatus();
  const [pendingInspecciones, setPendingInspecciones] = useState(0);

  async function refreshPendingInspecciones() {
    const n = await getInspeccionesPendingCount();
    setPendingInspecciones(n);
  }

  useEffect(() => {
    refreshPendingInspecciones();
  }, []);

  useEffect(() => {
    if (!online) return;
    (async () => {
      await syncInspeccionesQueue(http);
      await refreshPendingInspecciones();
    })();
  }, [online]);

  return (
    <div className="app-shell">
      <div className={`sidebar ${open ? "open" : ""}`}>
        <Sidebar onNavigate={() => setOpen(false)} />
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
          actions={
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {pendingInspecciones > 0 && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    border: "1px solid #e5e7eb",
                    padding: "4px 8px",
                    borderRadius: 999,
                    background: "#f8fafc",
                  }}
                >
                  Pendientes: {pendingInspecciones}
                </span>
              )}
              {actions}
            </div>
          }
          onToggle={() => setOpen((v) => !v)}
        />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
