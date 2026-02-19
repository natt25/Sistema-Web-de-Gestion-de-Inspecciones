import { useEffect, useState } from "react";
import { listarPendientes } from "../api/pendientes.api";
import { getUser } from "../auth/auth.storage";

export default function Pendientes() {
  const [dias, setDias] = useState(7);
  const [soloMias, setSoloMias] = useState(0);
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const data = await listarPendientes({ dias, solo_mias: soloMias });
      setRows(data);
    } catch (e) {
      setMsg("No se pudo cargar pendientes (si el endpoint no existe aún, lo creamos en backend)");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [dias, soloMias]);

  const user = getUser();

  return (
    <div style={{ padding: 16 }}>
      <h2>Bandeja de Pendientes</h2>
      <p style={{ marginTop: 0 }}>Usuario: {user?.dni} ({user?.rol})</p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <label>Días</label>
        <input type="number" value={dias} onChange={(e) => setDias(Number(e.target.value))} min={1} max={60} />
        <label>
          <input type="checkbox" checked={soloMias === 1} onChange={(e) => setSoloMias(e.target.checked ? 1 : 0)} />
          Solo mis acciones
        </label>
        <button onClick={load}>Refrescar</button>
      </div>

      {msg && <p>{msg}</p>}
      {loading ? (
        <p>Cargando...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th>ID Acción</th>
                <th>Obs</th>
                <th>Descripción</th>
                <th>Responsable</th>
                <th>Fecha compromiso</th>
                <th>Estado</th>
                <th>Días restantes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id_accion}>
                  <td>{a.id_accion}</td>
                  <td>{a.id_observacion ?? "-"}</td>
                  <td>{a.desc_accion ?? a.descripcion ?? "-"}</td>
                  <td>{a.responsable ?? "-"}</td>
                  <td>{a.fecha_compromiso ? String(a.fecha_compromiso).slice(0,10) : "-"}</td>
                  <td>{a.estado ?? "-"}</td>
                  <td>{a.dias_restantes ?? "-"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan="7">No hay pendientes</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
