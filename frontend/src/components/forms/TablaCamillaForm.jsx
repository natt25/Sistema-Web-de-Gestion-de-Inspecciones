// frontend/src/components/forms/TablaCamillaForm.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import Button from "../ui/Button.jsx";
import Autocomplete from "../ui/Autocomplete.jsx";
import { buscarEmpleados } from "../../api/busquedas.api.js";
import { buildEmpleadoDisplayName, buildEmpleadoOptionLabel } from "../../utils/empleados.js";
import { serializeTablaCamilla } from "../../utils/plantillaRenderer.js";

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

const DEFAULT_ITEMS = [
  { item_ref: "i1", descripcion: "Estado de la funda." },
  { item_ref: "i2", descripcion: "Estado del soporte." },
  { item_ref: "i3", descripcion: "Estado general de la camilla." },
  { item_ref: "i4", descripcion: "Se encuentra correctamente asegurada a la pared." },
  { item_ref: "i5", descripcion: "Estado de las correas de ajuste." },
  { item_ref: "i6", descripcion: "Señalización adecuada y visible." },
  { item_ref: "i7", descripcion: "Accesos libres de obstrucciones." },
  { item_ref: "i8", descripcion: "Cuenta con inmobilizadores para extremidades superiores e inferiores." },
];

function emptyMesMeta() {
  return { fecha: "", realizado_por: null, realizado_por_text: "", cargo: "", firma: "" };
}
function buildEmptyMeta() {
  const meses = {};
  MESES.forEach((m) => (meses[m.key] = emptyMesMeta()));
  return { meses };
}

function emptyCell() {
  return { estado: "", observacion: "", accion: { que: "", quien: "", quien_dni: "", cuando: "" } };
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
  const rawItems =
    definicion?.items ||
    definicion?.json?.items ||
    definicion?.json_definicion?.items ||
    definicion?.camilla?.items ||
    [];

  const finalItems = Array.isArray(rawItems) && rawItems.length ? rawItems : DEFAULT_ITEMS;

  return finalItems.map((it, idx) => {
    const checks = {};
    MESES.forEach((m) => (checks[m.key] = emptyCell()));
    return {
      rowIndex: idx + 1,
      item_ref: it?.item_ref ?? it?.id ?? it?.item_id ?? `i${idx + 1}`,
      descripcion: it?.descripcion ?? it?.desc ?? `Item ${idx + 1}`,
      checks,
      __locked: true, // <- base bloqueada (no borrar)
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
        checks,
        __locked: false, // <- custom sí se puede borrar
      };
    });

  return normalizeRowIndexes([...merged, ...extra]);
}

