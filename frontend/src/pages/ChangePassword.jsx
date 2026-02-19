import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, getUser, setUser, clearAuth } from "../auth/auth.storage";

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
        setMsg(data.message || "No se pudo cambiar la contraseña");
        return;
      }

      // marcar usuario como "ya no requiere cambio"
      const u = getUser();
      if (u) setUser({ ...u, debe_cambiar_password: false });

      setMsg("✅ Contraseña actualizada. Redirigiendo...");
      setTimeout(() => navigate("/", { replace: true }), 700);
    } catch (err) {
      setMsg("Error de red o servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h2>Cambiar contraseña</h2>
      <p>Por seguridad, debes actualizar tu contraseña antes de continuar.</p>

      <form onSubmit={onSubmit}>
        <label>Contraseña actual</label>
        <input
          type="password"
          value={old_password}
          onChange={(e) => setOld(e.target.value)}
          required
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
        />

        <label>Nueva contraseña</label>
        <input
          type="password"
          value={new_password}
          onChange={(e) => setNew(e.target.value)}
          required
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
        />

        <button disabled={loading} style={{ width: "100%", padding: 10 }}>
          {loading ? "Guardando..." : "Actualizar"}
        </button>

        {msg && <div style={{ marginTop: 12 }}>{msg}</div>}
      </form>
    </div>
  );
}
