import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, getUser, setUser, clearAuth } from "../auth/auth.storage";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/+$/, "");

export default function ChangePassword() {
  const [old_password, setOld] = useState("");
  const [new_password, setNew] = useState("");
  const [confirm_password, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const navigate = useNavigate();

  const hasMinLength = new_password.length >= 10;
  const hasUpper = /[A-Z]/.test(new_password);
  const hasLower = /[a-z]/.test(new_password);
  const hasNumber = /[0-9]/.test(new_password);
  const hasSymbol = /[^A-Za-z0-9]/.test(new_password);
  const passwordsMatch = confirm_password.length > 0 && new_password === confirm_password;
  const passwordRules = [
    { ok: hasMinLength, label: "Mínimo 10 caracteres" },
    { ok: hasUpper, label: "Una letra mayúscula" },
    { ok: hasLower, label: "Una letra minúscula" },
    { ok: hasNumber, label: "Un número" },
    { ok: hasSymbol, label: "Un símbolo" },
    { ok: passwordsMatch, label: "Las contraseñas coinciden" },
  ];
  const canSubmit = passwordRules.every((rule) => rule.ok);

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setMsg(null);
    setLoading(true);

    try {
      const token = getToken();
      if (!token) {
        clearAuth();
        navigate("/login", { replace: true });
        return;
      }

      const r = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Client-Mode": "ONLINE",
        },
        body: JSON.stringify({ old_password, new_password }),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        setMsg(data.message || "No se pudo cambiar la contraseña");
        return;
      }

      const u = getUser();
      if (u) setUser({ ...u, debe_cambiar_password: false });

      setMsg("Contraseña actualizada. Redirigiendo...");
      setTimeout(() => navigate("/", { replace: true }), 700);
    } catch (err) {
      setMsg("Error de red o servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <section className="auth-left">
          <h1 className="auth-title">SSOMA</h1>
          <p className="auth-subtitle">
            Por seguridad, actualiza tu contraseña para continuar.
          </p>
        </section>

        <section className="auth-right">
          <div className="auth-tabs">
            <div className="auth-tab active">Cambiar contraseña</div>
          </div>

          <form className="form" onSubmit={onSubmit}>
            <Input
              label="Contraseña actual"
              type="password"
              value={old_password}
              onChange={(e) => setOld(e.target.value)}
              required
            />

            <Input
              label="Nueva contraseña"
              type="password"
              value={new_password}
              onChange={(e) => setNew(e.target.value)}
              required
            />

            <Input
              label="Confirmar nueva contraseña"
              type="password"
              value={confirm_password}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />

            <div className="password-rules">
              <div className="password-rules-title">Tu contraseña debe incluir:</div>
              {passwordRules.map((rule) => (
                <div
                  key={rule.label}
                  className={`password-rule ${rule.ok ? "success" : "pending"}`}
                >
                  <span>{rule.ok ? "✓" : "○"}</span>
                  <span>{rule.label}</span>
                </div>
              ))}
            </div>

            {msg && <div className="help error">{msg}</div>}

            <div className="actions">
              <Button variant="ghost" type="button" onClick={() => navigate("/login")}>
                Volver
              </Button>
              <Button variant="primary" type="submit" disabled={loading || !canSubmit}>
                {loading ? "Guardando..." : "Actualizar"}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
