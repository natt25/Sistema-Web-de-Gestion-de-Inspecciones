import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { login } from "../auth/auth.service";
import { getToken, setToken, setUser, getUser } from "../auth/auth.storage";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [dni, setDni] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const redirectTo = location.state?.from?.pathname || "/inspecciones";

  useEffect(() => {
    // si ya hay token y además user exige cambio -> manda a change-password
    if (getToken()) {
      const u = getUser();
      if (u?.debe_cambiar_password) {
        navigate("/change-password", { replace: true });
      } else {
        navigate(redirectTo, { replace: true });
      }
    }
  }, [navigate, redirectTo]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    try {
      const data = await login({ dni, password }); // { token, usuario }
      setToken(data.token);
      setUser(data.usuario);

      if (data.usuario?.debe_cambiar_password) {
        navigate("/change-password", { replace: true });
      } else {
        navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      setError("Credenciales incorrectas");
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        {/* IZQUIERDA (branding) */}
        <section className="auth-left">
          <h1 className="auth-title">Sistema Web de Gestión de Inspecciones</h1>
          <p className="auth-subtitle">
            Registro en campo, evidencias y reportes.
          </p>
        </section>

        {/* DERECHA (form) */}
        <section className="auth-right">
          <div className="auth-tabs">
            <div className="auth-tab active">Login</div>
            <div className="auth-tab">Registrarse</div>
          </div>

          <form className="form" onSubmit={handleSubmit}>
            <div className="input-row">
              <div className="label">DNI / Documento de Identidad</div>
              <input
                className="input"
                placeholder="DNI"
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                autoComplete="username"
                inputMode="numeric"
              />
            </div>

            <div className="input-row">
              <div className="label">Contraseña</div>
              <input
                className="input"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              {error && <div className="help error">{error}</div>}
            </div>

            <div className="actions">
              <button className="btn-link" type="button" onClick={() => navigate("/change-password")}>
                Cambiar contraseña
              </button>

              <button className="btn-primary" type="submit">
                ingresar →
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
