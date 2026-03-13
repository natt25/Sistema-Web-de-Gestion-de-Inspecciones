import { useMemo, useState } from "react";
import Button from "../ui/Button.jsx";
import { getUser } from "../../auth/auth.storage.js";
import { serializeObservacionesAccionesRows } from "../../utils/plantillaRenderer.js";

function createEmptyRow() {
  return {
    observacion: "",
    accion_correctiva: "",
    fecha_ejecucion: "",
    porcentaje: "",
    responsable: "",
    evidencia_obs: [],
    evidencia_lev: [],
  };
}

function mapInitialRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [createEmptyRow()];
  return rows.map((row) => ({
    ...createEmptyRow(),
    ...row,
  }));
}

export default function TablaObservacionesForm({ onSubmit, initialRows = [] }) {
  const esInvitado = String(getUser()?.rol || "").trim().toUpperCase() === "INVITADO";
  const [rows, setRows] = useState(() => mapInitialRows(initialRows));

  const total = rows.length;
  const filled = useMemo(
    () => rows.filter((r) => String(r?.observacion || "").trim()).length,
    [rows]
  );

  function updateRow(index, key, value) {
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [key]: value } : row)));
  }

  function updateFileNames(index, key, fileList) {
    const names = Array.from(fileList || []).map((f) => f.name);
    updateRow(index, key, names);
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
    if (esInvitado) return;
    onSubmit?.({
      tipo: "observaciones_acciones",
      respuestas: serializeObservacionesAccionesRows(rows),
      resumen: { total, respondidas: filled },
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="ins-form">
      <div className="ins-header">
        <div>
          <div className="ins-title">Rellenar inspección</div>
          <div className="ins-sub" style={{ marginTop: 6 }}>
            Registra observaciones y acciones correctivas por fila.
          </div>
        </div>
        <div className="ins-progress">
          <span>{filled}/{total} con observación</span>
          {!esInvitado ? <Button type="button" variant="outline" onClick={addRow}>Agregar fila</Button> : null}
          {!esInvitado ? <Button type="submit">Guardar</Button> : null}
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((row, idx) => (
          <div key={`row-${idx}`} className="card ins-item" style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <b>Fila {idx + 1}</b>
              {!esInvitado ? <Button type="button" variant="outline" onClick={() => removeRow(idx)}>X</Button> : null}
            </div>

            <label className="ins-field">
              <span>OBSERVACIÓN</span>
              <textarea
                className="ins-note-input"
                rows={2}
                value={row.observacion}
                disabled={esInvitado}
                onChange={(e) => updateRow(idx, "observacion", e.target.value)}
              />
            </label>

            <label className="ins-field">
              <span>ACCIÓN CORRECTIVA</span>
              <textarea
                className="ins-note-input"
                rows={2}
                value={row.accion_correctiva}
                disabled={esInvitado}
                onChange={(e) => updateRow(idx, "accion_correctiva", e.target.value)}
              />
            </label>

            <div className="ins-grid">
              {!esInvitado ? <label className="ins-field">
                <span>Fecha ejecucion</span>
                <input
                  type="date"
                  className="ins-input"
                  value={row.fecha_ejecucion}
                  disabled={esInvitado}
                  onChange={(e) => updateRow(idx, "fecha_ejecucion", e.target.value)}
                />
              </label> : null}

              {!esInvitado ? <label className="ins-field">
                <span>Porcentaje (0-100)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="ins-input"
                  value={row.porcentaje}
                  disabled={esInvitado}
                  onChange={(e) => updateRow(idx, "porcentaje", e.target.value)}
                />
              </label> : null}

              {!esInvitado ? <label className="ins-field">
                <span>Responsable</span>
                <input
                  type="text"
                  className="ins-input"
                  value={row.responsable}
                  disabled={esInvitado}
                  onChange={(e) => updateRow(idx, "responsable", e.target.value)}
                />
              </label> : null}
            </div>

            <div className="ins-grid">
              {!esInvitado ? <label className="ins-field">
                <span>Evidencia Obs (opcional)</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="ins-input"
                  onChange={(e) => updateFileNames(idx, "evidencia_obs", e.target.files)}
                />
              </label> : null}

              {!esInvitado ? <label className="ins-field">
                <span>Evidencia Lev (opcional)</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="ins-input"
                  onChange={(e) => updateFileNames(idx, "evidencia_lev", e.target.files)}
                />
              </label> : null}
            </div>
          </div>
        ))}
      </div>
    </form>
  );
}
