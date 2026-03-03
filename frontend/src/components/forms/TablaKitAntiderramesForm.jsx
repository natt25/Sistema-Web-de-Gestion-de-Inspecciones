import { useMemo, useState, useCallback } from "react";
import Button from "../ui/Button.jsx";
import Autocomplete from "../ui/Autocomplete.jsx";
import { buscarEmpleados } from "../../api/busquedas.api.js";
import { serializeTablaKitAntiderrames } from "../../utils/plantillaRenderer.js";

const DIAS = [
  { key: "LUNES", label: "Lunes" },
  { key: "MARTES", label: "Martes" },
  { key: "MIERCOLES", label: "Miércoles" },
  { key: "JUEVES", label: "Jueves" },
  { key: "VIERNES", label: "Viernes" },
  { key: "SABADO", label: "Sábado" },
  { key: "DOMINGO", label: "Domingo" },
];

const ESTADO_OPTIONS = ["", "BUENO", "MALO", "NA"];

function emptyDiaMeta() {
  return { fecha: "", realizado_por: null, realizado_por_text: "", cargo: "", firma: "" };
}

function emptyCell() {
  return {
    estado: "",
    observacion: "",
    accion: { que: "", quien: "", cuando: "" },
  };
}

function createEmptyRow(idx, material) {
  const checks = {};
  DIAS.forEach((d) => (checks[d.key] = emptyCell()));
  return {
    rowIndex: idx + 1,
    item_ref: material?.item_ref ?? `m${idx + 1}`,
    material: material?.material ?? "",
    cantidad: "",
    unidad: material?.unidad ?? "",
    checks,
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

export default function TablaKitAntiderramesForm({ definicion, initial = null, onSubmit }) {
  const materials = definicion?.materials || [];
  const [meta, setMeta] = useState(() => {
    // meta por día (fecha/realizado/firma)
    const m = {};
    DIAS.forEach((d) => (m[d.key] = emptyDiaMeta()));
    return { dias: m };
  });

  const [rows, setRows] = useState(() => {
    const base = materials.length
      ? materials.map((mat, idx) => createEmptyRow(idx, mat))
      : Array.from({ length: 9 }, (_, i) => createEmptyRow(i, { item_ref: `m${i + 1}`, material: "", unidad: "" }));

    // si viene initial (cuando edita/recarga)
    if (!initial?.rows) return base;

    const byRef = new Map((initial.rows || []).map((r) => [String(r.item_ref), r]));
    return base.map((b) => {
      const inc = byRef.get(String(b.item_ref));
      if (!inc) return b;
      return {
        ...b,
        ...inc,
        checks: { ...b.checks, ...(inc.checks || {}) },
      };
    });
  });

  const [searching, setSearching] = useState(false);
  const [empOptions, setEmpOptions] = useState([]);
  const [errors, setErrors] = useState({});

  const filled = useMemo(() => {
    // cuenta celdas con estado marcado
    let n = 0;
    for (const r of rows) {
      for (const d of DIAS) {
        if (String(r.checks?.[d.key]?.estado || "").trim()) n++;
      }
    }
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

  function updateMetaDia(diaKey, patch) {
    setMeta((prev) => ({
      ...prev,
      dias: { ...(prev.dias || {}), [diaKey]: { ...(prev.dias?.[diaKey] || emptyDiaMeta()), ...patch } },
    }));
  }

  function updateRow(idx, patch) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function updateCell(rowIdx, diaKey, patch) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== rowIdx) return r;
        const curr = r.checks?.[diaKey] || emptyCell();
        const nextCell = { ...curr, ...patch };

        // si cambia a no MALO, limpia obs/accion
        if (!hasMaloCell(nextCell)) {
          nextCell.observacion = "";
          nextCell.accion = { que: "", quien: "", cuando: "" };
        }

        return { ...r, checks: { ...(r.checks || {}), [diaKey]: nextCell } };
      })
    );
  }

  function validateAll() {
    const next = {};

    rows.forEach((r, rowIdx) => {
      DIAS.forEach((d) => {
        const cell = r.checks?.[d.key] || emptyCell();
        const msg = validateCell(cell);
        if (msg) next[`r${rowIdx}:${d.key}`] = msg;
      });
    });

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validateAll()) return;

    onSubmit?.({
      tipo: "tabla_kit_antiderrames",
      respuestas: serializeTablaKitAntiderrames({ meta, rows }),
      resumen: { celdas_marcadas: filled, filas: rows.length },
      meta,
      rows,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="ins-form">
      <div className="ins-header">
        <div>
          <div className="ins-title">Inspección de Kit Antiderrames</div>
          <div className="ins-sub">
            FOR-035. Si marcas un estado como MALO, se exige Observación + Plan de acción (Qué / Quién / Cuándo).
          </div>
        </div>
        <div className="ins-progress">
          <span>{filled} celdas con estado</span>
          <Button type="submit">Guardar</Button>
        </div>
      </div>

      {/* Cabecera por día */}
      <div className="ins-section" style={{ overflowX: "auto" }}>
        <table className="table" style={{ minWidth: 1300 }}>
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th style={{ minWidth: 260 }}>Material</th>
              <th style={{ width: 110 }}>Cantidad</th>
              <th style={{ width: 90 }}>Unidad</th>
              {DIAS.map((d) => (
                <th key={d.key} style={{ minWidth: 220 }}>{d.label}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* Fila de FECHA */}
            <tr>
              <td colSpan={4} style={{ fontWeight: 900 }}>Fecha</td>
              {DIAS.map((d) => (
                <td key={`fecha-${d.key}`}>
                  <input
                    type="date"
                    className="ins-input"
                    value={meta.dias?.[d.key]?.fecha || ""}
                    onChange={(e) => updateMetaDia(d.key, { fecha: e.target.value })}
                  />
                </td>
              ))}
            </tr>

            {/* Fila de REALIZADO POR (autocomplete) */}
            <tr>
              <td colSpan={4} style={{ fontWeight: 900 }}>Realizado por</td>
              {DIAS.map((d) => {
                const dia = meta.dias?.[d.key] || emptyDiaMeta();
                return (
                  <td key={`rp-${d.key}`}>
                    <Autocomplete
                      placeholder="DNI / Apellido / Nombre"
                      displayValue={dia.realizado_por_text || ""}
                      options={empOptions}
                      loading={searching}
                      getOptionLabel={(it) => `${it?.apellidos ?? ""} ${it?.nombres ?? ""}`.trim() || it?.dni}
                      onInputChange={async (text) => {
                        updateMetaDia(d.key, { realizado_por_text: text, realizado_por: null, cargo: "" });
                        const opts = await buscarEmpleadosForAutocomplete(text);
                        setEmpOptions(opts);
                      }}
                      onSelect={(it) => {
                        const full = `${it?.apellidos ?? ""} ${it?.nombres ?? ""}`.trim();
                        updateMetaDia(d.key, {
                          realizado_por: it,
                          realizado_por_text: full,
                          cargo: it?.cargo ?? it?.desc_cargo ?? "",
                        });
                      }}
                    />
                    {dia.cargo ? <div className="help">Cargo: <b>{dia.cargo}</b></div> : null}
                  </td>
                );
              })}
            </tr>

            {/* Fila de FIRMA (texto simple) */}
            <tr>
              <td colSpan={4} style={{ fontWeight: 900 }}>Firma</td>
              {DIAS.map((d) => (
                <td key={`firma-${d.key}`}>
                  <input
                    className="ins-input"
                    value={meta.dias?.[d.key]?.firma || ""}
                    onChange={(e) => updateMetaDia(d.key, { firma: e.target.value })}
                    placeholder="Nombre / ruta firma"
                  />
                </td>
              ))}
            </tr>

            {/* Materiales */}
            {rows.map((row, idx) => (
              <>
                <tr key={`row-${row.item_ref}`}>
                  <td>{row.rowIndex}</td>
                  <td>
                    <input
                      className="ins-input"
                      value={row.material}
                      onChange={(e) => updateRow(idx, { material: e.target.value })}
                      placeholder="Material"
                    />
                  </td>
                  <td>
                    <input
                      className="ins-input"
                      value={row.cantidad}
                      onChange={(e) => updateRow(idx, { cantidad: e.target.value })}
                      placeholder="Cantidad"
                    />
                  </td>
                  <td>
                    <input
                      className="ins-input"
                      value={row.unidad}
                      onChange={(e) => updateRow(idx, { unidad: e.target.value })}
                      placeholder="Unidad"
                    />
                  </td>

                  {DIAS.map((d) => (
                    <td key={`${row.item_ref}-${d.key}`}>
                      <select
                        className="ins-input"
                        value={row.checks?.[d.key]?.estado || ""}
                        onChange={(e) => updateCell(idx, d.key, { estado: e.target.value })}
                      >
                        {ESTADO_OPTIONS.map((opt) => (
                          <option key={opt || "empty"} value={opt}>
                            {opt || "-"}
                          </option>
                        ))}
                      </select>

                      {/* Inline form cuando MALO */}
                      {hasMaloCell(row.checks?.[d.key]) ? (
                        <div style={{ marginTop: 10, padding: 10, border: "1px solid #f3c6c6", borderRadius: 12, background: "#fff5f5" }}>
                          <div style={{ fontWeight: 900, color: "#b91c1c" }}>Observación (obligatoria)</div>
                          <textarea
                            className="ins-note-input"
                            rows={2}
                            value={row.checks?.[d.key]?.observacion || ""}
                            onChange={(e) => updateCell(idx, d.key, { observacion: e.target.value })}
                            placeholder="Detalla observaciones y medidas correctivas..."
                          />

                          <div style={{ marginTop: 10, fontWeight: 900 }}>Plan de acción (obligatorio)</div>

                          <div className="ins-grid">
                            <label className="ins-field">
                              <span>Qué</span>
                              <input
                                className="ins-input"
                                value={row.checks?.[d.key]?.accion?.que || ""}
                                onChange={(e) => updateCell(idx, d.key, { accion: { ...(row.checks?.[d.key]?.accion || {}), que: e.target.value } })}
                              />
                            </label>

                            <label className="ins-field">
                              <span>Quién</span>
                              <input
                                className="ins-input"
                                value={row.checks?.[d.key]?.accion?.quien || ""}
                                onChange={(e) => updateCell(idx, d.key, { accion: { ...(row.checks?.[d.key]?.accion || {}), quien: e.target.value } })}
                              />
                            </label>

                            <label className="ins-field">
                              <span>Cuándo</span>
                              <input
                                type="date"
                                className="ins-input"
                                value={row.checks?.[d.key]?.accion?.cuando || ""}
                                onChange={(e) => updateCell(idx, d.key, { accion: { ...(row.checks?.[d.key]?.accion || {}), cuando: e.target.value } })}
                              />
                            </label>
                          </div>

                          {errors[`r${idx}:${d.key}`] ? (
                            <div className="ins-error" style={{ marginTop: 8 }}>{errors[`r${idx}:${d.key}`]}</div>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                  ))}
                </tr>
              </>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}