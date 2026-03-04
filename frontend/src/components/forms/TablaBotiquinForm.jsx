// frontend/src/components/forms/TablaBotiquinForm.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import Button from "../ui/Button.jsx";
import Autocomplete from "../ui/Autocomplete.jsx";
import { buscarEmpleados } from "../../api/busquedas.api.js";
import { serializeTablaBotiquin } from "../../utils/plantillaRenderer.js"; // <- si tu archivo usa otro nombre, cámbialo

const MESES = [
  { key: "ENERO", label: "Enero" },
  { key: "FEBRERO", label: "Febrero" },
  { key: "MARZO", label: "Marzo" },
  { key: "ABRIL", label: "Abril" },
  { key: "MAYO", label: "Mayo" },
  { key: "JUNIO", label: "Junio" },
  { key: "JULIO", label: "Julio" },
  { key: "AGOSTO", label: "Agosto" },
  { key: "SETIEMBRE", label: "Setiembre" },
  { key: "OCTUBRE", label: "Octubre" },
  { key: "NOVIEMBRE", label: "Noviembre" },
  { key: "DICIEMBRE", label: "Diciembre" },
];

const ESTADO_OPTIONS = ["", "BUENO", "MALO", "NA"];

function emptyMesMeta() {
  return { fecha: "", realizado_por: null, realizado_por_text: "", cargo: "", firma: "" };
}

function buildEmptyMeta() {
  const meses = {};
  MESES.forEach((m) => (meses[m.key] = emptyMesMeta()));
  return { meses };
}

function emptyCell() {
  return {
    estado: "",
    observacion: "",
    accion: { que: "", quien: "", quien_dni: "", cuando: "" },
  };
}

function hasMaloCell(cell) {
  return String(cell?.estado || "").toUpperCase() === "MALO";
}

function validateCell(cell) {
  if (!hasMaloCell(cell)) return null;
  if (!String(cell?.observacion || "").trim()) return "Observación obligatoria.";
  if (!String(cell?.accion?.que || "").trim()) return "Acción (qué) obligatoria.";
  if (!String(cell?.accion?.quien || "").trim()) return "Acción (quién) obligatoria.";
  if (!String(cell?.accion?.cuando || "").trim()) return "Acción (cuándo) obligatoria.";
  return null;
}

// Igual que cabecera: Nombre (DNI) — cargo
function getEmpleadoLabel(e) {
  const nom = `${e?.apellidos ?? e?.apellido ?? ""} ${e?.nombres ?? e?.nombre ?? ""}`.trim();
  const dni = e?.dni ? `(${e.dni})` : "";
  const cargo = e?.cargo ? `— ${e.cargo}` : e?.desc_cargo ? `— ${e.desc_cargo}` : "";
  return `${nom} ${dni} ${cargo}`.trim();
}

function getEmpleadoFullName(e) {
  return `${e?.apellidos ?? e?.apellido ?? ""} ${e?.nombres ?? e?.nombre ?? ""}`.trim() || e?.dni || "";
}

function getFirmaFromEmpleado(e) {
  const raw = e?.firma_url || e?.firma_ruta || e?.firma_path || e?.ruta_firma || "";
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  const api = String(import.meta?.env?.VITE_API_URL || "http://localhost:3000").replace(/\/+$/, "");
  const path = s.startsWith("/") ? s : `/${s}`;
  return `${api}${path}`;
}

function normalizeRowIndexes(list) {
  return (Array.isArray(list) ? list : []).map((r, i) => ({
    ...r,
    rowIndex: i + 1,
    item_ref: r?.item_ref || `item_${i + 1}`,
  }));
}

