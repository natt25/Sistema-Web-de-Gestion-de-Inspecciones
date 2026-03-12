import { useEffect, useMemo, useState, useCallback } from "react";
import Button from "../ui/Button.jsx";
import Autocomplete from "../ui/Autocomplete.jsx";
import { buscarEmpleados } from "../../api/busquedas.api.js";
import { buildEmpleadoDisplayName, buildEmpleadoOptionLabel } from "../../utils/empleados.js";

const ESTADOS = ["", "BUENO", "MALO", "NA"];

const DEFAULT_COLS = [
  { key: "mandil_anticorte", label: "Mandil anticorte" },
  { key: "mangas_anticorte", label: "Mangas anticorte" },
  { key: "guantes_anticorte", label: "Guantes anticorte" },
];

function emptyRow(cols) {
  const epps = {};
  cols.forEach((c) => (epps[c.key] = ""));
  return {
    trabajador: null,          // objeto empleado
    trabajador_text: "",       // texto del input
    epps,
    // Si hay MALO en cualquier EPP => obligatorios
    observacion: "",
    accion: { que: "", quien: null, quien_text: "", cuando: "" },
    __locked: false,
  };
}

function rowHasMalo(row) {
  return Object.values(row?.epps || {}).some((v) => String(v || "").toUpperCase() === "MALO");
}

function validateRow(row) {
  if (!rowHasMalo(row)) return null;
  if (!String(row?.observacion || "").trim()) return "Observación obligatoria.";
  if (!String(row?.accion?.que || "").trim()) return "Acción (qué) obligatoria.";
  if (!String(row?.accion?.quien_text || "").trim()) return "Acción (quién) obligatoria.";
  if (!String(row?.accion?.cuando || "").trim()) return "Acción (cuándo) obligatoria.";
  return null;
}

