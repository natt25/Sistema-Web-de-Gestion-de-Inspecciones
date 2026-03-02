import { useMemo, useState } from "react";
import Button from "../ui/Button.jsx";
import { serializeTablaExtintoresRows } from "../../utils/plantillaRenderer.js";

const ESTADOS_DEFAULT = ["BUENO", "MALO", "NA"];
const TIPOS_DEFAULT = ["PQS", "CO2", "AGUA", "OTROS"];
const PQS_CLASES_DEFAULT = ["BC", "ABC"];

function createEmptyRow() {
  return {
    codigo: "",
    ubicacion: "",

    // Tipo + subcampos condicionales
    tipo: "PQS",
    pqs_clase: "BC",           // SOLO si tipo === PQS
    otros_descripcion: "",     // SOLO si tipo === OTROS

    // Datos generales
    capacidad: "",
    fecha_prueba: "",
    fecha_vencimiento: "",

    // Estados (BUENO / MALO / NA) - TODOS los del cuadro
    pintura: "NA",
    golpes: "NA",
    autoadhesivo_fecha_tipo: "NA",
    cilindro_transporte: "NA",
    manija_transporte: "NA",
    manija_disparo: "NA",
    presion: "NA",
    manometro: "NA",
    boquilla: "NA",
    manguera: "NA",
    ring_aro_seguridad: "NA",
    corneta: "NA",
    senializacion: "NA",
    soporte_colgar_ruedas: "NA",

    // Texto final
    observaciones: "",
  };
}

function mapInitialRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [createEmptyRow()];
  return rows.map((row) => {
    const merged = { ...createEmptyRow(), ...row };

    // Si viene tipo distinto, asegurar defaults coherentes
    if (merged.tipo !== "PQS") merged.pqs_clase = createEmptyRow().pqs_clase;
    if (merged.tipo !== "OTROS") merged.otros_descripcion = "";

    return merged;
  });
}

function FieldSelect({ label, value, onChange, options }) {
  return (
    <label className="ins-field">
      <span>{label}</span>
      <select className="ins-input" value={value} onChange={onChange}>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </label>
  );
}

// Solo números y coma (ej: 4,5). Sin letras.
function normalizeCapacidadInput(raw) {
  const s = String(raw ?? "");
  // permitir dígitos y coma
  let out = s.replace(/[^\d,]/g, "");
  // solo 1 coma
  const firstComma = out.indexOf(",");
  if (firstComma !== -1) {
    out = out.slice(0, firstComma + 1) + out.slice(firstComma + 1).replace(/,/g, "");
  }
  return out;
}

