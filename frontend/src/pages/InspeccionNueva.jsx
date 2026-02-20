import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { obtenerDefinicionPlantilla } from "../api/plantillas.api";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function InspeccionNueva() {
  const q = useQuery();
  const navigate = useNavigate();

  const plantillaId = Number(q.get("plantilla"));
  const [loading, setLoading] = useState(true);
  const [def, setDef] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        setError("");
        setLoading(true);

        if (!plantillaId || Number.isNaN(plantillaId)) {
          setError("Plantilla inválida. Vuelve a seleccionar una plantilla.");
          setDef(null);
          return;
        }

        const data = await obtenerDefinicionPlantilla(plantillaId);
        if (!ok) return;

        // json_definicion puede venir string
        const json = typeof data.json_definicion === "string"
          ? JSON.parse(data.json_definicion)
          : data.json_definicion;

        setDef({ ...data, json });
      } catch (e) {
        if (!ok) return;
        setError("No se pudo cargar la definición de la plantilla.");
        setDef(null);
      } finally {
        if (ok) setLoading(false);
      }
    })();

    return () => { ok = false; };
  }, [plantillaId]);

  return (
    <DashboardLayout title="Nueva inspección">
      <div style={{ display: "grid", gap: 16 }}>
        <Card title="Plantilla seleccionada">
          {loading ? <div>Cargando...</div> : null}
          {error ? <div style={{ color: "#b91c1c", fontWeight: 800 }}>{error}</div> : null}

          {!loading && def ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div><b>Código:</b> {def.json?.codigo_formato}</div>
              <div><b>Nombre:</b> {def.json?.nombre_formato}</div>
              <div><b>Versión:</b> {def.version}</div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button onClick={() => navigate("/inspecciones")}>
                  Volver al listado
                </Button>
                <Button variant="outline" onClick={() => navigate("/inspecciones/plantillas")}>
                  Cambiar plantilla
                </Button>
              </div>

              <div style={{ marginTop: 12, color: "var(--muted)", fontSize: 13 }}>
                Siguiente paso: renderizar dinámicamente los “items” del JSON (BUENO/MALO/NA) y guardar como INSPECCION_RESPUESTA.
              </div>
            </div>
          ) : null}
        </Card>

        {def?.json?.items?.length ? (
          <Card title="Vista previa de items">
            <div style={{ display: "grid", gap: 10 }}>
              {def.json.items.slice(0, 8).map((it) => (
                <div key={it.id} style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 14 }}>
                  <div style={{ fontWeight: 900 }}>{it.id} · {it.categoria}</div>
                  <div style={{ color: "var(--muted)" }}>{it.texto}</div>
                </div>
              ))}
              {def.json.items.length > 8 ? (
                <div style={{ color: "var(--muted)" }}>
                  … y {def.json.items.length - 8} más.
                </div>
              ) : null}
            </div>
          </Card>
        ) : null}
      </div>
    </DashboardLayout>
  );
}