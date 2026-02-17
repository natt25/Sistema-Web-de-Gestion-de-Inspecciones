import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listarInspecciones } from "../api/inspecciones.api";
import { clearToken } from "../auth/auth.storage";

function normalizeArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data; // por si tu backend envía {data:[]}
  if (Array.isArray(data?.rows)) return data.rows; // por si envía {rows:[]}
  return [];
}

function toInputDate(value) {
  // value puede ser Date o string; aquí solo dejamos pasar string YYYY-MM-DD
  return value || "";
}

export default function InspeccionesList() {
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    id_area: "",
    id_estado_inspeccion: "",
    id_usuario: "",
    desde: "",
    hasta: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

  const queryParams = useMemo(() => {
    // solo enviar los que tengan valor
    const p = {};
    if (filters.id_area) p.id_area = Number(filters.id_area);
    if (filters.id_estado_inspeccion) p.id_estado_inspeccion = Number(filters.id_estado_inspeccion);
    if (filters.id_usuario) p.id_usuario = Number(filters.id_usuario);
    if (filters.desde) p.desde = filters.desde; // YYYY-MM-DD
    if (filters.hasta) p.hasta = filters.hasta; // YYYY-MM-DD
    return p;
  }, [filters]);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const data = await listarInspecciones(queryParams);
      setItems(normalizeArray(data));
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message;

      if (status === 401) setError("Sesión expirada (401). Vuelve a iniciar sesión.");
      else if (status === 403) setError("No tienes permisos (403).");
      else if (status === 404) setError("Endpoint no encontrado (404).");
      else if (status === 500) setError("Error interno del servidor (500).");
      else setError(msg || "No se pudo cargar el listado. Revisa backend/CORS.");

      if (status === 401) {
        clearToken();
        navigate("/login", { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onChange(e) {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Inspecciones</h2>
        <button
          onClick={() => {
            clearToken();
            navigate("/login", { replace: true });
          }}
        >
          Cerrar sesión
        </button>
      </header>

      {/* Filtros */}
      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
          <label style={{ display: "grid", gap: 6 }}>
            id_area
            <input name="id_area" value={filters.id_area} onChange={onChange} placeholder="Ej: 1" />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            id_estado_inspeccion
            <input
              name="id_estado_inspeccion"
              value={filters.id_estado_inspeccion}
              onChange={onChange}
              placeholder="Ej: 1"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            id_usuario
            <input name="id_usuario" value={filters.id_usuario} onChange={onChange} placeholder="Ej: 5" />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            desde
            <input
              type="date"
              name="desde"
              value={toInputDate(filters.desde)}
              onChange={onChange}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            hasta
            <input
              type="date"
              name="hasta"
              value={toInputDate(filters.hasta)}
              onChange={onChange}
            />
          </label>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Aplicar filtros"}
          </button>

          <button
            type="button"
            onClick={() => {
              setFilters({
                id_area: "",
                id_estado_inspeccion: "",
                id_usuario: "",
                desde: "",
                hasta: "",
              });
              // recarga sin filtros
              setTimeout(load, 0);
            }}
            disabled={loading}
          >
            Limpiar
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 10, border: "1px solid #ffb3b3", background: "#ffecec" }}>
            {error}
          </div>
        )}
      </section>

      {/* Tabla */}
      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, overflowX: "auto" }}>
        <table width="100%" cellPadding="8" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th>ID</th>
              <th>Fecha</th>
              <th>Área</th>
              <th>Estado</th>
              <th>Usuario</th>
              <th>Acción</th>
            </tr>
          </thead>

          <tbody>
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 12, opacity: 0.7 }}>
                  Sin registros.
                </td>
              </tr>
            )}

            {items.map((it) => (
              <tr key={it.id_inspeccion ?? it.id ?? JSON.stringify(it)} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td>{it.id_inspeccion ?? it.id ?? "-"}</td>
                <td>{it.fecha ?? it.fecha_inspeccion ?? it.created_at ?? "-"}</td>
                <td>{it.area ?? it.nom_area ?? it.id_area ?? "-"}</td>
                <td>{it.estado ?? it.nom_estado ?? it.id_estado_inspeccion ?? it.id_estado ?? "-"}</td>
                <td>{it.usuario ?? it.nom_usuario ?? it.id_usuario ?? "-"}</td>
                <td>
                  <button
                    onClick={() => {
                      const id = it.id_inspeccion ?? it.id;
                      if (!id) return;
                      navigate(`/inspecciones/${id}`);
                    }}
                  >
                    Ver detalle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
