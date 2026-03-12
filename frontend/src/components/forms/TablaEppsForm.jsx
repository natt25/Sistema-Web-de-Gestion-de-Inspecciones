import { useMemo, useState, useEffect } from "react";
import Button from "../ui/Button.jsx";
import Autocomplete from "../ui/Autocomplete.jsx";
import { buscarEmpleados } from "../../api/busquedas.api.js";
import { serializeTablaEppsRows } from "../../utils/plantillaRenderer.js";

const BASE_EPP_COLUMNS = [
  { key: "casco", label: "CASCO" },
  { key: "lentes_luna_clara", label: "LENTES LUNA CLARA" },
  { key: "lentes_luna_oscura", label: "LENTES LUNA OSCURA" },
  { key: "zapatos_seguridad", label: "ZAPATOS SEGURIDAD" },
  { key: "chaleco_seguridad", label: "CHALECO SEGURIDAD" },
  { key: "tapones_oido", label: "TAPONES OIDO" },
  { key: "orejeras", label: "OREJERAS" },
  { key: "guantes_anticorte", label: "GUANTES ANTICORTE" },
  { key: "guantes_antiimpacto", label: "GUANTES ANTIIMPACTO" },
  { key: "respirador_media_cara", label: "RESPIRADOR MEDIA CARA" },
  { key: "filtros", label: "FILTROS" },
  { key: "barbiquejo", label: "BARBIQUEJO" },
  { key: "mascarilla_n95", label: "MASCARILLA N95" },
];

const ESTADO_OPTIONS = ["", "BUENO", "MALO", "NA"];
const DEFAULT_ROWS = 5;
const DEFAULT_OTROS_COLUMNS = [
  { key: "otros_1", label: "OTROS 1" },
  { key: "otros_2", label: "OTROS 2" },
];

function emptyAccion() {
  return { que: "", quien: "", quien_dni: "", cuando: "" };
}

function emptyCell() {
  return { estado: "", observacion: "", accion: emptyAccion() };
}

function normalizeCell(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return {
      estado: String(value?.estado || "").toUpperCase(),
      observacion: String(value?.observacion || value?.observaciones || ""),
      accion: {
        que: String(value?.accion?.que || ""),
        quien: String(value?.accion?.quien || ""),
        quien_dni: String(value?.accion?.quien_dni || ""),
        cuando: String(value?.accion?.cuando || ""),
      },
    };
  }

  if (typeof value === "string") {
    return { ...emptyCell(), estado: String(value || "").toUpperCase() };
  }

  return emptyCell();
}

function isOtrosColumnKey(key) {
  return String(key || "").startsWith("otros_");
}

function getOtrosColumnNumber(key) {
  return Number(String(key || "").replace("otros_", "")) || 0;
}

function isRemovableOtrosColumn(key) {
  return isOtrosColumnKey(key) && getOtrosColumnNumber(key) > 0;
}

function normalizeColumns(columns) {
  return (Array.isArray(columns) ? columns : [])
    .map((col, idx) => {
      const key = String(col?.key || "").trim();
      if (!key) return null;
      const fallbackLabel = isOtrosColumnKey(key) ? `OTROS ${idx + 1}` : key;
      return {
        key,
        label: String(col?.label || fallbackLabel).trim() || fallbackLabel,
      };
    })
    .filter(Boolean);
}

function buildOtrosColumnsFromRows(rows) {
  const rowList = Array.isArray(rows) ? rows : [];
  const fromMeta = rowList.find((row) => Array.isArray(row?.columns))?.columns || [];
  const fromMetaOtros = normalizeColumns(fromMeta).filter((col) => isOtrosColumnKey(col.key));
  if (fromMetaOtros.length) return fromMetaOtros;

  const dynamicKeys = new Set();
  rowList.forEach((row) => {
    Object.keys(row?.epps || {}).forEach((key) => {
      if (isOtrosColumnKey(key)) dynamicKeys.add(key);
    });
  });

  if (!dynamicKeys.size) return DEFAULT_OTROS_COLUMNS;

  return Array.from(dynamicKeys)
    .sort((a, b) => {
      const left = Number(String(a).replace("otros_", "")) || 0;
      const right = Number(String(b).replace("otros_", "")) || 0;
      return left - right;
    })
    .map((key, idx) => ({ key, label: `OTROS ${idx + 1}` }));
}

