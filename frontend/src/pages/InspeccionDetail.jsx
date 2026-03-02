
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getInspeccionFull } from "../api/inspeccionFull.api";
import { crearObservacion, actualizarEstadoObservacion } from "../api/observaciones.api";
import { crearAccion, actualizarEstadoAccion, actualizarPorcentajeAccion } from "../api/acciones.api";
import { uploadEvidenciaObs, uploadEvidenciaAcc, deleteEvidenciaAcc } from "../api/uploads.api";
import useOnlineStatus from "../hooks/useOnlineStatus";
import useLoadingWatchdog from "../hooks/useLoadingWatchdog";
import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import {
  addToQueue, getAllQueue, removeFromQueue,
  addMutationToQueue, getAllMutationsQueue, removeMutationFromQueue,
  setIdMap, getIdMap, getPendingCounts,
  getInspeccionCache, setInspeccionCache,
} from "../utils/offlineQueue";
import { obtenerDefinicionPlantilla } from "../api/plantillas.api";
import { getToken } from "../auth/auth.storage";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";
const DEBUG_SYNC = import.meta.env.DEV;

function safeParseJson(v) {
  if (!v) return null;
  if (typeof v === "object") return v;
  if (typeof v !== "string") return null;
  try { return JSON.parse(v); } catch { return null; }
}

function pick(obj, keys, fallback = "") {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return fallback;
}