export default function TablaExtintoresForm({ onSubmit, initialRows = [], definicion }) {
  const [rows, setRows] = useState(() => mapInitialRows(initialRows));

  const estadoOpciones =
    Array.isArray(definicion?.estado_opciones) && definicion.estado_opciones.length
      ? definicion.estado_opciones
      : ESTADOS_DEFAULT;

  const tiposOpciones =
    Array.isArray(definicion?.tipos) && definicion.tipos.length
      ? definicion.tipos
      : TIPOS_DEFAULT;

  const pqsClases =
    Array.isArray(definicion?.pqs_clases) && definicion.pqs_clases.length
      ? definicion.pqs_clases
      : PQS_CLASES_DEFAULT;

  const total = rows.length;
  const filled = useMemo(
    () =>
      rows.filter(
        (r) => String(r?.codigo || "").trim() || String(r?.ubicacion || "").trim()
      ).length,
    [rows]
  );

  function updateRow(index, key, value) {
    setRows((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, [key]: value } : row))
    );
  }

  function onChangeTipo(index, nextTipo) {
    setRows((prev) =>
      prev.map((row, idx) => {
        if (idx !== index) return row;
        const next = { ...row, tipo: nextTipo };

        // reset condicionales
        if (nextTipo !== "PQS") next.pqs_clase = createEmptyRow().pqs_clase;
        if (nextTipo !== "OTROS") next.otros_descripcion = "";

        return next;
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

  function handleSubmit(e) {
    e.preventDefault();

    // limpieza final por seguridad
    const cleaned = rows.map((r) => {
      const out = { ...r };
      if (out.tipo !== "PQS") out.pqs_clase = createEmptyRow().pqs_clase;
      if (out.tipo !== "OTROS") out.otros_descripcion = "";
      out.capacidad = normalizeCapacidadInput(out.capacidad);
      return out;
    });

    onSubmit?.({
      tipo: "tabla_extintores",
      respuestas: serializeTablaExtintoresRows(cleaned),
      resumen: { total, respondidas: filled },
      createdAt: new Date().toISOString(),
    });
  }

  // Lista de estados (para render fácil)
  const estadoFields = [
    { key: "pintura", label: "Pintura" },
    { key: "golpes", label: "Golpes" },
    { key: "autoadhesivo_fecha_tipo", label: "Autoadhesivo Fecha/Tipo" },
    { key: "cilindro_transporte", label: "Cilindro transporte" },
    { key: "manija_transporte", label: "Manija transporte" },
    { key: "manija_disparo", label: "Manija disparo" },
    { key: "presion", label: "Presión" },
    { key: "manometro", label: "Manómetro" },
    { key: "boquilla", label: "Boquilla" },
    { key: "manguera", label: "Manguera" },
    { key: "ring_aro_seguridad", label: "Ring / Aro seguridad" },
    { key: "corneta", label: "Corneta" },
    { key: "senializacion", label: "Señalización" },
    { key: "soporte_colgar_ruedas", label: "Soporte colgar / ruedas" },
  ];

  return (
    <form onSubmit={handleSubmit} className="ins-form">
      <div className="ins-header">
        <div>
          <div className="ins-title">Rellenar inspección</div>
          <div className="ins-sub" style={{ marginTop: 6 }}>
            Registra estado de extintores por fila.
          </div>
        </div>
        <div className="ins-progress">
          <span>{filled}/{total} filas completas</span>
          <Button type="button" variant="outline" onClick={addRow}>
            Agregar fila
          </Button>
          <Button type="submit">Guardar</Button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((row, idx) => (
          <div
            key={`ext-${idx}`}
            className="card ins-item"
            style={{ display: "grid", gap: 10 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <b>Fila {idx + 1}</b>
              <Button type="button" variant="ghost" onClick={() => removeRow(idx)}>
                Eliminar
              </Button>
            </div>

            {/* Datos generales */}
            <div className="ins-grid">
              <label className="ins-field">
                <span>Código</span>
                <input
                  className="ins-input"
                  value={row.codigo}
                  onChange={(e) => updateRow(idx, "codigo", e.target.value)}
                />
              </label>

              <label className="ins-field">
                <span>Ubicación</span>
                <input
                  className="ins-input"
                  value={row.ubicacion}
                  onChange={(e) => updateRow(idx, "ubicacion", e.target.value)}
                />
              </label>

              <FieldSelect
                label="Tipo"
                value={row.tipo}
                options={tiposOpciones}
                onChange={(e) => onChangeTipo(idx, e.target.value)}
              />

              <label className="ins-field">
                <span>Capacidad</span>
                <input
                  className="ins-input"
                  inputMode="decimal"
                  placeholder="Ej: 4,5"
                  value={row.capacidad}
                  onChange={(e) => updateRow(idx, "capacidad", normalizeCapacidadInput(e.target.value))}
                />
              </label>

              <label className="ins-field">
                <span>Fecha prueba</span>
                <input
                  type="date"
                  className="ins-input"
                  value={row.fecha_prueba}
                  onChange={(e) => updateRow(idx, "fecha_prueba", e.target.value)}
                />
              </label>
            </div>

            {/* Condicionales por tipo */}
            {row.tipo === "PQS" ? (
              <div className="ins-grid">
                <FieldSelect
                  label="Tipo PQS (BC / ABC)"
                  value={row.pqs_clase}
                  options={pqsClases}
                  onChange={(e) => updateRow(idx, "pqs_clase", e.target.value)}
                />
              </div>
            ) : null}

            {row.tipo === "OTROS" ? (
              <div className="ins-grid">
                <label className="ins-field">
                  <span>Descripción (OTROS)</span>
                  <input
                    className="ins-input"
                    value={row.otros_descripcion}
                    onChange={(e) => updateRow(idx, "otros_descripcion", e.target.value)}
                    placeholder="Describe el tipo..."
                  />
                </label>
              </div>
            ) : null}

            {/* Estados generales (todos los del cuadro) */}
            <div className="ins-grid">
              {estadoFields.map((f) => (
                <FieldSelect
                  key={f.key}
                  label={f.label}
                  value={row[f.key] ?? "NA"}
                  options={estadoOpciones}
                  onChange={(e) => updateRow(idx, f.key, e.target.value)}
                />
              ))}
            </div>

            {/* Fecha vencimiento antes de observaciones */}
            <div className="ins-grid">
              <label className="ins-field">
                <span>Fecha de vencimiento</span>
                <input
                  type="date"
                  className="ins-input"
                  value={row.fecha_vencimiento}
                  onChange={(e) => updateRow(idx, "fecha_vencimiento", e.target.value)}
                />
              </label>
            </div>

            <label className="ins-field">
              <span>Observaciones</span>
              <textarea
                className="ins-note-input"
                rows={2}
                value={row.observaciones}
                onChange={(e) => updateRow(idx, "observaciones", e.target.value)}
              />
            </label>
          </div>
        ))}
      </div>
    </form>
  );
}