function createEmptyEpps(columns) {
  return columns.reduce((acc, c) => {
    acc[c.key] = emptyCell();
    return acc;
  }, {});
}

function createEmptyRow(index, columns) {
  return {
    rowIndex: index,
    empleado: null,
    apellidos_nombres: "",
    puesto_trabajo: "",
    epps: createEmptyEpps(columns),
  };
}

function cellHasAnyData(cell) {
  const normalized = normalizeCell(cell);
  if (String(normalized.estado || "").trim()) return true;
  if (String(normalized.observacion || "").trim()) return true;
  if (String(normalized.accion?.que || "").trim()) return true;
  if (String(normalized.accion?.quien || "").trim()) return true;
  if (String(normalized.accion?.quien_dni || "").trim()) return true;
  if (String(normalized.accion?.cuando || "").trim()) return true;
  return false;
}

function rowHasAnyData(row) {
  if (!row) return false;
  if (String(row.apellidos_nombres || "").trim()) return true;
  if (String(row.puesto_trabajo || "").trim()) return true;
  if (Object.values(row.epps || {}).some((cell) => cellHasAnyData(cell))) return true;
  return false;
}

function isMaloCell(cell) {
  return String(cell?.estado || "").toUpperCase() === "MALO";
}

function buildEmpleadoNombreCompleto(emp) {
  if (!emp) return "";

  const apellidoPaterno = String(emp?.apellido_paterno ?? "").trim();
  const apellidoMaterno = String(emp?.apellido_materno ?? "").trim();
  const apellidos = String(emp?.apellidos ?? emp?.apellido ?? "").trim();
  const nombres = String(emp?.nombres ?? emp?.nombre ?? "").trim();
  const full = String(emp?.apellidos_nombres ?? emp?.label ?? emp?.nombreCompleto ?? "").trim();

  return (
    [apellidoPaterno, apellidoMaterno, nombres].filter(Boolean).join(" ").trim() ||
    [apellidos, nombres].filter(Boolean).join(" ").trim() ||
    full
  );
}

function buildEmpleadoOptionLabel(emp) {
  const dni = String(emp?.dni ?? "").trim();
  const nombreCompleto = buildEmpleadoNombreCompleto(emp);
  return dni ? `${dni} - ${nombreCompleto}`.trim() : nombreCompleto;
}

function extractCargo(emp) {
  return emp?.cargo || emp?.desc_cargo || emp?.nombre_cargo || emp?.puesto || emp?.desc_puesto || "";
}

function getEppTone(value) {
  const estado = String(value || "").trim().toUpperCase();
  if (estado === "BUENO") {
    return {
      background: "#ecfdf3",
      borderColor: "#34d399",
      color: "#065f46",
      fontWeight: 800,
    };
  }
  if (estado === "MALO") {
    return {
      background: "#fef2f2",
      borderColor: "#f87171",
      color: "#991b1b",
      fontWeight: 900,
      boxShadow: "0 0 0 3px rgba(248,113,113,.14)",
    };
  }
  if (estado === "NA") {
    return {
      background: "#f3f4f6",
      borderColor: "#9ca3af",
      color: "#374151",
      fontWeight: 700,
    };
  }
  return null;
}

function mapInitialRows(rows, columns) {
  const n = Array.isArray(rows) && rows.length ? rows.length : DEFAULT_ROWS;
  const base = Array.from({ length: n }, (_, i) => createEmptyRow(i + 1, columns));

  if (!Array.isArray(rows) || rows.length === 0) return base;

  return base.map((blank, idx) => {
    const incoming = rows[idx] || {};
    const epps = createEmptyEpps(columns);

    columns.forEach((col) => {
      epps[col.key] = normalizeCell(incoming?.epps?.[col.key]);
    });

    return {
      ...blank,
      ...incoming,
      rowIndex: idx + 1,
      epps,
    };
  });
}

