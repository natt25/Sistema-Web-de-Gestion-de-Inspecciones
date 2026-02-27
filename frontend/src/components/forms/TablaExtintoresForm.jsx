import { useMemo, useState } from "react";
import Button from "../ui/Button.jsx";
import { serializeTablaExtintoresRows } from "../../utils/plantillaRenderer.js";

const ESTADOS_DEFAULT = ["BUENO", "MALO", "NA"];
const TIPOS_DEFAULT = ["PQS", "CO2", "AGUA", "OTROS"];

function createEmptyRow() {
  return {
    codigo: "",
    ubicacion: "",
    tipo: "PQS",
    capacidad: "",
    fecha_prueba: "",
    presion: "NA",
    manometro: "NA",
    manguera: "NA",
    senializacion: "NA",
    observaciones: "",
    evidencia_fotos: [],
  };
}

function mapInitialRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [createEmptyRow()];
  return rows.map((row) => ({
    ...createEmptyRow(),
    ...row,
  }));
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

export default function TablaExtintoresForm({ onSubmit, initialRows = [], definicion }) {
  const [rows, setRows] = useState(() => mapInitialRows(initialRows));
  const estadoOpciones = Array.isArray(definicion?.estado_opciones) && definicion.estado_opciones.length
    ? definicion.estado_opciones
    : ESTADOS_DEFAULT;
  const tiposOpciones = Array.isArray(definicion?.tipos) && definicion.tipos.length
    ? definicion.tipos
    : TIPOS_DEFAULT;

  const total = rows.length;
  const filled = useMemo(
    () => rows.filter((r) => String(r?.codigo || "").trim() || String(r?.ubicacion || "").trim()).length,
    [rows]
  );

  function updateRow(index, key, value) {
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [key]: value } : row)));
  }

  function updateFileNames(index, fileList) {
    const names = Array.from(fileList || []).map((f) => f.name);
    updateRow(index, "evidencia_fotos", names);
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
    onSubmit?.({
      tipo: "tabla_extintores",
      respuestas: serializeTablaExtintoresRows(rows),
      resumen: { total, respondidas: filled },
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="ins-form">
      <div className="ins-header">
        <div>
          <div className="ins-title">Rellenar inspeccion</div>
          <div className="ins-sub" style={{ marginTop: 6 }}>
            Registra estado de extintores por fila.
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
          <div key={`ext-${idx}`} className="card ins-item" style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <b>Fila {idx + 1}</b>
              <Button type="button" variant="ghost" onClick={() => removeRow(idx)}>Eliminar</Button>
            </div>

            <div className="ins-grid">
              <label className="ins-field">
                <span>Codigo</span>
                <input className="ins-input" value={row.codigo} onChange={(e) => updateRow(idx, "codigo", e.target.value)} />
              </label>
              <label className="ins-field">
                <span>Ubicacion</span>
                <input className="ins-input" value={row.ubicacion} onChange={(e) => updateRow(idx, "ubicacion", e.target.value)} />
              </label>
              <FieldSelect
                label="Tipo"
                value={row.tipo}
                options={tiposOpciones}
                onChange={(e) => updateRow(idx, "tipo", e.target.value)}
              />
              <label className="ins-field">
                <span>Capacidad</span>
                <input className="ins-input" value={row.capacidad} onChange={(e) => updateRow(idx, "capacidad", e.target.value)} />
              </label>
              <label className="ins-field">
                <span>Fecha prueba</span>
                <input type="date" className="ins-input" value={row.fecha_prueba} onChange={(e) => updateRow(idx, "fecha_prueba", e.target.value)} />
              </label>
            </div>

            <div className="ins-grid">
              <FieldSelect label="Presion" value={row.presion} options={estadoOpciones} onChange={(e) => updateRow(idx, "presion", e.target.value)} />
              <FieldSelect label="Manometro" value={row.manometro} options={estadoOpciones} onChange={(e) => updateRow(idx, "manometro", e.target.value)} />
              <FieldSelect label="Manguera" value={row.manguera} options={estadoOpciones} onChange={(e) => updateRow(idx, "manguera", e.target.value)} />
              <FieldSelect label="Senializacion" value={row.senializacion} options={estadoOpciones} onChange={(e) => updateRow(idx, "senializacion", e.target.value)} />
            </div>

            <label className="ins-field">
              <span>Observaciones</span>
              <textarea className="ins-note-input" rows={2} value={row.observaciones} onChange={(e) => updateRow(idx, "observaciones", e.target.value)} />
            </label>

            <label className="ins-field">
              <span>Evidencia fotos (opcional)</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="ins-input"
                onChange={(e) => updateFileNames(idx, e.target.files)}
              />
            </label>
          </div>
        ))}
      </div>
    </form>
  );
}
