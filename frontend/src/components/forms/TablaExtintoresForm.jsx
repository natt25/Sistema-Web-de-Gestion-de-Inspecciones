// frontend/src/components/forms/TablaExtintoresForm.jsx
import { useMemo, useState } from "react";
import Button from "../ui/Button.jsx";
import Autocomplete from "../ui/Autocomplete.jsx";
import { buscarEmpleados } from "../../api/busquedas.api.js";
import { serializeTablaExtintoresRows } from "../../utils/plantillaRenderer.js";

const TIPOS_DEFAULT = ["PQS", "CO2", "AGUA", "OTROS"];
const PQS_CLASES = ["BC", "ABC"];

// === Sub-secciones REVISIÓN ESTADO GENERAL (como tu cabecera de Excel)
const REVISION_SECTIONS = [
  {
    titulo: "CILINDRO",
    items: [
      { key: "cil_pintura", label: "Pintura" },
      { key: "cil_golpes", label: "Golpes" },
      { key: "cil_autoadhesivo", label: "Autoadhesivo Fecha/Tipo" },
    ],
  },
  {
    titulo: "MANIJAS",
    items: [
      { key: "man_transporte", label: "Manija de transporte" },
      { key: "man_disparo", label: "Manija de disparo" },
    ],
  },
  {
    titulo: "OTROS COMPONENTES",
    items: [
      { key: "comp_presion", label: "Presión" },
      { key: "comp_manometro", label: "Manómetro" },
      { key: "comp_boquilla", label: "Boquilla" },
      { key: "comp_manguera", label: "Manguera" },
      { key: "comp_ring", label: "Ring / Aro de seguridad" },
      { key: "comp_corneta", label: "Corneta" },
      { key: "comp_senializacion", label: "Señalización" },
      { key: "comp_soporte", label: "Soporte colgar o ruedas" },
    ],
  },
];

function createEmptyRevision() {
  // 🔥 importante: NO default NA => todo vacío ""
  const estados = {};
  const notas = {};
  const acciones = {};
  for (const sec of REVISION_SECTIONS) {
    for (const it of sec.items) {
      estados[it.key] = ""; // "" | "BUENO" | "MALO" | "NA"
      notas[it.key] = "";
      acciones[it.key] = { que: "", quien: "", cuando: "", responsable: null };
    }
  }
  return { estados, notas, acciones };
}

function createEmptyRow() {
  return {
    codigo: "",
    ubicacion: "",
    tipo: "",
    pqs_clase: "",
    tipo_otro_desc: "",
    capacidad: "",
    fecha_prueba: "",
    fecha_vencimiento: "",
    observaciones: "",

    // revision estado general (nuevo shape)
    revision: createEmptyRevision(),
  };
}

function mapInitialRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [createEmptyRow()];
  return rows.map((row) => {
    const base = { ...createEmptyRow(), ...row };
    // compat: si viene "revision" vieja o incompleta
    if (!base.revision || typeof base.revision !== "object") base.revision = createEmptyRevision();
    if (!base.revision.estados) base.revision.estados = createEmptyRevision().estados;
    if (!base.revision.notas) base.revision.notas = createEmptyRevision().notas;
    if (!base.revision.acciones) base.revision.acciones = createEmptyRevision().acciones;

    // asegurar keys
    const empty = createEmptyRevision();
    base.revision.estados = { ...empty.estados, ...(base.revision.estados || {}) };
    base.revision.notas = { ...empty.notas, ...(base.revision.notas || {}) };
    base.revision.acciones = { ...empty.acciones, ...(base.revision.acciones || {}) };

    return base;
  });
}

function onlyNumericLike(value) {
  // permite: 12  12.5  12,5
  const v = String(value ?? "");
  return v.replace(/[^\d.,]/g, "");
}

function isValidDecimal(v) {
  const s = String(v ?? "").trim();
  if (!s) return true; // vacío permitido si no quieres validar requerido aquí
  return /^\d+([.,]\d+)?$/.test(s);
}