function getCellError(errors, idx, colKey, field) {
  return errors[`row:${idx}:col:${colKey}:${field}`];
}

export default function TablaEppsForm({ onSubmit, initialRows = [] }) {
  const [otrosColumns, setOtrosColumns] = useState(() => buildOtrosColumnsFromRows(initialRows));
  const eppColumns = useMemo(() => [...BASE_EPP_COLUMNS, ...otrosColumns], [otrosColumns]);
  const [rows, setRows] = useState(() => mapInitialRows(initialRows, [...BASE_EPP_COLUMNS, ...buildOtrosColumnsFromRows(initialRows)]));
  const [errors, setErrors] = useState({});

  const [empOpenIdx, setEmpOpenIdx] = useState(null);
  const [empQuery, setEmpQuery] = useState("");
  const [empOptions, setEmpOptions] = useState([]);
  const [empLoading, setEmpLoading] = useState(false);

  const [whoOpenCell, setWhoOpenCell] = useState(null);
  const [whoQuery, setWhoQuery] = useState("");
  const [whoOptions, setWhoOptions] = useState([]);
  const [whoLoading, setWhoLoading] = useState(false);

  const filled = useMemo(() => rows.filter((r) => rowHasAnyData(r)).length, [rows]);

  function addOtrosColumn() {
    setOtrosColumns((prev) => {
      const maxId = prev.reduce((max, col) => {
        const current = Number(String(col.key).replace("otros_", "")) || 0;
        return Math.max(max, current);
      }, 0);
      const id = maxId + 1;
      const key = `otros_${id}`;
      const next = [...prev, { key, label: `OTROS ${id}` }];

      setRows((currentRows) =>
        currentRows.map((row) => ({
          ...row,
          epps: {
            ...(row.epps || {}),
            [key]: emptyCell(),
          },
        }))
      );

      return next;
    });
  }

  function updateOtrosColumnLabel(key, label) {
    setOtrosColumns((prev) =>
      prev.map((col) => (col.key === key ? { ...col, label: String(label || "") } : col))
    );
  }

  function removeOtrosColumn(key) {
    if (!isRemovableOtrosColumn(key)) return;

    setOtrosColumns((prev) => prev.filter((col) => col.key !== key));
    setRows((prev) =>
      prev.map((row) => {
        const nextEpps = { ...(row.epps || {}) };
        delete nextEpps[key];
        return { ...row, epps: nextEpps };
      })
    );
    setErrors((prev) => {
      const next = {};
      Object.entries(prev).forEach(([errorKey, value]) => {
        if (!errorKey.includes(`:col:${key}:`)) next[errorKey] = value;
      });
      return next;
    });
    if (whoOpenCell && String(whoOpenCell).endsWith(`:${key}`)) {
      setWhoOpenCell(null);
      setWhoQuery("");
      setWhoOptions([]);
      setWhoLoading(false);
    }
  }

  function reindexRows(next) {
    return next.map((r, i) => ({ ...r, rowIndex: i + 1 }));
  }

  function updateRow(idx, patch) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function updateCell(idx, key, patch) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;

        const current = normalizeCell(r?.epps?.[key]);
        const nextCell = {
          ...current,
          ...patch,
          accion: {
            ...current.accion,
            ...(patch?.accion || {}),
          },
        };

        if (!isMaloCell(nextCell)) {
          nextCell.observacion = "";
          nextCell.accion = emptyAccion();
        }

        return {
          ...r,
          epps: {
            ...(r.epps || {}),
            [key]: nextCell,
          },
        };
      })
    );
  }

  function updateEstado(idx, key, value) {
    updateCell(idx, key, { estado: String(value || "").toUpperCase() });
  }

  function addRow() {
    setRows((prev) => reindexRows([...prev, createEmptyRow(prev.length + 1, eppColumns)]));
  }

  function removeRow(idx) {
    setRows((prev) => {
      const row = prev[idx];
      if (rowHasAnyData(row)) {
        const ok = window.confirm("La fila tiene datos. ¿Deseas eliminarla?");
        if (!ok) return prev;
      }
      return reindexRows(prev.filter((_, i) => i !== idx));
    });
  }

  function validateAll() {
    const nextErrors = {};

    rows.forEach((row, idx) => {
      if (!rowHasAnyData(row)) return;

      eppColumns.forEach((col) => {
        const cell = normalizeCell(row?.epps?.[col.key]);
        if (!isMaloCell(cell)) return;

        if (!String(cell.observacion || "").trim()) {
          nextErrors[`row:${idx}:col:${col.key}:obs`] = "Observación obligatoria cuando la celda está en MALO.";
        }
        if (!String(cell.accion?.que || "").trim()) {
          nextErrors[`row:${idx}:col:${col.key}:que`] = "Acción (qué) obligatoria cuando la celda está en MALO.";
        }
        if (!String(cell.accion?.quien || "").trim()) {
          nextErrors[`row:${idx}:col:${col.key}:quien`] = "Acción (quién) obligatoria cuando la celda está en MALO.";
        }
        if (!String(cell.accion?.cuando || "").trim()) {
          nextErrors[`row:${idx}:col:${col.key}:cuando`] = "Acción (cuándo) obligatoria cuando la celda está en MALO.";
        }
      });
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validateAll()) return;

    onSubmit?.({
      tipo: "tabla_epps",
      respuestas: serializeTablaEppsRows(rows, eppColumns),
      resumen: { total: rows.length, respondidas: filled },
      rows,
    });
  }

  useEffect(() => {
    if (empOpenIdx == null) return;

    const q = String(empQuery || "").trim();
    if (!q) {
      setEmpOptions([]);
      setEmpLoading(false);
      return;
    }

    let alive = true;
    setEmpLoading(true);

    const t = setTimeout(async () => {
      try {
        const list = await buscarEmpleados(q);
        if (!alive) return;
        setEmpOptions(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!alive) return;
        console.error("[TablaEppsForm] buscarEmpleados error", err);
        setEmpOptions([]);
      } finally {
        if (alive) setEmpLoading(false);
      }
    }, 250);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [empQuery, empOpenIdx]);

  useEffect(() => {
    if (!whoOpenCell) return;

    const q = String(whoQuery || "").trim();
    if (!q) {
      setWhoOptions([]);
      setWhoLoading(false);
      return;
    }

    let alive = true;
    setWhoLoading(true);

    const t = setTimeout(async () => {
      try {
        const list = await buscarEmpleados(q);
        if (!alive) return;
        setWhoOptions(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!alive) return;
        console.error("[TablaEppsForm] buscarEmpleados(quien) error", err);
        setWhoOptions([]);
      } finally {
        if (alive) setWhoLoading(false);
      }
    }, 250);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [whoQuery, whoOpenCell]);

  return (
    <form onSubmit={handleSubmit} className="ins-form">
      <div className="ins-header">
        <div>
          <div className="ins-title">Inspección de EPPs</div>
          <div className="ins-sub">
            FOR-033. Cada celda marcada como MALO exige su propia observación y plan de acción.
          </div>
        </div>
        <div className="ins-progress">
          <span>
            {filled}/{rows.length} filas con datos
          </span>
          <Button type="submit">Guardar</Button>
        </div>
      </div>

      <div className="ins-section" style={{ overflowX: "auto" }}>
        <table className="table" style={{ minWidth: 1900 }}>
          <thead>
            <tr>
              <th>N</th>
              <th style={{ minWidth: 280 }}>Apellidos y Nombres</th>
              <th style={{ minWidth: 180 }}>Puesto de Trabajo</th>
              {eppColumns.map((c) => (
                <th key={c.key} style={{ minWidth: 240 }}>
                  {isOtrosColumnKey(c.key) ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      <input
                        className="ins-input"
                        value={c.label}
                        onChange={(e) => updateOtrosColumnLabel(c.key, e.target.value)}
                        placeholder="OTROS"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => removeOtrosColumn(c.key)}
                        disabled={!isRemovableOtrosColumn(c.key)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
              <th style={{ width: 70 }}></th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, idx) => (
              <FragmentRow
                key={row.rowIndex}
                row={row}
                idx={idx}
                updateRow={updateRow}
                updateCell={updateCell}
                updateEstado={updateEstado}
                errors={errors}
                removeRow={removeRow}
                empOpenIdx={empOpenIdx}
                setEmpOpenIdx={setEmpOpenIdx}
                empQuery={empQuery}
                setEmpQuery={setEmpQuery}
                empOptions={empOptions}
                empLoading={empLoading}
                columns={eppColumns}
                whoOpenCell={whoOpenCell}
                setWhoOpenCell={setWhoOpenCell}
                whoQuery={whoQuery}
                setWhoQuery={setWhoQuery}
                whoOptions={whoOptions}
                whoLoading={whoLoading}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Button type="button" variant="secondary" onClick={addRow}>
            + Agregar trabajador
          </Button>
          <Button type="button" variant="secondary" onClick={addOtrosColumn}>
            + Agregar columna
          </Button>
        </div>
        <div style={{ color: "var(--muted)", fontSize: 12 }}>
          Tip: Escribe DNI / apellido / nombre para seleccionar al trabajador.
        </div>
      </div>
    </form>
  );
}

function FragmentRow({
  row,
  idx,
  updateRow,
  updateCell,
  updateEstado,
  errors,
  removeRow,
  empOpenIdx,
  setEmpOpenIdx,
  empQuery,
  setEmpQuery,
  empOptions,
  empLoading,
  columns,
  whoOpenCell,
  setWhoOpenCell,
  whoQuery,
  setWhoQuery,
  whoOptions,
  whoLoading,
}) {
  return (
    <tr>
      <td style={{ verticalAlign: "top" }}>{row.rowIndex}</td>

      <td style={{ verticalAlign: "top" }}>
        <Autocomplete
          placeholder="DNI / Apellido / Nombre"
          displayValue={row.apellidos_nombres}
          options={empOpenIdx === idx ? empOptions : []}
          loading={empOpenIdx === idx ? empLoading : false}
          getOptionLabel={buildEmpleadoOptionLabel}
          onFocus={() => {
            setEmpOpenIdx(idx);
            setEmpQuery(row.apellidos_nombres || "");
          }}
          onInputChange={(txt) => {
            setEmpOpenIdx(idx);
            setEmpQuery(txt);
            updateRow(idx, { apellidos_nombres: txt, empleado: null });
          }}
          onSelect={(emp) => {
            const label = buildEmpleadoNombreCompleto(emp);
            const cargo = extractCargo(emp);
            updateRow(idx, {
              empleado: emp,
              apellidos_nombres: label,
              puesto_trabajo: cargo || row.puesto_trabajo || "",
            });
          }}
        />
      </td>

      <td style={{ verticalAlign: "top" }}>
        <input
          className="ins-input"
          value={row.puesto_trabajo}
          onChange={(e) => updateRow(idx, { puesto_trabajo: e.target.value })}
          placeholder="Puesto"
        />
      </td>

      {columns.map((c) => {
        const cell = normalizeCell(row?.epps?.[c.key]);
        const malo = isMaloCell(cell);
        const whoCellKey = `${idx}:${c.key}`;

        return (
          <td key={`${row.rowIndex}-${c.key}`} style={{ verticalAlign: "top" }}>
            <select
              className="ins-input"
              value={cell.estado || ""}
              onChange={(e) => updateEstado(idx, c.key, e.target.value)}
              style={getEppTone(cell.estado) || undefined}
            >
              {ESTADO_OPTIONS.map((opt) => (
                <option key={opt || "empty"} value={opt}>
                  {opt || "-"}
                </option>
              ))}
            </select>

            {malo ? (
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
                  className={`ins-note-input ${getCellError(errors, idx, c.key, "obs") ? "is-error" : ""}`}
                  rows={2}
                  value={cell.observacion || ""}
                  onChange={(e) => updateCell(idx, c.key, { observacion: e.target.value })}
                  placeholder="Detalla observaciones y medidas correctivas..."
                />
                {getCellError(errors, idx, c.key, "obs") ? (
                  <div className="ins-error">{getCellError(errors, idx, c.key, "obs")}</div>
                ) : null}

                <div style={{ marginTop: 10, fontWeight: 900 }}>Plan de acción (obligatorio)</div>

                <div className="ins-grid">
                  <label className="ins-field">
                    <span>Qué</span>
                    <input
                      className={`ins-input ${getCellError(errors, idx, c.key, "que") ? "is-error" : ""}`}
                      value={cell.accion?.que || ""}
                      onChange={(e) =>
                        updateCell(idx, c.key, {
                          accion: { ...(cell.accion || {}), que: e.target.value },
                        })
                      }
                      placeholder="Describe la acción correctiva inmediata..."
                    />
                    {getCellError(errors, idx, c.key, "que") ? (
                      <div className="ins-error">{getCellError(errors, idx, c.key, "que")}</div>
                    ) : null}
                  </label>

                  <label className="ins-field">
                    <span>Quién</span>
                    <Autocomplete
                      placeholder="DNI / Apellido / Nombre"
                      displayValue={cell.accion?.quien || ""}
                      options={whoOpenCell === whoCellKey ? whoOptions : []}
                      loading={whoOpenCell === whoCellKey ? whoLoading : false}
                      getOptionLabel={buildEmpleadoOptionLabel}
                      onFocus={() => {
                        setWhoOpenCell(whoCellKey);
                        setWhoQuery(cell.accion?.quien || "");
                      }}
                      onInputChange={(txt) => {
                        setWhoOpenCell(whoCellKey);
                        setWhoQuery(txt);
                        updateCell(idx, c.key, {
                          accion: { ...(cell.accion || {}), quien: txt, quien_dni: "" },
                        });
                      }}
                      onSelect={(emp) => {
                        const nombreCompleto = buildEmpleadoNombreCompleto(emp);
                        setWhoOpenCell(whoCellKey);
                        setWhoQuery(nombreCompleto);
                        updateCell(idx, c.key, {
                          accion: {
                            ...(cell.accion || {}),
                            quien: nombreCompleto,
                            quien_dni: String(emp?.dni || "").trim(),
                          },
                        });
                      }}
                    />
                    {getCellError(errors, idx, c.key, "quien") ? (
                      <div className="ins-error">{getCellError(errors, idx, c.key, "quien")}</div>
                    ) : null}
                  </label>

                  <label className="ins-field">
                    <span>Cuándo</span>
                    <input
                      type="date"
                      className={`ins-input ${getCellError(errors, idx, c.key, "cuando") ? "is-error" : ""}`}
                      value={cell.accion?.cuando || ""}
                      onChange={(e) =>
                        updateCell(idx, c.key, {
                          accion: { ...(cell.accion || {}), cuando: e.target.value },
                        })
                      }
                    />
                    {getCellError(errors, idx, c.key, "cuando") ? (
                      <div className="ins-error">{getCellError(errors, idx, c.key, "cuando")}</div>
                    ) : null}
                  </label>
                </div>
              </div>
            ) : null}
          </td>
        );
      })}

      <td style={{ verticalAlign: "top" }}>
        <Button type="button" variant="outline" onClick={() => removeRow(idx)}>
          X
        </Button>
      </td>
    </tr>
  );
}
