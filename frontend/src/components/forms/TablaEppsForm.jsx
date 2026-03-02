import { useMemo, useState } from "react";
import Button from "../ui/Button.jsx";
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

function createEmptyEpps() {
  return EPP_COLUMNS.reduce((acc, c) => {
    acc[c.key] = "";
    return acc;
  }, {});
}

function createEmptyRow(index) {
  return {
    rowIndex: index,
    apellidos_nombres: "",
    puesto_trabajo: "",
    epps: createEmptyEpps(),
    observaciones: "",
    accion: {
      que: "",
      quien: "",
      cuando: "",
    },
  };
}

function mapInitialRows(rows) {
  const base = Array.from({ length: 24 }, (_, i) => createEmptyRow(i + 1));
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

export default function TablaEppsForm({ onSubmit, initialRows = [] }) {
  const [rows, setRows] = useState(() => mapInitialRows(initialRows));
  const [errors, setErrors] = useState({});

  const filled = useMemo(() => rows.filter((r) => rowHasAnyData(r)).length, [rows]);

  function updateRow(idx, patch) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function updateEppState(idx, key, value) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const epps = { ...(r.epps || {}), [key]: value };

        const next = { ...r, epps };
        if (value !== "MALO" && !rowHasMalo(next)) {
          next.observaciones = "";
          next.accion = { que: "", quien: "", cuando: "" };
        }
        return next;
      })
    );
  }

  function validateAll() {
    const nextErrors = {};

    rows.forEach((row, idx) => {
      if (!rowHasAnyData(row)) return;

      if (rowHasMalo(row)) {
        if (!String(row.observaciones || "").trim()) {
          nextErrors[`row:${idx}:obs`] = "Observaciones obligatorias cuando existe MALO.";
        }
        if (!String(row.accion?.que || "").trim()) {
          nextErrors[`row:${idx}:que`] = "Accion (que) obligatoria cuando existe MALO.";
        }
        if (!String(row.accion?.quien || "").trim()) {
          nextErrors[`row:${idx}:quien`] = "Accion (quien) obligatoria cuando existe MALO.";
        }
        if (!String(row.accion?.cuando || "").trim()) {
          nextErrors[`row:${idx}:cuando`] = "Accion (cuando) obligatoria cuando existe MALO.";
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

  return (
    <form onSubmit={handleSubmit} className="ins-form">
      <div className="ins-header">
        <div>
          <div className="ins-title">Inspeccion de EPPs</div>
          <div className="ins-sub">FOR-033. Si existe al menos un MALO en una fila, se exige observacion y accion correctiva.</div>
        </div>
        <div className="ins-progress">
          <span>{filled}/24 filas con datos</span>
          <Button type="submit">Guardar</Button>
        </div>
      </div>

      <div className="ins-section" style={{ overflowX: "auto" }}>
        <table className="table" style={{ minWidth: 1900 }}>
          <thead>
            <tr>
              <th>N</th>
              <th>Apellidos y Nombres</th>
              <th>Puesto de Trabajo</th>
              {EPP_COLUMNS.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.rowIndex}>
                <td>{row.rowIndex}</td>
                <td>
                  <input
                    className="ins-input"
                    value={row.apellidos_nombres}
                    onChange={(e) => updateRow(idx, { apellidos_nombres: e.target.value })}
                    placeholder="Apellidos y Nombres"
                  />
                </td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((row, idx) => {
          if (!rowHasMalo(row)) return null;

          return (
            <div key={`malo-${row.rowIndex}`} className="ins-action">
              <div className="ins-action-title">
                Fila {row.rowIndex}: Accion obligatoria por estado MALO
              </div>

              <label className="ins-field">
                <span>Observaciones</span>
                <textarea
                  className={`ins-note-input ${errors[`row:${idx}:obs`] ? "is-error" : ""}`}
                  rows={2}
                  value={row.observaciones}
                  onChange={(e) => updateRow(idx, { observaciones: e.target.value })}
                />
                {errors[`row:${idx}:obs`] ? <div className="ins-error">{errors[`row:${idx}:obs`]}</div> : null}
              </label>

              <div className="ins-grid">
                <label className="ins-field">
                  <span>Que</span>
                  <input
                    className={`ins-input ${errors[`row:${idx}:que`] ? "is-error" : ""}`}
                    value={row.accion?.que || ""}
                    onChange={(e) => updateRow(idx, { accion: { ...(row.accion || {}), que: e.target.value } })}
                  />
                  {errors[`row:${idx}:que`] ? <div className="ins-error">{errors[`row:${idx}:que`]}</div> : null}
                </label>

                <label className="ins-field">
                  <span>Quien</span>
                  <input
                    className={`ins-input ${errors[`row:${idx}:quien`] ? "is-error" : ""}`}
                    value={row.accion?.quien || ""}
                    onChange={(e) => updateRow(idx, { accion: { ...(row.accion || {}), quien: e.target.value } })}
                  />
                  {errors[`row:${idx}:quien`] ? <div className="ins-error">{errors[`row:${idx}:quien`]}</div> : null}
                </label>

                <label className="ins-field">
                  <span>Cuando</span>
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
          );
        })}
      </div>
    </form>
  );
}