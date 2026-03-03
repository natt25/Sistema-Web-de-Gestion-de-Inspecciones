import { useEffect, useMemo, useState, useCallback } from "react";
import Button from "../ui/Button.jsx";
import Autocomplete from "../ui/Autocomplete.jsx";
import { buscarEmpleados } from "../../api/busquedas.api.js";
import { serializeTablaLavaojos } from "../../utils/plantillaRenderer.js";

const DIAS = [
  { key: "LUNES", label: "Lunes" },
  { key: "MARTES", label: "Martes" },
  { key: "MIERCOLES", label: "Miercoles" },
  { key: "JUEVES", label: "Jueves" },
  { key: "VIERNES", label: "Viernes" },
  { key: "SABADO", label: "Sabado" },
  { key: "DOMINGO", label: "Domingo" },
];

const ESTADO_OPTIONS = ["", "BUENO", "MALO", "NA"];

function emptyDiaMeta() {
  return { fecha: "", realizado_por: null, realizado_por_text: "", cargo: "", firma: "" };
}

function buildEmptyMeta() {
  const dias = {};
  DIAS.forEach((d) => { dias[d.key] = emptyDiaMeta(); });
  return { dias };
}

function emptyCell() {
  return { estado: "", observacion: "", accion: { que: "", quien: "", quien_dni: "", cuando: "" } };
}

function hasMaloCell(cell) {
  return String(cell?.estado || "").toUpperCase() === "MALO";
}

function validateCell(cell) {
  if (!hasMaloCell(cell)) return null;
  if (!String(cell?.observacion || "").trim()) return "Observacion obligatoria.";
  if (!String(cell?.accion?.que || "").trim()) return "Accion (que) obligatoria.";
  if (!String(cell?.accion?.quien || "").trim()) return "Accion (quien) obligatoria.";
  if (!String(cell?.accion?.cuando || "").trim()) return "Accion (cuando) obligatoria.";
  return null;
}