function Option({ name, label, checked, onChange }) {
  const cls = label === "BUENO" ? "good" : label === "MALO" ? "bad" : "na";
  return (
    <label className={`ins-opt ${cls} ${checked ? "is-checked" : ""}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

export default function TablaExtintoresForm({ onSubmit, initialRows = [], definicion }) {
  const [rows, setRows] = useState(() => mapInitialRows(initialRows));
  const [errors, setErrors] = useState({}); // errores por fila y por item revision
  const [respOptions, setRespOptions] = useState({}); // autocomplete options por (fila-item)

  const tiposOpciones =
    Array.isArray(definicion?.tipos) && definicion.tipos.length ? definicion.tipos : TIPOS_DEFAULT;

  const total = rows.length;
  const filled = useMemo(
    () => rows.filter((r) => String(r?.codigo || "").trim() || String(r?.ubicacion || "").trim()).length,
    [rows]
  );

  function updateRow(idx, patch) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function updateRevision(idx, key, patch) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const rev = r.revision || createEmptyRevision();
        return { ...r, revision: { ...rev, ...patch } };
      })
    );
  }

  function setRevisionEstado(rowIdx, itemKey, value) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== rowIdx) return r;
        const rev = r.revision || createEmptyRevision();
        const estados = { ...(rev.estados || {}) };
        estados[itemKey] = value;

        // si deja de ser MALO, limpia errores de ese item
        return { ...r, revision: { ...rev, estados } };
      })
    );

    // limpia errores si ya no es malo
    setErrors((p) => {
      const k = `${rowIdx}:${itemKey}`;
      if (value === "MALO") return p;
      if (!p[k]) return p;
      const copy = { ...p };
      delete copy[k];
      return copy;
    });
  }

  function setRevisionNota(rowIdx, itemKey, text) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== rowIdx) return r;
        const rev = r.revision || createEmptyRevision();
        return {
          ...r,
          revision: { ...rev, notas: { ...(rev.notas || {}), [itemKey]: text } },
        };
      })
    );
  }

  function setRevisionAccion(rowIdx, itemKey, patch) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== rowIdx) return r;
        const rev = r.revision || createEmptyRevision();
        const act = (rev.acciones || {})[itemKey] || { que: "", quien: "", cuando: "", responsable: null };
        return {
          ...r,
          revision: {
            ...rev,
            acciones: { ...(rev.acciones || {}), [itemKey]: { ...act, ...patch } },
          },
        };
      })
    );
  }

  function addRow() {
    setRows((prev) => [...prev, createEmptyRow()]);
  }

  function removeRow(index) {
    setRows((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      return next.length ? next : [createEmptyRow()];
    });
  }

  function validateAll() {
    const newErrors = {};

    rows.forEach((row, rowIdx) => {
      // capacidad numérica
      if (row.capacidad && !isValidDecimal(row.capacidad)) {
        newErrors[`row:${rowIdx}:capacidad`] = "Capacidad debe ser numérica (ej: 10,5 o 10.5).";
      }

      // validación extra: si tipo = PQS -> pqs_clase requerido
      if (String(row.tipo || "").toUpperCase() === "PQS" && !String(row.pqs_clase || "").trim()) {
        newErrors[`row:${rowIdx}:pqs_clase`] = "Selecciona BC o ABC.";
      }
      // si tipo = OTROS -> descripción requerida
      if (String(row.tipo || "").toUpperCase() === "OTROS" && !String(row.tipo_otro_desc || "").trim()) {
        newErrors[`row:${rowIdx}:tipo_otro_desc`] = "Describe el tipo (OTROS).";
      }

      // regla plantilla 3: si un componente es MALO => nota + plan acción obligatorio
      const rev = row.revision || createEmptyRevision();
      for (const sec of REVISION_SECTIONS) {
        for (const it of sec.items) {
          const estado = rev.estados?.[it.key] || "";
          if (estado !== "MALO") continue;

          const note = String(rev.notas?.[it.key] || "").trim();
          const act = rev.acciones?.[it.key] || {};
          const quienText = typeof act.quien === "string" ? act.quien : act?.quien?.nombre || "";

          const k = `${rowIdx}:${it.key}`;
          if (note.length < 10) {
            newErrors[k] = { ...(newErrors[k] || {}), note: "Obligatorio si es MALO (min. 10 caracteres)." };
          }
          if (!act.que || String(act.que).trim().length < 5) {
            newErrors[k] = { ...(newErrors[k] || {}), que: "Indica Qué (min. 5 caracteres)." };
          }
          if (!quienText || String(quienText).trim().length < 3) {
            newErrors[k] = { ...(newErrors[k] || {}), quien: "Indica Quién (responsable)." };
          }
          if (!act.cuando) {
            newErrors[k] = { ...(newErrors[k] || {}), cuando: "Indica Cuándo (fecha)." };
          }
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validateAll()) return;

    // normaliza capacidad a punto si quieres
    const normalizedRows = rows.map((r) => ({
      ...r,
      capacidad: String(r.capacidad || "").replace(",", "."),
    }));

    onSubmit?.({
      tipo: "tabla_extintores",
      respuestas: serializeTablaExtintoresRows(normalizedRows),
      resumen: { total, respondidas: filled },
      createdAt: new Date().toISOString(),
      // opcional: por si luego quieres subir evidencias (aquí ya no hay)
      rows: normalizedRows,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="ins-form">
      <div className="ins-header">
        <div>
          <div className="ins-title">Rellenar inspección</div>
          <div className="ins-sub" style={{ marginTop: 6 }}>
            Si marcas <b>MALO</b> en un componente, debes completar observación y plan de acción.
          </div>
        </div>
        <div className="ins-progress">
          <span>{filled}/{total} filas completas</span>
          <Button type="button" variant="outline" onClick={addRow}>Agregar fila</Button>
          <Button type="submit">Guardar</Button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((row, idx) => (
          <div key={`ext-${idx}`} className="card ins-item" style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <b>Fila {idx + 1}</b>
              <Button type="button" variant="ghost" onClick={() => removeRow(idx)}>Eliminar</Button>
            </div>

            {/* Datos principales */}
            <div className="ins-grid">
              <label className="ins-field">
                <span>Código</span>
                <input className="ins-input" value={row.codigo}
                  onChange={(e) => updateRow(idx, { codigo: e.target.value })} />
              </label>

              <label className="ins-field">
                <span>Ubicación</span>
                <input className="ins-input" value={row.ubicacion}
                  onChange={(e) => updateRow(idx, { ubicacion: e.target.value })} />
              </label>

              <label className="ins-field">
                <span>Tipo</span>
                <select
                  className="ins-input"
                  value={row.tipo}
                  onChange={(e) => {
                    const v = e.target.value;
                    // al cambiar tipo, resetea campos condicionales
                    updateRow(idx, {
                      tipo: v,
                      pqs_clase: v === "PQS" ? row.pqs_clase : "",
                      tipo_otro_desc: v === "OTROS" ? row.tipo_otro_desc : "",
                    });
                  }}
                >
                  <option value="">-- Seleccionar --</option>
                  {tiposOpciones.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>

                {/* 👇 campo condicional inmediatamente debajo */}
                {String(row.tipo || "").toUpperCase() === "PQS" ? (
                  <div style={{ marginTop: 10 }}>
                    <label className="ins-field" style={{ marginTop: 0 }}>
                      <span>Clase PQS (BC / ABC)</span>
                      <select
                        className={`ins-input ${errors[`row:${idx}:pqs_clase`] ? "is-error" : ""}`}
                        value={row.pqs_clase}
                        onChange={(e) => updateRow(idx, { pqs_clase: e.target.value })}
                      >
                        <option value="">-- Seleccionar --</option>
                        {PQS_CLASES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {errors[`row:${idx}:pqs_clase`] ? <div className="ins-error">{errors[`row:${idx}:pqs_clase`]}</div> : null}
                    </label>
                  </div>
                ) : null}

                {String(row.tipo || "").toUpperCase() === "OTROS" ? (
                  <div style={{ marginTop: 10 }}>
                    <label className="ins-field" style={{ marginTop: 0 }}>
                      <span>Descripción (OTROS)</span>
                      <input
                        className={`ins-input ${errors[`row:${idx}:tipo_otro_desc`] ? "is-error" : ""}`}
                        value={row.tipo_otro_desc}
                        onChange={(e) => updateRow(idx, { tipo_otro_desc: e.target.value })}
                        placeholder="Ej: espuma, clase K, etc."
                      />
                      {errors[`row:${idx}:tipo_otro_desc`] ? <div className="ins-error">{errors[`row:${idx}:tipo_otro_desc`]}</div> : null}
                    </label>
                  </div>
                ) : null}
              </label>

              <label className="ins-field">
                <span>Capacidad</span>
                <input
                  className={`ins-input ${errors[`row:${idx}:capacidad`] ? "is-error" : ""}`}
                  value={row.capacidad}
                  inputMode="decimal"
                  placeholder="Ej: 10,5"
                  onChange={(e) => updateRow(idx, { capacidad: onlyNumericLike(e.target.value) })}
                />
                {errors[`row:${idx}:capacidad`] ? <div className="ins-error">{errors[`row:${idx}:capacidad`]}</div> : null}
              </label>

              <label className="ins-field">
                <span>Fecha prueba</span>
                <input type="date" className="ins-input"
                  value={row.fecha_prueba}
                  onChange={(e) => updateRow(idx, { fecha_prueba: e.target.value })}
                />
              </label>
            </div>

            {/* REVISIÓN ESTADO GENERAL */}
            <div className="ins-section" style={{ marginTop: 2 }}>
              <div className="ins-section-title">REVISIÓN ESTADO GENERAL</div>

              {REVISION_SECTIONS.map((sec) => (
                <div key={sec.titulo} style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 900, marginBottom: 10 }}>{sec.titulo}</div>

                  <div className="ins-grid">
                    {sec.items.map((it) => {
                      const rev = row.revision || createEmptyRevision();
                      const value = rev.estados?.[it.key] || "";
                      const errKey = `${idx}:${it.key}`;
                      const err = errors[errKey] || {};
                      const act = rev.acciones?.[it.key] || { que: "", quien: "", cuando: "", responsable: null };

                      const optName = `rev_${idx}_${it.key}`;
                      return (
                        <div key={it.key} className="card ins-item">
                          <div className="ins-item-top">
                            <div className="ins-item-title">{it.label}</div>
                            <div className="ins-item-badge">
                              {value === "BUENO" ? (
                                <span className="status-badge good">BUENO</span>
                              ) : value === "MALO" ? (
                                <span className="status-badge bad">MALO</span>
                              ) : value === "NA" ? (
                                <span className="status-badge na">N/A</span>
                              ) : (
                                <span className="status-badge pending">Sin responder</span>
                              )}
                            </div>
                          </div>

                          {/* mismo formato de plantilla 3 */}
                          <div className="ins-options">
                            <Option name={optName} label="BUENO" checked={value === "BUENO"} onChange={() => setRevisionEstado(idx, it.key, "BUENO")} />
                            <Option name={optName} label="MALO" checked={value === "MALO"} onChange={() => setRevisionEstado(idx, it.key, "MALO")} />
                            <Option name={optName} label="N/A" checked={value === "NA"} onChange={() => setRevisionEstado(idx, it.key, "NA")} />
                          </div>

                          {/* 🔥 NO mostrar observación si NO es MALO */}
                          {value === "MALO" ? (
                            <>
                              <div className="ins-note">
                                <label className="ins-note-label">
                                  <span className="ins-required">
                                    <span className="dot" />
                                    Observación (obligatoria)
                                  </span>
                                </label>
                                <textarea
                                  className={`ins-note-input ${err.note ? "is-error" : ""}`}
                                  rows={2}
                                  value={rev.notas?.[it.key] || ""}
                                  onChange={(e) => setRevisionNota(idx, it.key, e.target.value)}
                                  placeholder="Detalla observaciones y medidas correctivas."
                                />
                                {err.note ? <div className="ins-error">{err.note}</div> : null}
                              </div>

                              <div className="ins-action">
                                <div className="ins-action-title">Plan de acción (obligatorio)</div>

                                <label className="ins-field">
                                  <span>Qué</span>
                                  <textarea
                                    className={`ins-note-input ${err.que ? "is-error" : ""}`}
                                    rows={3}
                                    value={act.que || ""}
                                    onChange={(e) => setRevisionAccion(idx, it.key, { que: e.target.value })}
                                    placeholder="Describe la acción correctiva inmediata..."
                                  />
                                  {err.que ? <div className="ins-error">{err.que}</div> : null}
                                </label>

                                <label className="ins-field">
                                  <span>Quién</span>
                                  <Autocomplete
                                    placeholder="DNI / Apellido / Nombre"
                                    displayValue={act.quien || ""}
                                    options={respOptions[`${idx}:${it.key}`] || []}
                                    getOptionLabel={(e) => {
                                      const nom = `${e.apellidos ?? ""} ${e.nombres ?? ""}`.trim();
                                      const dni = e.dni ? `(${e.dni})` : "";
                                      const cargo = e.cargo ? `- ${e.cargo}` : "";
                                      return `${nom} ${dni} ${cargo}`.trim();
                                    }}
                                    onFocus={async () => {
                                      try {
                                        const list = await buscarEmpleados("");
                                        setRespOptions((p) => ({ ...p, [`${idx}:${it.key}`]: Array.isArray(list) ? list : [] }));
                                      } catch {
                                        setRespOptions((p) => ({ ...p, [`${idx}:${it.key}`]: [] }));
                                      }
                                    }}
                                    onInputChange={async (txt) => {
                                      setRevisionAccion(idx, it.key, {
                                        quien: txt,
                                        responsable: txt?.trim()
                                          ? { tipo: "EXTERNO", nombre: txt.trim(), cargo: "EXTERNO" }
                                          : null,
                                      });

                                      if (!txt.trim()) {
                                        setRespOptions((p) => ({ ...p, [`${idx}:${it.key}`]: [] }));
                                        return;
                                      }

                                      try {
                                        const list = await buscarEmpleados(txt.trim());
                                        setRespOptions((p) => ({ ...p, [`${idx}:${it.key}`]: Array.isArray(list) ? list : [] }));
                                      } catch {
                                        setRespOptions((p) => ({ ...p, [`${idx}:${it.key}`]: [] }));
                                      }
                                    }}
                                    onSelect={(e) => {
                                      const nombre = `${e.apellidos ?? ""} ${e.nombres ?? ""}`.trim();
                                      const label = `${nombre}${e.dni ? ` (${e.dni})` : ""}`;
                                      setRevisionAccion(idx, it.key, {
                                        quien: label,
                                        responsable: {
                                          tipo: "INTERNO",
                                          dni: e.dni || "",
                                          nombre: nombre || e.dni || "",
                                          cargo: e.cargo || "",
                                        },
                                      });
                                      setRespOptions((p) => ({ ...p, [`${idx}:${it.key}`]: [] }));
                                    }}
                                    allowCustom
                                    onCreateCustom={(text) => {
                                      setRevisionAccion(idx, it.key, {
                                        quien: text,
                                        responsable: { tipo: "EXTERNO", nombre: text, cargo: "EXTERNO" },
                                      });
                                      setRespOptions((p) => ({ ...p, [`${idx}:${it.key}`]: [] }));
                                    }}
                                  />
                                  {err.quien ? <div className="ins-error">{err.quien}</div> : null}
                                </label>

                                <label className="ins-field">
                                  <span>Cuándo</span>
                                  <input
                                    type="date"
                                    className={`ins-input ${err.cuando ? "is-error" : ""}`}
                                    value={act.cuando || ""}
                                    onChange={(e) => setRevisionAccion(idx, it.key, { cuando: e.target.value })}
                                  />
                                  {err.cuando ? <div className="ins-error">{err.cuando}</div> : null}
                                </label>
                              </div>
                            </>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Fecha vencimiento después de la revisión */}
              <div className="ins-grid" style={{ marginTop: 14 }}>
                <label className="ins-field">
                  <span>Fecha de vencimiento</span>
                  <input
                    type="date"
                    className="ins-input"
                    value={row.fecha_vencimiento || ""}
                    onChange={(e) => updateRow(idx, { fecha_vencimiento: e.target.value })}
                  />
                </label>
              </div>
            </div>

            {/* Observaciones generales (se quedan) */}
            <label className="ins-field">
              <span>Observaciones</span>
              <textarea
                className="ins-note-input"
                rows={2}
                value={row.observaciones}
                onChange={(e) => updateRow(idx, { observaciones: e.target.value })}
              />
            </label>

            {/* ✅ eliminado: evidencia fotos */}
          </div>
        ))}
      </div>
    </form>
  );
}