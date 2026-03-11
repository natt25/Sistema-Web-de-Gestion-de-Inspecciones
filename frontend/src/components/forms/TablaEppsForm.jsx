import { useMemo, useState, useEffect } from "react";
import Button from "../ui/Button.jsx";
import Autocomplete from "../ui/Autocomplete.jsx";
import { buscarEmpleados } from "../../api/busquedas.api.js";
import { serializeTablaEppsRows } from "../../utils/plantillaRenderer.js";

const EPP_COLUMNS = [
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
  { key: "otros_1", label: "OTROS 1" },
  { key: "otros_2", label: "OTROS 2" },
];

const ESTADO_OPTIONS = ["", "BUENO", "MALO", "NA"];

const DEFAULT_ROWS = 5; // antes te salían 5; ahora puedes agregar todas las que quieras

function createEmptyEpps() {
  return EPP_COLUMNS.reduce((acc, c) => {
    acc[c.key] = "";
    return acc;
  }, {});
}

function createEmptyRow(index) {
  return {
    rowIndex: index,
    empleado: null, // guardamos el objeto seleccionado (dni, nombres, cargo...)
    apellidos_nombres: "",
    puesto_trabajo: "",
    epps: createEmptyEpps(),
    observaciones: "",
    accion: { que: "", quien: "", cuando: "" },
  };
}

function rowHasAnyData(row) {
  if (!row) return false;
  if (String(row.apellidos_nombres || "").trim()) return true;
  if (String(row.puesto_trabajo || "").trim()) return true;
  if (Object.values(row.epps || {}).some((v) => String(v || "").trim())) return true;
  if (String(row.observaciones || "").trim()) return true;
  if (String(row.accion?.que || "").trim()) return true;
  if (String(row.accion?.quien || "").trim()) return true;
  if (String(row.accion?.cuando || "").trim()) return true;
  return false;
}

function rowHasMalo(row) {
  return Object.values(row?.epps || {}).some((v) => String(v).toUpperCase() === "MALO");
}

function normalizeEmpleadoLabel(emp) {
  if (!emp) return "";
  // intenta varias combinaciones según tu API
  const dni = emp?.dni ? String(emp.dni).trim() : "";
  const ap = emp?.apellidos ? String(emp.apellidos).trim() : (emp?.apellido ? String(emp.apellido).trim() : "");
  const nom = emp?.nombres ? String(emp.nombres).trim() : (emp?.nombre ? String(emp.nombre).trim() : "");
  const full = (emp?.apellidos_nombres ? String(emp.apellidos_nombres).trim() : "").trim();
  const labelBase = full || `${ap} ${nom}`.trim();
  return dni ? `${dni} - ${labelBase}`.trim() : labelBase;
}

function buildEmpleadoNombreCompleto(emp) {
  if (!emp) return "";

  const apellidoPaterno = String(emp?.apellido_paterno ?? "").trim();
  const apellidoMaterno = String(emp?.apellido_materno ?? "").trim();
  const apellidos = String(emp?.apellidos ?? emp?.apellido ?? "").trim();
  const nombres = String(emp?.nombres ?? emp?.nombre ?? "").trim();
  const full = String(
    emp?.apellidos_nombres ?? emp?.label ?? emp?.nombreCompleto ?? ""
  ).trim();

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
  // prueba campos típicos
  return (
    emp?.cargo ||
    emp?.desc_cargo ||
    emp?.nombre_cargo ||
    emp?.puesto ||
    emp?.desc_puesto ||
    ""
  );
}

function mapInitialRows(rows) {
  // si ya vienen filas, respétalas; si no, empieza con 5
  const n = Array.isArray(rows) && rows.length ? rows.length : DEFAULT_ROWS;
  const base = Array.from({ length: n }, (_, i) => createEmptyRow(i + 1));

  if (!Array.isArray(rows) || rows.length === 0) return base;

  return base.map((blank, idx) => {
    const incoming = rows[idx] || {};
    const epps = { ...createEmptyEpps(), ...(incoming.epps || {}) };
    return {
      ...blank,
      ...incoming,
      rowIndex: idx + 1,
      epps,
      accion: {
        que: incoming?.accion?.que || "",
        quien: incoming?.accion?.quien || "",
        cuando: incoming?.accion?.cuando || "",
      },
    };
  });
}

