import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { login } from "../auth/auth.service";
import { getToken, setToken } from "../auth/auth.storage";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [dni, setDni] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const redirectTo = location.state?.from?.pathname || "/inspecciones";
  
  useEffect(() => {
    if (getToken()) {
      navigate(redirectTo, { replace: true });
    }
  }, [navigate, redirectTo]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    try {
      const data = await login({ dni, password });
      setToken(data.token);
      navigate(redirectTo, { replace: true });
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
