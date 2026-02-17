import { clearToken } from "../auth/auth.storage";

export default function Home() {
  return (
    <div style={{ padding: 20 }}>
      <h2>Home</h2>

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
