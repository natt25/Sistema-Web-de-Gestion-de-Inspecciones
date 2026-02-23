import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { login } from "../auth/auth.service";
import { clearAuth, getToken, setToken, setUser, getUser } from "../auth/auth.storage";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [dni, setDni] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const redirectTo = location.state?.from?.pathname || "/inspecciones/plantillas";

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
      navigate(redirectTo, { replace: true });
    }
  }, [navigate, redirectTo]);

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
        navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message;

      if (!err?.response) setError("Network error: no se pudo conectar con la API (http://localhost:3000).");
      else if (status === 401) setError(message || "Credenciales incorrectas");
      else if (status === 403) setError(message || "Usuario no habilitado");
      else if (status === 500) setError("Error interno del servidor");
      else setError(message || err?.message || "No se pudo iniciar sesion");
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <section className="auth-left">
          <h1 className="auth-title">Sistema Web de Gestion de Inspecciones</h1>
          <p className="auth-subtitle">
            Registro en campo, evidencias y reportes.
          </p>
        </section>

        <section className="auth-right">
          <div className="auth-tabs">
            <div className="auth-tab active">Login</div>
            <div className="auth-tab">Registrarse</div>
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
              <Button variant="ghost" type="button" onClick={() => navigate("/change-password")}>
                Cambiar contrasena
              </Button>

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
