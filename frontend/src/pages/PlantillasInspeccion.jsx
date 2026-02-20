import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { listarPlantillas } from "../api/plantillas.api";

export default function PlantillasInspeccion() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        setError("");
        setLoading(true);
        const data = await listarPlantillas();
        if (!ok) return;
        const rowsData = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        setRows(rowsData);
      } catch (e) {
        if (!ok) return;
        const status = e?.response?.status;
        const url = e?.config?.url;
        const message = e?.response?.data?.message || e?.message || "Error desconocido";
        console.error("[PlantillasInspeccion] Error cargando plantillas:", { status, url, message });
        setError("No se pudieron cargar las plantillas.");
      } finally {
        if (ok) setLoading(false);
      }
    })();
    return () => { ok = false; };
  }, []);

  return (
    <DashboardLayout title="Plantillas de inspección">
      <div style={{ display: "grid", gap: 16 }}>
        <Card title="Selecciona una plantilla para iniciar una inspección">
          {loading ? <div>Cargando...</div> : null}
          {error ? <div style={{ color: "#b91c1c", fontWeight: 800 }}>{error}</div> : null}

          <div style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12
          }}>
            {rows.map((p) => (
              <div
                key={p.id_plantilla_inspec}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 18,
                  padding: 14,
                  background: "#fff",
                  boxShadow: "var(--shadow-sm)"
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 14 }}>
                  {p.codigo_formato}
                </div>
                <div style={{ color: "var(--muted)", marginTop: 4 }}>
                  {p.nombre_formato}
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Button
                    onClick={() => navigate(`/inspecciones/nueva?plantilla=${p.id_plantilla_inspec}`)}
                  >
                    Usar plantilla
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/inspecciones?nueva=1&plantilla=${p.id_plantilla_inspec}`)}
                  >
                    Ver inspecciones
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {!loading && rows.length === 0 ? (
            <div style={{ marginTop: 10, color: "var(--muted)" }}>
              No hay plantillas activas (estado=1).
            </div>
          ) : null}
        </Card>
      </div>
    </DashboardLayout>
  );
}
