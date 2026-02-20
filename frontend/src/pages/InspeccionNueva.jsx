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
          setError("Plantilla inválida.");
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
        setError("No se pudo cargar la definición.");
        setDef(null);
      } finally {
        if (ok) setLoading(false);
      }
    })();

    return () => { ok = false; };
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
        {/* ENCABEZADO SIEMPRE VISIBLE */}
        <Card title="Plantilla seleccionada">
          {loading && <div>Cargando plantilla...</div>}

          {error && (
            <div style={{ color: "#b91c1c", fontWeight: 800 }}>
              {error}
            </div>
          )}

          {!loading && !error && def && (
            <div style={{ display: "grid", gap: 8 }}>
              <div><b>Código:</b> {def.json?.codigo_formato || def.codigo_formato || "-"}</div>
              <div><b>Nombre:</b> {def.json?.nombre_formato || def.nombre_formato || "-"}</div>
              <div><b>Versión:</b> {def.version ?? "-"}</div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button onClick={() => navigate("/inspecciones")}>
                  Volver al listado
                </Button>
                <Button variant="outline" onClick={() => navigate("/inspecciones/plantillas")}>
                  Cambiar plantilla
                </Button>
              </div>
            </div>
          )}

          {!loading && !error && !def && (
            <div style={{ color: "var(--muted)" }}>
              No se encontró definición de plantilla.
            </div>
          )}
        </Card>

        {/* FORMULARIO */}
        {def?.json?.items?.length ? (
          <InspeccionDinamicaForm
            plantilla={def}              // ✅ pásale def completo (tiene id, version, etc.)
            definicion={def.json}        // ✅ pásale el JSON real
            onSubmit={(payload) => {
              console.log("PAYLOAD INSPECCIÓN:", payload);
              alert("Listo ✅ (revisa consola)");
            }}
          />
        ) : (
          !loading && !error && (
            <Card title="Sin items">
              <div style={{ color: "var(--muted)" }}>
                Esta plantilla no tiene items en su JSON.
              </div>
            </Card>
          )
        )}
      </div>
    </DashboardLayout>
  );
}
