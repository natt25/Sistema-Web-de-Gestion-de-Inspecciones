
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getInspeccionFull } from "../api/inspeccionFull.api";
import { crearObservacion, actualizarEstadoObservacion } from "../api/observaciones.api";
import { crearAccion, actualizarPorcentajeAccion } from "../api/acciones.api";
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

function getEstadoClass(estado) {
  const s = String(estado || "").toUpperCase();
  if (s === "BUENO") return "resp-state resp-state-good";
  if (s === "MALO") return "resp-state resp-state-bad";
  if (s === "NA" || s === "N/A") return "resp-state resp-state-na";
  return "resp-state resp-state-pending";
}

function getResponsableAccion(accion) {
  if (!accion) return "-";
  if (typeof accion?.quien === "string" && accion.quien.trim()) return accion.quien.trim();
  if (typeof accion?.responsable?.nombre === "string" && accion.responsable.nombre.trim()) {
    return accion.responsable.nombre.trim();
  }
  return "-";
}

function RenderTablaBotiquin({ respuestas }) {
  const list = (respuestas || []).filter(r => String(r?.categoria||"").toUpperCase() === "TABLA_BOTIQUIN");
  let meta = null;
  const rows = [];

  for (const r of list) {
    const rd = safeParseJson(r.row_data);
    if (!rd) continue;
    if (rd.__tipo === "tabla_botiquin_meta") meta = rd;
    if (rd.__tipo === "tabla_botiquin_row") rows.push(rd);
  }
  rows.sort((a,b)=>Number(a.rowIndex||0)-Number(b.rowIndex||0));

  return (
    <div style={{ display:"grid", gap:12 }}>
      <Card title="Botiquín (FOR-038)">
        <div style={{ display:"grid", gap:6 }}>
          <div><b>Mes:</b> {meta?.mes || "-"}</div>
          <div><b>Fecha:</b> {meta?.fecha || "-"}</div>
          <div><b>Código:</b> {meta?.codigoBotiquin || "-"}</div>
          <div><b>Realizado por:</b> {meta?.realizadoPor?.nombre || meta?.realizadoPor?.nombres || "-"}</div>
          {meta?.firmaUrl && (
            <img src={meta.firmaUrl} alt="firma" style={{ height:56, borderRadius:10, border:"1px solid rgba(0,0,0,.12)" }} />
          )}
        </div>
      </Card>

      {rows.map((r) => {
        const isMalo = String(r.estado||"").toUpperCase() === "MALO";
        return (
          <Card key={r.item_ref} title={`${r.rowIndex}. ${r.descripcion || ""}`}>
            <div style={{ display:"grid", gap:6 }}>
              <div><b>Cant/Unidad:</b> {r.cant || "-"} {r.unidad || ""}</div>
              <div><b>Estado:</b> {r.estado || "SIN RESPONDER"}</div>
              {isMalo && (
                <>
                  <div><b>Observación:</b> {r.observacion || "-"}</div>
                  <div><b>Acción - Qué:</b> {r.accion?.que || "-"}</div>
                  <div><b>Acción - Quién:</b> {r.accion?.quien?.nombre || r.accion?.quien?.nombres || "-"}</div>
                  <div><b>Acción - Cuándo:</b> {r.accion?.cuando || "-"}</div>
                </>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function RenderTablaLavaojos({ respuestas }) {
  const meta = respuestas.find((r) => r?.categoria === "LAVAOJOS_META")?.row_data;
  const items = respuestas.filter((r) => r?.categoria === "LAVAOJOS_ITEM");

  const metaObj = typeof meta === "string" ? safeJson(meta) : meta;

  const dias = [
    { key: "LUNES", label: "Lunes" },
    { key: "MARTES", label: "Martes" },
    { key: "MIERCOLES", label: "Miércoles" },
    { key: "JUEVES", label: "Jueves" },
    { key: "VIERNES", label: "Viernes" },
    { key: "SABADO", label: "Sábado" },
    { key: "DOMINGO", label: "Domingo" },
  ];

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Card title="Lavaojos portátil - Datos">
        <div style={{ display: "grid", gap: 6 }}>
          <div><b>Código Lavaojos:</b> {metaObj?.codigo_lavaojos || "-"}</div>
          <div><b>Responsable del proceso:</b> {metaObj?.responsable_proceso || "-"}</div>
        </div>
      </Card>

      <Card title="Tarjeta semanal">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 1100 }}>
            <thead>
              <tr>
                <th style={thSticky(0, 60)}>ITEM</th>
                <th style={thSticky(60, 320)}>DESCRIPCIÓN</th>
                {dias.map((d) => (
                  <th key={d.key} style={thDay()}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 900 }}>{d.label.toUpperCase()}</div>
                      <div style={{ fontSize: 12, opacity: 0.9 }}>
                        <b>Fecha:</b> {metaObj?.dias?.[d.key]?.fecha || "-"}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.9 }}>
                        <b>Realizado:</b>{" "}
                        {metaObj?.dias?.[d.key]?.realizado_por
                          ? `${metaObj.dias[d.key].realizado_por.dni || ""} - ${metaObj.dias[d.key].realizado_por.apellido || ""} ${metaObj.dias[d.key].realizado_por.nombre || ""}`
                          : "-"}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.9 }}>
                        <b>Firma:</b> {metaObj?.dias?.[d.key]?.firma || "-"}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {items.map((r, idx) => {
                const rd = typeof r.row_data === "string" ? safeJson(r.row_data) : r.row_data;
                return (
                  <tr key={r.id_respuesta || idx}>
                    <td style={tdSticky(0, 60)}>{idx + 1}</td>
                    <td style={tdSticky(60, 320)}>{rd?.descripcion || "-"}</td>

                    {dias.map((d) => {
                      const c = rd?.dias?.[d.key] || {};
                      const estado = c?.estado || "";
                      const isMalo = estado === "MALO";
                      return (
                        <td key={d.key} style={tdDay()}>
                          <div style={{ display: "grid", gap: 8 }}>
                            <Badge variant={estado === "BUENO" ? "success" : estado === "MALO" ? "danger" : "outline"}>
                              {estado ? (estado === "NA" ? "N/A" : estado) : "SIN RESPONDER"}
                            </Badge>

                            {isMalo ? (
                              <div style={{ border: "1px solid #fecaca", background: "#fff7ed", borderRadius: 12, padding: 10 }}>
                                <div style={{ fontWeight: 900, color: "#b91c1c", marginBottom: 6 }}>Observación</div>
                                <div style={{ whiteSpace: "pre-wrap" }}>{c?.observacion || "-"}</div>

                                <div style={{ fontWeight: 900, marginTop: 10 }}>Plan de acción</div>
                                <div><b>Qué:</b> {c?.accion?.que || "-"}</div>
                                <div><b>Quién:</b> {c?.accion?.quien || "-"}</div>
                                <div><b>Cuándo:</b> {c?.accion?.cuando || "-"}</div>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function safeJson(v) {
  try { return JSON.parse(v); } catch { return null; }
}

// reutiliza helpers si ya los tienes; si no, puedes copiar los del Form:
function thSticky(left, width) { return { position:"sticky", left, zIndex:3, top:0, width, minWidth:width, background:"var(--card)", borderBottom:"1px solid var(--border)", padding:10, textAlign:"left", fontWeight:900 }; }
function tdSticky(left, width) { return { position:"sticky", left, zIndex:2, width, minWidth:width, background:"var(--card)", borderBottom:"1px solid var(--border)", padding:10, verticalAlign:"top", fontWeight:left===0?900:700 }; }
function thDay() { return { top:0, zIndex:1, background:"var(--card)", borderBottom:"1px solid var(--border)", padding:10, textAlign:"left", verticalAlign:"top", minWidth:220 }; }
function tdDay() { return { borderBottom:"1px solid var(--border)", padding:10, verticalAlign:"top", minWidth:220 }; }

function RenderTablaKitAntiderrames({ respuestas }) {
  const list = (respuestas || []).filter(r => String(r?.categoria||"").toUpperCase() === "TABLA_KIT_ANTIDERRAMES");

  let meta = null;
  const rows = [];
  for (const r of list) {
    const rd = safeParseJson(r.row_data);
    if (!rd) continue;

    if (rd.__tipo === "tabla_kit_antiderrames_meta") meta = rd.meta;
    if (rd.__tipo === "tabla_kit_antiderrames_row") rows.push(rd);
  }
  rows.sort((a,b)=>Number(a.rowIndex||0)-Number(b.rowIndex||0));

  return (
    <div style={{ display:"grid", gap: 12 }}>
      <Card title="Kit Antiderrames (FOR-035)">
        <pre style={{ whiteSpace:"pre-wrap" }}>{JSON.stringify(meta, null, 2)}</pre>
      </Card>

      {rows.map(r => (
        <Card key={r.item_ref} title={`Item ${r.rowIndex}: ${r.material}`}>
          <pre style={{ whiteSpace:"pre-wrap" }}>{JSON.stringify(r.checks, null, 2)}</pre>
        </Card>
      ))}
    </div>
  );
}

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
    .filter((r) => String(r.categoria || "").toUpperCase() === "TABLA_EXTINTORES" && r.row_data)
    .map((r) => r.row_data)
    .sort((a, b) => (a.rowIndex || 0) - (b.rowIndex || 0));

  if (!rows.length) return <p style={{ opacity: 0.7 }}>Sin filas.</p>;

  const REVISION_SECTIONS = [
    {
      titulo: "CILINDRO",
      items: [
        { key: "cil_pintura", label: "Pintura" },
        { key: "cil_golpes", label: "Golpes" },
        { key: "cil_autoadhesivo", label: "Autoadhesivo Fecha/Tipo" },
      ],
    },
    {
      titulo: "MANIJAS",
      items: [
        { key: "man_transporte", label: "Manija de transporte" },
        { key: "man_disparo", label: "Manija de disparo" },
      ],
    },
    {
      titulo: "OTROS COMPONENTES",
      items: [
        { key: "comp_presion", label: "Presón" },
        { key: "comp_manometro", label: "Manómetro" },
        { key: "comp_boquilla", label: "Boquilla" },
        { key: "comp_manguera", label: "Manguera" },
        { key: "comp_ring", label: "Ring / Aro de seguridad" },
        { key: "comp_corneta", label: "Corneta" },
        { key: "comp_senializacion", label: "Señalización" },
        { key: "comp_soporte", label: "Soporte colgar o ruedas" },
      ],
    },
  ];

  const badgeStyle = (v) => {
    const s = String(v || "").toUpperCase();
    const base = {
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 10px",
      borderRadius: 999,
      fontSize: 12,
      border: "1px solid rgba(0,0,0,.08)",
    };
    if (s === "BUENO") return { ...base, background: "#ecffec", borderColor: "#b3ffb3" };
    if (s === "MALO") return { ...base, background: "#ffecec", borderColor: "#ffb3b3" };
    if (s === "NA") return { ...base, background: "#f3f4f6" };
    return { ...base, background: "#fff7ed", borderColor: "rgba(255,106,0,.25)" };
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {rows.map((r, i) => {
        const rev = r.revision || {};
        const estados = rev.estados || {};
        const notas = rev.notas || {};
        const acciones = rev.acciones || {};

        return (
          <div
            key={r.rowIndex ?? i}
            style={{ border: "1px solid #eee", borderRadius: 14, padding: 12, background: "#fff" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <b>Fila {r.rowIndex ?? i + 1}</b>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {r.codigo ? <span style={badgeStyle("NA")}>Codigo: {r.codigo}</span> : null}
                {r.ubicacion ? <span style={badgeStyle("NA")}>Ubicacion: {r.ubicacion}</span> : null}
                {r.tipo ? <span style={badgeStyle("NA")}>Tipo: {r.tipo}</span> : null}
              </div>
            </div>

            {/* Datos principales (TODO) */}
            <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
              <div><b>Codigo:</b> {r.codigo || "-"}</div>
              <div><b>Ubicacion:</b> {r.ubicacion || "-"}</div>
              <div><b>Tipo:</b> {r.tipo || "-"}</div>

              {String(r.tipo || "").toUpperCase() === "PQS" ? (
                <div><b>Clase PQS:</b> {r.pqs_clase || "-"}</div>
              ) : null}

              {String(r.tipo || "").toUpperCase() === "OTROS" ? (
                <div><b>Descripcion (OTROS):</b> {r.tipo_otro_desc || "-"}</div>
              ) : null}

              <div><b>Capacidad:</b> {r.capacidad || "-"}</div>
              <div><b>Fecha prueba:</b> {r.fecha_prueba || "-"}</div>
              <div><b>Fecha vencimiento:</b> {r.fecha_vencimiento || "-"}</div>

              {r.observaciones ? (
                <div><b>Observaciones generales:</b> {r.observaciones}</div>
              ) : null}
            </div>

            {/* REVISION ESTADO GENERAL (TODO + MALO => Obs + Plan) */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #eee" }}>
              <b>REVISION ESTADO GENERAL</b>

              <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
                {REVISION_SECTIONS.map((sec) => (
                  <div key={sec.titulo}>
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>{sec.titulo}</div>

                    <div style={{ display: "grid", gap: 10 }}>
                      {sec.items.map((it) => {
                        const estado = estados[it.key] || "";
                        const isMalo = String(estado).toUpperCase() === "MALO";
                        const note = notas[it.key] || "";
                        const act = acciones[it.key] || {};
                        const quien =
                          typeof act.quien === "string"
                            ? act.quien
                            : (act?.responsable?.nombre || "");

                        return (
                          <div
                            key={it.key}
                            style={{
                              border: "1px solid #eee",
                              borderRadius: 12,
                              padding: 10,
                              background: "#fafafa",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                              <div><b>{it.label}</b></div>
                              <span style={badgeStyle(estado)}>{estado ? String(estado).toUpperCase() : "SIN RESPONDER"}</span>
                            </div>

                            {isMalo ? (
                              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                                <div style={{ padding: 10, borderRadius: 12, border: "1px solid #ffb3b3", background: "#ffecec" }}>
                                  <b>Observacion (obligatoria):</b>
                                  <div style={{ marginTop: 6 }}>{note || "-"}</div>
                                </div>

                                <div style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(255,106,0,.25)", background: "#fff7ed" }}>
                                  <b>Plan de accion (obligatorio)</b>
                                  <div style={{ marginTop: 6 }}><b>Que:</b> {act.que || "-"}</div>
                                  <div style={{ marginTop: 6 }}><b>Quien:</b> {quien || "-"}</div>
                                  <div style={{ marginTop: 6 }}><b>Cuando:</b> {act.cuando || "-"}</div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RenderTablaEpps({ respuestas }) {
  const rows = (respuestas || [])
    .filter((r) => {
      const categoria = String(r?.categoria || "").toUpperCase();
      const tipo = String(r?.row_data?.__tipo || "").toLowerCase();
      return categoria === "TABLA_EPPS" || tipo === "tabla_epps";
    })
    .map((r) => (r?.row_data && typeof r.row_data === "object" ? r.row_data : {}))
    .sort((a, b) => Number(a?.rowIndex || 0) - Number(b?.rowIndex || 0));

  if (!rows.length) return <p style={{ opacity: 0.7 }}>Sin filas.</p>;

  const EPP_COLUMNS = [
    ["casco", "CASCO"],
    ["lentes_luna_clara", "LENTES LUNA CLARA"],
    ["lentes_luna_oscura", "LENTES LUNA OSCURA"],
    ["zapatos_seguridad", "ZAPATOS SEGURIDAD"],
    ["chaleco_seguridad", "CHALECO SEGURIDAD"],
    ["tapones_oido", "TAPONES OIDO"],
    ["orejeras", "OREJERAS"],
    ["guantes_anticorte", "GUANTES ANTICORTE"],
    ["guantes_antiimpacto", "GUANTES ANTIIMPACTO"],
    ["respirador_media_cara", "RESPIRADOR MEDIA CARA"],
    ["filtros", "FILTROS"],
    ["barbiquejo", "BARBIQUEJO"],
    ["mascarilla_n95", "MASCARILLA N95"],
    ["otros_1", "OTROS 1"],
    ["otros_2", "OTROS 2"],
  ];

  const badgeStyle = (value) => {
    const estado = String(value || "").toUpperCase();
    const base = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: 72,
      padding: "2px 8px",
      borderRadius: 999,
      fontSize: 12,
      border: "1px solid rgba(0,0,0,.12)",
      background: "#fff",
    };
    if (estado === "BUENO") return { ...base, background: "#ecffec", borderColor: "#b3ffb3" };
    if (estado === "MALO") return { ...base, background: "#ffecec", borderColor: "#ffb3b3" };
    if (estado === "NA") return { ...base, background: "#f3f4f6", borderColor: "#d1d5db" };
    return { ...base, background: "#fff7ed", borderColor: "rgba(255,106,0,.25)" };
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ overflowX: "auto" }}>
        <table className="table" style={{ minWidth: 1900 }}>
          <thead>
            <tr>
              <th>N</th>
              <th>Apellidos y Nombres</th>
              <th>Puesto de Trabajo</th>
              {EPP_COLUMNS.map(([, label]) => (
                <th key={label}>{label}</th>
              ))}
              <th>Observaciones</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const epps = row?.epps && typeof row.epps === "object" ? row.epps : {};
              const hasMalo = Object.values(epps).some((v) => String(v).toUpperCase() === "MALO");
              const accion = row?.accion || {};

              return (
                <tr key={row?.rowIndex ?? idx + 1}>
                  <td>{row?.rowIndex ?? idx + 1}</td>
                  <td>{row?.apellidos_nombres || "-"}</td>
                  <td>{row?.puesto_trabajo || "-"}</td>
                  {EPP_COLUMNS.map(([key]) => (
                    <td key={`${row?.rowIndex ?? idx + 1}-${key}`}>
                      <span style={badgeStyle(epps[key])}>{String(epps[key] || "-").toUpperCase()}</span>
                    </td>
                  ))}
                  <td>{hasMalo ? row?.observaciones || "-" : "-"}</td>
                  <td>
                    {hasMalo ? (
                      <div style={{ display: "grid", gap: 4 }}>
                        <span><b>Que:</b> {accion?.que || "-"}</span>
                        <span><b>Quien:</b> {accion?.quien || "-"}</span>
                        <span><b>Cuando:</b> {accion?.cuando || "-"}</span>
                      </div>
                    ) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function descargarExcelSeguridad(idInspeccion) {
  const token = getToken(); // como ya lo usas en otras llamadas

  const r = await fetch(`${API_BASE}/api/inspecciones/${idInspeccion}/export/seguridad-xlsx`, {
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

function parseLocalDateOnly(value) {
  if (!value) return null;
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

function toLocalDayNumber(value) {
  if (!value) return null;
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).setHours(0, 0, 0, 0);
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
    return <p className="evi-empty">Sin evidencias.</p>;
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
        id_estado_accion: 1,
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
            id_estado_accion: 1,
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
          Estado inicial
          <input value="PENDIENTE (automático)" disabled />
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
        {inspeccionCerrada ? "Inspección cerrada" : saving ? "Guardando..." : "Crear accion"}
      </Button>
    </form>
  );
}

function UploadEvidence({
  kind,
  idTarget,
  onUploaded,
  disabled,
  inspeccionCerrada,
  online,
  maxFiles = null,
  currentCount = 0,
  className = "",
}) {
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const inputId = `file_${kind}_${idTarget}`;

  function onPickFiles(e) {
    const picked = Array.from(e.target.files || []);
    setError("");
    setOk("");

    if (!picked.length) {
      setFiles([]);
      return;
    }

    if (maxFiles != null) {
      const available = Math.max(0, maxFiles - Number(currentCount || 0));

      if (available <= 0) {
        setFiles([]);
        setError(`Solo se permiten ${maxFiles} evidencia(s) para esta accion.`);
        e.target.value = "";
        return;
      }

      if (picked.length > available) {
        setFiles(picked.slice(0, available));
        setError(`Solo puedes subir ${available} archivo(s) mas. Maximo total: ${maxFiles}.`);
        return;
      }
    }

    setFiles(picked);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setOk("");

    if (!files.length) return setError("Selecciona uno o mas archivos.");
    if (maxFiles != null && Number(currentCount || 0) + files.length > maxFiles) {
      return setError(`Solo se permiten ${maxFiles} evidencia(s) para esta accion.`);
    }
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
    <form onSubmit={onSubmit} className={`evidence-upload-form ${className}`.trim()}>
      <b className="evidence-upload-title">Subir evidencias</b>

      <div className="evidence-upload-controls">
        <input
          id={inputId}
          type="file"
          accept="image/*"
          multiple={maxFiles == null || maxFiles > 1}
          onChange={onPickFiles}
          disabled={disabled || saving || inspeccionCerrada || (maxFiles != null && Number(currentCount || 0) >= maxFiles)}
          className="sr-only-file"
        />

        <label
          htmlFor={inputId}
          className={`file-picker-label ${(disabled || saving || inspeccionCerrada || (maxFiles != null && Number(currentCount || 0) >= maxFiles)) ? "is-disabled" : ""}`}
        >
          Elegir archivos
        </label>

        <div className="evidence-upload-info">
          {maxFiles != null
            ? `Seleccionadas: ${files.length} | Ya cargadas: ${currentCount} | Maximo: ${maxFiles}`
            : files.length
              ? `${files.length} seleccionado(s)`
              : "Ningun archivo seleccionado"}
        </div>

        <Button variant="primary" disabled={blocked} type="submit">
          {saving ? "Subiendo..." : `Subir${files.length ? ` (${files.length})` : ""}`}
        </Button>
      </div>

      {files.length > 0 && (
        <div className="evidence-upload-previews">
          {files.map((f) => {
            const url = URL.createObjectURL(f);
            return (
              <div key={f.name + f.size} className="evidence-upload-preview-item">
                <img
                  src={url}
                  alt={f.name}
                  className="evidence-upload-preview-image"
                  onLoad={() => URL.revokeObjectURL(url)}
                />
                <div className="evidence-upload-preview-name">{f.name}</div>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="evidence-upload-alert evidence-upload-alert-error">
          {error}
        </div>
      )}

      {ok && (
        <div className="evidence-upload-alert evidence-upload-alert-ok">
          {ok}
        </div>
      )}
    </form>
  );
}

function normalizeFormatToken(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function detectTipoPlantilla({ cabecera, definicion, respuestas }) {
  const explicitTipo = String(
    definicion?.tipo || definicion?.json?.tipo || cabecera?.tipo || cabecera?.tipo_plantilla || ""
  ).trim().toLowerCase();
  if (explicitTipo) return explicitTipo;

  const code = normalizeFormatToken(cabecera?.codigo_formato || definicion?.codigo_formato || definicion?.json?.codigo_formato);
  if (code.includes("FOR014")) return "observaciones_seguridad";
  if (code.includes("FOR033")) return "tabla_epps";
  if (code.includes("FOR034")) return "tabla_extintores";
  if (code.includes("FOR035")) return "tabla_kit_antiderrames";
  if (code.includes("FOR036")) return "tabla_lavaojos";
  if (code.includes("FOR037")) return "tabla_epps_caliente";

  const list = Array.isArray(respuestas) ? respuestas : [];
  if (list.some((r) => String(r?.categoria || "").toUpperCase() === "TABLA_EPPS" || String(r?.row_data?.__tipo || "").toLowerCase() === "tabla_epps")) return "tabla_epps";
  if (list.some((r) => String(r?.categoria || "").toUpperCase() === "TABLA_EXTINTORES" || String(r?.row_data?.__tipo || "").toLowerCase() === "tabla_extintores")) return "tabla_extintores";
  if (list.some((r) => String(r?.categoria || "").toUpperCase() === "TABLA_KIT_ANTIDERRAMES" || String(r?.row_data?.__tipo || "").toLowerCase().includes("tabla_kit_antiderrames"))) return "tabla_kit_antiderrames";
  if (list.some((r) => String(r?.categoria || "").toUpperCase() === "TABLA_LAVAOJOS" || String(r?.row_data?.__tipo || "").toLowerCase().includes("tabla_lavaojos"))) return "tabla_lavaojos";
  return "checklist";
}

function fmtDateOnly(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("es-PE");
}

function pickFirst(...values) {
  for (const v of values) {
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "-";
}

function getEstadoBadgeVariant(estado) {
  const s = String(estado || "").trim().toUpperCase();

  if (s === "PENDIENTE") return "status-pending";
  if (s === "EN PROGRESO") return "status-progress";
  if (s === "VENCIDA" || s === "RECHAZADA") return "status-expired";
  if (s === "CERRADA" || s === "CERRADO") return "status-closed";

  return "status-pending";
}

function isAccionCerrada(accion) {
  return String(accion?.estado_accion || "").trim().toUpperCase() === "CERRADA";
}

function getMetaBadgeVariant() {
  return "meta-primary";
}

function getAprobacionBadgeVariant(fechaAprobacion) {
  return fechaAprobacion ? "green" : "gray";
}

export default function InspeccionDetail() {
  const [porcentajeDraft, setPorcentajeDraft] = useState({});

  function getPorcentajeDraftValue(accionDb, row) {
    const key = accionDb?.id_accion;
    if (key && Object.prototype.hasOwnProperty.call(porcentajeDraft, key)) {
      return porcentajeDraft[key];
    }
    return String(accionDb?.porcentaje_cumplimiento ?? row?.porcentaje ?? "");
  }

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
  const tipoPlantilla = detectTipoPlantilla({ cabecera: cab, definicion, respuestas: data?.respuestas });
  const isFOR014 = tipoPlantilla === "observaciones_seguridad" || tipoPlantilla === "observaciones_acciones";
  const isFOR033 = tipoPlantilla === "tabla_epps";
  const isFOR034 = tipoPlantilla === "tabla_extintores";
  const isFOR035 = tipoPlantilla === "tabla_kit_antiderrames";
  const isChecklist = tipoPlantilla === "checklist";

  // ocultar la UI inferior cuando la observación/acción ya forma parte natural de la plantilla
  const hideObsUI = isFOR014 || isChecklist || isFOR033 || isFOR034 || isFOR035;
  const inspectores = useMemo(() => {
    if (Array.isArray(data?.inspectores)) return data.inspectores;
    if (!Array.isArray(data?.participantes)) return [];
    return data.participantes.map((p) => ({
      id_usuario: p?.id_usuario ?? null,
      nombres: "",
      apellidos: "",
      nombre_completo: p?.nombre || "-",
      cargo: p?.cargo || null,
      firma_url: p?.firma_url || null,
      es_creador: String(p?.tipo || "").toUpperCase() === "REALIZADO_POR" ? 1 : 0,
    }));
  }, [data?.inspectores, data?.participantes]);
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
  const inspeccionCerrada = String(cab?.estado_inspeccion || "").toUpperCase() === "CERRADA";
  const visiblePageError = online ? pageError : "";
  const nombreTipoInspeccion = pickFirst(
    cab?.nombre_formato,
    cab?.nombre_tipo_inspeccion,
    definicion?.nombre_formato,
    definicion?.json?.nombre_formato,
    cab?.codigo_formato,
    "Inspeccion"
  );

  const fechaInspeccionSoloFecha = fmtDateOnly(cab?.fecha_inspeccion);

  const clienteUnidadMinera = pickFirst(
    cab?.raz_social,
    cab?.nombre_cliente,
    cab?.cliente_nombre,
    cab?.unidad_minera,
    cab?.nombre_unidad_minera,
    cab?.desc_cliente
  );

  const areaTexto = pickFirst(
    cab?.desc_area,
    cab?.area,
    cab?.nombre_area
  );

  const lugarTexto = pickFirst(
    cab?.lugar,
    cab?.nombre_lugar,
    cab?.ubicacion,
    cab?.desc_lugar
  );

  const servicioTexto = pickFirst(
    cab?.nombre_servicio,
    cab?.servicio,
    cab?.desc_servicio
  );

  const versionTexto = pickFirst(
    cab?.version_actual,
    cab?.version
  );

  const fechaAprobacionTexto = pickFirst(
    cab?.fecha_aprobacion,
    cab?.fechaAprobacion,
    cab?.approved_at
  );

  const codigoFormatoTexto = pickFirst(
    cab?.codigo_formato,
    definicion?.codigo_formato,
    definicion?.json?.codigo_formato
  );
  const respuestas = Array.isArray(data?.respuestas) ? data.respuestas : [];
  respuestas.sort((a, b) => {
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
    <DashboardLayout title={`Inspección #${id}`}>
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

      <h2 style={{ margin: 0 }}>
        {`Inspección #${id} : ${nombreTipoInspeccion}`}
      </h2>

      {visiblePageError && (
        <div style={{ padding: 10, borderRadius: 10, border: "1px solid #ffb3b3", background: "#ffecec" }}>
          {visiblePageError}
        </div>
      )}

      <Card title="Datos generales">
        {!cab ? (
          <p style={{ opacity: 0.7 }}>Sin cabecera.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge variant={getEstadoBadgeVariant(cab?.estado_inspeccion)}>
                Estado: {pickFirst(cab?.estado_inspeccion)}
              </Badge>

              <Badge variant={getMetaBadgeVariant()}>
                Modo: {pickFirst(cab?.modo_registro)}
              </Badge>

              <Badge variant={getMetaBadgeVariant()}>
                Codigo: {codigoFormatoTexto}
              </Badge>

              <Badge variant={getMetaBadgeVariant()}>
                Version: {versionTexto}
              </Badge>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div>
                <b>Fecha inspección:</b> {fechaInspeccionSoloFecha}
              </div>
              <div>
                <b>Cliente/Unidad Minera:</b> {clienteUnidadMinera}
              </div>
              <div>
                <b>Area:</b> {areaTexto}
              </div>
              <div>
                <b>Lugar:</b> {lugarTexto}
              </div>
              <div>
                <b>Servicio:</b> {servicioTexto}
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card title="Realizado por">
        {inspectores.length === 0 ? (
          <p style={{ opacity: 0.7 }}>Sin datos.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Inspector</th>
                  <th>Cargo</th>
                  <th>Firma</th>
                </tr>
              </thead>
              <tbody>
                {inspectores.map((p, idx) => (
                  <tr key={`${p?.id_usuario || "ins"}-${idx}`}>
                    <td>
                      <div style={{ display: "grid", gap: 6 }}>
                        {Number(p?.es_creador) === 1 ? (
                          <span>
                            <Badge className="badge-creator-header">
                              INSPECCIÓN CREADA POR:
                            </Badge>
                          </span>
                        ) : null}

                        <span style={{ fontWeight: 800 }}>
                          {p?.nombre_completo || "-"}
                        </span>
                      </div>
                    </td>

                    <td>{p?.cargo || "-"}</td>

                    <td>
                      {p?.firma_url ? (
                        <img
                          src={/^https?:\/\//i.test(String(p.firma_url)) ? p.firma_url : fileUrl(p.firma_url)}
                          alt={`Firma ${p?.nombre_completo || "inspector"}`}
                          className="firma-img"
                        />
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              const isTablaExtintores = String(categoria).toUpperCase() === "TABLA_EXTINTORES";
              if (isTablaExtintores) {
                const list = respuestasPorCategoria.get(categoria) || [];
                return (
                  <div key={categoria}>
                    <h4 style={{ margin: "0 0 8px 0" }}>{categoria}</h4>
                    <RenderTablaExtintores respuestas={list} />
                  </div>
                );
              }
              
              // CASO ESPECIAL: Observaciones/Acciones (tu logica actual)
              const isTablaEpps =
                String(categoria).toUpperCase() === "TABLA_EPPS" ||
                list.some((r) => String(r?.row_data?.__tipo || "").toLowerCase() === "tabla_epps");
              if (isTablaEpps) {
                const list = respuestasPorCategoria.get(categoria) || [];
                return (
                  <div key={categoria}>
                    <h4 style={{ margin: "0 0 8px 0" }}>{categoria}</h4>
                    <RenderTablaEpps respuestas={list} />
                  </div>
                );
              }

              // CASO ESPECIAL: TABLA_KIT_ANTIDERRAMES (FOR-035)
              const isTablaKit =
                String(categoria).toUpperCase() === "TABLA_KIT_ANTIDERRAMES" ||
                list.some((r) => String(r?.row_data?.__tipo || "").toLowerCase().includes("tabla_kit_antiderrames"));

              if (isTablaKit) {
                const list = respuestasPorCategoria.get(categoria) || [];
                return (
                  <div key={categoria}>
                    <h4 style={{ margin: "0 0 8px 0" }}>{categoria}</h4>
                    <RenderTablaKitAntiderrames respuestas={list} />
                  </div>
                );
              }

              const isObsAcc = upper === "OBSERVACIONES_ACCIONES";
              return (
                <div key={categoria}>
                  

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
                        const todayDay = new Date().setHours(0, 0, 0, 0);
                        const deadlineDay = toLocalDayNumber(accionDb?.fecha_ejecucion || row?.fecha_ejecucion);

                        const canEditCumplimiento =
                          hasLev &&
                          deadlineDay != null &&
                          todayDay <= deadlineDay &&
                          !inspeccionCerrada;

                        const isExpired = deadlineDay != null && todayDay > deadlineDay;
                        const cumplimientoPlaceholder = !hasLev
                          ? "Sube evidencia para habilitar"
                          : isExpired
                          ? "Acción vencida"
                          : "0 - 100";

                        return (
                          <article key={`${itemRef || "row"}-${idx}`} className="for014-item">
                            <div className="for014-head">
                              <div className="for014-head-main">
                                <div className="for014-kicker">OBSERVACIÓN {idx + 1}</div>
                                <div className="for014-meta">
                                  <div className="for014-meta">
                                    <Badge variant="red">
                                      Riesgo: {String(row?.riesgo || r?.estado || "NA").toUpperCase()}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="for014-grid">
                              <section className="for014-panel for014-panel-obs">
                                <div className="for014-panel-title">Observación detectada</div>

                                <div className="for014-content">
                                  <div className="for014-text">
                                    {row?.observacion || "-"}
                                  </div>
                                </div>

                                <div className="for014-evidence-block">
                                  <div className="for014-subtitle">Evidencias de observacion</div>
                                  <EvidenceGrid evidencias={evidObs} onPreview={openPreview} />
                                </div>
                              </section>

                              <section className="for014-panel for014-panel-acc">
                                <div className="for014-panel-title">Acción correctiva</div>

                                <div className="for014-content">
                                  <div className="for014-data-list">
                                    <div><b>Acción:</b> {row?.accion_correctiva || "-"}</div>
                                    <div><b>Fecha de ejecución:</b> {row?.fecha_ejecucion || "-"}</div>
                                    <div><b>Responsable:</b> {row?.responsable || row?.responsable_data?.nombre || "-"}</div>
                                  </div>
                                </div>

                                <div className="for014-evidence-block">
                                  <div className="for014-subtitle">Evidencias de levantamiento</div>

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
                                        maxFiles={2}
                                        currentCount={evidLev.length}
                                        className="for014-upload"
                                      />
                                    </>
                                  ) : (
                                    <p className="for014-empty-msg">
                                      No se encontro accion creada para {itemRef}.
                                    </p>
                                  )}
                                </div>

                                <div className="for014-cumplimiento">
                                  <label className="for014-cumplimiento-label">% cumplimiento</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    className="ins-input"
                                    value={getPorcentajeDraftValue(accionDb, row)}
                                    onChange={(e) => {
                                      if (!accionDb?.id_accion) return;

                                      const raw = e.target.value;

                                      if (raw === "") {
                                        setPorcentajeDraft((prev) => ({
                                          ...prev,
                                          [accionDb.id_accion]: "",
                                        }));
                                        return;
                                      }

                                      const num = Number(raw);
                                      if (Number.isNaN(num)) return;
                                      if (num < 0 || num > 100) return;

                                      setPorcentajeDraft((prev) => ({
                                        ...prev,
                                        [accionDb.id_accion]: raw,
                                      }));
                                    }}
                                    disabled={!canEditCumplimiento}
                                    placeholder={cumplimientoPlaceholder}
                                    onBlur={async () => {
                                      if (!accionDb?.id_accion) return;
                                      if (!online) return;
                                      if (!canEditCumplimiento) return;

                                      const draft = porcentajeDraft[accionDb.id_accion];
                                      const sourceValue =
                                        draft ?? String(accionDb?.porcentaje_cumplimiento ?? row?.porcentaje ?? "");

                                      const v = sourceValue === "" ? null : Number(sourceValue);

                                      try {
                                        await actualizarPorcentajeAccion(accionDb.id_accion, v);
                                        setPorcentajeDraft((prev) => {
                                          const copy = { ...prev };
                                          delete copy[accionDb.id_accion];
                                          return copy;
                                        });
                                        await load();
                                      } catch (err) {
                                        alert(getErrorMessage(err));
                                      }
                                    }}
                                  />
                                </div>
                              </section>
                            </div>
                          </article>
                        );
                      }

                      // fallback
                      const estado = String(r?.estado || "").toUpperCase();
                      const itemRef = normItemRef(r?.item_id || r?.item_ref || "");
                      const desc = r?.descripcion || "-";
                      const obs = (r?.observacion || "").trim();
                      const accion = parseAccionJson(r?.accion) || r?.accion || null;
                      const isMalo = estado === "MALO";

                      return (
                        <article
                          key={`${itemRef || "item"}-${idx}`}
                          className={`resp-item-card ${isMalo ? "is-malo" : ""}`}
                        >
                          <div className="resp-item-head">
                            <div className="resp-item-main">
                              <div className="resp-item-refline">
                                <span className="resp-item-ref">{itemRef || "-"}</span>
                                <span className="resp-item-desc">{desc}</span>
                              </div>
                            </div>

                            <span className={getEstadoClass(estado)}>
                              {estado || "SIN RESPUESTA"}
                            </span>
                          </div>

                          {isMalo ? (
                            <div className="resp-detail-panels">
                              <section className="resp-panel resp-panel-danger">
                                <div className="resp-panel-title">Observación</div>
                                <div className="resp-panel-body">
                                  {obs || "-"}
                                </div>
                              </section>

                              <section className="resp-panel resp-panel-success">
                                <div className="resp-panel-title">Acción correctiva</div>
                                <div className="resp-action-grid">
                                  <div><b>Qué:</b> {accion?.que || "-"}</div>
                                  <div><b>Quién:</b> {getResponsableAccion(accion)}</div>
                                  <div><b>Cuándo:</b> {accion?.cuando || "-"}</div>
                                </div>
                              </section>
                            </div>
                          ) : null}
                        </article>
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
              {inspeccionCerrada ? "Inspección cerrada" : savingObs ? "Guardando..." : "Crear observacion"}
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
              const hayPendientes = acciones.some((x) => !isAccionCerrada(x));

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
                        isAccionCerrada(acc);

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
                                disabled={isAccionCerrada(acc)}
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
                            {!isAccionCerrada(a) && (
                              <Button
                                variant="outline"
                                disabled={!online}
                                onClick={async () => {
                                  try {
                                    await actualizarPorcentajeAccion(a.id_accion, 100);
                                    await load();
                                    alert("Accion cerrada ?");
                                  } catch (err) {
                                    console.error("inspeccion.detail.cerrarAccion:", err);
                                    alert(getErrorMessage(err));
                                  }
                                }}
                              >
                                Marcar como cerrada
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
                            disabled={isAccionCerrada(a)}
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