export default function TablaEppsForm({ onSubmit, initialRows = [] }) {
  const [rows, setRows] = useState(() => mapInitialRows(initialRows));
  const [errors, setErrors] = useState({});

  // Autocomplete (un solo buscador activo a la vez)
  const [empOpenIdx, setEmpOpenIdx] = useState(null);
  const [empQuery, setEmpQuery] = useState("");
  const [empOptions, setEmpOptions] = useState([]);
  const [empLoading, setEmpLoading] = useState(false);

  const filled = useMemo(() => rows.filter((r) => rowHasAnyData(r)).length, [rows]);

  function reindexRows(next) {
    return next.map((r, i) => ({ ...r, rowIndex: i + 1 }));
  }

  function updateRow(idx, patch) {
    setRows((prev) => {
      const next = prev.map((r, i) => (i === idx ? { ...r, ...patch } : r));
      return next;
    });
  }

  function updateEppState(idx, key, value) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;

        const epps = { ...(r.epps || {}), [key]: value };
        const next = { ...r, epps };

        // si ya no hay MALO en esa fila, limpiar campos obligatorios
        if (value !== "MALO" && !rowHasMalo(next)) {
          next.observaciones = "";
          next.accion = { que: "", quien: "", cuando: "" };
        }
        return next;
      })
    );
  }

  function addRow() {
    setRows((prev) => reindexRows([...prev, createEmptyRow(prev.length + 1)]));
  }

  function removeRow(idx) {
    setRows((prev) => reindexRows(prev.filter((_, i) => i !== idx)));
  }

  function validateAll() {
    const nextErrors = {};

    rows.forEach((row, idx) => {
      if (!rowHasAnyData(row)) return;

      // si hay texto pero no seleccionó empleado, igual lo dejamos (por si quieren escribir manual)
      // pero si seleccionó, puesto debe quedar
      if (rowHasMalo(row)) {
        if (!String(row.observaciones || "").trim()) {
          nextErrors[`row:${idx}:obs`] = "Observación obligatoria cuando existe MALO.";
        }
        if (!String(row.accion?.que || "").trim()) {
          nextErrors[`row:${idx}:que`] = "Acción (qué) obligatoria cuando existe MALO.";
        }
        if (!String(row.accion?.quien || "").trim()) {
          nextErrors[`row:${idx}:quien`] = "Acción (quién) obligatoria cuando existe MALO.";
        }
        if (!String(row.accion?.cuando || "").trim()) {
          nextErrors[`row:${idx}:cuando`] = "Acción (cuándo) obligatoria cuando existe MALO.";
        }
      }
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validateAll()) return;

    onSubmit?.({
      tipo: "tabla_epps",
      respuestas: serializeTablaEppsRows(rows),
      resumen: { total: rows.length, respondidas: filled },
      rows,
    });
  }

  // Buscar empleados cuando cambie empQuery/empOpenIdx (debounce simple)
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

  return (
    <form onSubmit={handleSubmit} className="ins-form">
      <div className="ins-header">
        <div>
          <div className="ins-title">Inspección de EPPs</div>
          <div className="ins-sub">
            FOR-033. Si existe al menos un MALO en una fila, se exige observación y plan de acción.
          </div>
        </div>
        <div className="ins-progress">
          <span>{filled}/{rows.length} filas con datos</span>
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
              {EPP_COLUMNS.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th style={{ width: 70 }}></th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, idx) => {
              const showMalo = rowHasMalo(row);
              return (
                <FragmentRow
                  key={row.rowIndex}
                  row={row}
                  idx={idx}
                  showMalo={showMalo}
                  updateRow={updateRow}
                  updateEppState={updateEppState}
                  errors={errors}
                  removeRow={removeRow}
                  // autocomplete props
                  empOpenIdx={empOpenIdx}
                  setEmpOpenIdx={setEmpOpenIdx}
                  empQuery={empQuery}
                  setEmpQuery={setEmpQuery}
                  empOptions={empOptions}
                  empLoading={empLoading}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
        <Button type="button" variant="secondary" onClick={addRow}>
          + Agregar trabajador
        </Button>
        <div style={{ color: "var(--muted)", fontSize: 12 }}>
          Tip: Escribe DNI / apellido / nombre para seleccionar al trabajador.
        </div>
      </div>
    </form>
  );
}

/** Subcomponente para renderizar fila + bloque MALO justo debajo */
function FragmentRow({
  row,
  idx,
  showMalo,
  updateRow,
  updateEppState,
  errors,
  removeRow,
  empOpenIdx,
  setEmpOpenIdx,
  empQuery,
  setEmpQuery,
  empOptions,
  empLoading,
}) {
  // NOTE: usamos un wrapper sin importar React.Fragment para evitar imports extra
  return (
    <>
      <tr>
        <td>{row.rowIndex}</td>

        {/* Autocomplete empleado */}
        <td>
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
              // permitir escribir aunque no seleccione
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

        {/* Puesto (auto, pero editable si quieres) */}
        <td>
          <input
            className="ins-input"
            value={row.puesto_trabajo}
            onChange={(e) => updateRow(idx, { puesto_trabajo: e.target.value })}
            placeholder="Puesto"
          />
        </td>

        {EPP_COLUMNS.map((c) => (
          <td key={`${row.rowIndex}-${c.key}`}>
            <select
              className="ins-input"
              value={row.epps?.[c.key] || ""}
              onChange={(e) => updateEppState(idx, c.key, e.target.value)}
            >
              {ESTADO_OPTIONS.map((opt) => (
                <option key={opt || "empty"} value={opt}>
                  {opt || "-"}
                </option>
              ))}
            </select>
          </td>
        ))}

        <td>
          <Button type="button" variant="outline" onClick={() => removeRow(idx)}>
            ✕
          </Button>
        </td>
      </tr>

      
      {showMalo ? (
        <tr>
          <td colSpan={3 + EPP_COLUMNS.length + 1} style={{ padding: 0 }}>
            <div className="ins-action" style={{ margin: "10px 0" }}>
              <div className="ins-action-title">
                Fila {row.rowIndex}: Observación y Plan de acción (obligatorio por MALO)
              </div>

              <label className="ins-field">
                <span style={{ fontWeight: 900, color: "#b91c1c" }}>
                  Observación (obligatoria)
                </span>
                <textarea
                  className={`ins-note-input ${errors[`row:${idx}:obs`] ? "is-error" : ""}`}
                  rows={2}
                  value={row.observaciones}
                  onChange={(e) => updateRow(idx, { observaciones: e.target.value })}
                  placeholder="Detalla observaciones y medidas correctivas..."
                />
                {errors[`row:${idx}:obs`] ? <div className="ins-error">{errors[`row:${idx}:obs`]}</div> : null}
              </label>

              <div className="ins-action-title" style={{ marginTop: 10 }}>
                Plan de acción (obligatorio)
              </div>

              <div className="ins-grid">
                <label className="ins-field">
                  <span>Qué</span>
                  <input
                    className={`ins-input ${errors[`row:${idx}:que`] ? "is-error" : ""}`}
                    value={row.accion?.que || ""}
                    onChange={(e) => updateRow(idx, { accion: { ...(row.accion || {}), que: e.target.value } })}
                    placeholder="Describe la acción correctiva inmediata..."
                  />
                  {errors[`row:${idx}:que`] ? <div className="ins-error">{errors[`row:${idx}:que`]}</div> : null}
                </label>

                <label className="ins-field">
                  <span>Quién</span>
                  <input
                    className={`ins-input ${errors[`row:${idx}:quien`] ? "is-error" : ""}`}
                    value={row.accion?.quien || ""}
                    onChange={(e) => updateRow(idx, { accion: { ...(row.accion || {}), quien: e.target.value } })}
                    placeholder="DNI / Apellido / Nombre"
                  />
                  {errors[`row:${idx}:quien`] ? <div className="ins-error">{errors[`row:${idx}:quien`]}</div> : null}
                </label>

                <label className="ins-field">
                  <span>Cuándo</span>
                  <input
                    type="date"
                    className={`ins-input ${errors[`row:${idx}:cuando`] ? "is-error" : ""}`}
                    value={row.accion?.cuando || ""}
                    onChange={(e) => updateRow(idx, { accion: { ...(row.accion || {}), cuando: e.target.value } })}
                  />
                  {errors[`row:${idx}:cuando`] ? <div className="ins-error">{errors[`row:${idx}:cuando`]}</div> : null}
                </label>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
