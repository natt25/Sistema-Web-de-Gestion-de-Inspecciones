import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../auth/auth.service";
import { clearAuth, getToken, setToken, setUser, getUser } from "../auth/auth.storage";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import logoAqp from "../assets/logo-aqp.png";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/+$/, "");

export default function Login() {
  const navigate = useNavigate();
  const [dni, setDni] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const HOME_ROUTE = "/home";

  useEffect(() => {
    const token = getToken();
    const user = getUser();

    if (!token) return;
    if (!user) {
      clearAuth();
      return;
    }

    if (user.debe_cambiar_password) {
      navigate("/change-password", { replace: true });
    } else {
      navigate(HOME_ROUTE, { replace: true });
    }
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    try {
      const data = await login({ dni, password });
      setToken(data.token);
      setUser(data.usuario);

      if (data.usuario?.debe_cambiar_password) {
        navigate("/change-password", { replace: true });
      } else {
        navigate(HOME_ROUTE, { replace: true });
      }
    } catch (err) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message;

      if (!err?.response) setError(`Network error: no se pudo conectar con la API (${API_BASE}).`);
      else if (status === 401) setError(message || "Credenciales incorrectas");
      else if (status === 403) setError(message || "Usuario no habilitado");
      else if (status === 500) setError("Error interno del servidor");
      else setError(message || err?.message || "No se pudo iniciar sesion");
    }
  }

  return (
    <div className="auth-shell">
      <img
        src={logoAqp}
        alt="AQP Industrial Service"
        className="aqp-logo"
      />
      <div className="auth-card">
        <section className="auth-left">
          <div className="auth-brand">
            
            <div className="auth-logo">
              <svg viewBox="0 0 64 64" width="80" height="80">
                <rect x="10" y="6" width="34" height="50" rx="8" fill="#ff7a1a" opacity="0.15"/>
                <rect x="14" y="10" width="34" height="50" rx="8" fill="#ff7a1a" opacity="0.25"/>

                <rect x="20" y="18" width="18" height="4" rx="2" fill="#ff7a1a"/>
                <rect x="20" y="28" width="14" height="4" rx="2" fill="#ff7a1a"/>
                <rect x="20" y="38" width="10" height="4" rx="2" fill="#ff7a1a"/>

                <circle cx="48" cy="44" r="12" fill="#ff7a1a"/>
                <path
                  d="M42.5 44l3 3 7-7"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div>
              <h1 className="auth-title">
                Sistema Web de <br/>
                Gestión de <br/>
                Inspecciones
              </h1>

              <p className="auth-subtitle">
                Registro en campo, evidencias y reportes.
              </p>
            </div>

          </div>
        </section>

        <section className="auth-right">
          <div className="auth-tabs">
            <div className="auth-tab active">Login</div>
          </div>

          <form className="form" onSubmit={handleSubmit}>
            <Input
              label="DNI / Documento de Identidad"
              placeholder="DNI"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              autoComplete="username"
              inputMode="numeric"
            />

            <Input
              label="Contrasena"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              error={error}
            />

            <div className="actions">
              <Button variant="primary" type="submit">
                Ingresar
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