export default function TablaEppsCorteForm({ definicion = {}, initial = null, onSubmit }) {
  const cols = useMemo(() => {
    const fromJson = definicion?.columns || definicion?.json?.columns || definicion?.json_definicion?.columns;
    return Array.isArray(fromJson) && fromJson.length ? fromJson : DEFAULT_COLS;
  }, [definicion]);

  const defaultRows = Number(definicion?.defaultRows || definicion?.json?.defaultRows || 5) || 5;

  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState({});
  const [searching, setSearching] = useState(false);
  const [empOptions, setEmpOptions] = useState([]);

  useEffect(() => {
    // seed: si hay initial => úsalo, si no => 5 filas
    if (initial?.rows?.length) {
      const seeded = initial.rows.map((r) => ({
        ...emptyRow(cols),
        ...r,
        trabajador: r?.trabajador || null,
        trabajador_text: r?.trabajador_text || (r?.trabajador ? buildEmpleadoDisplayName(r.trabajador) : ""),
        accion: {
          que: r?.accion?.que || "",
          quien: r?.accion?.quien || null,
          quien_text:
            r?.accion?.quien_text ||
            (r?.accion?.quien ? buildEmpleadoDisplayName(r.accion.quien) : "") ||
            "",
          cuando: r?.accion?.cuando || "",
        },
      }));
      setRows(seeded);
      return;
    }

    setRows(Array.from({ length: defaultRows }, () => emptyRow(cols)));
  }, [cols, defaultRows, initial]);

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

  const addRow = () => setRows((p) => [...p, emptyRow(cols)]);

  const removeRow = (idx) => {
    const r = rows[idx];
    if (!r) return;
    if (r.__locked) return;

    const ok = window.confirm(`¿Eliminar trabajador ${idx + 1}?`);
    if (!ok) return;

    setRows((p) => p.filter((_, i) => i !== idx));
    setErrors((p) => {
      const next = { ...(p || {}) };
      delete next[`row:${idx}`];
      return next;
    });
  };

  const updateRow = (idx, patch) => {
    setRows((p) => p.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const updateEpp = (rowIdx, key, estado) => {
    setRows((p) =>
      p.map((r, i) => {
        if (i !== rowIdx) return r;
        const next = { ...r, epps: { ...(r.epps || {}), [key]: estado } };

        if (!rowHasMalo(next)) {
          next.observacion = "";
          next.accion = { que: "", quien: null, quien_text: "", cuando: "" };
        }
        return next;
      })
    );
  };

  const validateAll = () => {
    const next = {};
    rows.forEach((r, idx) => {
      const msg = validateRow(r);
      if (msg) next[`row:${idx}`] = msg;
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateAll()) return;

    onSubmit?.({
      tipo: "tabla_epps_corte",
      rows,
      resumen: { filas: rows.length },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="ins-form">
      <div className="ins-header">
        <div>
          <div className="ins-title">Inspección de EPPs para Trabajos de Corte</div>
          <div className="ins-sub">
            Marca BUENO / MALO / N/A. Si hay MALO, completa Observación + Plan de acción.
          </div>
        </div>
        <div className="ins-progress">
          <Button type="submit">Guardar</Button>
        </div>
      </div>

      <div className="ins-section" style={{ overflowX: "auto" }}>
        <table className="table" style={{ minWidth: 1200 }}>
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th style={{ minWidth: 320 }}>Trabajador (Apellidos y nombres)</th>
              {cols.map((c) => (
                <th key={c.key} style={{ minWidth: 220 }}>{c.label}</th>
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
            {rows.map((row, idx) => {
              const malo = rowHasMalo(row);
              return (
                <tr key={`row-${idx}`}>
                  <td>{idx + 1}</td>

                  <td>
                    {/* MISMA UX que “Agregar inspector”: input->dropdown->select */}
                    <Autocomplete
                      placeholder="DNI / Apellido / Nombre"
                      displayValue={row?.trabajador_text || ""}
                      options={empOptions}
                      loading={searching}
                      getOptionLabel={buildEmpleadoOptionLabel}
                      onInputChange={async (text) => {
                        updateRow(idx, { trabajador_text: text, trabajador: null });
                        const opts = await buscarEmpleadosForAutocomplete(text);
                        setEmpOptions(opts);
                      }}
                      onSelect={(emp) => {
                        updateRow(idx, { trabajador: emp, trabajador_text: buildEmpleadoDisplayName(emp) });
                      }}
                    />

                    {malo ? (
                      <div style={{ marginTop: 10, padding: 10, border: "1px solid #f3c6c6", borderRadius: 12, background: "#fff5f5" }}>
                        <div style={{ fontWeight: 900, color: "#b91c1c" }}>Observación (obligatoria)</div>
                        <textarea
                          className="ins-note-input"
                          rows={2}
                          value={row?.observacion || ""}
                          onChange={(e) => updateRow(idx, { observacion: e.target.value })}
                          placeholder="Detalla observaciones y medidas correctivas..."
                        />

                        <div style={{ marginTop: 10, fontWeight: 900 }}>Plan de acción (obligatorio)</div>

                        <div className="ins-grid">
                          <label className="ins-field">
                            <span>Qué</span>
                            <input
                              className="ins-input"
                              value={row?.accion?.que || ""}
                              onChange={(e) => updateRow(idx, { accion: { ...(row.accion || {}), que: e.target.value } })}
                            />
                          </label>

                          <label className="ins-field">
                            <span>Quién</span>
                            <Autocomplete
                              placeholder="DNI / Apellido / Nombre"
                              displayValue={row?.accion?.quien_text || ""}
                              options={empOptions}
                              loading={searching}
                              getOptionLabel={buildEmpleadoOptionLabel}
                              onInputChange={async (text) => {
                                updateRow(idx, { accion: { ...(row.accion || {}), quien_text: text, quien: null } });
                                const opts = await buscarEmpleadosForAutocomplete(text);
                                setEmpOptions(opts);
                              }}
                              onSelect={(emp) => {
                                updateRow(idx, {
                                  accion: {
                                    ...(row.accion || {}),
                                    quien: emp,
                                    quien_text: buildEmpleadoDisplayName(emp),
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
                              value={row?.accion?.cuando || ""}
                              onChange={(e) => updateRow(idx, { accion: { ...(row.accion || {}), cuando: e.target.value } })}
                            />
                          </label>
                        </div>

                        {errors[`row:${idx}`] ? (
                          <div className="ins-error" style={{ marginTop: 8 }}>
                            {errors[`row:${idx}`]}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </td>

                  {cols.map((c) => (
                    <td key={`${idx}-${c.key}`}>
                      <select
                        className="ins-input"
                        value={row?.epps?.[c.key] || ""}
                        onChange={(e) => updateEpp(idx, c.key, e.target.value)}
                      >
                        {ESTADOS.map((opt) => (
                          <option key={opt || "empty"} value={opt}>
                            {opt || "-"}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}

                  <td
                    style={{
                      textAlign: "center",
                      position: "sticky",
                      right: 0,
                      background: "#fff",
                      zIndex: 5,
                    }}
                  >
                    <button
                      type="button"
                      title="Eliminar fila"
                      onClick={() => removeRow(idx)}
                      disabled={row?.__locked}
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        background: "#fff",
                        cursor: row?.__locked ? "not-allowed" : "pointer",
                        fontSize: 16,
                        opacity: row?.__locked ? 0.35 : 1,
                      }}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-start", paddingLeft: 50 }}>
          <Button type="button" onClick={addRow}>+ Agregar trabajador</Button>
        </div>
      </div>
    </form>
  );
}