function getEmpleadoLabel(e) {
  const nom = `${e?.apellidos ?? e?.apellido ?? ""} ${e?.nombres ?? e?.nombre ?? ""}`.trim();
  const dni = e?.dni ? `(${e.dni})` : "";
  const cargo = e?.cargo ? `- ${e.cargo}` : e?.desc_cargo ? `- ${e.desc_cargo}` : "";
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
  const rawItems =
    definicion?.items ||
    definicion?.items_default ||
    definicion?.lavaojos?.items ||
    definicion?.lavaojos?.items_default ||
    [];

  const fallback = [
    "Ubicacion",
    "Pictograma de forma de uso",
    "Acceso sin obstrucciones",
    "Carga requerida",
    "Flujo de agua",
    "Valvula del sistema",
    "Palanca de activacion",
    "Estado general del contenedor",
    "Estado de los componentes",
    "Senaletica",
    "Tarjeta de inspeccion mensual",
  ].map((descripcion, i) => ({ item_ref: `i${i + 1}`, descripcion }));

  const finalItems = Array.isArray(rawItems) && rawItems.length ? rawItems : fallback;

  return finalItems.map((it, idx) => {
    const checks = {};
    DIAS.forEach((d) => { checks[d.key] = emptyCell(); });
    return {
      rowIndex: idx + 1,
      item_ref: it?.item_ref ?? it?.id ?? it?.item_id ?? `i${idx + 1}`,
      descripcion: it?.descripcion ?? it?.desc ?? `Item ${idx + 1}`,
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
    DIAS.forEach((d) => {
      checks[d.key] = { ...emptyCell(), ...(inc?.checks?.[d.key] || inc?.dias?.[d.key] || {}) };
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
      DIAS.forEach((d) => { checks[d.key] = { ...emptyCell(), ...(r?.checks?.[d.key] || r?.dias?.[d.key] || {}) }; });
      return {
        rowIndex: 0,
        item_ref: r?.item_ref || r?.item_id || `custom_${Date.now()}`,
        descripcion: r?.descripcion || "",
        checks,
        __locked: false,
      };
    });

  return normalizeRowIndexes([...merged, ...extra]);
}

export default function TablaLavaojosForm({ definicion = {}, initial = null, onSubmit }) {
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
    DIAS.forEach((d) => {
      nextMeta.dias[d.key] = { ...emptyDiaMeta(), ...(initial?.meta?.dias?.[d.key] || {}) };
    });
    setMeta(nextMeta);
  }, [definicion, initial]);

  const filled = useMemo(() => {
    let n = 0;
    for (const r of rows || []) {
      for (const d of DIAS) {
        if (String(r?.checks?.[d.key]?.estado || "").trim()) n += 1;
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

  const updateMetaDia = (diaKey, patch) => {
    setMeta((prev) => ({
      ...prev,
      dias: {
        ...(prev?.dias || {}),
        [diaKey]: { ...(prev?.dias?.[diaKey] || emptyDiaMeta()), ...patch },
      },
    }));
  };

  const updateRow = (idx, patch) => {
    setRows((prev) => normalizeRowIndexes((prev || []).map((r, i) => (i === idx ? { ...r, ...patch } : r))));
  };

  const updateCell = (rowIdx, diaKey, patch) => {
    setRows((prev) =>
      (prev || []).map((r, i) => {
        if (i !== rowIdx) return r;
        const curr = r?.checks?.[diaKey] || emptyCell();
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
        return { ...r, checks: { ...(r?.checks || {}), [diaKey]: nextCell } };
      })
    );
  };

  const validateAll = () => {
    const next = {};
    (rows || []).forEach((r, rowIdx) => {
      DIAS.forEach((d) => {
        const cell = r?.checks?.[d.key] || emptyCell();
        const msg = validateCell(cell);
        if (msg) next[`r${rowIdx}:${d.key}`] = msg;
      });
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleAddRow = () => {
    setRows((prev) => {
      const checks = {};
      DIAS.forEach((d) => { checks[d.key] = emptyCell(); });
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
      tipo: "tabla_lavaojos",
      respuestas: serializeTablaLavaojos({ meta: meta || buildEmptyMeta(), rows: rows || [] }),
      resumen: { celdas_marcadas: filled, filas: (rows || []).length },
      meta: meta || buildEmptyMeta(),
      rows: rows || [],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="ins-form">
      <div className="ins-header">
        <div>
          <div className="ins-title">Inspeccion de Lavaojos Portatil</div>
          <div className="ins-sub">
            FOR-036. Si marcas un estado como MALO, se exige Observacion + Plan de accion (Que / Quien / Cuando).
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
              <th style={{ minWidth: 320 }}>Descripcion</th>
              {DIAS.map((d) => (
                <th key={d.key} style={{ minWidth: 220 }}>{d.label}</th>
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
              >
                {" "}
              </th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td colSpan={2} style={{ fontWeight: 900 }}>Fecha</td>
              {DIAS.map((d) => (
                <td key={`fecha-${d.key}`}>
                  <input
                    type="date"
                    className="ins-input"
                    value={meta?.dias?.[d.key]?.fecha || ""}
                    onChange={(e) => updateMetaDia(d.key, { fecha: e.target.value })}
                  />
                </td>
              ))}
              <td />
            </tr>

            <tr>
              <td colSpan={2} style={{ fontWeight: 900 }}>Realizado por</td>
              {DIAS.map((d) => {
                const dia = meta?.dias?.[d.key] || emptyDiaMeta();
                return (
                  <td key={`rp-${d.key}`}>
                    <Autocomplete
                      placeholder="DNI / Apellido / Nombre"
                      displayValue={dia?.realizado_por_text || ""}
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
                  </td>
                );
              })}
              <td />
            </tr>

            <tr>
              <td colSpan={2} style={{ fontWeight: 900 }}>Firma</td>
              {DIAS.map((d) => {
                const dia = meta?.dias?.[d.key] || emptyDiaMeta();
                const finalSrc = getFirmaFromEmpleado(dia?.realizado_por) || dia?.firma || "";
                return (
                  <td key={`firma-${d.key}`}>
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
                    placeholder="Descripcion"
                    disabled={row?.__locked}
                  />
                </td>
                {DIAS.map((d) => (
                  <td key={`${row?.item_ref || idx}-${d.key}`}>
                    <select
                      className="ins-input"
                      value={row?.checks?.[d.key]?.estado || ""}
                      onChange={(e) => updateCell(idx, d.key, { estado: e.target.value })}
                    >
                      {ESTADO_OPTIONS.map((opt) => (
                        <option key={opt || "empty"} value={opt}>{opt || "-"}</option>
                      ))}
                    </select>

                    {hasMaloCell(row?.checks?.[d.key]) ? (
                      <div style={{ marginTop: 10, padding: 10, border: "1px solid #f3c6c6", borderRadius: 12, background: "#fff5f5" }}>
                        <div style={{ fontWeight: 900, color: "#b91c1c" }}>Observacion (obligatoria)</div>
                        <textarea
                          className="ins-note-input"
                          rows={2}
                          value={row?.checks?.[d.key]?.observacion || ""}
                          onChange={(e) => updateCell(idx, d.key, { observacion: e.target.value })}
                          placeholder="Detalla observaciones y medidas correctivas..."
                        />
                        <div style={{ marginTop: 10, fontWeight: 900 }}>Plan de accion (obligatorio)</div>
                        <div className="ins-grid">
                          <label className="ins-field">
                            <span>Que</span>
                            <input
                              className="ins-input"
                              value={row?.checks?.[d.key]?.accion?.que || ""}
                              onChange={(e) =>
                                updateCell(idx, d.key, { accion: { ...(row?.checks?.[d.key]?.accion || {}), que: e.target.value } })
                              }
                            />
                          </label>
                          <label className="ins-field">
                            <span>Quien</span>
                            <Autocomplete
                              placeholder="DNI / Apellido / Nombre"
                              displayValue={row?.checks?.[d.key]?.accion?.quien || ""}
                              options={empOptions}
                              loading={searching}
                              getOptionLabel={getEmpleadoLabel}
                              onInputChange={async (text) => {
                                updateCell(idx, d.key, { accion: { ...(row?.checks?.[d.key]?.accion || {}), quien: text, quien_dni: "" } });
                                const opts = await buscarEmpleadosForAutocomplete(text);
                                setEmpOptions(opts);
                              }}
                              onSelect={(it) => {
                                updateCell(idx, d.key, {
                                  accion: {
                                    ...(row?.checks?.[d.key]?.accion || {}),
                                    quien: getEmpleadoFullName(it),
                                    quien_dni: String(it?.dni || ""),
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
                              value={row?.checks?.[d.key]?.accion?.cuando || ""}
                              onChange={(e) =>
                                updateCell(idx, d.key, { accion: { ...(row?.checks?.[d.key]?.accion || {}), cuando: e.target.value } })
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
          <Button type="button" onClick={handleAddRow}>
            + Agregar fila
          </Button>
        </div>
      </div>
    </form>
  );
}
