import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getInspeccionFull } from "../api/inspeccionFull.api";

function imgUrl(archivo_ruta) {
  // archivo_ruta viene tipo "storage/observaciones/xxx.jpg"
  return `http://localhost:3000/${archivo_ruta}`;
}

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

  const cab = data?.cabecera ?? data?.inspeccion ?? data?.header ?? data;

  const observaciones = data?.observaciones ?? [];
  const evidObs = data?.evidencias_observacion ?? data?.evidenciasObservacion ?? [];
  const acciones = data?.acciones ?? [];
  const evidAcc = data?.evidencias_accion ?? data?.evidenciasAccion ?? [];

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link to="/inspecciones">← Volver</Link>
        <button onClick={load} disabled={loading}>
          {loading ? "Recargando..." : "Recargar"}
        </button>
      </div>

      <h2 style={{ margin: 0 }}>Inspección #{id}</h2>

      {error && (
        <div style={{ padding: 10, borderRadius: 10, border: "1px solid #ffb3b3", background: "#ffecec" }}>
          {error}
        </div>
      )}

      {/* Cabecera */}
      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Cabecera</h3>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
          {cab ? JSON.stringify(cab, null, 2) : "Sin data de cabecera"}
        </pre>
      </section>

      {/* Observaciones */}
      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Observaciones ({observaciones.length})</h3>

        {observaciones.length === 0 ? (
          <p style={{ opacity: 0.7 }}>Sin observaciones.</p>
        ) : (
          observaciones.map((o) => {
            const idObs = o.id_observacion ?? o.id;
            const evidenciasDeObs = evidObs.filter((e) => (e.id_observacion ?? e.observacion_id) === idObs);
            const accionesDeObs = acciones.filter((a) => (a.id_observacion ?? a.observacion_id) === idObs);

            return (
              <div key={idObs} style={{ borderTop: "1px solid #eee", paddingTop: 10, marginTop: 10 }}>
                <b>Obs #{idObs}</b>
                <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(o, null, 2)}</pre>

                <div style={{ marginTop: 8 }}>
                  <b>Evidencias ({evidenciasDeObs.length})</b>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                    {evidenciasDeObs.map((e) => (
                      <a
                        key={e.id_evidencia ?? e.id ?? e.archivo_ruta}
                        href={imgUrl(e.archivo_ruta)}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: "grid", gap: 6, width: 160, textDecoration: "none" }}
                      >
                        <img
                          src={imgUrl(e.archivo_ruta)}
                          alt="evidencia"
                          style={{ width: 160, height: 120, objectFit: "cover", borderRadius: 10, border: "1px solid #ddd" }}
                          onError={(ev) => (ev.currentTarget.style.display = "none")}
                        />
                        <small style={{ color: "#333", wordBreak: "break-all" }}>{e.archivo_ruta}</small>
                      </a>
                    ))}
                    {evidenciasDeObs.length === 0 && <span style={{ opacity: 0.7 }}>Sin evidencias</span>}
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <b>Acciones ({accionesDeObs.length})</b>
                  {accionesDeObs.length === 0 ? (
                    <p style={{ opacity: 0.7 }}>Sin acciones.</p>
                  ) : (
                    accionesDeObs.map((a) => {
                      const idAcc = a.id_accion ?? a.id;
                      const evidenciasDeAcc = evidAcc.filter((ea) => (ea.id_accion ?? ea.accion_id) === idAcc);

                      return (
                        <div key={idAcc} style={{ marginTop: 8, padding: 10, borderRadius: 10, border: "1px solid #eee" }}>
                          <b>Acc #{idAcc}</b>
                          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(a, null, 2)}</pre>

                          <b>Evidencias acción ({evidenciasDeAcc.length})</b>
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                            {evidenciasDeAcc.map((ea) => (
                              <a
                                key={ea.id_evidencia ?? ea.id ?? ea.archivo_ruta}
                                href={imgUrl(ea.archivo_ruta)}
                                target="_blank"
                                rel="noreferrer"
                                style={{ display: "grid", gap: 6, width: 160, textDecoration: "none" }}
                              >
                                <img
                                  src={imgUrl(ea.archivo_ruta)}
                                  alt="evidencia accion"
                                  style={{ width: 160, height: 120, objectFit: "cover", borderRadius: 10, border: "1px solid #ddd" }}
                                  onError={(ev) => (ev.currentTarget.style.display = "none")}
                                />
                                <small style={{ color: "#333", wordBreak: "break-all" }}>{ea.archivo_ruta}</small>
                              </a>
                            ))}
                            {evidenciasDeAcc.length === 0 && <span style={{ opacity: 0.7 }}>Sin evidencias</span>}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
