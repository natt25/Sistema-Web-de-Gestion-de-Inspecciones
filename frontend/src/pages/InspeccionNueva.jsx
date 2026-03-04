import { useEffect, useMemo, useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { clearToken, getUser } from "../auth/auth.storage.js";
import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { obtenerDefinicionPlantilla } from "../api/plantillas.api.js";
import { listarCatalogosInspeccion } from "../api/catalogos.api.js";
import { buscarEmpleados } from "../api/busquedas.api.js";
import InspeccionHeaderForm from "../components/inspecciones/InspeccionHeaderForm.jsx";
import ChecklistForm from "../components/forms/ChecklistForm.jsx";
import TablaObservacionesSeguridadForm from "../components/forms/TablaObservacionesSeguridadForm.jsx";
import TablaExtintoresForm from "../components/forms/TablaExtintoresForm.jsx";
import TablaEppsForm from "../components/forms/TablaEppsForm.jsx";
import TablaKitAntiderramesForm from "../components/forms/TablaKitAntiderramesForm.jsx";
import TablaLavaojosForm from "../components/forms/TablaLavaojosForm.jsx";
import TablaEppsCalienteForm from "../components/forms/TablaEppsCalienteForm.jsx";
import TablaBotiquinForm from "../components/forms/TablaBotiquinForm.jsx";
import http from "../api/http.js";
import useOnlineStatus from "../hooks/useOnlineStatus";
import { addInspeccionToQueue } from "../utils/offlineQueue";
import {
  deserializeTableRowsFromRespuestas,
  deserializeTablaEppsRowsFromRespuestas,
  normalizePlantillaDef,
  deserializeTablaKitAntiderramesFromRespuestas,
  deserializeTablaLavaojosFromRespuestas,
  deserializeTablaEppsCalienteRowsFromRespuestas,
  deserializeTablaBotiquinFromRespuestas,
  serializeTablaBotiquin,
} from "../utils/plantillaRenderer.js";
import { uploadEvidenciaObs, uploadEvidenciaAcc } from "../api/uploads.api.js";
import TablaCamillaForm from "../components/forms/TablaCamillaForm.jsx";

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

function pickRendererType(def) {
  const code = String(def?.codigo_formato || def?.json?.codigo_formato || "")
    .trim()
    .toUpperCase();

  const explicitTipo = String(def?.tipo || def?.json?.tipo || "").trim().toLowerCase();
  if (explicitTipo) return explicitTipo;

  if (code === "AQP-SSOMA-FOR-014") return "observaciones_seguridad";
  if (code === "AQP-SSOMA-FOR-034") return "tabla_extintores";
  if (code === "AQP-SSOMA-FOR-033") return "tabla_epps";
  if (code === "AQP-SSOMA-FOR-035") return "tabla_kit_antiderrames";
  if (code === "AQP-SSOMA-FOR-036") return "tabla_lavaojos";
  if (code === "AQP-SSOMA-FOR-037") return "tabla_epps_caliente";
  if (code === "AQP-SSOMA-FOR-038") return "tabla_botiquin";
  return "checklist";
}

const CABECERA_EMPTY = {
  id_otro: null,
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
  cliente_text: "",
  servicio_text: "",
  area_text: "",
  lugar_text: "",
};

export default function InspeccionNueva() {
  const q = useQuery();
  const navigate = useNavigate();
  const plantillaId = Number(q.get("plantilla"));
  const user = useMemo(() => getUser(), []);
  const online = useOnlineStatus();

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
  const [cabecera, setCabecera] = useState(CABECERA_EMPTY);
  const [uiNotice, setUiNotice] = useState("");
  const [tablaRows, setTablaRows] = useState([]);

  useEffect(() => {
    if (plantillaId === 1) {
      navigate("/inspecciones/plantillas", { replace: true });
    }
  }, [plantillaId, navigate]);

  useEffect(() => {
    setCabecera(CABECERA_EMPTY);
    setUiNotice("");
    setError("");
    setWarning("");
  }, [plantillaId]);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    (async () => {
      setError("");
      setDef(null);

      if (!plantillaId || Number.isNaN(plantillaId)) {
        setError("Plantilla invalida: falta ?plantilla=ID en la URL.");
        return;
      }

      setLoadingDef(true);
      try {
        const data = await obtenerDefinicionPlantilla(plantillaId, undefined, {
          signal: controller.signal,
        });
        if (!alive) return;
        setDef(normalizePlantillaDef(data));
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

  const rendererType = pickRendererType(def);
  const hasChecklistItems = Boolean(def?.items?.length || def?.json?.secciones?.length);

  const initialObsAccRows = useMemo(
    () => deserializeTableRowsFromRespuestas(def?.json?.respuestas, "observaciones_acciones"),
    [def]
  );
  const initialExtintoresRows = useMemo(
    () => deserializeTableRowsFromRespuestas(def?.json?.respuestas, "tabla_extintores"),
    [def]
  );
  const initialEppsRows = useMemo(
    () => deserializeTablaEppsRowsFromRespuestas(def?.json?.respuestas),
    [def]
  );
  const initialKit = useMemo(
    () => deserializeTablaKitAntiderramesFromRespuestas(def?.json?.respuestas || []),
    [def]
  );
  const initialLavaojos = useMemo(
    () => deserializeTablaLavaojosFromRespuestas(def?.json?.respuestas),
    [def]
  );
  const initialEppsCalienteRows = useMemo(
    () => deserializeTablaEppsCalienteRowsFromRespuestas(def?.json?.respuestas || []),
    [def]
  );
  const initialBotiquin = useMemo(
    () => deserializeTablaBotiquinFromRespuestas(def?.json?.respuestas || []),
    [def]
  );

  useEffect(() => {
    setTablaRows(initialEppsCalienteRows);
  }, [initialEppsCalienteRows, plantillaId]);

  const buscarEmpleadosForAutocomplete = useCallback(async (text) => {
    try {
      const rows = await buscarEmpleados(String(text || "").trim());
      return Array.isArray(rows) ? rows : [];
    } catch (err) {
      console.error("[InspeccionNueva] buscarEmpleados error", err);
      return [];
    }
  }, []);

  const handleAddParticipante = useCallback((p) => {
    setCabecera((prev) => {
      const dni = String(p?.dni ?? "").trim();
      const prevList = Array.isArray(prev?.participantes) ? prev.participantes : [];
      const exists = dni && prevList.some((x) => String(x?.dni ?? "").trim() === dni);

      if (exists) {
        queueMicrotask(() => setUiNotice("Ese inspector ya fue agregado. No se puede repetir."));
        return prev;
      }

      queueMicrotask(() => setUiNotice(""));
      return { ...prev, participantes: [...prevList, p] };
    });
  }, []);

  const handleRemoveParticipante = useCallback((idx) => {
    setUiNotice("");
    setCabecera((prev) => ({
      ...prev,
      participantes: (prev.participantes || []).filter((_, i) => i !== idx),
    }));
  }, []);

  const handleSubmit = useCallback(
    async (payload) => {
      setUiNotice("");

      let respuestas = Array.isArray(payload?.respuestas) ? payload.respuestas : [];
      if (payload?.__tipo === "tabla_botiquin") {
        respuestas = serializeTablaBotiquin(payload);
      }

      const cabeceraPayload = {
        ...cabecera,
        id_plantilla_inspec: Number(plantillaId),
        id_cliente: cabecera.id_cliente ? String(cabecera.id_cliente).trim() : null,
        id_servicio: cabecera.id_servicio ? Number(cabecera.id_servicio) : null,
        id_area: cabecera.id_area ? Number(cabecera.id_area) : null,
        id_lugar: cabecera.id_lugar ? Number(cabecera.id_lugar) : null,
        id_otro: cabecera.id_otro ? Number(cabecera.id_otro) : null,
        servicio_detalle: cabecera.servicio_detalle || null,
        fecha_inspeccion: cabecera.fecha_inspeccion || "",
        id_estado_inspeccion: 1,
        id_modo_registro: 1,
      };

      if (!cabeceraPayload.id_area) {
        const msg = "Debes completar la cabecera: falta Area (id_area).";
        setError(msg);
        alert(msg);
        return;
      }

      const hasCatalogo = Boolean(cabeceraPayload.id_cliente && cabeceraPayload.id_servicio);
      const hasOtro = Boolean(cabeceraPayload.id_otro);
      if ((hasCatalogo && hasOtro) || (!hasCatalogo && !hasOtro)) {
        const msg = "Completa cabecera usando (Cliente + Servicio) o id_otro, pero no ambos.";
        setError(msg);
        alert(msg);
        return;
      }

      const body = {
        cabecera: cabeceraPayload,
        participantes: cabecera.participantes || [],
        respuestas,
      };

      try {
        if (!online) {
          await addInspeccionToQueue(body);
          alert("Inspeccion guardada OFFLINE (pendiente de sincronizar)");
          navigate("/inspecciones");
          return;
        }

        const r = await http.post("/api/inspecciones", body);
        const created = r.data;
        const obsMap = new Map((created.observaciones || []).map((o) => [String(o.item_ref), Number(o.id_observacion)]));
        const accMap = new Map((created.acciones || []).map((a) => [String(a.item_ref), Number(a.id_accion)]));
        const filas = payload?.rowsWithRef || payload?.rows || [];

        for (const row of filas) {
          const ref = String(row.item_ref || "").trim();
          const idObs = obsMap.get(ref);
          const idAcc = accMap.get(ref);

          if (idObs && Array.isArray(row.evidencia_obs_files)) {
            for (const file of row.evidencia_obs_files) {
              await uploadEvidenciaObs(idObs, file);
            }
          }

          if (idAcc && Array.isArray(row.evidencia_lev_files)) {
            for (const file of row.evidencia_lev_files) {
              await uploadEvidenciaAcc(idAcc, file);
            }
          }
        }

        alert(
          `GUARDADO EN SQL: ID_INSPECCION=${r.data?.id_inspeccion ?? "??"} ID_RESPUESTA=${r.data?.id_respuesta ?? "??"}`
        );
        navigate("/inspecciones");
      } catch (e) {
        const status = e?.response?.status;
        setError(getApiErrorMessage(e));
        if (status === 401 || status === 403) {
          clearToken();
          navigate("/login", { replace: true });
        }
      }
    },
    [cabecera, plantillaId, online, navigate]
  );

  const renderFormByTipo = useCallback(() => {
    if (!def) return null;
    const safeDef = def || {};

    if (rendererType === "observaciones_seguridad" || rendererType === "observaciones_acciones") {
      return (
        <TablaObservacionesSeguridadForm
          initialRows={initialObsAccRows}
          buscarEmpleados={buscarEmpleadosForAutocomplete}
          onSubmit={handleSubmit}
        />
      );
    }

    if (rendererType === "tabla_extintores") {
      return (
        <TablaExtintoresForm
          definicion={safeDef.json}
          initialRows={initialExtintoresRows}
          onSubmit={handleSubmit}
        />
      );
    }

    if (rendererType === "tabla_epps") {
      return <TablaEppsForm initialRows={initialEppsRows} onSubmit={handleSubmit} />;
    }

    if (rendererType === "tabla_kit_antiderrames") {
      return <TablaKitAntiderramesForm definicion={safeDef.json} initial={initialKit} onSubmit={handleSubmit} />;
    }

    if (rendererType === "tabla_lavaojos") {
      return (
        <TablaLavaojosForm
          definicion={safeDef.json}
          initial={initialLavaojos}
          onSubmit={handleSubmit}
          inspectores={cabecera?.inspectores || cabecera?.participantes || []}
        />
      );
    }

    if (rendererType === "tabla_epps_caliente") {
      return (
        <TablaEppsCalienteForm
          definicion={safeDef?.json || safeDef}
          value={tablaRows}
          onChange={setTablaRows}
          onSubmit={handleSubmit}
          inspectores={cabecera?.participantes || []}
        />
      );
    }

    if (rendererType === "tabla_botiquin") {
      return (
        <TablaBotiquinForm
          definicion={safeDef?.json || {}}
          initial={initialBotiquin}
          inspectores={cabecera?.participantes || []}
          buscarEmpleados={buscarEmpleadosForAutocomplete}
          onSubmit={handleSubmit}
        />
      );
    }

    if (rendererType === "tabla_camilla") {
      return (
        <TablaCamillaForm
          definicion={safeDef?.json || safeDef}
          initial={null}
          onSubmit={handleSubmit}
        />
      );
    }

    if (!hasChecklistItems) {
      return <Card title="Sin campos">Plantilla sin campos en BD (INS_PLANTILLA_CAMPO) o sin definicion de items.</Card>;
    }

    return <ChecklistForm plantilla={def} definicion={def.json} onSubmit={handleSubmit} />;
  }, [
    def,
    rendererType,
    initialObsAccRows,
    buscarEmpleadosForAutocomplete,
    handleSubmit,
    initialExtintoresRows,
    initialEppsRows,
    hasChecklistItems,
    initialKit,
    cabecera,
    initialLavaojos,
    tablaRows,
    initialBotiquin,
  ]);

  return (
    <DashboardLayout title="Nueva inspección">
      <div style={{ display: "grid", gap: 16 }}>
        <Card title="Plantilla seleccionada">
          {loading && <div>Cargando...</div>}
          {error ? <div style={{ color: "#b91c1c", fontWeight: 800 }}>{error}</div> : null}

          {!loadingDef && !error && def ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div>
                <b>Código:</b> {def.codigo_formato ?? def.json?.codigo_formato ?? "-"}
              </div>
              <div>
                <b>Nombre:</b> {def.nombre_formato ?? def.json?.nombre_formato ?? "-"}
              </div>
              <div>
                <b>Versión:</b> {def.version ?? "-"}
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button onClick={() => navigate("/inspecciones/plantillas")}>Cambiar plantilla</Button>
              </div>
            </div>
          ) : null}

          {!loadingDef && !error && !def ? (
            <div style={{ color: "var(--muted)" }}>No se encontro la definicion.</div>
          ) : null}
        </Card>

        {uiNotice ? (
          <Card title="Aviso">
            <div style={{ color: "#b91c1c", fontWeight: 800 }}>{uiNotice}</div>
          </Card>
        ) : null}

        {warning ? (
          <Card title="Aviso">
            <div style={{ color: "#92400e", fontWeight: 700 }}>{warning}</div>
          </Card>
        ) : null}

        {!loadingDef && !error && def ? (
          <InspeccionHeaderForm
            headerDef={def?.json?.header || {}}
            catalogos={catalogos}
            user={user}
            value={cabecera}
            onChange={setCabecera}
            onAddParticipante={handleAddParticipante}
            onRemoveParticipante={handleRemoveParticipante}
          />
        ) : null}

        {!loadingDef && !error && renderFormByTipo()}
      </div>
    </DashboardLayout>
  );
}
