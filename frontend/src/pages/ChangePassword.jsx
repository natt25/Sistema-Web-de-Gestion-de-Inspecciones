import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, getUser, setUser, clearAuth } from "../auth/auth.storage";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";

export default function ChangePassword() {
  const [old_password, setOld] = useState("");
  const [new_password, setNew] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const token = getToken();
      if (!token) {
        clearAuth();
        navigate("/login", { replace: true });
        return;
      }

      const r = await fetch("http://localhost:3000/api/auth/change-password", {
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
        setMsg(data.message || "No se pudo cambiar la contraseÃ±a");
        return;
      }

      const u = getUser();
      if (u) setUser({ ...u, debe_cambiar_password: false });

      setMsg("ContraseÃ±a actualizada. Redirigiendo...");
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
            Por seguridad, actualiza tu contraseÃ±a para continuar.
          </p>
        </section>

        <section className="auth-right">
          <div className="auth-tabs">
            <div className="auth-tab active">Cambiar contraseÃ±a</div>
          </div>

          <form className="form" onSubmit={onSubmit}>
            <Input
              label="ContraseÃ±a actual"
              type="password"
              value={old_password}
              onChange={(e) => setOld(e.target.value)}
              required
            />

            <Input
              label="Nueva contraseÃ±a"
              type="password"
              value={new_password}
              onChange={(e) => setNew(e.target.value)}
              required
            />

            {msg && <div className="help error">{msg}</div>}

            <div className="actions">
              <Button variant="ghost" type="button" onClick={() => navigate("/login")}>
                Volver
              </Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? "Guardando..." : "Actualizar"}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
