import { getUser } from "../../auth/auth.storage";

function buildUserDisplayName(user) {
  const fullName = String(user?.nombreCompleto || "").trim();
  if (fullName) return fullName;

  const composedName = [user?.nombres, user?.apellidos]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  if (composedName) return composedName;

  const fallbackName =
    String(user?.nombre || "").trim() ||
    String(user?.name || "").trim() ||
    String(user?.dni || "").trim();

  return fallbackName || "Usuario";
}

function getInitials(name) {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return "U";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return `${words[0].slice(0, 1)}${words[1].slice(0, 1)}`.toUpperCase();
}

export default function Topbar({ title, actions, onToggle, showHamburger = false }) {
  const user = getUser();
  const userDisplayName = buildUserDisplayName(user);
  const userInitials = getInitials(userDisplayName);

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
        <div className="topbar-user" title={userDisplayName}>
          <div className="topbar-user-avatar">{userInitials}</div>
          <div className="topbar-user-name">{userDisplayName}</div>
        </div>
      </div>
    </header>
  );
}
