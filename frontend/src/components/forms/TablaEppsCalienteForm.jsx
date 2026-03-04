import { useEffect, useMemo, useState, useCallback } from "react";
import Button from "../ui/Button.jsx";
import Autocomplete from "../ui/Autocomplete.jsx";
import { buscarEmpleados } from "../../api/busquedas.api.js";
import { serializeTablaEppsCalienteRows } from "../../utils/plantillaRenderer.js";

const DEFAULT_COLS = [
  { key: "casaca_cuero", label: "Casaca de cuero" },
  { key: "mandil_cuero", label: "Mandil de cuero" },
  { key: "pantalon_cuero", label: "Pantalon de cuero" },
  { key: "guantes_cuero", label: "Guantes de cuero" },
  { key: "careta_facial", label: "Careta facial" },
  { key: "careta_soldador", label: "Careta de soldador" },
  { key: "escarpines", label: "Escarpines" },
  { key: "orejeras_tapones", label: "Orejeras y/o tapones de o\u00eddos" },
  { key: "respirador_media_cara", label: "Respirador media cara + filtros" },
];

const ESTADOS = ["", "BUENO", "MALO", "NA"];

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
      observacion: String(value?.observacion || ""),
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

function buildEmptyRow(cols) {
  const epps = {};
  cols.forEach((c) => {
    epps[c.key] = emptyCell();
  });

  return {
    trabajador: "",
    trabajador_text: "",
    trabajador_obj: null,
    trabajador_dni: "",
    epps,
  };
}

function normalizeRow(row, cols) {
  const raw = row && typeof row === "object" ? row : {};
  const epps = {};

  cols.forEach((c) => {
    epps[c.key] = normalizeCell(raw?.epps?.[c.key]);
  });

  const trabajadorText = String(raw?.trabajador_text || raw?.trabajador || raw?.apellidos_nombres || "");

  return {
    trabajador: trabajadorText,
    trabajador_text: trabajadorText,
    trabajador_obj: raw?.trabajador_obj && typeof raw.trabajador_obj === "object" ? raw.trabajador_obj : null,
    trabajador_dni: String(raw?.trabajador_dni || ""),
    epps,
  };
}

function isMaloCell(cell) {
  return String(cell?.estado || "").toUpperCase() === "MALO";
}

function validateRows(rows, cols) {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || {};

    for (const c of cols) {
      const cell = row?.epps?.[c.key] || emptyCell();
      if (!isMaloCell(cell)) continue;

      if (!String(cell?.observacion || "").trim()) return `Fila ${i + 1}, ${c.label}: Observacion obligatoria.`;
      if (!String(cell?.accion?.que || "").trim()) return `Fila ${i + 1}, ${c.label}: Accion (que) obligatoria.`;
      if (!String(cell?.accion?.quien || "").trim()) return `Fila ${i + 1}, ${c.label}: Accion (quien) obligatoria.`;
      if (!String(cell?.accion?.cuando || "").trim()) return `Fila ${i + 1}, ${c.label}: Accion (cuando) obligatoria.`;
    }
  }

  return null;
}

function getEmpleadoLabel(e) {
  const nom = `${e?.apellidos ?? e?.apellido ?? ""} ${e?.nombres ?? e?.nombre ?? ""}`.trim();
  const dni = e?.dni ? `(${e.dni})` : "";
  const cargo = e?.cargo ? `- ${e.cargo}` : e?.desc_cargo ? `- ${e.desc_cargo}` : "";
  return `${nom} ${dni} ${cargo}`.trim();
}

function getEmpleadoFullName(e) {
  return `${e?.apellidos ?? e?.apellido ?? ""} ${e?.nombres ?? e?.nombre ?? ""}`.trim() || String(e?.dni || "").trim();
}

