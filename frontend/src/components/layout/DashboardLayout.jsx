import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function DashboardLayout({ title, actions, children }) {
  const [open, setOpen] = useState(false);

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
        <Topbar title={title} actions={actions} onToggle={() => setOpen((v) => !v)} />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
