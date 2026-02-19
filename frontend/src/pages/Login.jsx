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
    <div style={{ padding: 20 }}>
      <h2>Login</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <input
            placeholder="DNI"
            value={dni}
            onChange={(e) => setDni(e.target.value)}
          />
        </div>

        <div>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p style={{ color: "red" }}>{error}</p>}

        <button type="submit">Ingresar</button>
      </form>
    </div>
  );
}
