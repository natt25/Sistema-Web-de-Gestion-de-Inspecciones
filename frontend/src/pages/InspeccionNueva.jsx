import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { listarPlantillas } from "../api/plantillas.api";

export default function InspeccionNueva() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const r = await listarPlantillas();
        setRows(r);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DashboardLayout title="Nueva inspección">
      <Card title="Plantillas disponibles">
        {loading ? (
          <div>Cargando...</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {rows.map((p) => (
              <div
                key={p.id_plantilla_inspec}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: 14,
                  border: "1px solid var(--border)",
                  borderRadius: 16,
                  background: "#fff",
                }}
              >
                <div style={{ display: "grid" }}>
                  <b style={{ fontSize: 14 }}>{p.nombre_formato}</b>
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>
                    {p.codigo_formato} · v{p.version_actual}
                  </span>
                </div>

                <Button onClick={() => navigate(`/inspecciones/nueva/${p.id_plantilla_inspec}`)}>
                  Elegir
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </DashboardLayout>
  );
}