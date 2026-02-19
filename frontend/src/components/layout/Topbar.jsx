import { useNavigate } from "react-router-dom";

export default function Topbar({ title, actions, onToggle }) {
  const navigate = useNavigate();

  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          className="hamburger"
          onClick={onToggle}
          aria-label="Abrir menu"
        >
          ☰
        </button>

        <div className="topbar-title">{title || "Dashboard"}</div>
      </div>

      <div className="topbar-actions">
        {actions}
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => navigate("/perfil")}
        >
          Perfil
        </button>
      </div>
    </header>
  );
}