export default function TablaCamillaForm({ definicion = {}, initial = null, onSubmit }) {
  const [codigo, setCodigo] = useState(() => String(initial?.codigo_camilla || initial?.meta?.codigo_camilla || ""));
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

    setCodigo(String(initial?.codigo_camilla || initial?.meta?.codigo_camilla || ""));
  }, [definicion, initial]);

  const filled = useMemo(() => {
    let n = 0;
    for (const r of rows || []) for (const m of MESES) if (String(r?.checks?.[m.key]?.estado || "").trim()) n += 1;
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
        checks,
        __locked: false,
      };
      return normalizeRowIndexes([...(prev || []), newRow]);
    });
  };

  const handleDeleteRow = (rowIdx) => {
    const r = rows?.[rowIdx];
    if (!r) return;
    if (r.__locked) return; // <- base NO se borra

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
      tipo: "tabla_camilla",
      respuestas: serializeTablaCamilla({ codigo_camilla: codigo, meta, rows }),
      resumen: { celdas_marcadas: filled, filas: (rows || []).length },
      meta,
      rows,
      codigo_camilla: codigo,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="ins-form">
      <div className="ins-header">
        <div>
          <div className="ins-title">Inspección de Camilla</div>
          <div className="ins-sub">FOR-043. Si marcas MALO, se exige Observación + Plan de acción (Qué / Quién / Cuándo).</div>
        </div>
        <div className="ins-progress">
          <span>{filled} celdas con estado</span>
          <Button type="submit">Guardar</Button>
        </div>
      </div>

      {/* SOLO código arriba */}
      <div className="ins-section">
        <div className="ins-grid" style={{ gridTemplateColumns: "1fr" }}>
          <label className="ins-field">
            <span>Código de Camilla</span>
            <input
              className="ins-input"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ej: CAM-001"
            />
          </label>
        </div>
      </div>

      <div className="ins-section" style={{ overflowX: "auto" }}>
        <table className="table" style={{ minWidth: 1700 }}>
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th style={{ minWidth: 360 }}>Descripción</th>

              {MESES.map((m) => (
                <th key={m.key} style={{ minWidth: 240 }}>{m.label}</th>
              ))}

              {/* tacho sticky */}
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
            <tr>
              <td colSpan={2} style={{ fontWeight: 900 }}>Fecha</td>
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

            <tr>
              <td colSpan={2} style={{ fontWeight: 900 }}>Realizado por</td>
              {MESES.map((m) => {
                const mes = meta?.meses?.[m.key] || emptyMesMeta();
                return (
                  <td key={`rp-${m.key}`}>
                    <Autocomplete
                      placeholder="DNI / Apellido / Nombre"
                      displayValue={mes?.realizado_por_text || ""}
                      options={empOptions}
                      loading={searching}
                      getOptionLabel={buildEmpleadoOptionLabel}
                      onInputChange={async (text) => {
                        updateMetaMes(m.key, { realizado_por_text: text, realizado_por: null, cargo: "", firma: "" });
                        const opts = await buscarEmpleadosForAutocomplete(text);
                        setEmpOptions(opts);
                      }}
                      onSelect={(it) => {
                        updateMetaMes(m.key, {
                          realizado_por: it,
                          realizado_por_text: buildEmpleadoDisplayName(it),
                          cargo: it?.cargo ?? it?.desc_cargo ?? "",
                          firma: getFirmaFromEmpleado(it) || "",
                        });
                      }}
                    />
                  </td>
                );
              })}
              <td />
            </tr>

            <tr>
              <td colSpan={2} style={{ fontWeight: 900 }}>Firma</td>
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

            {(rows || []).map((row, idx) => (
              <tr key={`row-${row?.item_ref || idx}`}>
                <td>{row?.rowIndex || idx + 1}</td>

                <td>
                  <input
                    className="ins-input"
                    value={row?.descripcion || ""}
                    onChange={(e) => updateRow(idx, { descripcion: e.target.value })}
                    placeholder="Descripción"
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
                                updateCell(idx, m.key, { accion: { ...(row?.checks?.[m.key]?.accion || {}), que: e.target.value } })
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
                              getOptionLabel={buildEmpleadoOptionLabel}
                              onInputChange={async (text) => {
                                updateCell(idx, m.key, { accion: { ...(row?.checks?.[m.key]?.accion || {}), quien: text, quien_dni: "" } });
                                const opts = await buscarEmpleadosForAutocomplete(text);
                                setEmpOptions(opts);
                              }}
                              onSelect={(it) => {
                                updateCell(idx, m.key, {
                                  accion: {
                                    ...(row?.checks?.[m.key]?.accion || {}),
                                    quien: buildEmpleadoDisplayName(it),
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
                                updateCell(idx, m.key, { accion: { ...(row?.checks?.[m.key]?.accion || {}), cuando: e.target.value } })
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

                {/* tacho: bloqueado para base */}
                <td
                  style={{
                    textAlign: "center",
                    position: "sticky",
                    right: 0,
                    background: "#fff",
                    zIndex: 5,
                  }}
                >
                  <Button
                    type="button"
                    title={row?.__locked ? "Fila de plantilla (no se puede borrar)" : "Eliminar fila"}
                    onClick={() => handleDeleteRow(idx)}
                    disabled={row?.__locked}
                    variant="outline"
                    style={{ opacity: row?.__locked ? 0.35 : 1 }}
                  >
                    X
                  </Button>
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
