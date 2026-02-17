import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getInspeccionFull } from "../api/inspeccionFull.api";

export default function InspeccionDetail() {
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await getInspeccionFull(id);
      setData(res);
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message;
      setError(msg || `Error cargando FULL (${status || "sin status"})`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Link to="/inspecciones">← Volver</Link>
        <button onClick={load} disabled={loading}>
          {loading ? "Cargando..." : "Recargar"}
        </button>
      </div>

      <h2 style={{ margin: 0 }}>FULL - Inspección #{id}</h2>

      {error && (
        <div style={{ padding: 10, borderRadius: 10, border: "1px solid #ffb3b3", background: "#ffecec" }}>
          {error}
        </div>
      )}

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
        {loading && <p>Cargando...</p>}
        {!loading && data && (
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