function RenderTablaExtintores({ respuestas }) {
  const rows = (respuestas || [])
    .filter((r) => String(r.categoria).toUpperCase() === "TABLA_EXTINTORES" && r.row_data)
    .map((r) => r.row_data)
    .sort((a, b) => (a.rowIndex || a.row_index || 0) - (b.rowIndex || b.row_index || 0));

  if (!rows.length) return <div style={{ opacity: 0.7 }}>Sin registros en TABLA_EXTINTORES.</div>;

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Código</th>
            <th>Ubicación</th>
            <th>Tipo</th>
            <th>Capacidad</th>
            <th>F. Prueba</th>
            <th>F. Venc.</th>
            <th>Obs.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.rowIndex ?? r.row_index ?? i}>
              <td>{pick(r, ["rowIndex", "row_index", "n", "numero"], i + 1)}</td>
              <td>{pick(r, ["codigo", "cod", "code"])}</td>
              <td>{pick(r, ["ubicacion", "ubic", "location"])}</td>
              <td>{pick(r, ["tipo", "type"])}</td>
              <td>{pick(r, ["capacidad", "cap", "kg"])}</td>
              <td>{pick(r, ["fecha_prueba", "f_prueba", "fechaPrueba"])}</td>
              <td>{pick(r, ["fecha_vencimiento", "f_venc", "fechaVencimiento"])}</td>
              <td>{pick(r, ["observaciones", "obs", "observacion"])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function descargarExcelSeguridad(idInspeccion) {
  const token = getToken(); // como ya lo usas en otras llamadas

  const r = await fetch(`${import.meta.env.VITE_API_URL}/api/inspecciones/${idInspeccion}/export/seguridad-xlsx`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!r.ok) throw new Error("No se pudo descargar");

  const blob = await r.blob();
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `FOR-014_InspeccionSeguridad_${idInspeccion}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  window.URL.revokeObjectURL(url);
}

function fileUrl(archivo_ruta) {
  if (!archivo_ruta || String(archivo_ruta).startsWith("PENDING_UPLOAD/")) return null;

  const base = String(API_BASE || "").replace(/\/+$/, "");
  const path = String(archivo_ruta || "").replace(/^\/+/, "");
  return `${base}/${path}`;
}

function fmtDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function isTempId(x) {
  return typeof x === "string" && x.startsWith("tmp_");
}

function makeTempId(prefix) {
  return `tmp_${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function pickIdFromCreateResponse(res, kind) {
  if (!res) return null;
  if (kind === "OBS") return res.id_observacion ?? res.id ?? res.insertedId ?? null;
  if (kind === "ACC") return res.id_accion ?? res.id ?? res.insertedId ?? null;
  return null;
}

function dedupeEvidencias(list) {
  const seen = new Set();
  const out = [];
  for (const e of list || []) {
    const key = e?.archivo_hash || e?.archivo_ruta || e?.id || e?.id_obs_evidencia || e?.id_acc_evidencia;
    if (key && seen.has(String(key))) continue;
    if (key) seen.add(String(key));
    out.push(e);
  }
  return out;
}

function applyPendingToData(base, mutations, uploads) {
  const safeBase = base ?? { cabecera: null, participantes: [], respuestas: [], observaciones: [] };
  const baseObs = Array.isArray(safeBase.observaciones) ? safeBase.observaciones : [];
  const obsMap = new Map(baseObs.map((o) => [String(o.id_observacion), { ...o }]));
  const prependObs = [];

  for (const m of mutations || []) {
    if (m.type !== "OBS_CREATE") continue;
    const key = String(m.tempId);
    if (obsMap.has(key)) continue;
    const pendingObs = {
      id_observacion: m.tempId,
      id_estado_observacion: m.payload?.id_estado_observacion ?? 1,
      estado_observacion: "PENDIENTE",
      nivel_riesgo: m.payload?.id_nivel_riesgo ?? 1,
      item_ref: m.payload?.item_ref ?? "-",
      desc_observacion: m.payload?.desc_observacion ?? "",
      evidencias: [],
      acciones: [],
      __pending: true,
    };
    obsMap.set(key, pendingObs);
    prependObs.push(pendingObs);
  }

  const obsList = [...prependObs, ...baseObs.map((o) => obsMap.get(String(o.id_observacion)) || o)];

  for (const m of mutations || []) {
    if (m.type !== "ACC_CREATE") continue;
    const obsRef = String(m.obsRef);
    const obs = obsMap.get(obsRef);
    if (!obs) continue;
    const acciones = Array.isArray(obs.acciones) ? obs.acciones : [];
    if (acciones.some((a) => String(a.id_accion) === String(m.tempId))) continue;
    const pendingAcc = {
      id_accion: m.tempId,
      id_estado_accion: m.payload?.id_estado_accion ?? 1,
      estado_accion: "PENDIENTE",
      fecha_compromiso: m.payload?.fecha_compromiso ?? null,
      desc_accion: m.payload?.desc_accion ?? "",
      evidencias: [],
      __pending: true,
    };
    obs.acciones = [pendingAcc, ...acciones];
  }

  for (const u of uploads || []) {
    if (!u?.pendingPath) continue;
    const placeholder = {
      id: u.pendingPath,
      archivo_ruta: u.pendingPath,
      archivo_nombre: u.fileMeta?.name || u.file?.name || "archivo",
      mime_type: u.fileMeta?.type || u.file?.type || "",
      capturada_en: u.createdAt || new Date().toISOString(),
      __pending: true,
    };

    if (u.kind === "OBS") {
      const obs = obsMap.get(String(u.idTarget));
      if (!obs) continue;
      const evs = Array.isArray(obs.evidencias) ? obs.evidencias : [];
      if (!evs.some((e) => String(e.archivo_ruta) === String(u.pendingPath))) {
        obs.evidencias = [placeholder, ...evs];
      }
    } else if (u.kind === "ACC") {
      for (const obs of obsMap.values()) {
        const acciones = Array.isArray(obs.acciones) ? obs.acciones : [];
        obs.acciones = acciones.map((a) => {
          if (String(a.id_accion) !== String(u.idTarget)) return a;
          const evs = Array.isArray(a.evidencias) ? a.evidencias : [];
          if (evs.some((e) => String(e.archivo_ruta) === String(u.pendingPath))) return a;
          return { ...a, evidencias: [placeholder, ...evs] };
        });
      }
    }
  }

  const finalObs = obsList.map((o) => {
    const evidencias = dedupeEvidencias(o.evidencias || []);
    const acciones = (o.acciones || []).map((a) => ({
      ...a,
      evidencias: dedupeEvidencias(a.evidencias || []),
    }));
    return { ...o, evidencias, acciones };
  });

  return {
    ...safeBase,
    participantes: Array.isArray(safeBase.participantes) ? safeBase.participantes : [],
    respuestas: Array.isArray(safeBase.respuestas) ? safeBase.respuestas : [],
    observaciones: finalObs,
  };
}

function getErrorMessage(err) {
  const status = err?.response?.status;
  const msg = err?.response?.data?.message;

  if (status === 401) return "Sesion expirada (401). Vuelve a iniciar sesion.";
  if (status === 403) return "No tienes permisos (403).";
  if (status === 404) return "Endpoint no encontrado (404).";
  if (status === 409) return msg || "Conflicto (409).";
  if (status === 500) return "Error interno del servidor (500).";
  return msg || "Error inesperado. Revisa consola/backend.";
}

function parseAccionJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getItemNumber(itemId) {
  const s = String(itemId || "").toLowerCase().trim();
  // captura el primer numero que aparezca: i08 -> 8, 1.2 -> 1, etc
  const m = s.match(/\d+/);
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
}

function EvidenceGrid({ evidencias, allowDelete = false, onDelete, onPreview }) {
  if (!evidencias || evidencias.length === 0) {
    return <p style={{ margin: "6px 0", opacity: 0.7 }}>Sin evidencias.</p>;
  }

  return (
    <div className="obsacc-grid">
      {evidencias.map((e) => {
        const key = e.id_obs_evidencia ?? e.id_acc_evidencia ?? e.id ?? e.archivo_ruta;
        const url = fileUrl(e.archivo_ruta);
        const showDelete = allowDelete && typeof onDelete === "function";
        const onOpenPreview = () => {
          if (!url) return;
          onPreview?.({ url, name: e.archivo_nombre || "Evidencia" });
        };

        const deleteBtn = showDelete ? (
          <Button
            variant="primary"
            type="button"
            className="evi-x"
            onClick={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              onDelete(e);
            }}
            title="Eliminar evidencia"
            aria-label="Eliminar evidencia"
          >
            X
          </Button>
        ) : null;

        if (!url) {
          return (
            <div
              key={key}
              className="evi-thumb evi-thumb-pending"
            >
              {deleteBtn}
              <b className="evi-pending-title">PENDIENTE</b>
              <div className="evi-pending-path">{e.archivo_ruta}</div>
            </div>
          );
        }

        return (
          <div
            key={key}
            className="evi-thumb"
            onClick={onOpenPreview}
            role="button"
            tabIndex={0}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                onOpenPreview();
              }
            }}
          >
            {deleteBtn}
            <img
              src={url}
              alt={e.archivo_nombre || "evidencia"}
              className="evi-image"
              onError={(ev) => {
                ev.currentTarget.style.display = "none";
              }}
            />

            <div className="evi-meta">
              <div className="evi-name">
                {e.archivo_nombre || e.archivo_ruta}
              </div>
              <div className="evi-text-muted">{e.mime_type || "-"}</div>
              <div className="evi-text-muted">Capturada: {fmtDate(e.capturada_en)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CrearAccionForm({ idObservacion, onCreated, onMsg, inspeccionCerrada, online }) {
  const [form, setForm] = useState({
    desc_accion: "",
    fecha_compromiso: "",
    id_estado_accion: "1",
    responsable_interno_dni: "",
    responsable_externo_nombre: "",
    responsable_externo_cargo: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function onChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.desc_accion.trim()) return setError("Falta desc_accion.");
    if (!form.fecha_compromiso) return setError("Falta fecha_compromiso.");

    const dni = form.responsable_interno_dni.trim();
    const externoNombre = form.responsable_externo_nombre.trim();
    const externoCargo = form.responsable_externo_cargo.trim();

    if (dni && (externoNombre || externoCargo)) {
      return setError("Usa responsable interno por DNI o responsable externo (nombre y cargo), no ambos.");
    }
    if (!dni && (!externoNombre || !externoCargo)) {
      return setError("Si no indicas DNI, debes completar responsable_externo_nombre y responsable_externo_cargo.");
    }

    setSaving(true);
    try {
      const payload = {
        desc_accion: form.desc_accion.trim(),
        fecha_compromiso: form.fecha_compromiso,
        id_estado_accion: Number(form.id_estado_accion),
      };

      if (dni) payload.responsable_interno_dni = dni;
      else {
        payload.responsable_externo_nombre = externoNombre;
        payload.responsable_externo_cargo = externoCargo;
      }

      if (!online) {
        const tempId = makeTempId("acc");

        await addMutationToQueue({
          type: "ACC_CREATE",
          tempId,
          obsRef: idObservacion,
          payload,
          createdAt: new Date().toISOString(),
        });

        onMsg?.(idObservacion, "Accion guardada offline ?", "ok");
        await onCreated?.({
          __offlineCreatedAction: true,
          obsRef: idObservacion,
          action: {
            id_accion: tempId,
            id_estado_accion: payload.id_estado_accion,
            estado_accion: "PENDIENTE",
            fecha_compromiso: payload.fecha_compromiso,
            desc_accion: payload.desc_accion,
            evidencias: [],
            __pending: true,
          },
        });

        return;
      }

      await crearAccion(idObservacion, payload);

      setForm((prev) => ({
        ...prev,
        desc_accion: "",
        fecha_compromiso: "",
        responsable_interno_dni: "",
        responsable_externo_nombre: "",
        responsable_externo_cargo: "",
      }));

      onMsg?.(idObservacion, "Accion creada ?", "ok");
      await onCreated?.();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      onMsg?.(idObservacion, msg, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        marginTop: 12,
        padding: 12,
        border: "1px solid #eee",
        borderRadius: 12,
        display: "grid",
        gap: 8,
        maxWidth: 520,
        background: "#fafafa",
      }}
    >
      <b>Crear accion (Obs #{idObservacion})</b>

      <label style={{ display: "grid", gap: 6 }}>
        Descripcion (desc_accion)
        <textarea name="desc_accion" value={form.desc_accion} onChange={onChange} rows={2} disabled={inspeccionCerrada} />
      </label>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <label style={{ display: "grid", gap: 6 }}>
          Fecha compromiso
          <input type="date" name="fecha_compromiso" value={form.fecha_compromiso} onChange={onChange} disabled={inspeccionCerrada} />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          Estado (id_estado_accion)
          <select name="id_estado_accion" value={form.id_estado_accion} onChange={onChange} disabled={inspeccionCerrada}>
            <option value="1">1 - ABIERTA</option>
            <option value="2">2 - EN PROCESO</option>
            <option value="3">3 - CUMPLIDA</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          DNI responsable interno
          <input
            name="responsable_interno_dni"
            value={form.responsable_interno_dni}
            onChange={onChange}
            placeholder="Ej: 12345678"
            disabled={inspeccionCerrada}
          />
        </label>
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <label style={{ display: "grid", gap: 6 }}>
          Responsable externo nombre
          <input
            name="responsable_externo_nombre"
            value={form.responsable_externo_nombre}
            onChange={onChange}
            placeholder="Si no hay DNI interno"
            disabled={inspeccionCerrada}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          Responsable externo cargo
          <input
            name="responsable_externo_cargo"
            value={form.responsable_externo_cargo}
            onChange={onChange}
            placeholder="Si no hay DNI interno"
            disabled={inspeccionCerrada}
          />
        </label>
      </div>

      {error && (
        <div style={{ padding: 10, borderRadius: 10, border: "1px solid #ffb3b3", background: "#ffecec" }}>
          {error}
        </div>
      )}

      <Button variant="primary" disabled={saving || inspeccionCerrada} type="submit">
        {inspeccionCerrada ? "Inspeccion cerrada" : saving ? "Guardando..." : "Crear accion"}
      </Button>
    </form>
  );
}

function UploadEvidence({ kind, idTarget, onUploaded, disabled, inspeccionCerrada, online }) {
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const inputId = `file_${kind}_${idTarget}`;

  function onPickFiles(e) {
    const picked = Array.from(e.target.files || []);
    setFiles(picked);
    setError("");
    setOk("");
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setOk("");

    if (!files.length) return setError("Selecciona uno o mas archivos.");

    setSaving(true);
    try {
      if (!online) {
        const placeholders = [];
        for (const f of files) {
          const pendingPath = `PENDING_UPLOAD/${Date.now()}_${f.name}`;

          await addToQueue({
            kind,
            idTarget,
            file: f,
            pendingPath,
            createdAt: new Date().toISOString(),
            queueKey: `${kind}|${idTarget}|${f.name}|${f.size}|${f.lastModified}`,
          });

          placeholders.push({
            id: `${Date.now()}_${f.name}`,
            archivo_ruta: pendingPath,
            archivo_nombre: f.name,
            mime_type: f.type,
            capturada_en: new Date().toISOString(),
            __pending: true,
          });
        }

        await onUploaded?.({ __offlineEvidence: true, kind, idTarget, placeholders });

        setOk(`Guardado offline ? (${files.length})`);
        setFiles([]);
        setTimeout(() => setOk(""), 2500);
        return;
      }

      for (const f of files) {
        if (kind === "OBS") await uploadEvidenciaObs(idTarget, f);
        else await uploadEvidenciaAcc(idTarget, f);
      }

      setOk(`Evidencias subidas ? (${files.length})`);
      setFiles([]);
      await onUploaded?.();
      setTimeout(() => setOk(""), 2500);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const blocked = disabled || saving || inspeccionCerrada;

  return (
    <form onSubmit={onSubmit} style={{ marginTop: 10, display: "grid", gap: 10, maxWidth: 520 }}>
      <b>Subir evidencias ({kind === "OBS" ? `Obs #${idTarget}` : `Acc #${idTarget}`})</b>

      {/* selector en columna */}
      <div style={{ display: "grid", gap: 10, justifyItems: "start" }}>
        {/* input real oculto */}
        <input
          id={`file_${kind}_${idTarget}`}
          type="file"
          accept="image/*"
          multiple
          onChange={onPickFiles}
          disabled={disabled || saving || inspeccionCerrada}
          style={{ display: "none" }}
        />

        {/* boton con estilo del proyecto */}
        <label htmlFor={`file_${kind}_${idTarget}`}>
          <Button variant="outline" type="button" disabled={disabled || saving || inspeccionCerrada}>
            Elegir archivos
          </Button>
        </label>

        <div style={{ fontSize: 12, opacity: 0.75 }}>
          {files.length ? `${files.length} seleccionado(s)` : "Ningun archivo seleccionado"}
        </div>

        {/* boton subir debajo y a la izquierda */}
        <Button variant="primary" disabled={saving || disabled || inspeccionCerrada} type="submit">
          {saving ? "Subiendo..." : `Subir${files.length ? ` (${files.length})` : ""}`}
        </Button>
      </div>

      {/* previews seleccionados */}
      {files.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {files.map((f) => {
            const url = URL.createObjectURL(f);
            return (
              <div
                key={f.name + f.size}
                style={{ width: 140, border: "1px solid #ddd", borderRadius: 14, overflow: "hidden", background: "#fff" }}
              >
                <img
                  src={url}
                  alt={f.name}
                  style={{ width: "100%", height: 110, objectFit: "contain", background: "#f7f6f3", display: "block" }}
                  onLoad={() => URL.revokeObjectURL(url)}
                />
                <div style={{ padding: 8, fontSize: 11, wordBreak: "break-all" }}>{f.name}</div>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div style={{ padding: 10, borderRadius: 10, border: "1px solid #ffb3b3", background: "#ffecec" }}>
          {error}
        </div>
      )}

      {ok && (
        <div style={{ padding: 10, borderRadius: 10, border: "1px solid #b3ffb3", background: "#ecffec" }}>
          {ok}
        </div>
      )}
    </form>
  );
}

export default function InspeccionDetail() {
  const [preview, setPreview] = useState({ open: false, url: "", name: "" });
  const openPreview = ({ url, name }) => {
    setPreview({ open: true, url, name: name || "Evidencia" });
  };
  const closePreview = () => {
    setPreview({ open: false, url: "", name: "" });
  };
  useEffect(() => {
    if (!preview.open) return undefined;
    const onKeyDown = (ev) => {
      if (ev.key === "Escape") closePreview();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [preview.open]);
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  useLoadingWatchdog({
    loading,
    setLoading,
    setMessage: setPageError,
    label: "InspeccionDetail.load",
    timeoutMs: 10000,
  });
  const [infoMsg, setInfoMsg] = useState("");
  const [data, setData] = useState(null);
  const [accionMsgByObs, setAccionMsgByObs] = useState({});
  const [obsMsgByObs, setObsMsgByObs] = useState({});
  const obsTimersRef = useRef({});
  const accionTimersRef = useRef({});
  const [definicion, setDefinicion] = useState(null);
  const [form, setForm] = useState({
    item_ref: "",
    desc_observacion: "",
    id_nivel_riesgo: "1",
    id_estado_observacion: "1",
  });

  const online = useOnlineStatus();
  const [pending, setPending] = useState({ total: 0, uploads: 0, mutations: 0 });
  const [syncMsg, setSyncMsg] = useState("");

  async function refreshPending() {
    try {
      const c = await getPendingCounts();
      setPending(c);
    } catch {
      setPending({ total: 0, uploads: 0, mutations: 0 });
    }
  }

  useEffect(() => {
    refreshPending();
  }, []);

  async function syncNow({ silent = false } = {}) {
    if (!online) {
      if (!silent) setSyncMsg("Sin conexion: no se puede sincronizar.");
      return;
    }

    if (window.__OFFLINE_SYNC_RUNNING__) return;
    window.__OFFLINE_SYNC_RUNNING__ = true;

    try {
      if (!silent) setSyncMsg("Sincronizando...");

      let mutations = [];
      let uploads = [];
      try {
        mutations = await getAllMutationsQueue();
        uploads = await getAllQueue();
      } catch {
        mutations = [];
        uploads = [];
      }
      const seen = new Set();
      const uploadsUnique = [];
      for (const u of uploads) {
        const k = u.queueKey || `${u.kind}|${u.idTarget}|${u.pendingPath || ""}`;
        if (seen.has(k)) {
          try { await removeFromQueue(u.id); } catch {}
          continue;
        }
        seen.add(k);
        uploadsUnique.push(u);
      }

      let removedMutations = 0;
      let removedUploads = 0;
      const uploadedPendingPaths = new Set();

      if (DEBUG_SYNC) {
        console.debug("[syncNow] queued", { mutations: mutations.length, uploads: uploads.length });
      }

      let subioAlgo = false;

      const obsCreates = mutations.filter((m) => m.type === "OBS_CREATE");
      const accCreates = mutations.filter((m) => m.type === "ACC_CREATE");

      for (const m of obsCreates) {
        try {
          const res = await crearObservacion(m.idInspeccion, m.payload);
          const realId = pickIdFromCreateResponse(res, "OBS");
          if (realId != null) {
            await setIdMap(m.tempId, Number(realId));
            await removeMutationFromQueue(m.id);
            removedMutations += 1;
            subioAlgo = true;
          }
        } catch (err) {
          console.error("SYNC OBS_CREATE error:", err);
        }
      }

      for (const m of accCreates) {
        try {
          let obsId = m.obsRef;
          if (isTempId(obsId)) {
            const map = await getIdMap(obsId);
            if (!map?.realId) continue;
            obsId = map.realId;
          }

          const res = await crearAccion(obsId, m.payload);
          const realId = pickIdFromCreateResponse(res, "ACC");
          if (realId != null) {
            await setIdMap(m.tempId, Number(realId));
            await removeMutationFromQueue(m.id);
            removedMutations += 1;
            subioAlgo = true;
          }
        } catch (err) {
          console.error("SYNC ACC_CREATE error:", err);
        }
      }

      for (const u of uploadsUnique) {
        try {
          if (!u.file) continue;

          let targetId = u.idTarget;
          if (isTempId(targetId)) {
            const map = await getIdMap(targetId);
            if (!map?.realId) continue;
            targetId = map.realId;
          }

          let uploaded = false;
          try {
            if (u.kind === "OBS") await uploadEvidenciaObs(targetId, u.file);
            else await uploadEvidenciaAcc(targetId, u.file);
            uploaded = true;
          } catch (err) {
            const status = err?.response?.status;
            if (status === 409) uploaded = true;
            else console.error("SYNC upload error:", err);
          }

          if (!uploaded) continue;
          await removeFromQueue(u.id);
          removedUploads += 1;
          if (typeof u.pendingPath === "string" && u.pendingPath.startsWith("PENDING_UPLOAD/")) {
            uploadedPendingPaths.add(u.pendingPath);
          }
          subioAlgo = true;
        } catch (err) {
          console.error("SYNC upload error:", err);
        }
      }

      if (DEBUG_SYNC) {
        console.debug("[syncNow] removed", { mutations: removedMutations, uploads: removedUploads });
      }

      await refreshPending();

      if (subioAlgo) {
        await removePendingPlaceholdersFromState(uploadedPendingPaths);
        await load();
        if (!silent) setSyncMsg("Sincronizacion completa ?");
      } else {
        if (!silent) setSyncMsg("Nada pendiente por sincronizar.");
      }
    } finally {
      window.__OFFLINE_SYNC_RUNNING__ = false;
      if (!silent) setTimeout(() => setSyncMsg(""), 2500);
    }
  }

  useEffect(() => {
    if (online) syncNow({ silent: true });
  }, [online]);

  const [savingObs, setSavingObs] = useState(false);
  const [obsError, setObsError] = useState("");
  const [obsOk, setObsOk] = useState("");

  function showAccionMsg(idObs, msg, type = "ok") {
    setAccionMsgByObs((prev) => ({ ...prev, [idObs]: { msg, type } }));

    if (accionTimersRef.current[idObs]) {
      clearTimeout(accionTimersRef.current[idObs]);
    }

    accionTimersRef.current[idObs] = setTimeout(() => {
      setAccionMsgByObs((prev) => {
        const copy = { ...prev };
        delete copy[idObs];
        return copy;
      });
    }, 4000);
  }

  function showObsMsg(idObs, msg, type = "ok") {
    setObsMsgByObs((prev) => ({ ...prev, [idObs]: { msg, type } }));

    if (obsTimersRef.current[idObs]) clearTimeout(obsTimersRef.current[idObs]);

    obsTimersRef.current[idObs] = setTimeout(() => {
      setObsMsgByObs((prev) => {
        const copy = { ...prev };
        delete copy[idObs];
        return copy;
      });
    }, 4000);
  }

  useEffect(() => {
    return () => {
      Object.values(accionTimersRef.current).forEach((t) => clearTimeout(t));
      Object.values(obsTimersRef.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  const dataRef = useRef(null);
  useEffect(() => { dataRef.current = data; }, [data]);

  async function setDataAndCache(next) {
    setData(next);
    try {
      await setInspeccionCache(id, next);
    } catch {}
  }

  async function removeAccEvidenceFromState(idAccion, matchFn) {
    const base = dataRef.current;
    if (!base) return;

    const next = {
      ...base,
      observaciones: (base.observaciones || []).map((o) => ({
        ...o,
        acciones: (o.acciones || []).map((a) => {
          if (String(a.id_accion) !== String(idAccion)) return a;
          const evs = Array.isArray(a.evidencias) ? a.evidencias : [];
          return { ...a, evidencias: evs.filter((ev) => !matchFn(ev)) };
        }),
      })),
    };

    await setDataAndCache(next);
  }

  async function removePendingUploadFromQueue(idAccion, pendingPath) {
    const queue = await getAllQueue();
    const items = queue.filter((q) =>
      q?.kind === "ACC" &&
      String(q?.idTarget) === String(idAccion) &&
      String(q?.pendingPath || "") === String(pendingPath || "")
    );

    for (const item of items) {
      if (item?.id != null) await removeFromQueue(item.id);
    }
  }

  async function handleDeleteAccEvidence({ evItem, idAccion }) {
    if (!evItem || !idAccion) return;
    if (!confirm("¿Eliminar evidencia?")) return;

    const pendingPath = String(evItem?.archivo_ruta || "");
    const isPendingOffline = pendingPath.startsWith("PENDING_UPLOAD/");

    if (isPendingOffline) {
      await removePendingUploadFromQueue(idAccion, pendingPath);
      await removeAccEvidenceFromState(idAccion, (ev) => String(ev?.archivo_ruta || "") === pendingPath);
      await refreshPending();
      return;
    }

    if (!evItem?.id_acc_evidencia) return;

    try {
      await deleteEvidenciaAcc(evItem.id_acc_evidencia);
      await removeAccEvidenceFromState(
        idAccion,
        (ev) =>
          String(ev?.id_acc_evidencia || "") === String(evItem.id_acc_evidencia) ||
          String(ev?.archivo_ruta || "") === String(evItem?.archivo_ruta || "")
      );
    } catch (err) {
      // fallback conservador si el estado local no coincide con backend
      await load();
      alert(getErrorMessage(err));
    }
  }

  async function load() {
    setLoading(true);
    await refreshPending();

    let cached = null;
    try {
      cached = await getInspeccionCache(id);
    } catch {}

    if (!online) {
      setPageError("");
      if (!cached) setInfoMsg("Sin datos offline disponibles.");
      else setInfoMsg("");

      let mutations = [];
      let uploads = [];
      try {
        mutations = await getAllMutationsQueue();
        uploads = await getAllQueue();
      } catch {
        mutations = [];
        uploads = [];
      }
      const merged = applyPendingToData(
        cached ?? { cabecera: null, participantes: [], respuestas: [], observaciones: [] },
        mutations,
        uploads
      );
      await setDataAndCache(merged);
      setLoading(false);
      return;
    }

    try {
      setPageError("");
      setInfoMsg("");
      const res = await getInspeccionFull(id);
      const payload = res?.data ?? res ?? { cabecera: null, participantes: [], respuestas: [], observaciones: [] };
      const mutations = await getAllMutationsQueue();
      const uploads = await getAllQueue();
      const merged = applyPendingToData(payload, mutations, uploads);
      await setDataAndCache(merged);
      
      const plantillaId = payload?.cabecera?.id_plantilla_inspec;
      if (plantillaId) {
        const defRes = await obtenerDefinicionPlantilla(plantillaId);
        const def = defRes?.data ?? defRes ?? null;
        setDefinicion(def);
      } else {
        setDefinicion(null);
      }
    } catch (err) {
      setDefinicion(null);
      const isNetwork = !err?.response;
      if (isNetwork && cached) {
        let mutations = [];
        let uploads = [];
        try {
          mutations = await getAllMutationsQueue();
          uploads = await getAllQueue();
        } catch {
          mutations = [];
          uploads = [];
        }
        const merged = applyPendingToData(cached, mutations, uploads);
        await setDataAndCache(merged);
        setPageError("");
        setInfoMsg("");
      } else {
        console.error("inspeccion.detail.load:", err);
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          navigate("/login", { replace: true, state: { from: { pathname: `/inspecciones/${id}` } } });
          return;
        }
        setPageError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleAccionCreated(info) {
    if (info?.__offlineCreatedAction) {
      const { obsRef, action } = info;

      const base = dataRef.current;
      if (!base) return;

      const next = {
        ...base,
        observaciones: (base.observaciones || []).map((o) => {
          if (String(o.id_observacion) !== String(obsRef)) return o;
          const acciones = Array.isArray(o.acciones) ? o.acciones : [];
          return { ...o, acciones: [action, ...acciones] };
        }),
      };

      await setDataAndCache(next);
      await refreshPending();
      return;
    }

    await load();
  }

  async function handleEvidenceUploaded(info) {
    if (info?.__offlineEvidence) {
      const { kind, idTarget, placeholders } = info;
      const base = dataRef.current;
      if (!base) return;

      const next = {
        ...base,
        observaciones: (base.observaciones || []).map((o) => {
          if (kind === "OBS" && String(o.id_observacion) === String(idTarget)) {
            const evs = Array.isArray(o.evidencias) ? o.evidencias : [];
            const ya = new Set(evs.map((x) => x.archivo_ruta));
            const nuevos = (placeholders || []).filter((p) => p?.archivo_ruta && !ya.has(p.archivo_ruta));
            return { ...o, evidencias: [...nuevos, ...evs] };
          }

          if (kind === "ACC") {
            const acciones = Array.isArray(o.acciones) ? o.acciones : [];
            return {
              ...o,
              acciones: acciones.map((a) => {
                if (String(a.id_accion) !== String(idTarget)) return a;
                const evs = Array.isArray(a.evidencias) ? a.evidencias : [];
                const ya = new Set(evs.map((x) => x.archivo_ruta));
                const nuevos = (placeholders || []).filter((p) => p?.archivo_ruta && !ya.has(p.archivo_ruta));
                return { ...a, evidencias: [...nuevos, ...evs] };
              }),
            };
          }

          return o;
        }),
      };

      await setDataAndCache(next);
      await refreshPending();
      return;
    }

    await load();
  }

  useEffect(() => {
    load();
  }, [id, online]);

  function onChangeForm(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function onCrearObservacion(e) {
    e.preventDefault();
    setObsError("");
    setObsOk("");

    if (!form.item_ref.trim()) return setObsError("Falta item_ref.");
    if (!form.desc_observacion.trim()) return setObsError("Falta descripcion.");
    if (!form.id_nivel_riesgo) return setObsError("Falta nivel de riesgo.");

    const payload = {
      item_ref: form.item_ref.trim(),
      desc_observacion: form.desc_observacion.trim(),
      id_nivel_riesgo: Number(form.id_nivel_riesgo),
      id_estado_observacion: Number(form.id_estado_observacion),
    };

    setSavingObs(true);
    try {
      if (!online) {
        const tempId = makeTempId("obs");

        await addMutationToQueue({
          type: "OBS_CREATE",
          tempId,
          idInspeccion: Number(id),
          payload,
          createdAt: new Date().toISOString(),
        });

        const base = dataRef.current ?? { cabecera: null, observaciones: [] };
        const obsPendiente = {
          id_observacion: tempId,
          id_estado_observacion: payload.id_estado_observacion,
          estado_observacion: "PENDIENTE",
          nivel_riesgo: payload.id_nivel_riesgo,
          item_ref: payload.item_ref,
          desc_observacion: payload.desc_observacion,
          evidencias: [],
          acciones: [],
          __pending: true,
        };

        const next = { ...base, observaciones: [obsPendiente, ...(base.observaciones || [])] };
        await setDataAndCache(next);

        setObsOk("Observacion guardada offline ?");
        setForm({ item_ref: "", desc_observacion: "", id_nivel_riesgo: "1", id_estado_observacion: "1" });
        await refreshPending();
        return;
      }

      await crearObservacion(id, payload);

      setObsOk("Observacion creada OK");
      setForm({ item_ref: "", desc_observacion: "", id_nivel_riesgo: "1", id_estado_observacion: "1" });
      await load();
    } catch (err) {
      console.error("inspeccion.detail.crearObservacion:", err);
      const msg = getErrorMessage(err);
      setObsError(msg);
    } finally {
      setSavingObs(false);
      setTimeout(() => setObsOk(""), 2500);
    }
  }

  if (!id) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ padding: 10, borderRadius: 10, border: "1px solid #ffb3b3", background: "#ffecec" }}>
          No se encontro ID de inspeccion en la ruta.
        </div>
      </div>
    );
  }

  const cab = data?.cabecera;
  const plantillaId = Number(cab?.id_plantilla_inspec ?? 0);
  const codigoFormato = String(cab?.codigo_formato || "").toUpperCase();
  const isFOR034 = codigoFormato.includes("AQP-SSOMA-FOR-034");
  const hideObsUI = isFOR034 || [3, 4].includes(plantillaId);
  const participantes = Array.isArray(data?.participantes) ? data.participantes : [];
  const observaciones = data?.observaciones || [];
  const accionByItemRef = useMemo(() => {
    const map = new Map();
    const obs = Array.isArray(data?.observaciones) ? data.observaciones : [];
    for (const o of obs) {
      const acciones = Array.isArray(o?.acciones) ? o.acciones : [];
      for (const a of acciones) {
        const key = String(a?.item_ref || o?.item_ref || "").trim();
        if (!key) continue;
        if (!map.has(key)) map.set(key, a);
      }
    }
    return map;
  }, [data?.observaciones]);
  const obsByItemRef = useMemo(() => {
  const map = new Map();
  const obs = Array.isArray(data?.observaciones) ? data.observaciones : [];
  for (const o of obs) {
    const key = String(o?.item_ref || "").trim();
    if (!key) continue;
    if (!map.has(key)) map.set(key, o);
  }
  return map;
}, [data?.observaciones]);
  const realizadoPor = participantes.find((p) => String(p?.tipo || "").toUpperCase() === "REALIZADO_POR");
  const inspectores = participantes.filter((p) => String(p?.tipo || "").toUpperCase() === "INSPECTOR");
  const inspeccionCerrada = String(cab?.estado_inspeccion || "").toUpperCase() === "CERRADA";
  const visiblePageError = online ? pageError : "";
  const respuestas = Array.isArray(data?.respuestas) ? data.respuestas : [];
  const respuestasOrdenadas = [...respuestas].sort((a, b) => {
    // 1) primero por numero de item
    const na = getItemNumber(a?.item_id);
    const nb = getItemNumber(b?.item_id);
    if (na !== nb) return na - nb;
    // 2) desempate: por item_id completo (i08 vs i8)
    return String(a?.item_id || "").localeCompare(String(b?.item_id || ""), "es", { numeric: true });
  });
  // 1) mapa item_ref -> orden segun definicion.items
  const orderByRef = useMemo(() => {
    const map = new Map();
    const items = Array.isArray(definicion?.items) ? definicion.items : [];
    items.forEach((it, idx) => {
      const ref = normItemRef(it.item_ref ?? it.ref ?? it.id);
      if (ref) map.set(ref, idx);
    });
    return map;
  }, [definicion]);

  // 2) agrupar + ordenar items dentro de cada categoria
  const respuestasPorCategoria = useMemo(() => {
    const map = new Map();

    for (const r of (Array.isArray(respuestas) ? respuestas : [])) {
      const cat = r?.categoria || "SIN CATEGORIA";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(r);
    }

    // ordenar items en cada categoria segun plantilla, fallback por numero
    for (const [cat, list] of map.entries()) {
      list.sort((a, b) => {
        const aKey = normItemRef(a?.item_id);
        const bKey = normItemRef(b?.item_id);
        const aOrd = orderByRef.has(aKey) ? orderByRef.get(aKey) : getNumFromItemId(a?.item_id);
        const bOrd = orderByRef.has(bKey) ? orderByRef.get(bKey) : getNumFromItemId(b?.item_id);
        return aOrd - bOrd;
      });
    }

    return map;
  }, [respuestas, orderByRef]);

  // 3) orden de categorias segun el primer item que aparece en plantilla
  const categoriasOrdenadas = useMemo(() => {
    const entries = Array.from(respuestasPorCategoria.entries());
    entries.sort(([catA, listA], [catB, listB]) => {
      const aFirst = listA?.[0]?.item_id;
      const bFirst = listB?.[0]?.item_id;

      const aKey = normItemRef(aFirst);
      const bKey = normItemRef(bFirst);

      const aOrd = orderByRef.has(aKey) ? orderByRef.get(aKey) : getNumFromItemId(aFirst);
      const bOrd = orderByRef.has(bKey) ? orderByRef.get(bKey) : getNumFromItemId(bFirst);

      return aOrd - bOrd;
    });
    return entries.map(([cat]) => cat);
  }, [respuestasPorCategoria, orderByRef]);

  function normItemRef(v) {
    return String(v ?? "").trim().replace(/\s+/g, " ");
  }

  function getNumFromItemId(v) {
    // i08 -> 8, 08 -> 8, "1.2" -> 12 aprox (fallback)
    const s = String(v ?? "");
    const m = s.match(/\d+/g);
    if (!m) return 999999;
    return parseInt(m.join(""), 10) || 999999;
  }

  async function removePendingPlaceholdersFromState(pendingPaths) {
    const removeAllPending = !pendingPaths || pendingPaths.size === 0;
    const shouldRemovePendingPath = (value) => {
      const path = String(value || "");
      if (!path.startsWith("PENDING_UPLOAD/")) return false;
      return removeAllPending || pendingPaths.has(path);
    };

    let updatedData = null;
    setData((prev) => {
      if (!prev) {
        updatedData = prev;
        return prev;
      }

      const obs = (prev.observaciones || []).map((o) => {
        const evid = (o.evidencias || []).filter((e) => !shouldRemovePendingPath(e.archivo_ruta));

        const acciones = (o.acciones || []).map((a) => {
          const evA = (a.evidencias || []).filter((e) => !shouldRemovePendingPath(e.archivo_ruta));
          return { ...a, evidencias: evA };
        });

        return { ...o, evidencias: evid, acciones };
      });

      updatedData = { ...prev, observaciones: obs };
      return updatedData;
    });

    if (updatedData) {
      await setInspeccionCache(id, updatedData);
    }
  }

  const handleDownloadExcel = async () => {
    const routeId = typeof id === "string" ? id.trim() : "";
    const stateId = String(data?.cabecera?.id_inspeccion ?? "").trim();
    const inspeccionId = routeId || stateId;

    if (!inspeccionId) {
      alert("No se encontro el ID de inspeccion para descargar el Excel.");
      return;
    }

    try {
      const token = getToken();
      const base = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/+$/, "");
      const resp = await fetch(`${base}/api/inspecciones/${inspeccionId}/export/xlsx`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!resp.ok) {
        const contentType = resp.headers.get("content-type") || "";
        const message = contentType.includes("application/json")
          ? ((await resp.json())?.message || "No se pudo descargar el Excel.")
          : (await resp.text()) || "No se pudo descargar el Excel.";
        console.error("inspeccion.detail.download.xlsx:", { status: resp.status, message });
        alert(message);
        return;
      }

      const contentDisposition = resp.headers.get("content-disposition") || "";
      const match = contentDisposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
      const decodedName = match?.[1] ? decodeURIComponent(match[1].replace(/"/g, "").trim()) : "";
      const fallback = `inspeccion_${inspeccionId}.xlsx`;
      const filename = decodedName || fallback;

      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("inspeccion.detail.download.xlsx:", e);
      alert("Error: No se pudo descargar");
    }
  };
  return (
    <DashboardLayout title={`Inspeccion #${id}`}>
      <div style={{ display: "grid", gap: 12 }}>
      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Link to="/inspecciones">
            <Button variant="ghost">Volver</Button>
          </Link>

          <Button variant="outline" onClick={handleDownloadExcel}>
            Descargar Excel
          </Button>
        </div>
      </Card>

      <h2 style={{ margin: 0 }}>Inspeccion #{id}</h2>

      {visiblePageError && (
        <div style={{ padding: 10, borderRadius: 10, border: "1px solid #ffb3b3", background: "#ffecec" }}>
          {visiblePageError}
        </div>
      )}

      <Card title="Datos generales">
        {!cab ? (
          <p style={{ opacity: 0.7 }}>Sin cabecera.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge>Estado: {cab.estado_inspeccion}</Badge>
              <Badge>Modo: {cab.modo_registro}</Badge>
              <Badge>Area: {cab.desc_area}</Badge>
              <Badge>
                Formato: {cab.codigo_formato} v{cab.version_actual}
              </Badge>
            </div>

            <div style={{ display: "grid", gap: 4 }}>
              <div>
                <b>Fecha inspeccion:</b> {fmtDate(cab.fecha_inspeccion)}
              </div>
              <div>
                <b>Servicio:</b> {cab.nombre_servicio} {cab.servicio_detalle ? `- ${cab.servicio_detalle}` : ""}
              </div>
              <div>
                <b>Cliente:</b> {cab.id_cliente} {cab.raz_social ? `- ${cab.raz_social}` : ""}
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card title="Realizado por">
        {!realizadoPor ? (
          <p style={{ opacity: 0.7 }}>Sin datos.</p>
        ) : (
          <div style={{ display: "grid", gap: 4 }}>
            <div>
              <b>Nombre:</b> {realizadoPor.nombre || realizadoPor.dni || "-"}
            </div>
            <div>
              <b>Cargo:</b> {realizadoPor.cargo || "-"}
            </div>
          </div>
        )}
      </Card>

      <Card title={`Inspectores (${inspectores.length})`}>
        {inspectores.length === 0 ? (
          <p style={{ opacity: 0.7 }}>Sin datos.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {inspectores.map((p, idx) => (
              <div key={`${p.dni || "sin-dni"}-${idx}`} style={{ borderTop: idx ? "1px solid #eee" : "none", paddingTop: idx ? 10 : 0 }}>
                <div><b>{p.nombre || p.dni || "-"}</b></div>
                <div style={{ opacity: 0.8 }}>{p.cargo || "-"}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Respuestas">
        {respuestas.length === 0 ? (
          <p style={{ opacity: 0.7 }}>Sin datos.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {categoriasOrdenadas.map((categoria) => {
              const upper = String(categoria || "").toUpperCase();
              const list = respuestasPorCategoria.get(categoria) || [];

              // CASO ESPECIAL: TABLA_EXTINTORES
              if (upper === "TABLA_EXTINTORES") {
                return (
                  <div key={categoria}>
                    <h4 style={{ margin: "0 0 8px 0" }}>{categoria}</h4>
                    <RenderTablaExtintores respuestas={list} />
                  </div>
                );
              }

              // CASO ESPECIAL: Observaciones/Acciones (tu lógica actual)
              const isObsAcc = upper === "OBSERVACIONES_ACCIONES";
              return (
                <div key={categoria}>
                  <h4 style={{ margin: "0 0 8px 0" }}>
                    {isObsAcc ? "Observaciones y acciones correctivas" : categoria}
                  </h4>

                  <div style={{ display: "grid", gap: 8 }}>
                    {list.map((r, idx) => {
                      const row = (r?.row_data && typeof r.row_data === "object") ? r.row_data : null;

                      if (isObsAcc && row) {
                        const itemRef = normItemRef(r?.item_id || r?.item_ref || "");
                        const accionDb = accionByItemRef.get(itemRef);
                        const obsDb = obsByItemRef.get(itemRef);
                        const evidObs = Array.isArray(obsDb?.evidencias) ? obsDb.evidencias : [];
                        const evidLev = Array.isArray(accionDb?.evidencias) ? accionDb.evidencias : [];
                        const hasLev = evidLev.length > 0;

                        return (
                          <div key={`${itemRef || "row"}-${idx}`} className="obsacc-item">
                            <div className="obsacc-item-top">
                              <b>{`Observación ${idx + 1}`}</b>
                              <Badge>{itemRef}</Badge>
                              {accionDb?.id_accion ? <Badge>Acc #{accionDb.id_accion}</Badge> : <Badge>Acc: -</Badge>}
                            </div>

                            <div className="obsacc-cards">
                              <section className="obsacc-card">
                                <header className="obsacc-header">
                                  <h5 className="obsacc-title">OBSERVACIÓN</h5>
                                </header>

                                <div className="obsacc-section">
                                  <div><b>Observación:</b> {row?.observacion || "-"}</div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <b>Nivel de riesgo:</b>
                                    <Badge>{String(row?.riesgo || r?.estado || "NA").toUpperCase()}</Badge>
                                  </div>
                                </div>

                                <div className="obsacc-section">
                                  <b>Evidencias (Observación)</b>
                                  <EvidenceGrid evidencias={evidObs} onPreview={openPreview} />
                                </div>
                              </section>

                              <section className="obsacc-card">
                                <header className="obsacc-header">
                                  <h5 className="obsacc-title">ACCIÓN CORRECTIVA</h5>
                                </header>

                                <div className="obsacc-section">
                                  <div><b>Acción correctiva:</b> {row?.accion_correctiva || "-"}</div>
                                  <div><b>Fecha ejecución:</b> {row?.fecha_ejecucion || "-"}</div>
                                  <div><b>Responsable:</b> {row?.responsable || row?.responsable_data?.nombre || "-"}</div>
                                </div>

                                <div className="obsacc-section">
                                  <b>Evidencia de levantamiento (Acción)</b>
                                  {accionDb?.id_accion ? (
                                    <>
                                      <EvidenceGrid
                                        evidencias={evidLev}
                                        allowDelete={true}
                                        onPreview={openPreview}
                                        onDelete={(evItem) => handleDeleteAccEvidence({ evItem, idAccion: accionDb.id_accion })}
                                      />
                                      <UploadEvidence
                                        kind="ACC"
                                        idTarget={accionDb.id_accion}
                                        onUploaded={handleEvidenceUploaded}
                                        disabled={false}
                                        inspeccionCerrada={inspeccionCerrada}
                                        online={online}
                                      />
                                    </>
                                  ) : (
                                    <p style={{ margin: "6px 0", opacity: 0.7 }}>
                                      No se encontró acción creada para {itemRef}.
                                    </p>
                                  )}
                                </div>

                                <div className="obsacc-section obsacc-cumplimiento">
                                  <b>% cumplimiento</b>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    className="ins-input"
                                    value={accionDb?.porcentaje_cumplimiento ?? row?.porcentaje ?? ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      e.target.value = val;
                                    }}
                                    disabled={!hasLev}
                                    placeholder={hasLev ? "0 - 100" : "Sube evidencia para habilitar"}
                                    onBlur={async (e) => {
                                      if (!accionDb?.id_accion) return;
                                      if (!online) return;

                                      const vRaw = e.target.value;
                                      const v = vRaw === "" ? null : Number(vRaw);

                                      try {
                                        await actualizarPorcentajeAccion(accionDb.id_accion, v);
                                        await load();
                                      } catch (err) {
                                        alert(getErrorMessage(err));
                                      }
                                    }}
                                  />
                                </div>
                              </section>
                            </div>
                          </div>
                        );
                      }

                      // fallback
                      const estado = String(r?.estado || "").toUpperCase();
                      const itemRef = normItemRef(r?.item_id || r?.item_ref || "");
                      const desc = r?.descripcion || "-";
                      const obs = (r?.observacion || "").trim();
                      const accion = parseAccionJson(r?.accion) || r?.accion || null;

                      return (
                        <div
                          key={`${itemRef || "item"}-${idx}`}
                          style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fff" }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <div>
                              <b style={{ color: "#111" }}>{itemRef || "-"}</b>{" "}
                              <span style={{ color: "rgba(0,0,0,.75)" }}>{desc}</span>
                            </div>
                            <Badge>{estado || "SIN RESPUESTA"}</Badge>
                          </div>

                          {estado === "MALO" && (
                            <div style={{ marginTop: 10, padding: 12, borderRadius: 12, border: "1px solid rgba(220,38,38,.25)", background: "rgba(220,38,38,.06)" }}>
                              <div style={{ fontWeight: 900, color: "#b91c1c", marginBottom: 8 }}>Observación</div>
                              <div style={{ whiteSpace: "pre-wrap" }}>{obs || "-"}</div>

                              <div style={{ marginTop: 10, fontWeight: 900, color: "#111" }}>Acción correctiva</div>
                              <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                                <div><b>Qué:</b> {accion?.que || "-"}</div>
                                <div><b>Quién:</b> {accion?.quien || accion?.responsable?.nombre || "-"}</div>
                                <div><b>Cuándo:</b> {accion?.cuando || "-"}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </Card>

      {!hideObsUI && (
        <Card title="Crear observacion">

          <form onSubmit={onCrearObservacion} style={{ display: "grid", gap: 10, maxWidth: 520 }}>
            <label style={{ display: "grid", gap: 6 }}>
              item_ref
              <input name="item_ref" value={form.item_ref} onChange={onChangeForm} placeholder="Ej: 1.1" disabled={inspeccionCerrada} />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              Nivel de riesgo (id_nivel_riesgo)
              <select name="id_nivel_riesgo" value={form.id_nivel_riesgo} onChange={onChangeForm} disabled={inspeccionCerrada}>
                <option value="1">1 - BAJO</option>
                <option value="2">2 - MEDIO</option>
                <option value="3">3 - ALTO</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              Estado observacion (id_estado_observacion)
              <select name="id_estado_observacion" value={form.id_estado_observacion} onChange={onChangeForm} disabled={inspeccionCerrada}>
                <option value="1">1 - ABIERTA</option>
                <option value="2">2 - EN PROCESO</option>
                <option value="3">3 - CERRADA</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              Descripcion
              <textarea
                name="desc_observacion"
                value={form.desc_observacion}
                onChange={onChangeForm}
                rows={3}
                placeholder="Describe la observacion..."
                disabled={inspeccionCerrada}
              />
            </label>

            {obsError && (
              <div style={{ padding: 10, borderRadius: 10, border: "1px solid #ffb3b3", background: "#ffecec" }}>
                {obsError}
              </div>
            )}

            {obsOk && (
              <div style={{ padding: 10, borderRadius: 10, border: "1px solid #b3ffb3", background: "#ecffec" }}>
                {obsOk}
              </div>
            )}

            <Button variant="primary" disabled={savingObs || inspeccionCerrada} type="submit">
              {inspeccionCerrada ? "Inspeccion cerrada" : savingObs ? "Guardando..." : "Crear observacion"}
            </Button>
          </form>
        </Card>
      )}

      {!hideObsUI && (
        <Card title={`Observaciones (${observaciones.length})`}>

          {loading && <p>Cargando...</p>}
          {!loading && observaciones.length === 0 && <p style={{ opacity: 0.7 }}>Sin observaciones.</p>}

          {!loading &&
            observaciones.map((o) => {
              const acciones = o.acciones || [];
              const hayAcciones = acciones.length > 0;
              const hayPendientes = acciones.some((x) => ![3, 4].includes(Number(x.id_estado_accion)));

              return (
                <div
                  key={o.id_observacion}
                  style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 12 }}
                >
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <b>Obs #{o.id_observacion}</b>
                    {o.__pending && <Badge>?? PENDIENTE</Badge>}
                    <Badge>Riesgo: {o.nivel_riesgo}</Badge>
                    <Badge>Estado: {o.estado_observacion}</Badge>
                    <Badge>Item: {o.item_ref}</Badge>
                  </div>

                  <div style={{ marginTop: 6 }}>
                    <b>Descripcion:</b> {o.desc_observacion}
                  </div>
                  
                  {isFOR014 && (
                    (() => {
                      const acciones = Array.isArray(o.acciones) ? o.acciones : [];
                      const acc = acciones[0] || null; // FOR-014 normalmente 1 accion por observacion
                      const evidAcc = Array.isArray(acc?.evidencias) ? acc.evidencias : [];
                      const tieneEvidAcc = evidAcc.length > 0;

                      const pctValue = acc?.porcentaje_cumplimiento ?? "";

                      const disabledPct =
                        inspeccionCerrada ||
                        !acc ||
                        !tieneEvidAcc ||
                        [3, 4].includes(Number(acc?.id_estado_accion)); // si ya cumplida/final, bloquea

                      return (
                        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #eee", background: "#fafafa" }}>
                          <b>Levantamiento / Accion Correctiva</b>

                          {!acc ? (
                            <div style={{ marginTop: 8, opacity: 0.75 }}>
                              Sin accion asociada a esta observacion.
                            </div>
                          ) : (
                            <>
                              <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                                <div><b>Acc #{acc.id_accion}</b> - {acc.desc_accion || "-"}</div>
                                <div style={{ opacity: 0.8 }}>
                                  <b>Compromiso:</b> {fmtDate(acc.fecha_compromiso)}{" "}
                                  <span style={{ marginLeft: 8 }}><b>Estado:</b> {acc.estado_accion}</span>
                                </div>
                              </div>

                              <div style={{ marginTop: 10 }}>
                                <b>Evidencias (Acc)</b>
                                <EvidenceGrid
                                  evidencias={evidAcc}
                                  allowDelete={true}
                                  onPreview={openPreview}
                                  onDelete={(evItem) => handleDeleteAccEvidence({ evItem, idAccion: acc.id_accion })}
                                />
                              </div>
                              <UploadEvidence
                                kind="ACC"
                                idTarget={acc.id_accion}
                                onUploaded={handleEvidenceUploaded}
                                disabled={[3, 4].includes(Number(acc.id_estado_accion))}
                                inspeccionCerrada={inspeccionCerrada}
                                online={online}
                              />

                              <div style={{ marginTop: 12, display: "grid", gap: 6, maxWidth: 280 }}>
                                <b>% Cumplimiento</b>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="1"
                                  value={pctValue}
                                  disabled={disabledPct}
                                  placeholder={tieneEvidAcc ? "0 - 100" : "Sube evidencia para habilitar"}
                                  onChange={async (e) => {
                                    const nextPct = e.target.value;

                                    // Guardado local en state + cache (no backend aun)
                                    const base = dataRef.current;
                                    if (!base) return;

                                    const next = {
                                      ...base,
                                      observaciones: (base.observaciones || []).map((obs) => {
                                        if (String(obs.id_observacion) !== String(o.id_observacion)) return obs;
                                        const accs = Array.isArray(obs.acciones) ? obs.acciones : [];
                                        if (!accs.length) return obs;

                                        const updatedAcc0 = { ...accs[0], porcentaje_cumplimiento: nextPct };
                                        return { ...obs, acciones: [updatedAcc0, ...accs.slice(1)] };
                                      }),
                                    };

                                    await setDataAndCache(next);
                                  }}
                                />
                                {!tieneEvidAcc && (
                                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                                    * El % se habilita cuando exista evidencia de levantamiento.
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()
                  )}
                  
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {o.id_estado_observacion !== 3 && (
                      <>
                        {!hayAcciones || !hayPendientes ? (
                          <Button
                            variant="outline"
                            disabled={!online}
                            onClick={async () => {
                              try {
                                await actualizarEstadoObservacion(o.id_observacion, 3);
                                await load();
                                showObsMsg(o.id_observacion, "Observacion cerrada ?", "ok");
                              } catch (err) {
                                console.error("inspeccion.detail.cerrarObservacion:", err);
                                showObsMsg(o.id_observacion, getErrorMessage(err), "error");
                              }
                            }}
                          >
                            Cerrar observacion
                          </Button>
                        ) : (
                          <div style={{ fontSize: 12, opacity: 0.75 }}>
                            No puedes cerrar: hay acciones pendientes.
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {obsMsgByObs[o.id_observacion]?.msg && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 10,
                        borderRadius: 10,
                        border:
                          obsMsgByObs[o.id_observacion].type === "ok"
                            ? "1px solid #b3ffb3"
                            : "1px solid #ffb3b3",
                        background:
                          obsMsgByObs[o.id_observacion].type === "ok" ? "#ecffec" : "#ffecec",
                      }}
                    >
                      {obsMsgByObs[o.id_observacion].msg}
                    </div>
                  )}

                  {!isFOR014 && (
                    <>
                      <div style={{ marginTop: 10 }}>
                        <b>Evidencias (Obs)</b>
                        <EvidenceGrid evidencias={o.evidencias} onPreview={openPreview} />
                      </div>

                      <UploadEvidence
                        kind="OBS"
                        idTarget={o.id_observacion}
                        onUploaded={handleEvidenceUploaded}
                        disabled={o.id_estado_observacion === 3}
                        inspeccionCerrada={inspeccionCerrada}
                        online={online}
                      />
                    </>
                  )}

                  {!isFOR014 && (
                    <CrearAccionForm
                      idObservacion={o.id_observacion}
                      onCreated={handleAccionCreated}
                      onMsg={showAccionMsg}
                      inspeccionCerrada={inspeccionCerrada || o.id_estado_observacion === 3}
                      online={online}
                    />
                  )}

                  {accionMsgByObs[o.id_observacion]?.msg && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 10,
                        borderRadius: 10,
                        border:
                          accionMsgByObs[o.id_observacion].type === "ok"
                            ? "1px solid #b3ffb3"
                            : "1px solid #ffb3b3",
                        background:
                          accionMsgByObs[o.id_observacion].type === "ok" ? "#ecffec" : "#ffecec",
                      }}
                    >
                      {accionMsgByObs[o.id_observacion].msg}
                    </div>
                  )}

                  <div style={{ marginTop: 12 }}>
                    <b>Acciones ({acciones.length})</b>

                    {acciones.length === 0 ? (
                      <p style={{ margin: "6px 0", opacity: 0.7 }}>Sin acciones.</p>
                    ) : (
                      acciones.map((a) => (
                        <div
                          key={a.id_accion}
                          style={{ marginTop: 10, padding: 12, borderRadius: 12, border: "1px solid #eee" }}
                        >
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <b>Acc #{a.id_accion}</b>
                            <Badge>Estado: {a.estado_accion}</Badge>
                            <Badge>Compromiso: {fmtDate(a.fecha_compromiso)}</Badge>
                            <Badge>Resp: {a.dni || a.responsable_interno_dni || "-"}</Badge>
                          </div>

                          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {![3, 4].includes(Number(a.id_estado_accion)) && (
                              <Button
                                variant="outline"
                                disabled={!online}
                                onClick={async () => {
                                  try {
                                    await actualizarEstadoAccion(a.id_accion, 3);
                                    await load();
                                    alert("Accion cumplida ?");
                                  } catch (err) {
                                    console.error("inspeccion.detail.cumplirAccion:", err);
                                    alert(getErrorMessage(err));
                                  }
                                }}
                              >
                                Marcar como cumplida
                              </Button>
                            )}
                          </div>

                          <div style={{ marginTop: 10 }}>
                            <b>Evidencias (Acc)</b>
                            <EvidenceGrid evidencias={a.evidencias} onPreview={openPreview} />
                          </div>

                          <UploadEvidence
                            kind="ACC"
                            idTarget={a.id_accion}
                            onUploaded={handleEvidenceUploaded}
                            disabled={[3, 4].includes(Number(a.id_estado_accion))}
                            inspeccionCerrada={inspeccionCerrada}
                            online={online}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
        </Card>
      )}
      </div>
            {preview.open && (
        <div
          onClick={closePreview}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.55)",
            zIndex: 9999,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(980px, 96vw)",
              maxHeight: "92vh",
              background: "#fff",
              borderRadius: 18,
              overflow: "hidden",
              border: "1px solid rgba(255,106,0,.25)",
              boxShadow: "0 18px 55px rgba(17,24,39,.25)",
              display: "grid",
            }}
          >
            <div
              style={{
                padding: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                borderBottom: "1px solid rgba(0,0,0,.08)",
              }}
            >
              <b style={{ fontSize: 13, wordBreak: "break-all" }}>{preview.name}</b>
              <Button
                variant="ghost"
                type="button"
                onClick={closePreview}
                style={{ height: 36, width: 36, padding: 0, minWidth: 0 }}
                aria-label="Cerrar"
                title="Cerrar"
              >
                X
              </Button>
            </div>

            <div style={{ padding: 12, overflow: "auto" }}>
              <img
                src={preview.url}
                alt={preview.name}
                style={{
                  width: "100%",
                  maxHeight: "78vh",
                  objectFit: "contain",   // completa, no recortada
                  background: "#f7f6f3",
                  borderRadius: 14,
                  border: "1px solid rgba(0,0,0,.08)",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
