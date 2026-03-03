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
  // firma: ahora será URL/ruta de imagen (foto firma)
  return { fecha: "", realizado_por: null, realizado_por_text: "", cargo: "", firma: "" };
}

function emptyCell() {
  return {
    estado: "",
    observacion: "",
    accion: { que: "", quien: "", quien_dni: "", cuando: "" },
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

// Igual estilo que cabecera: Nombre (DNI) — cargo
function getEmpleadoLabel(e) {
  const nom = `${e?.apellidos ?? ""} ${e?.nombres ?? ""}`.trim();
  const dni = e?.dni ? `(${e.dni})` : "";
  const cargo = e?.cargo ? `— ${e.cargo}` : e?.desc_cargo ? `— ${e.desc_cargo}` : "";
  return `${nom} ${dni} ${cargo}`.trim();
}

function getEmpleadoFullName(e) {
  return `${e?.apellidos ?? ""} ${e?.nombres ?? ""}`.trim() || e?.dni || "";
}

function getFirmaFromEmpleado(e) {
  // soporta vista empleado o usuario
  return e?.firma_ruta || e?.firma_path || e?.ruta_firma || "";
}

function normalizeRowIndexes(list) {
  return (Array.isArray(list) ? list : []).map((r, i) => ({
    ...r,
    rowIndex: i + 1,
    item_ref: r?.item_ref || `row_${i + 1}`,
  }));
}

export default function TablaKitAntiderramesForm({ definicion, initial = null, onSubmit }) {
  const materials = definicion?.materials || [];
  const [meta, setMeta] = useState(() => {
    const m = {};
    DIAS.forEach((d) => (m[d.key] = emptyDiaMeta()));
    return { dias: m };
  });

  const [rows, setRows] = useState(() => {
    const base = materials.length
      ? materials.map((mat, idx) => createEmptyRow(idx, mat))
      : Array.from({ length: 9 }, (_, i) =>
          createEmptyRow(i, { item_ref: `m${i + 1}`, material: "", unidad: "" })
        );

    if (!initial?.rows) return base;

    const byRef = new Map((initial.rows || []).map((r) => [String(r.item_ref), r]));
    const merged = base.map((b) => {
      const inc = byRef.get(String(b.item_ref));
      if (!inc) return b;
      return {
        ...b,
        ...inc,
        checks: { ...b.checks, ...(inc.checks || {}) },
      };
    });

    // Si había filas extra (creadas por el usuario antes), las añadimos también
    const baseRefs = new Set(base.map((x) => String(x.item_ref)));
    const extra = (initial.rows || []).filter((r) => !baseRefs.has(String(r.item_ref)));
    const out = [...merged, ...extra];
    return normalizeRowIndexes(out);
  });

  const [searching, setSearching] = useState(false);
  const [empOptions, setEmpOptions] = useState([]);
  const [errors, setErrors] = useState({});

  const filled = useMemo(() => {
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
    // en cabecera dejan buscar con vacío también; aquí mantenemos mínimo 1 char
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
      dias: {
        ...(prev.dias || {}),
        [diaKey]: { ...(prev.dias?.[diaKey] || emptyDiaMeta()), ...patch },
      },
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

        // Si cambia a no MALO, limpia obs/accion
        if (!hasMaloCell(nextCell)) {
          nextCell.observacion = "";
          nextCell.accion = { que: "", quien: "", quien_dni: "", cuando: "" };
        } else {
          // Si falta estructura
          if (!nextCell.accion || typeof nextCell.accion !== "object") {
            nextCell.accion = { que: "", quien: "", quien_dni: "", cuando: "" };
          } else {
            nextCell.accion = {
              que: nextCell.accion.que ?? "",
              quien: nextCell.accion.quien ?? "",
              quien_dni: nextCell.accion.quien_dni ?? "",
              cuando: nextCell.accion.cuando ?? "",
            };
          }
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

  function handleAddRow() {
    setRows((prev) => {
      const idx = prev.length;
      const uniqueRef = `custom_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const newRow = createEmptyRow(idx, { item_ref: uniqueRef, material: "", unidad: "" });
      return normalizeRowIndexes([...(prev || []), newRow]);
    });
  }

  function handleDeleteRow(rowIdx) {
    const r = rows?.[rowIdx];
    const name = r?.material || `Fila ${rowIdx + 1}`;
    const ok = window.confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`);
    if (!ok) return;

    setRows((prev) => normalizeRowIndexes((prev || []).filter((_, i) => i !== rowIdx)));

    // Limpia errores asociados
    setErrors((prevErr) => {
      const next = { ...(prevErr || {}) };
      Object.keys(next).forEach((k) => {
        if (k.startsWith(`r${rowIdx}:`)) delete next[k];
      });
      return next;
    });
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

      <div className="ins-section" style={{ overflowX: "auto" }}>
        <table className="table" style={{ minWidth: 1400 }}>
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th style={{ minWidth: 260 }}>Material</th>
              <th style={{ width: 110 }}>Cantidad</th>
              <th style={{ width: 90 }}>Unidad</th>
              {DIAS.map((d) => (
                <th key={d.key} style={{ minWidth: 220 }}>
                  {d.label}
                </th>
              ))}
              {/* Columna nueva: eliminar fila */}
              <th style={{ width: 70, textAlign: "center" }}> </th>
            </tr>
          </thead>

          <tbody>
            {/* Fila de FECHA */}
            <tr>
              <td colSpan={4} style={{ fontWeight: 900 }}>
                Fecha
              </td>
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
              <td />
            </tr>

            {/* Fila de REALIZADO POR (autocomplete) */}
            <tr>
              <td colSpan={4} style={{ fontWeight: 900 }}>
                Realizado por
              </td>
              {DIAS.map((d) => {
                const dia = meta.dias?.[d.key] || emptyDiaMeta();
                return (
                  <td key={`rp-${d.key}`}>
                    <Autocomplete
                      placeholder="DNI / Apellido / Nombre"
                      displayValue={dia.realizado_por_text || ""}
                      options={empOptions}
                      loading={searching}
                      getOptionLabel={getEmpleadoLabel}
                      onInputChange={async (text) => {
                        updateMetaDia(d.key, { realizado_por_text: text, realizado_por: null, cargo: "", firma: "" });
                        const opts = await buscarEmpleadosForAutocomplete(text);
                        setEmpOptions(opts);
                      }}
                      onSelect={(it) => {
                        const full = getEmpleadoFullName(it);
                        updateMetaDia(d.key, {
                          realizado_por: it,
                          realizado_por_text: full,
                          cargo: it?.cargo ?? it?.desc_cargo ?? "",
                          firma: getFirmaFromEmpleado(it) || "",
                        });
                      }}
                    />
                    {dia.cargo ? (
                      <div className="help">
                        Cargo: <b>{dia.cargo}</b>
                      </div>
                    ) : null}
                  </td>
                );
              })}
              <td />
            </tr>

            {/* Fila de FIRMA (foto perfil) */}
            <tr>
              <td colSpan={4} style={{ fontWeight: 900 }}>
                Firma
              </td>

              {DIAS.map((d) => {
                const dia = meta.dias?.[d.key] || emptyDiaMeta();
                const src = dia?.firma || "";
                return (
                  <td key={`firma-${d.key}`}>
                    {src ? (
                      <div
                        style={{
                          width: "100%",
                          display: "grid",
                          placeItems: "center",
                          padding: 6,
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          background: "#fff",
                        }}
                      >
                        <img
                          src={src}
                          alt="firma"
                          style={{
                            maxWidth: "100%",
                            height: 64,
                            objectFit: "contain",
                            display: "block",
                          }}
                          onError={(e) => {
                            // si la ruta no carga, lo dejamos vacío visualmente
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          height: 74,
                          border: "1px dashed var(--border)",
                          borderRadius: 12,
                          background: "#fff",
                        }}
                      />
                    )}
                  </td>
                );
              })}
              <td />
            </tr>

            {/* Materiales */}
            {rows.map((row, idx) => (
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

                    {hasMaloCell(row.checks?.[d.key]) ? (
                      <div
                        style={{
                          marginTop: 10,
                          padding: 10,
                          border: "1px solid #f3c6c6",
                          borderRadius: 12,
                          background: "#fff5f5",
                        }}
                      >
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
                              onChange={(e) =>
                                updateCell(idx, d.key, {
                                  accion: { ...(row.checks?.[d.key]?.accion || {}), que: e.target.value },
                                })
                              }
                            />
                          </label>

                          <label className="ins-field">
                            <span>Quién</span>
                            <Autocomplete
                              placeholder="DNI / Apellido / Nombre"
                              displayValue={row.checks?.[d.key]?.accion?.quien || ""}
                              options={empOptions}
                              loading={searching}
                              getOptionLabel={getEmpleadoLabel}
                              onInputChange={async (text) => {
                                updateCell(idx, d.key, {
                                  accion: {
                                    ...(row.checks?.[d.key]?.accion || {}),
                                    quien: text,
                                    quien_dni: "",
                                  },
                                });
                                const opts = await buscarEmpleadosForAutocomplete(text);
                                setEmpOptions(opts);
                              }}
                              onSelect={(it) => {
                                const nombre = getEmpleadoFullName(it);
                                const dni = String(it?.dni ?? "").trim();
                                updateCell(idx, d.key, {
                                  accion: {
                                    ...(row.checks?.[d.key]?.accion || {}),
                                    quien: nombre,
                                    quien_dni: dni,
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
                              value={row.checks?.[d.key]?.accion?.cuando || ""}
                              onChange={(e) =>
                                updateCell(idx, d.key, {
                                  accion: { ...(row.checks?.[d.key]?.accion || {}), cuando: e.target.value },
                                })
                              }
                            />
                          </label>
                        </div>

                        {errors[`r${idx}:${d.key}`] ? (
                          <div className="ins-error" style={{ marginTop: 8 }}>
                            {errors[`r${idx}:${d.key}`]}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                ))}

                <td style={{ textAlign: "center" }}>
                  <button
                    type="button"
                    title="Eliminar fila"
                    onClick={() => handleDeleteRow(idx)}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "#fff",
                      cursor: "pointer",
                      fontSize: 16,
                      lineHeight: "16px",
                    }}
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
          <Button type="button" onClick={handleAddRow}>
            + Agregar fila
          </Button>
        </div>
      </div>
    </form>
  );
}