import { useMemo, useState } from "react";
import Autocomplete from "../ui/Autocomplete.jsx";
import Button from "../ui/Button.jsx";
import { getUser } from "../../auth/auth.storage.js";
import { buildEmpleadoDisplayName, buildEmpleadoOptionLabel } from "../../utils/empleados.js";
import { serializeObservacionesAccionesRows } from "../../utils/plantillaRenderer.js";

const RISK_OPTIONS = ["BAJO", "MEDIO", "ALTO"];

function createEmptyRow() {
  return {
    observacion: "",
    evidencia_obs_files: [],
    evidencia_obs: [],
    riesgo: "",
    accion_correctiva: "",
    fecha_ejecucion: "",
    responsable: "",
    responsable_data: null,
    evidencia_lev_files: [],
    evidencia_lev: [],
    porcentaje: "",
  };
}

function normalizeInitialRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [createEmptyRow()];
  return rows.map((row) => ({ ...createEmptyRow(), ...row }));
}

function isRequiredOk(row) {
  return (
    String(row?.observacion || "").trim().length > 0
    && Array.isArray(row?.evidencia_obs_files)
    && row.evidencia_obs_files.length > 0
    && RISK_OPTIONS.includes(String(row?.riesgo || "").toUpperCase())
    && String(row?.accion_correctiva || "").trim().length > 0
    && String(row?.fecha_ejecucion || "").trim().length > 0
    && String(row?.responsable || "").trim().length > 0
  );
}

