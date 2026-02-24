import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { clearToken } from "../auth/auth.storage.js";
import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { obtenerDefinicionPlantilla } from "../api/plantillas.api.js";
import { listarCatalogosInspeccion } from "../api/catalogos.api.js";
import InspeccionHeaderForm from "../components/inspecciones/InspeccionHeaderForm.jsx";
import InspeccionDinamicaForm from "../components/inspecciones/InspeccionDinamicaForm.jsx";
import http from "../api/http.js";
import { getUser } from "../auth/auth.storage.js";
import useOnlineStatus from "../hooks/useOnlineStatus";
import { addInspeccionToQueue } from "../utils/offlineQueue";

const IS_DEV = Boolean(import.meta.env.DEV);

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function getApiErrorMessage(error) {
  const status = error?.response?.status;
  const endpoint = error?.config?.url || "endpoint-desconocido";
  const msg = error?.response?.data?.message || error?.message || "Error inesperado";
  return `[HTTP ${status ?? "NO_STATUS"}] ${endpoint} - ${msg}`;
}

export default function InspeccionNueva() {
  const q = useQuery();
  const navigate = useNavigate();
  const plantillaId = Number(q.get("plantilla"));
  const user = getUser(); // debe incluir dni / nombreCompleto / cargo / firma_ruta
  const online = useOnlineStatus();

  // loading separado (def + catalogos)
  const [loadingDef, setLoadingDef] = useState(false);
  const [loadingCats, setLoadingCats] = useState(false);

  const loading = loadingDef || loadingCats;

  const [def, setDef] = useState(null);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const [catalogos, setCatalogos] = useState({
    clientes: [],
    servicios: [],
    areas: [],
    lugares: [],
  });

  const [cabecera, setCabecera] = useState({
    id_cliente: null,
    id_servicio: null,
    servicio_detalle: "",
    id_area: null,
    id_lugar: null,
    fecha_inspeccion: "",
    realizado_por: "",
    cargo: "",
    firma_ruta: "",
    participantes: [],
  });

  // 1) Cargar definición (UNA SOLA VEZ por plantillaId)
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    (async () => {
      setError("");
      setDef(null);

      if (!plantillaId || Number.isNaN(plantillaId)) {
        setError("Plantilla inválida: falta ?plantilla=ID en la URL.");
        return;
      }

      setLoadingDef(true);

      try {
        const data = await obtenerDefinicionPlantilla(plantillaId, undefined, {
          signal: controller.signal,
        });

        if (!alive) return;

        const json =
          typeof data?.json_definicion === "string"
            ? JSON.parse(data.json_definicion)
            : data?.json_definicion;

        setDef({ ...data, json });
      } catch (e) {
        if (!alive) return;

        const status = e?.response?.status;
        setError(getApiErrorMessage(e));

        if (status === 401 || status === 403) {
          clearToken();
          navigate("/login", { replace: true });
        }
      } finally {
        if (alive) setLoadingDef(false);
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [plantillaId, navigate]);

  // 2) Cargar catálogos (UNA SOLA VEZ al entrar a la página)
  useEffect(() => {
    let alive = true;

    (async () => {
      setWarning("");
      setLoadingCats(true);

      try {
        const data = await listarCatalogosInspeccion();
        if (!alive) return;
        setCatalogos(data);
      } catch (e) {
        if (!alive) return;

        const status = e?.response?.status;
        setWarning(getApiErrorMessage(e));

        if (status === 401 || status === 403) {
          clearToken();
          navigate("/login", { replace: true });
        }
      } finally {
        if (alive) setLoadingCats(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [navigate]);

  return (
    <DashboardLayout title="Nueva inspeccion">
      <div style={{ display: "grid", gap: 16 }}>
        {/* Card plantilla seleccionada (tu UI) */}
        <Card title="Plantilla seleccionada">
          {loading && <div>Cargando...</div>}

          {error ? (
            <div style={{ color: "#b91c1c", fontWeight: 800 }}>{error}</div>
          ) : null}

          {!loadingDef && !error && def ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div>
                <b>Codigo:</b> {def.json?.codigo_formato ?? "-"}
              </div>
              <div>
                <b>Nombre:</b> {def.json?.nombre_formato ?? "-"}
              </div>
              <div>
                <b>Version:</b> {def.version ?? "-"}
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button onClick={() => navigate("/inspecciones/plantillas")}>
                  Cambiar plantilla
                </Button>
                <Button variant="outline" onClick={() => navigate("/inspecciones")}>
                  Volver al listado
                </Button>
              </div>
            </div>
          ) : null}

          {!loadingDef && !error && !def ? (
            <div style={{ color: "var(--muted)" }}>No se encontro la definicion.</div>
          ) : null}

        </Card>

        {warning ? (
          <Card title="Aviso">
            <div style={{ color: "#92400e", fontWeight: 700 }}>{warning}</div>
          </Card>
        ) : null}

        {/* Cabecera */}
        {def?.json?.header ? (
          <InspeccionHeaderForm
            headerDef={def.json.header}
            catalogos={catalogos}
            user={user}
            value={cabecera}
            onChange={setCabecera}
            onAddParticipante={(p) =>
              setCabecera((prev) => ({
                ...prev,
                participantes: [...(prev.participantes || []), p],
              }))
            }
            onRemoveParticipante={(idx) =>
              setCabecera((prev) => ({
                ...prev,
                participantes: (prev.participantes || []).filter((_, i) => i !== idx),
              }))
            }
          />
        ) : null}

        {/* Items */}
        {def?.json?.items?.length ? (
          <InspeccionDinamicaForm
            plantilla={def}
            definicion={def.json}
            onSubmit={async (payload) => {
              const body = {
                cabecera: {
                  id_plantilla_inspec: Number(def.id_plantilla_inspec),
                  id_cliente: cabecera.id_cliente ? Number(cabecera.id_cliente) : null,
                  id_servicio: cabecera.id_servicio ? Number(cabecera.id_servicio) : null,
                  servicio_detalle: cabecera.servicio_detalle || null,
                  id_area: cabecera.id_area ? Number(cabecera.id_area) : null,
                  id_lugar: cabecera.id_lugar ? Number(cabecera.id_lugar) : null,
                  fecha_inspeccion: cabecera.fecha_inspeccion,
                  id_estado_inspeccion: 1,
                  id_modo_registro: 1,
                },
                participantes: cabecera.participantes || [],
                respuestas: payload.respuestas,
              };

              try {
                if (!online) {
                  console.info("[inspecciones.create] offline -> queued (no POST)");
                  await addInspeccionToQueue(body);
                  alert("Inspeccion guardada OFFLINE (pendiente de sincronizar)");
                  navigate("/inspecciones");
                  return;
                }

                const r = await http.post("/api/inspecciones", body);
                alert(`Inspeccion creada ID: ${r.data?.id_inspeccion ?? "?"}`);
                navigate("/inspecciones");
              } catch (e) {
                const status = e?.response?.status;
                setError(getApiErrorMessage(e));
                if (status === 401 || status === 403) {
                  clearToken();
                  navigate("/login", { replace: true });
                }
              }
            }}
          />
        ) : (
          !loadingDef && !error && <Card title="Sin items">Esta plantilla no tiene items.</Card>
        )}
      </div>
    </DashboardLayout>
  );
}
