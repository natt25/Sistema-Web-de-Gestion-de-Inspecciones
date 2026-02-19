export default function Topbar({ title, actions, onToggle }) {
  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button className="hamburger" onClick={onToggle} aria-label="Abrir menu">
          ☰
        </button>
        <div className="topbar-title">{title || "Dashboard"}</div>
      </div>

      <div className="topbar-actions">
        {actions}
        <div className="badge">Perfil</div>
      </div>
    </header>
  );
}
