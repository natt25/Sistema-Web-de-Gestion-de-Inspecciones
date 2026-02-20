import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { obtenerDefinicionPlantilla } from "../api/plantillas.api";
import InspeccionDinamicaForm from "../components/inspecciones/InspeccionDinamicaForm.jsx";
import http from "../api/http";

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

        const json =
          typeof data.json_definicion === "string"
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

    return () => {
      ok = false;
    };
  }, [plantillaId]);

  const plantilla = def
    ? {
        id_plantilla_inspec: def.id_plantilla_inspec,
        codigo_formato: def.json?.codigo_formato,
        nombre_formato: def.json?.nombre_formato,
        version: def.version,
      }
    : null;

  return (
    <DashboardLayout title="Nueva inspección">
      <div style={{ display: "grid", gap: 16 }}>
        <Card title="Plantilla seleccionada">
          {loading ? <div>Cargando...</div> : null}
          {error ? (
            <div style={{ color: "#b91c1c", fontWeight: 800 }}>{error}</div>
          ) : null}

          {!loading && def ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div>
                <b>Código:</b> {def.json?.codigo_formato}
              </div>
              <div>
                <b>Nombre:</b> {def.json?.nombre_formato}
              </div>
              <div>
                <b>Versión:</b> {def.version}
              </div>

              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <Button onClick={() => navigate("/inspecciones")}>
                  Volver al listado
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/inspecciones/plantillas")}
                >
                  Cambiar plantilla
                </Button>
              </div>

              <div style={{ marginTop: 12, color: "var(--muted)", fontSize: 13 }}>
                Rellena la inspección marcando BUENO / MALO / N/A por cada ítem.
              </div>
            </div>
          ) : null}
        </Card>

        {/* ✅ FORMULARIO REAL (reemplaza la vista previa) */}
        {!loading && def?.json?.items?.length ? (
          <InspeccionDinamicaForm
            plantilla={plantilla}
            definicion={def.json}
            onSubmit={async (payload) => {
              try {
                await http.post("/api/inspecciones", {
                  cabecera: {
                    id_plantilla_inspec: plantilla.id_plantilla_inspec,
                    id_area: 1, // ⚠ temporal, luego vendrá del select
                    id_cliente: null,
                    id_servicio: null,
                    servicio_detalle: null,
                    fecha_inspeccion: new Date().toISOString(),
                    id_estado_inspeccion: 1,
                    id_modo_registro: 1
                  },
                  respuestas: payload.respuestas
                });

                alert("Inspección guardada correctamente ✅");
                navigate("/inspecciones");

              } catch (err) {
                console.error(err);
                alert("Error al guardar inspección ❌");
              }
            }}
          />
        ) : null}
      </div>
    </DashboardLayout>
  );
}
