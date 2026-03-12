import { useNavigate } from "react-router-dom";
import { getUser } from "../../auth/auth.storage";

export default function Topbar({ title, actions, onToggle, showHamburger = false }) {
  const navigate = useNavigate();
  const user = getUser();
  const esInvitado = String(user?.rol || "").trim().toUpperCase() === "INVITADO";

  return (
    <header className="topbar">
      <div className="topbar-left">
        {showHamburger ? (
          <button className="hamburger-btn" type="button" onClick={onToggle} aria-label="Abrir menu">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
        <h1 className="topbar-title">{title || "Dashboard"}</h1>
      </div>

      <div className="topbar-right">
        {actions}
        {!esInvitado ? (
          <button type="button" className="btn btn-outline" onClick={() => navigate("/perfil")}>
            Perfil
          </button>
        ) : null}
      </div>
    </header>
  );
}
