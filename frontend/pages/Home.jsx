import { clearToken } from "../auth/auth.storage";

export default function Home() {
  return (
    <div style={{ padding: 16 }}>
      <h2>Home (Parte 2: Listado de inspecciones)</h2>

      <button
        onClick={() => {
          clearToken();
          window.location.href = "/login";
        }}
      >
        Cerrar sesión
      </button>
    </div>
  );
}