function buildBaseItems(definicion) {
  const rawItems = definicion?.items || definicion?.items_default || definicion?.botiquin?.items || [];

  const fallback = [
    { item_ref: "i1", descripcion: "Guantes Quirúrgicos / Nitrilo", unidad: "Par", cantidad: "1" },
    { item_ref: "i2", descripcion: "Yodopovidona (... ml)", unidad: "Uni", cantidad: "1" },
    { item_ref: "i3", descripcion: "Agua Oxigenada (... ml)", unidad: "Uni", cantidad: "1" },
  ];

  const finalItems = Array.isArray(rawItems) && rawItems.length ? rawItems : fallback;

  return finalItems.map((it, idx) => {
    const checks = {};
    MESES.forEach((m) => (checks[m.key] = emptyCell()));
    return {
      rowIndex: idx + 1,
      item_ref: it?.item_ref ?? it?.id ?? it?.item_id ?? `i${idx + 1}`,
      descripcion: it?.descripcion ?? it?.desc ?? `Item ${idx + 1}`,
      cantidad: String(it?.cantidad_default ?? it?.cantidad ?? ""),
      unidad: it?.unidad ?? "",
      checks,
      __locked: true,
    };
  });
}

function mergeInitialWithBase(base, initial) {
  const incoming = initial?.rows || initial?.items || [];
  if (!Array.isArray(incoming) || incoming.length === 0) return normalizeRowIndexes(base);

  const byRef = new Map(incoming.map((r) => [String(r?.item_ref || r?.item_id || ""), r]));
  const merged = base.map((b) => {
    const inc = byRef.get(String(b.item_ref));
    if (!inc) return b;

    const checks = { ...b.checks };
    MESES.forEach((m) => {
      checks[m.key] = { ...emptyCell(), ...(inc?.checks?.[m.key] || inc?.meses?.[m.key] || {}) };
    });

    return { ...b, ...inc, checks, __locked: true };
  });

  const baseRefs = new Set(base.map((x) => String(x.item_ref)));
  const extra = incoming
    .filter((r) => {
      const ref = String(r?.item_ref || r?.item_id || "");
      return ref && !baseRefs.has(ref);
    })
    .map((r) => {
      const checks = {};
      MESES.forEach((m) => (checks[m.key] = { ...emptyCell(), ...(r?.checks?.[m.key] || r?.meses?.[m.key] || {}) }));
      return {
        rowIndex: 0,
        item_ref: r?.item_ref || r?.item_id || `custom_${Date.now()}`,
        descripcion: r?.descripcion || "",
        cantidad: String(r?.cantidad ?? ""),
        unidad: r?.unidad ?? "",
        checks,
        __locked: false,
      };
    });

  return normalizeRowIndexes([...merged, ...extra]);
}

