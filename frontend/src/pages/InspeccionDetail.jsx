
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getInspeccionFull } from "../api/inspeccionFull.api";
import { crearObservacion, actualizarEstadoObservacion } from "../api/observaciones.api";
import { crearAccion, actualizarEstadoAccion } from "../api/acciones.api";
import { uploadEvidenciaObs, uploadEvidenciaAcc } from "../api/uploads.api";
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

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";
const DEBUG_SYNC = import.meta.env.DEV;

const API = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/+$/, "");

function downloadExcel(id) {
  const token = localStorage.getItem("token"); // o tu getToken()
  fetch(`${API}/api/inspecciones/${id}/export/xlsx`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(async (r) => {
    if (!r.ok) throw new Error("No se pudo descargar");
    const blob = await r.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Inspeccion_${id}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  });
}

function fileUrl(archivo_ruta) {
  if (!archivo_ruta || archivo_ruta.startsWith("PENDING_UPLOAD/")) return null;
  return `${API_BASE}/${archivo_ruta}`;
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

function EvidenceGrid({ evidencias }) {
  if (!evidencias || evidencias.length === 0) {
    return <p style={{ margin: "6px 0", opacity: 0.7 }}>Sin evidencias.</p>;
  }

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
      {evidencias.map((e) => {
        const key = e.id_obs_evidencia ?? e.id_acc_evidencia ?? e.id ?? e.archivo_ruta;
        const url = fileUrl(e.archivo_ruta);

        if (!url) {
          return (
            <div
              key={key}
              style={{
                width: 200,
                border: "1px dashed #bbb",
                borderRadius: 12,
                padding: 10,
                background: "#fffdf5",
              }}
            >
              <b style={{ fontSize: 12 }}>PENDIENTE</b>
              <div style={{ fontSize: 12, wordBreak: "break-all" }}>{e.archivo_ruta}</div>
            </div>
          );
        }

        return (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noreferrer"
            style={{
              width: 200,
              textDecoration: "none",
              color: "inherit",
              border: "1px solid #ddd",
              borderRadius: 12,
              overflow: "hidden",
              background: "#fff",
            }}
          >
            <img
              src={url}
              alt={e.archivo_nombre || "evidencia"}
              style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
              onError={(ev) => {
                ev.currentTarget.style.display = "none";
              }}
            />
            <div style={{ padding: 10, display: "grid", gap: 4 }}>
              <div style={{ fontSize: 12, wordBreak: "break-all" }}>
                {e.archivo_nombre || e.archivo_ruta}
              </div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>{e.mime_type || "-"}</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Capturada: {fmtDate(e.capturada_en)}</div>
            </div>
          </a>
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

      <button disabled={saving || inspeccionCerrada} type="submit">
        {inspeccionCerrada ? "Inspeccion cerrada" : saving ? "Guardando..." : "Crear accion"}
      </button>
    </form>
  );
}

function UploadEvidence({ kind, idTarget, onUploaded, disabled, inspeccionCerrada, online }) {
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

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

  return (
    <form onSubmit={onSubmit} style={{ marginTop: 10, display: "grid", gap: 8, maxWidth: 520 }}>
      <b>Subir evidencias ({kind === "OBS" ? `Obs #${idTarget}` : `Acc #${idTarget}`})</b>

      <input type="file" accept="image/*" multiple onChange={onPickFiles} disabled={disabled || saving || inspeccionCerrada} />

      {files.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {files.map((f) => {
            const url = URL.createObjectURL(f);
            return (
              <div
                key={f.name + f.size}
                style={{ width: 110, border: "1px solid #ddd", borderRadius: 10, overflow: "hidden", background: "#fff" }}
              >
                <img
                  src={url}
                  alt={f.name}
                  style={{ width: "100%", height: 80, objectFit: "cover", display: "block" }}
                  onLoad={() => URL.revokeObjectURL(url)}
                />
                <div style={{ padding: 6, fontSize: 11, wordBreak: "break-all" }}>{f.name}</div>
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

      <button disabled={saving || disabled} type="submit">
        {saving ? "Subiendo..." : `Subir ${files.length ? `(${files.length})` : ""}`}
      </button>
    </form>
  );
}
export default function InspeccionDetail() {
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
    } catch (err) {
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
  const participantes = Array.isArray(data?.participantes) ? data.participantes : [];
  const respuestas = Array.isArray(data?.respuestas) ? data.respuestas : [];
  const observaciones = data?.observaciones || [];
  const realizadoPor = participantes.find((p) => String(p?.tipo || "").toUpperCase() === "REALIZADO_POR");
  const inspectores = participantes.filter((p) => String(p?.tipo || "").toUpperCase() === "INSPECTOR");
  const respuestasPorCategoria = respuestas.reduce((acc, r) => {
    const categoria = r?.categoria || "SIN CATEGORIA";
    if (!acc[categoria]) acc[categoria] = [];
    acc[categoria].push(r);
    return acc;
  }, {});
  const inspeccionCerrada = String(cab?.estado_inspeccion || "").toUpperCase() === "CERRADA";
  const visiblePageError = online ? pageError : "";

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

  async function onDownloadXlsx(id) {
    const res = await descargarInspeccionXlsx(id);
    const blob = new Blob([res.data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AQP-SSOMA-FOR-013_Inspeccion_${id}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

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

          <Button variant="outline" onClick={() => onDownloadXlsx(idInspeccion)}>
            Descargar Excel
          </Button>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Badge>{online ? "Conectado" : "Sin conexion"}</Badge>
            <Badge>Pendientes: {pending.total}</Badge>
            {pending.total > 0 && <Badge>Pendiente por sincronizar</Badge>}

            <Button variant="outline" onClick={() => syncNow()} disabled={!online || pending.total === 0}>
              Sincronizar ahora
            </Button>

            <Button variant="outline" onClick={load} disabled={loading}>
              {loading ? "Recargando..." : "Recargar"}
            </Button>
          </div>
        </div>
      </Card>

      {syncMsg && (
        <div style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "#f7f7f7" }}>
          {syncMsg}
        </div>
      )}

      {infoMsg && (
        <div style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "#fafafa" }}>
          {infoMsg}
        </div>
      )}

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
            {Object.keys(respuestasPorCategoria).sort().map((categoria) => (
              <div key={categoria}>
                <h4 style={{ margin: "0 0 8px 0" }}>{categoria}</h4>
                <div style={{ display: "grid", gap: 8 }}>
                  {respuestasPorCategoria[categoria].map((r, idx) => {
                    const estado = String(r?.estado || "NA").toUpperCase();
                    const accion = parseAccionJson(r?.accion_json);
                    return (
                      <div key={`${r?.item_id || "item"}-${idx}`} style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <b>{r?.item_id || "-"}</b>
                          <span>{r?.descripcion || "-"}</span>
                          <Badge>{estado}</Badge>
                        </div>
                        {estado === "MALO" && (
                          <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
                            <div><b>Observacion:</b> {r?.observacion || "-"}</div>
                            <div>
                              <b>Accion:</b>{" "}
                              {accion
                                ? `${accion.que || "-"} | ${accion.quien || "-"} | ${accion.cuando || "-"}`
                                : "-"}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

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

                <div style={{ marginTop: 10 }}>
                  <b>Evidencias (Obs)</b>
                  <EvidenceGrid evidencias={o.evidencias} />
                </div>

                <UploadEvidence
                  kind="OBS"
                  idTarget={o.id_observacion}
                  onUploaded={handleEvidenceUploaded}
                  disabled={o.id_estado_observacion === 3}
                  inspeccionCerrada={inspeccionCerrada}
                  online={online}
                />

                <CrearAccionForm
                  idObservacion={o.id_observacion}
                  onCreated={handleAccionCreated}
                  onMsg={showAccionMsg}
                  inspeccionCerrada={inspeccionCerrada || o.id_estado_observacion === 3}
                  online={online}
                />

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
                          <EvidenceGrid evidencias={a.evidencias} />
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
      </div>
    </DashboardLayout>
  );
}