function PreviewGrid({ files = [] }) {
  if (!files.length) return null;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
      {files.map((f) => {
        const url = URL.createObjectURL(f);
        return (
          <div key={`${f.name}-${f.size}-${f.lastModified}`} style={{
            width: 130,
            border: "1px solid #ddd",
            borderRadius: 10,
            overflow: "hidden",
            background: "#fff"
          }}>
            <img
              src={url}
              alt={f.name}
              style={{ width: "100%", height: 90, objectFit: "cover" }}
              onLoad={() => URL.revokeObjectURL(url)}
            />
            <div style={{ padding: 6, fontSize: 11 }}>{f.name}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function TablaObservacionesSeguridadForm({
  initialRows = [],
  buscarEmpleados,
  onSubmit,
}) {
  const esInvitado = String(getUser()?.rol || "").trim().toUpperCase() === "INVITADO";
  const [rows, setRows] = useState(() => normalizeInitialRows(initialRows));
  const [respOptions, setRespOptions] = useState({});

  const total = rows.length;
  const filled = useMemo(() => rows.filter((row) => isRequiredOk(row)).length, [rows]);

  function updateRow(index, patch) {
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  }

  function updateFiles(index, keyFiles, keyNames, fileList) {
    const files = Array.from(fileList || []);
    const names = files.map((f) => f.name);
    if (keyFiles === "evidencia_lev_files" && files.length === 0) {
      updateRow(index, { [keyFiles]: files, [keyNames]: names, porcentaje: "" });
      return;
    }
    updateRow(index, { [keyFiles]: files, [keyNames]: names });
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

    const invalidIndex = rows.findIndex((row) => !isRequiredOk(row));
    if (invalidIndex >= 0) {
      alert(`Completa los campos obligatorios de la observacion ${invalidIndex + 1}.`);
      return;
    }

    onSubmit?.({
      tipo: "observaciones_acciones",
      respuestas: serializeObservacionesAccionesRows(rows),
      rowsWithRef: rows.map((row, idx) => ({
        item_ref: `row_${idx + 1}`,
        evidencia_obs_files: row.evidencia_obs_files || [],
        evidencia_lev_files: row.evidencia_lev_files || [],
      })),
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
            Registra observaciones y acciones correctivas por observación.
          </div>
        </div>

        <div className="ins-progress">
          <span>{filled}/{total} listas</span>
          {!esInvitado ? <Button type="submit">Guardar</Button> : null}
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((row, idx) => {
          const hasLev = (row.evidencia_lev_files || []).length > 0;
          return (
            <div key={`seg-${idx}`} className="card ins-item" style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <b>Observación {idx + 1}</b>
                {!esInvitado ? (
                  <Button type="button" variant="outline" onClick={() => removeRow(idx)}>X</Button>
                ) : null}
              </div>

              <label className="ins-field">
                <span>Observación *</span>
                <textarea
                  className="ins-note-input"
                  rows={3}
                  value={row.observacion}
                  disabled={esInvitado}
                  onChange={(e) => updateRow(idx, { observacion: e.target.value })}
                />
              </label>

              {!esInvitado ? <label className="ins-field">
                <span>Evidencia fotográfica de observación *</span>
                <input
                  className="ins-input"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => updateFiles(idx, "evidencia_obs_files", "evidencia_obs", e.target.files)}
                />
                <PreviewGrid files={row.evidencia_obs_files || []} />
              </label> : null}

              <div className="ins-field">
                <span>Nivel de riesgo *</span>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
                  {RISK_OPTIONS.map((opt) => (
                    <label key={`${idx}-${opt}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="radio"
                        name={`riesgo_${idx}`}
                        disabled={esInvitado}
                        checked={String(row.riesgo || "").toUpperCase() === opt}
                        onChange={() => updateRow(idx, { riesgo: opt })}
                      />
                      {opt.charAt(0) + opt.slice(1).toLowerCase()}
                    </label>
                  ))}
                </div>
              </div>

              <label className="ins-field">
                <span>Acción correctiva *</span>
                <textarea
                  className="ins-note-input"
                  rows={3}
                  value={row.accion_correctiva}
                  disabled={esInvitado}
                  onChange={(e) => updateRow(idx, { accion_correctiva: e.target.value })}
                />
              </label>

              <div className="ins-grid">
                <label className="ins-field">
                  <span>Fecha de ejecución *</span>
                  <input
                    type="date"
                    className="ins-input"
                    value={row.fecha_ejecucion}
                    disabled={esInvitado}
                    onChange={(e) => updateRow(idx, { fecha_ejecucion: e.target.value })}
                  />
                </label>

                <label className="ins-field">
                  <span>Responsable *</span>
                  <Autocomplete
                    placeholder="DNI / Apellido / Nombre"
                    disabled={esInvitado}
                    displayValue={row.responsable || ""}
                    options={respOptions[idx] || []}
                    getOptionLabel={buildEmpleadoOptionLabel}
                    onFocus={async () => {
                      if (esInvitado) return;
                      const items = await buscarEmpleados?.("");
                      setRespOptions((prev) => ({ ...prev, [idx]: Array.isArray(items) ? items : [] }));
                    }}
                    onInputChange={async (text) => {
                      if (esInvitado) return;
                      updateRow(idx, { responsable: text, responsable_data: null });
                      const items = await buscarEmpleados?.(text);
                      setRespOptions((prev) => ({ ...prev, [idx]: Array.isArray(items) ? items : [] }));
                    }}
                    onSelect={(e) => {
                      if (esInvitado) return;
                      const nombreCompleto = buildEmpleadoDisplayName(e);
                      updateRow(idx, {
                        responsable: nombreCompleto,
                        responsable_data: {
                          dni: e.dni || "",
                          nombre: nombreCompleto || e.dni || "",
                          cargo: e.cargo || "",
                        },
                      });
                      setRespOptions((prev) => ({ ...prev, [idx]: [] }));
                    }}
                    allowCustom
                    onCreateCustom={(text) => {
                      if (esInvitado) return;
                      updateRow(idx, {
                        responsable: text,
                        responsable_data: { nombre: text, cargo: "EXTERNO" },
                      });
                      setRespOptions((prev) => ({ ...prev, [idx]: [] }));
                    }}
                  />
                </label>
              </div>

              <div className="ins-grid">
                {!esInvitado ? <label className="ins-field">
                  <span>Evidencia de levantamiento (opcional)</span>
                  <input
                    className="ins-input"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => updateFiles(idx, "evidencia_lev_files", "evidencia_lev", e.target.files)}
                  />
                  <PreviewGrid files={row.evidencia_lev_files || []} />
                </label> : null}

                <label className="ins-field">
                  <span>% cumplimiento (opcional)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="ins-input"
                    value={row.porcentaje}
                    disabled={esInvitado || !hasLev}
                    placeholder={hasLev ? "0 - 100" : "Sube evidencia para habilitar"}
                    onChange={(e) => updateRow(idx, { porcentaje: e.target.value })}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {!esInvitado ? <Button type="button" variant="outline" onClick={addRow} style={{ width: "100%" }}>
        AGREGAR OBSERVACIÓN
      </Button> : null}
    </form>
  );
}