export default function TablaEppsCalienteForm({ definicion, value, onChange, onSubmit }) {
  const cols = useMemo(() => {
    const fromJson = definicion?.json?.columns || definicion?.json_definicion?.columns || definicion?.columns;
    const source = Array.isArray(fromJson) && fromJson.length ? fromJson : DEFAULT_COLS;

    const normalized = source
      .map((c) => {
        const key = String(c?.key || "").trim();
        if (!key) return null;
        if (key === "orejeras_tapones") return { ...c, key, label: "Orejeras y/o tapones de o\u00eddos" };
        return { ...c, key, label: c?.label || DEFAULT_COLS.find((d) => d.key === key)?.label || key };
      })
      .filter(Boolean);

    const caretaFacial = normalized.find((c) => c.key === "careta_facial");
    const caretaSoldador = normalized.find((c) => c.key === "careta_soldador");
    const middle = normalized.filter((c) => c.key !== "careta_facial" && c.key !== "careta_soldador");

    if (!caretaFacial && !caretaSoldador) return normalized;

    const guantesIndex = middle.findIndex((c) => c.key === "guantes_cuero");
    if (guantesIndex >= 0) {
      const out = [...middle];
      if (caretaFacial) out.splice(guantesIndex + 1, 0, caretaFacial);
      if (caretaSoldador) out.splice(guantesIndex + 2, 0, caretaSoldador);
      return out;
    }

    return [...middle, ...(caretaFacial ? [caretaFacial] : []), ...(caretaSoldador ? [caretaSoldador] : [])];
  }, [definicion]);

  const rows = useMemo(() => {
    const base = Array.isArray(value) ? value : [];
    return base.map((r) => normalizeRow(r, cols));
  }, [value, cols]);

  const [saving, setSaving] = useState(false);
  const [uiError, setUiError] = useState("");
  const [searching, setSearching] = useState(false);
  const [empOptions, setEmpOptions] = useState([]);
  const [searchingTrabajador, setSearchingTrabajador] = useState(false);
  const [empOptionsTrabajador, setEmpOptionsTrabajador] = useState([]);
  const [activeRowIdx, setActiveRowIdx] = useState(null);

  const setRows = useCallback(
    (updater) => {
      const next = typeof updater === "function" ? updater(rows) : updater;
      onChange?.(next.map((r) => normalizeRow(r, cols)));
    },
    [rows, onChange, cols]
  );

  useEffect(() => {
    if (!rows.length) {
      onChange?.(Array.from({ length: 5 }, () => buildEmptyRow(cols)));
      return;
    }

    const normalized = rows.map((r) => normalizeRow(r, cols));
    const changed = JSON.stringify(normalized) !== JSON.stringify(value || []);
    if (changed) onChange?.(normalized);
  }, [rows, cols, onChange, value]);

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

  const buscarEmpleadosForTrabajador = useCallback(async (text) => {
    try {
      setSearchingTrabajador(true);
      const list = await buscarEmpleados(String(text || "").trim());
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    } finally {
      setSearchingTrabajador(false);
    }
  }, []);

  const updateRow = useCallback(
    (rowIdx, patch) => {
      setRows((prev) => prev.map((r, i) => (i === rowIdx ? { ...r, ...patch } : r)));
    },
    [setRows]
  );

  const updateCell = useCallback(
    (rowIdx, colKey, patch) => {
      setRows((prev) =>
        prev.map((r, i) => {
          if (i !== rowIdx) return r;

          const curr = normalizeCell(r?.epps?.[colKey]);
          const next = { ...curr, ...patch };

          if (!isMaloCell(next)) {
            next.observacion = "";
            next.accion = emptyAccion();
          } else {
            next.accion = {
              que: String(next?.accion?.que || ""),
              quien: String(next?.accion?.quien || ""),
              quien_dni: String(next?.accion?.quien_dni || ""),
              cuando: String(next?.accion?.cuando || ""),
            };
          }

          return { ...r, epps: { ...(r?.epps || {}), [colKey]: next } };
        })
      );
    },
    [setRows]
  );

  const updateEstado = useCallback(
    (rowIdx, colKey, estado) => {
      updateCell(rowIdx, colKey, { estado: String(estado || "").toUpperCase() });
    },
    [updateCell]
  );

  const handleAddRow = () => {
    setRows((prev) => [...prev, buildEmptyRow(cols)]);
  };

  const handleDeleteRow = (rowIdx) => {
    const row = rows?.[rowIdx];
    const name = String(row?.trabajador_text || row?.trabajador || "").trim() || `Fila ${rowIdx + 1}`;
    const ok = window.confirm(`¿Eliminar "${name}"? Esta accion no se puede deshacer.`);
    if (!ok) return;
    setRows((prev) => prev.filter((_, i) => i !== rowIdx));
  };

  const handleTrabajadorInputChange = useCallback(
    async (rowIdx, text) => {
      setActiveRowIdx(rowIdx);
      updateRow(rowIdx, {
        trabajador: text,
        trabajador_text: text,
        trabajador_obj: null,
        trabajador_dni: "",
      });

      const opts = await buscarEmpleadosForTrabajador(text);
      setEmpOptionsTrabajador(opts);
    },
    [updateRow, buscarEmpleadosForTrabajador]
  );

  const handleTrabajadorSelect = useCallback(
    (rowIdx, emp) => {
      const fullName = getEmpleadoFullName(emp);
      updateRow(rowIdx, {
        trabajador: fullName,
        trabajador_text: fullName,
        trabajador_obj: emp || null,
        trabajador_dni: String(emp?.dni || "").trim(),
      });
      setEmpOptionsTrabajador([]);
    },
    [updateRow]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUiError("");

    const msg = validateRows(rows, cols);
    if (msg) {
      setUiError(msg);
      return;
    }

    try {
      setSaving(true);
      await onSubmit?.({
        tipo: "tabla_epps_caliente",
        respuestas: serializeTablaEppsCalienteRows(rows),
        rows,
        resumen: { filas: rows.length },
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="ins-form">
      <div className="ins-header">
        <div>
          <div className="ins-title">Inspeccion de EPPs (Trabajos en caliente)</div>
          <div className="ins-sub">
            Marca BUENO / MALO / N/A. Si hay MALO en una celda, completa su Observacion y Plan de accion.
          </div>
        </div>
        <div className="ins-progress">
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar inspeccion"}
          </Button>
        </div>
      </div>

      {uiError ? (
        <div className="ins-error" style={{ marginTop: 10 }}>
          {uiError}
        </div>
      ) : null}

      <div className="ins-section" style={{ overflowX: "auto" }}>
        <table className="table" style={{ minWidth: 1600 }}>
          <thead>
            <tr>
              <th style={{ minWidth: 280 }}>Trabajador (Apellidos y nombres)</th>
              {cols.map((c) => (
                <th key={c.key} style={{ minWidth: 230 }}>
                  {c.label}
                </th>
              ))}
              <th style={{ width: 70, textAlign: "center" }}> </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={`row-${rowIdx}`}>
                <td style={{ verticalAlign: "top" }}>
                  <Autocomplete
                    placeholder="DNI / Apellido / Nombre"
                    displayValue={row?.trabajador_text || row?.trabajador || ""}
                    options={activeRowIdx === rowIdx ? empOptionsTrabajador : []}
                    loading={activeRowIdx === rowIdx && searchingTrabajador}
                    getOptionLabel={getEmpleadoLabel}
                    onFocus={async () => {
                      setActiveRowIdx(rowIdx);
                      const currentText = String(row?.trabajador_text || row?.trabajador || "").trim();
                      if (!currentText) {
                        const opts = await buscarEmpleadosForTrabajador("");
                        setEmpOptionsTrabajador(opts);
                      }
                    }}
                    onInputChange={async (text) => {
                      await handleTrabajadorInputChange(rowIdx, text);
                    }}
                    onSelect={(emp) => {
                      handleTrabajadorSelect(rowIdx, emp);
                    }}
                  />
                </td>

                {cols.map((c) => {
                  const cell = normalizeCell(row?.epps?.[c.key]);
                  const malo = isMaloCell(cell);
                  return (
                    <td key={`${rowIdx}-${c.key}`} style={{ verticalAlign: "top" }}>
                      <select
                        className="ins-input"
                        value={cell.estado || ""}
                        onChange={(e) => updateEstado(rowIdx, c.key, e.target.value)}
                      >
                        {ESTADOS.map((op) => (
                          <option key={op || "empty"} value={op}>
                            {op === "" ? "-" : op === "NA" ? "N/A" : op}
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
                          <div style={{ fontWeight: 900, color: "#b91c1c" }}>Observacion (obligatoria)</div>
                          <textarea
                            className="ins-note-input"
                            rows={2}
                            value={cell?.observacion || ""}
                            onChange={(e) => updateCell(rowIdx, c.key, { observacion: e.target.value })}
                            placeholder="Detalla observaciones y medidas correctivas..."
                          />

                          <div style={{ marginTop: 10, fontWeight: 900 }}>Plan de accion (obligatorio)</div>
                          <div className="ins-grid">
                            <label className="ins-field">
                              <span>Que</span>
                              <input
                                className="ins-input"
                                value={cell?.accion?.que || ""}
                                onChange={(e) =>
                                  updateCell(rowIdx, c.key, {
                                    accion: { ...(cell?.accion || {}), que: e.target.value },
                                  })
                                }
                              />
                            </label>

                            <label className="ins-field">
                              <span>Quien</span>
                              <Autocomplete
                                placeholder="DNI / Apellido / Nombre"
                                displayValue={cell?.accion?.quien || ""}
                                options={empOptions}
                                loading={searching}
                                getOptionLabel={getEmpleadoLabel}
                                onInputChange={async (text) => {
                                  updateCell(rowIdx, c.key, {
                                    accion: { ...(cell?.accion || {}), quien: text, quien_dni: "" },
                                  });
                                  const opts = await buscarEmpleadosForAutocomplete(text);
                                  setEmpOptions(opts);
                                }}
                                onSelect={(it) => {
                                  updateCell(rowIdx, c.key, {
                                    accion: {
                                      ...(cell?.accion || {}),
                                      quien: getEmpleadoFullName(it),
                                      quien_dni: String(it?.dni || "").trim(),
                                    },
                                  });
                                }}
                              />
                            </label>

                            <label className="ins-field">
                              <span>Cuando</span>
                              <input
                                type="date"
                                className="ins-input"
                                value={cell?.accion?.cuando || ""}
                                onChange={(e) =>
                                  updateCell(rowIdx, c.key, {
                                    accion: { ...(cell?.accion || {}), cuando: e.target.value },
                                  })
                                }
                              />
                            </label>
                          </div>
                        </div>
                      ) : null}
                    </td>
                  );
                })}

                <td style={{ textAlign: "center", verticalAlign: "top", pointerEvents: "auto" }}>
                  <button
                    type="button"
                    title="Eliminar fila"
                    onClick={() => handleDeleteRow(rowIdx)}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "#fff",
                      cursor: "pointer",
                      fontSize: 16,
                      lineHeight: "16px",
                      pointerEvents: "auto",
                    }}
                  >
                    {"\u{1F5D1}\uFE0F"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-start" }}>
          <Button type="button" onClick={handleAddRow}>
            + Agregar trabajador
          </Button>
        </div>
      </div>
    </form>
  );
}
