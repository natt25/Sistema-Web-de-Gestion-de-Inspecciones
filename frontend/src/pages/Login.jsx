import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { login } from "../auth/auth.service";
import { getToken, setToken, setUser, getUser } from "../auth/auth.storage";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [dni, setDni] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const redirectTo = location.state?.from?.pathname || "/inspecciones";

  useEffect(() => {
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
      const data = await login({ dni, password });
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
        <section className="auth-left">
          <h1 className="auth-title">Sistema Web de Gestión de Inspecciones</h1>
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
              label="Contraseña"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              error={error}
            />

            <div className="actions">
              <Button variant="ghost" type="button" onClick={() => navigate("/change-password")}>
                Cambiar contraseña
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
