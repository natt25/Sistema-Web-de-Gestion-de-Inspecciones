import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../auth/auth.service";
import { setToken } from "../auth/auth.storage";

function getErrorMessage(err) {
  const status = err?.response?.status;
  const msg = err?.response?.data?.message;

  if (status === 401) return "Credenciales incorrectas (401).";
  if (status === 403) return "Acceso denegado (403).";
  if (status === 404) return "Endpoint no encontrado (404).";
  if (status === 409) return msg || "Conflicto (409).";
  if (status === 500) return "Error interno del servidor (500).";
  return msg || "No se pudo iniciar sesión. Revisa tu conexión.";
}

export default function Login() {
  const navigate = useNavigate();
  const [dni, setDni] = useState("00000000");
  const [password, setPassword] = useState("SSOMA#2026!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await login({ dni: dni.trim(), password });
      if (!data?.token) throw new Error("Respuesta sin token");
      setToken(data.token);
      navigate("/", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <form
        onSubmit={handleSubmit}
        style={{
          width: 360,
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          display: "grid",
          gap: 10,
        }}
      >
        <h2 style={{ margin: 0 }}>Sistema de Inspecciones</h2>
        <p style={{ margin: 0, opacity: 0.8 }}>
          Inicia sesión con tu DNI y contraseña.
        </p>

        <label style={{ display: "grid", gap: 6 }}>
          DNI
          <input
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            placeholder="00000000"
            autoComplete="username"
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          Contraseña
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
          />
        </label>

        {error && (
          <div
            style={{
              background: "#ffecec",
              border: "1px solid #ffb3b3",
              padding: 10,
              borderRadius: 10,
            }}
          >
            {error}
          </div>
        )}

        <button disabled={loading} type="submit">
          {loading ? "Ingresando..." : "Ingresar"}
        </button>

        <small style={{ opacity: 0.7 }}>
          Nota: El frontend enviará <b>Authorization: Bearer</b> automáticamente
          en rutas protegidas.
        </small>
      </form>
    </div>
  );
}
