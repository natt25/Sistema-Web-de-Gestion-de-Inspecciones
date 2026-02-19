import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getInspeccionFull } from "../api/inspeccionFull.api";
import { crearObservacion, actualizarEstadoObservacion } from "../api/observaciones.api";
import { crearAccion, actualizarEstadoAccion } from "../api/acciones.api";
import { uploadEvidenciaObs, uploadEvidenciaAcc } from "../api/uploads.api";
import useOnlineStatus from "../hooks/useOnlineStatus";
import {
  addToQueue, getAllQueue, removeFromQueue,
  addMutationToQueue, getAllMutationsQueue, removeMutationFromQueue,
  setIdMap, getIdMap, getPendingCounts,
  getInspeccionCache, setInspeccionCache,
} from "../utils/offlineQueue";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";
const DEBUG_SYNC = import.meta.env.DEV;

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
  // res viene de tu api (res.data)
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
  const safeBase = base ?? { cabecera: null, observaciones: [] };
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

  return { ...safeBase, observaciones: finalObs };
}


function Badge({ children }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid #ddd",
        background: "#f7f7f7",
        fontSize: 12,
      }}
    >
      {children}
    </span>
  );
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

            // ✅ OFFLINE: guardar acción en cola (mutations)
      if (!online) {
        const tempId = makeTempId("acc");

        await addMutationToQueue({
          type: "ACC_CREATE",
          tempId,
          obsRef: idObservacion, // puede ser real o tmp_obs...
          payload,
          createdAt: new Date().toISOString(),
        });

        // Pintar en UI local: delegamos a InspeccionDetail vía onCreated(tempAction)
        onMsg?.(idObservacion, "Acción guardada offline ✅", "ok");
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

      onMsg?.(idObservacion, "Acción creada ✅", "ok");
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
      <b>Crear acción (Obs #{idObservacion})</b>

      <label style={{ display: "grid", gap: 6 }}>
        Descripción (desc_accion)
        <textarea name="desc_accion" value={form.desc_accion} onChange={onChange} rows={2} disabled={inspeccionCerrada} />
      </label>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <label style={{ display: "grid", gap: 6 }}>
          Fecha compromiso
          <input type="date" name="fecha_compromiso" value={form.fecha_compromiso} onChange={onChange} disabled={inspeccionCerrada}/>
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

                                  <button
                              disabled={!online}
                              onClick={async () => {
                                try {
                                  await actualizarEstadoAccion(a.id_accion, 3);
                                  await load();
                                  alert("Accion cumplida OK");
                                } catch (err) {
                                  console.error("inspeccion.detail.cumplirAccion:", err);
                                  alert(getErrorMessage(err));
                                }
                              }}
                            >
                              Marcar como cumplida
                            </button>
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
                          disabled={[3,4].includes(Number(a.id_estado_accion))}
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
             
      </section>
    </div>
  );

}