export default function TablaBotiquinForm({ definicion = {}, initial = null, onSubmit }) {
  const [codigo, setCodigo] = useState(() => String(initial?.codigo_botiquin || initial?.meta?.codigo_botiquin || ""));
  const [meta, setMeta] = useState(buildEmptyMeta);
  const [rows, setRows] = useState([]);
  const [searching, setSearching] = useState(false);
  const [empOptions, setEmpOptions] = useState([]);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const base = buildBaseItems(definicion || {});
    const nextRows = mergeInitialWithBase(base, initial || null);
    setRows(nextRows);

    const nextMeta = buildEmptyMeta();
    MESES.forEach((m) => {
      nextMeta.meses[m.key] = { ...emptyMesMeta(), ...(initial?.meta?.meses?.[m.key] || {}) };
    });
    setMeta(nextMeta);
  }, [definicion, initial]);

  const filled = useMemo(() => {
    let n = 0;
    for (const r of rows || []) for (const m of MESES) if (String(r?.checks?.[m.key]?.estado || "").trim()) n++;
    return n;
  }, [rows]);

  const buscarEmpleadosForAutocomplete = useCallback(async (text) => {
    const q = String(text || "").trim();
    if (!q) return [];
    try {
      setSearching(true);
      const list = await buscarEmpleados(q);
      return Array.isArray(list) ? list : [];
    } finally {
      setSearching(false);
    }
  }, []);

  const updateMetaMes = (mesKey, patch) => {
    setMeta((prev) => ({
      ...prev,
      meses: {
        ...(prev?.meses || {}),
        [mesKey]: { ...(prev?.meses?.[mesKey] || emptyMesMeta()), ...patch },
      },
    }));
  };

  const updateRow = (idx, patch) => {
    setRows((prev) => normalizeRowIndexes((prev || []).map((r, i) => (i === idx ? { ...r, ...patch } : r))));
  };

  const updateCell = (rowIdx, mesKey, patch) => {
    setRows((prev) =>
      (prev || []).map((r, i) => {
        if (i !== rowIdx) return r;
        const curr = r?.checks?.[mesKey] || emptyCell();
        const nextCell = { ...curr, ...patch };

        if (!hasMaloCell(nextCell)) {
          nextCell.observacion = "";
          nextCell.accion = { que: "", quien: "", quien_dni: "", cuando: "" };
        } else {
          nextCell.accion = {
            que: nextCell?.accion?.que ?? "",
            quien: nextCell?.accion?.quien ?? "",
            quien_dni: nextCell?.accion?.quien_dni ?? "",
            cuando: nextCell?.accion?.cuando ?? "",
          };
        }

        return { ...r, checks: { ...(r?.checks || {}), [mesKey]: nextCell } };
      })
    );
  };

  const validateAll = () => {
    const next = {};
    (rows || []).forEach((r, rowIdx) => {
      MESES.forEach((m) => {
        const cell = r?.checks?.[m.key] || emptyCell();
        const msg = validateCell(cell);
        if (msg) next[`r${rowIdx}:${m.key}`] = msg;
      });
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleAddRow = () => {
    setRows((prev) => {
      const checks = {};
      MESES.forEach((m) => (checks[m.key] = emptyCell()));
      const newRow = {
        rowIndex: 0,
        item_ref: `custom_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        descripcion: "",
        cantidad: "",
        unidad: "",
        checks,
        __locked: false,
      };
      return normalizeRowIndexes([...(prev || []), newRow]);
    });
  };

  const handleDeleteRow = (rowIdx) => {
    const r = rows?.[rowIdx];
    if (!r) return;
    if (r.__locked) return;

    const name = String(r.descripcion || "").trim() || `Fila ${rowIdx + 1}`;
    const ok = window.confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`);
    if (!ok) return;

    setRows((prev) => normalizeRowIndexes((prev || []).filter((_, i) => i !== rowIdx)));

    setErrors((prevErr) => {
      const next = { ...(prevErr || {}) };
      Object.keys(next).forEach((k) => {
        if (k.startsWith(`r${rowIdx}:`)) delete next[k];
      });
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateAll()) return;

    onSubmit?.({
      tipo: "tabla_botiquin",
      respuestas: serializeTablaBotiquin({
        codigo_botiquin: codigo,
        meta,
        rows,
      }),
      resumen: { celdas_marcadas: filled, filas: (rows || []).length },
      meta,
      rows,
      codigo_botiquin: codigo,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="ins-form">
      <div className="ins-header">
        <div>
          <div className="ins-title">Inspección de Botiquín</div>
          <div className="ins-sub">FOR-038. Si marcas MALO, se exige Observación + Plan de acción (Qué / Quién / Cuándo).</div>
        </div>
        <div className="ins-progress">
          <span>{filled} celdas con estado</span>
          <Button type="submit">Guardar</Button>
        </div>
      </div>

      {/* Card superior: SOLO código */}
      <div className="ins-section">
        <div className="ins-grid" style={{ gridTemplateColumns: "1fr" }}>
          <label className="ins-field">
            <span>Código de Botiquín</span>
            <input
              className="ins-input"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ej: BOT-001"
            />
          </label>
        </div>
      </div>

      <div className="ins-section" style={{ overflowX: "auto" }}>
        <table className="table" style={{ minWidth: 1700 }}>
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th style={{ minWidth: 320 }}>Descripción</th>
              <th style={{ width: 110 }}>Cant.</th>
              <th style={{ width: 100 }}>Unidad</th>

              {MESES.map((m) => (
                <th key={m.key} style={{ minWidth: 240 }}>
                  {m.label}
                </th>
              ))}

              <th
                style={{
                  width: 70,
                  minWidth: 70,
                  textAlign: "center",
                  position: "sticky",
                  right: 0,
                  background: "#fff",
                  zIndex: 6,
                }}
              />
            </tr>
          </thead>

          <tbody>
            {/* FECHA */}
            <tr>
              <td colSpan={4} style={{ fontWeight: 900 }}>Fecha</td>
              {MESES.map((m) => (
                <td key={`fecha-${m.key}`}>
                  <input
                    type="date"
                    className="ins-input"
                    value={meta?.meses?.[m.key]?.fecha || ""}
                    onChange={(e) => updateMetaMes(m.key, { fecha: e.target.value })}
                  />
                </td>
              ))}
              <td />
            </tr>

            {/* REALIZADO POR */}
            <tr>
              <td colSpan={4} style={{ fontWeight: 900 }}>Realizado por</td>
              {MESES.map((m) => {
                const mes = meta?.meses?.[m.key] || emptyMesMeta();
                return (
                  <td key={`rp-${m.key}`}>
                    <Autocomplete
                      placeholder="DNI / Apellido / Nombre"
                      displayValue={mes?.realizado_por_text || ""}
                      options={empOptions}
                      loading={searching}
                      getOptionLabel={getEmpleadoLabel}
                      onInputChange={async (text) => {
                        updateMetaMes(m.key, { realizado_por_text: text, realizado_por: null, cargo: "", firma: "" });
                        const opts = await buscarEmpleadosForAutocomplete(text);
                        setEmpOptions(opts);
                      }}
                      onSelect={(it) => {
                        updateMetaMes(m.key, {
                          realizado_por: it,
                          realizado_por_text: getEmpleadoFullName(it),
                          cargo: it?.cargo ?? it?.desc_cargo ?? "",
                          firma: getFirmaFromEmpleado(it) || "",
                        });
                      }}
                    />
                    {mes?.cargo ? <div className="help">Cargo: <b>{mes.cargo}</b></div> : null}
                  </td>
                );
              })}
              <td />
            </tr>

            {/* FIRMA */}
            <tr>
              <td colSpan={4} style={{ fontWeight: 900 }}>Firma</td>
              {MESES.map((m) => {
                const mes = meta?.meses?.[m.key] || emptyMesMeta();
                const finalSrc = getFirmaFromEmpleado(mes?.realizado_por) || mes?.firma || "";
                return (
                  <td key={`firma-${m.key}`}>
                    {finalSrc ? (
                      <div style={{ width: "100%", display: "grid", placeItems: "center", padding: 6, border: "1px solid var(--border)", borderRadius: 12, background: "#fff" }}>
                        <img
                          src={finalSrc}
                          alt="firma"
                          style={{ maxWidth: "100%", height: 64, objectFit: "contain", display: "block" }}
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                      </div>
                    ) : (
                      <div style={{ height: 74, border: "1px dashed var(--border)", borderRadius: 12, background: "#fff" }} />
                    )}
                  </td>
                );
              })}
              <td />
            </tr>

            {/* ITEMS */}
            {(rows || []).map((row, idx) => (
              <tr key={`row-${row?.item_ref || idx}`}>
                <td>{row?.rowIndex || idx + 1}</td>

                <td>
                  <input
                    className="ins-input"
                    value={row?.descripcion || ""}
                    onChange={(e) => updateRow(idx, { descripcion: e.target.value })}
                    placeholder="Descripción"
                    disabled={row?.__locked}
                  />
                </td>

                <td>
                  <input
                    className="ins-input"
                    value={row?.cantidad || ""}
                    onChange={(e) => updateRow(idx, { cantidad: e.target.value })}
                    placeholder="Cant."
                  />
                </td>

                <td>
                  <input
                    className="ins-input"
                    value={row?.unidad || ""}
                    onChange={(e) => updateRow(idx, { unidad: e.target.value })}
                    placeholder="Unidad"
                  />
                </td>

                {MESES.map((m) => (
                  <td key={`${row?.item_ref || idx}-${m.key}`}>
                    <select
                      className="ins-input"
                      value={row?.checks?.[m.key]?.estado || ""}
                      onChange={(e) => updateCell(idx, m.key, { estado: e.target.value })}
                    >
                      {ESTADO_OPTIONS.map((opt) => (
                        <option key={opt || "empty"} value={opt}>{opt || "-"}</option>
                      ))}
                    </select>

                    {hasMaloCell(row?.checks?.[m.key]) ? (
                      <div style={{ marginTop: 10, padding: 10, border: "1px solid #f3c6c6", borderRadius: 12, background: "#fff5f5" }}>
                        <div style={{ fontWeight: 900, color: "#b91c1c" }}>Observación (obligatoria)</div>
                        <textarea
                          className="ins-note-input"
                          rows={2}
                          value={row?.checks?.[m.key]?.observacion || ""}
                          onChange={(e) => updateCell(idx, m.key, { observacion: e.target.value })}
                          placeholder="Detalla observaciones y medidas correctivas..."
                        />

                        <div style={{ marginTop: 10, fontWeight: 900 }}>Plan de acción (obligatorio)</div>

                        <div className="ins-grid">
                          <label className="ins-field">
                            <span>Qué</span>
                            <input
                              className="ins-input"
                              value={row?.checks?.[m.key]?.accion?.que || ""}
                              onChange={(e) =>
                                updateCell(idx, m.key, {
                                  accion: { ...(row?.checks?.[m.key]?.accion || {}), que: e.target.value },
                                })
                              }
                            />
                          </label>

                          <label className="ins-field">
                            <span>Quién</span>
                            <Autocomplete
                              placeholder="DNI / Apellido / Nombre"
                              displayValue={row?.checks?.[m.key]?.accion?.quien || ""}
                              options={empOptions}
                              loading={searching}
                              getOptionLabel={getEmpleadoLabel}
                              onInputChange={async (text) => {
                                updateCell(idx, m.key, {
                                  accion: { ...(row?.checks?.[m.key]?.accion || {}), quien: text, quien_dni: "" },
                                });
                                const opts = await buscarEmpleadosForAutocomplete(text);
                                setEmpOptions(opts);
                              }}
                              onSelect={(it) => {
                                updateCell(idx, m.key, {
                                  accion: {
                                    ...(row?.checks?.[m.key]?.accion || {}),
                                    quien: getEmpleadoFullName(it),
                                    quien_dni: String(it?.dni || ""),
                                  },
                                });
                              }}
                            />
                          </label>

                          <label className="ins-field">
                            <span>Cuándo</span>
                            <input
                              type="date"
                              className="ins-input"
                              value={row?.checks?.[m.key]?.accion?.cuando || ""}
                              onChange={(e) =>
                                updateCell(idx, m.key, {
                                  accion: { ...(row?.checks?.[m.key]?.accion || {}), cuando: e.target.value },
                                })
                              }
                            />
                          </label>
                        </div>

                        {errors[`r${idx}:${m.key}`] ? (
                          <div className="ins-error" style={{ marginTop: 8 }}>
                            {errors[`r${idx}:${m.key}`]}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                ))}

                <td
                  style={{
                    textAlign: "center",
                    position: "sticky",
                    right: 0,
                    background: "#fff",
                    zIndex: 5,
                    pointerEvents: "auto",
                  }}
                >
                  <button
                    type="button"
                    title="Eliminar fila"
                    onClick={() => handleDeleteRow(idx)}
                    disabled={row?.__locked}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "#fff",
                      cursor: row?.__locked ? "not-allowed" : "pointer",
                      fontSize: 16,
                      lineHeight: "16px",
                      opacity: row?.__locked ? 0.35 : 1,
                      pointerEvents: row?.__locked ? "none" : "auto",
                    }}
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-start", paddingLeft: 50 }}>
          <Button type="button" onClick={handleAddRow}>+ Agregar fila</Button>
        </div>
      </div>
    </form>
  );
}