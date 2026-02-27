import { useEffect, useMemo, useState } from "react";
import Autocomplete from "../ui/Autocomplete.jsx";
import Button from "../ui/Button.jsx";
import { serializeObservacionesAccionesRows } from "../../utils/plantillaRenderer.js";

const RISK_OPTIONS = ["BAJO", "MEDIO", "ALTO"];

// Preview estándar (misma caja para cualquier foto)
function PreviewGrid({ urls = [], onRemove }) {
  if (!urls.length) return null;

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
      {urls.map((url, i) => (
        <div
          key={`${url}-${i}`}
          style={{
            width: 160,
            height: 110,
            borderRadius: 12,
            border: "1px solid var(--border)",
            overflow: "hidden",
            position: "relative",
            background: "#fff",
          }}
        >
          <img
            src={url}
            alt={`preview-${i}`}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(i)}
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                border: 0,
                borderRadius: 10,
                padding: "6px 8px",
                cursor: "pointer",
                background: "rgba(0,0,0,.65)",
                color: "#fff",
                fontWeight: 800,
                fontSize: 12,
              }}
              title="Quitar imagen"
            >
              ✕
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function createEmptyRow() {
  return {
    observacion: "",

    // ✅ metadata que ya estabas guardando
    evidencia_obs: [],
    evidencia_lev: [],

    // ✅ UI files + previews (no se serializan)
    evidencia_obs_files: [],
    evidencia_obs_previews: [],
    evidencia_lev_files: [],
    evidencia_lev_previews: [],

    riesgo: "",
    accion_correctiva: "",
    fecha_ejecucion: "",
    responsable: "",
    responsable_data: null,

    porcentaje: "",
  };
}

function normalizeInitialRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [createEmptyRow()];
  return rows.map((row) => ({
    ...createEmptyRow(),
    ...row,
    // si vinieron nombres antiguos desde DB, los dejamos tal cual
    evidencia_obs: Array.isArray(row?.evidencia_obs) ? row.evidencia_obs : [],
    evidencia_lev: Array.isArray(row?.evidencia_lev) ? row.evidencia_lev : [],
  }));
}

function isRequiredOk(row) {
  return (
    String(row?.observacion || "").trim().length > 0 &&
    Array.isArray(row?.evidencia_obs) &&
    row.evidencia_obs.length > 0 &&
    RISK_OPTIONS.includes(String(row?.riesgo || "").toUpperCase()) &&
    String(row?.accion_correctiva || "").trim().length > 0 &&
    String(row?.fecha_ejecucion || "").trim().length > 0 &&
    String(row?.responsable || "").trim().length > 0
  );
}

export default function TablaObservacionesSeguridadForm({
  initialRows = [],
  buscarEmpleados,
  onSubmit,
}) {
  const [rows, setRows] = useState(() => normalizeInitialRows(initialRows));
  const [respOptions, setRespOptions] = useState({});

  useEffect(() => {
    // OJO: si vienes de DB, no hay files/preview; normalizamos igual.
    setRows(normalizeInitialRows(initialRows));
  }, [initialRows]);

  const total = rows.length;
  const filled = useMemo(() => rows.filter((row) => isRequiredOk(row)).length, [rows]);

  function updateRow(index, patch) {
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  }

  // ✅ guarda nombres (metadata) + File + preview URL
  function updateFiles(index, kind, fileList) {
    const files = Array.from(fileList || []);
    const names = files.map((f) => f.name);
    const urls = files.map((f) => URL.createObjectURL(f));

    if (kind === "obs") {
      // limpiar previews anteriores
      setRows((prev) =>
        prev.map((row, idx) => {
          if (idx !== index) return row;
          (row.evidencia_obs_previews || []).forEach((u) => {
            try { URL.revokeObjectURL(u); } catch {}
          });
          return {
            ...row,
            evidencia_obs: names,
            evidencia_obs_files: files,
            evidencia_obs_previews: urls,
          };
        })
      );
      return;
    }

    if (kind === "lev") {
      setRows((prev) =>
        prev.map((row, idx) => {
          if (idx !== index) return row;
          (row.evidencia_lev_previews || []).forEach((u) => {
            try { URL.revokeObjectURL(u); } catch {}
          });

          // ✅ regla: si NO hay evidencia_lev, NO puede haber porcentaje
          const nextPorc = names.length ? row.porcentaje : "";

          return {
            ...row,
            evidencia_lev: names,
            evidencia_lev_files: files,
            evidencia_lev_previews: urls,
            porcentaje: nextPorc,
          };
        })
      );
    }
  }

  function removePreview(index, kind, imgIndex) {
    setRows((prev) =>
      prev.map((row, idx) => {
        if (idx !== index) return row;

        if (kind === "obs") {
          const prevUrls = Array.isArray(row.evidencia_obs_previews) ? row.evidencia_obs_previews : [];
          const prevFiles = Array.isArray(row.evidencia_obs_files) ? row.evidencia_obs_files : [];
          const prevNames = Array.isArray(row.evidencia_obs) ? row.evidencia_obs : [];

          const urlToRemove = prevUrls[imgIndex];
          if (urlToRemove) {
            try { URL.revokeObjectURL(urlToRemove); } catch {}
          }

          const nextUrls = prevUrls.filter((_, i) => i !== imgIndex);
          const nextFiles = prevFiles.filter((_, i) => i !== imgIndex);
          const nextNames = prevNames.filter((_, i) => i !== imgIndex);

          return {
            ...row,
            evidencia_obs_previews: nextUrls,
            evidencia_obs_files: nextFiles,
            evidencia_obs: nextNames,
          };
        }

        if (kind === "lev") {
          const prevUrls = Array.isArray(row.evidencia_lev_previews) ? row.evidencia_lev_previews : [];
          const prevFiles = Array.isArray(row.evidencia_lev_files) ? row.evidencia_lev_files : [];
          const prevNames = Array.isArray(row.evidencia_lev) ? row.evidencia_lev : [];

          const urlToRemove = prevUrls[imgIndex];
          if (urlToRemove) {
            try { URL.revokeObjectURL(urlToRemove); } catch {}
          }

          const nextUrls = prevUrls.filter((_, i) => i !== imgIndex);
          const nextFiles = prevFiles.filter((_, i) => i !== imgIndex);
          const nextNames = prevNames.filter((_, i) => i !== imgIndex);

          // ✅ si queda vacío, limpia porcentaje
          const nextPorc = nextNames.length ? row.porcentaje : "";

          return {
            ...row,
            evidencia_lev_previews: nextUrls,
            evidencia_lev_files: nextFiles,
            evidencia_lev: nextNames,
            porcentaje: nextPorc,
          };
        }

        return row;
      })
    );
  }

  function addRow() {
    setRows((prev) => [...prev, createEmptyRow()]);
  }

  function removeRow(index) {
    setRows((prev) => {
      // revocar urls para no filtrar memoria
      const toRemove = prev[index];
      (toRemove?.evidencia_obs_previews || []).forEach((u) => { try { URL.revokeObjectURL(u); } catch {} });
      (toRemove?.evidencia_lev_previews || []).forEach((u) => { try { URL.revokeObjectURL(u); } catch {} });

      const next = prev.filter((_, idx) => idx !== index);
      return next.length ? next : [createEmptyRow()];
    });
  }

  function handleSubmit(e) {
    e.preventDefault();

    const invalidIndex = rows.findIndex((row) => !isRequiredOk(row));
    if (invalidIndex >= 0) {
      alert(`Completa los campos obligatorios de la observacion ${invalidIndex + 1}.`);
      return;
    }

    // ✅ Regla extra: si escribieron porcentaje sin evidencia_lev -> bloquear
    const badPorc = rows.findIndex((row) => {
      const p = String(row?.porcentaje ?? "").trim();
      if (!p) return false;
      return !(Array.isArray(row?.evidencia_lev) && row.evidencia_lev.length > 0);
    });
    if (badPorc >= 0) {
      alert(`En observacion ${badPorc + 1}: para ingresar % cumplimiento debes subir evidencia de levantamiento.`);
      return;
    }

    onSubmit?.({
      tipo: "observaciones_acciones",
      // ✅ serialize solo metadata (strings)
      respuestas: serializeObservacionesAccionesRows(
        rows.map((r) => ({
          ...r,
          // por seguridad, no enviamos files/previews en el json
          evidencia_obs_files: undefined,
          evidencia_obs_previews: undefined,
          evidencia_lev_files: undefined,
          evidencia_lev_previews: undefined,
        }))
      ),
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
            Registra observaciones y acciones correctivas por observacion.
          </div>
        </div>

        <div className="ins-progress">
          <span>{filled}/{total} listas</span>
          <Button type="submit">Guardar</Button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((row, idx) => {
          const hasLev = Array.isArray(row?.evidencia_lev) && row.evidencia_lev.length > 0;

          return (
            <div key={`seg-${idx}`} className="card ins-item" style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <b>Observacion {idx + 1}</b>
                <Button type="button" variant="ghost" onClick={() => removeRow(idx)}>Eliminar</Button>
              </div>

              <label className="ins-field">
                <span>Observacion *</span>
                <textarea
                  className="ins-note-input"
                  rows={3}
                  value={row.observacion}
                  onChange={(e) => updateRow(idx, { observacion: e.target.value })}
                />
              </label>

              <label className="ins-field">
                <span>Evidencia fotografica de observacion *</span>
                <input
                  className="ins-input"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => updateFiles(idx, "obs", e.target.files)}
                />

                {/* ✅ PREVIEW OBS */}
                <PreviewGrid
                  urls={row.evidencia_obs_previews || []}
                  onRemove={(imgIndex) => removePreview(idx, "obs", imgIndex)}
                />
              </label>

              <div className="ins-field">
                <span>Nivel de riesgo *</span>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
                  {RISK_OPTIONS.map((opt) => (
                    <label key={`${idx}-${opt}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="radio"
                        name={`riesgo_${idx}`}
                        checked={String(row.riesgo || "").toUpperCase() === opt}
                        onChange={() => updateRow(idx, { riesgo: opt })}
                      />
                      {opt.charAt(0) + opt.slice(1).toLowerCase()}
                    </label>
                  ))}
                </div>
              </div>

              <label className="ins-field">
                <span>Accion correctiva *</span>
                <textarea
                  className="ins-note-input"
                  rows={3}
                  value={row.accion_correctiva}
                  onChange={(e) => updateRow(idx, { accion_correctiva: e.target.value })}
                />
              </label>

              <div className="ins-grid">
                <label className="ins-field">
                  <span>Fecha de ejecucion *</span>
                  <input
                    type="date"
                    className="ins-input"
                    value={row.fecha_ejecucion}
                    onChange={(e) => updateRow(idx, { fecha_ejecucion: e.target.value })}
                  />
                </label>

                <label className="ins-field">
                  <span>Responsable *</span>
                  <Autocomplete
                    placeholder="DNI / Apellido / Nombre"
                    displayValue={row.responsable || ""}
                    options={respOptions[idx] || []}
                    getOptionLabel={(e) => {
                      const nom = `${e.apellidos ?? ""} ${e.nombres ?? ""}`.trim();
                      const dni = e.dni ? `(${e.dni})` : "";
                      const cargo = e.cargo ? `- ${e.cargo}` : "";
                      return `${nom} ${dni} ${cargo}`.trim();
                    }}
                    onFocus={async () => {
                      const items = await buscarEmpleados?.("");
                      setRespOptions((prev) => ({ ...prev, [idx]: Array.isArray(items) ? items : [] }));
                    }}
                    onInputChange={async (text) => {
                      updateRow(idx, { responsable: text, responsable_data: null });
                      const items = await buscarEmpleados?.(text);
                      setRespOptions((prev) => ({ ...prev, [idx]: Array.isArray(items) ? items : [] }));
                    }}
                    onSelect={(e) => {
                      const nom = `${e.apellidos ?? ""} ${e.nombres ?? ""}`.trim();
                      const label = `${nom}${e.dni ? ` (${e.dni})` : ""}`;
                      updateRow(idx, {
                        responsable: label,
                        responsable_data: {
                          dni: e.dni || "",
                          nombre: nom || e.dni || "",
                          cargo: e.cargo || "",
                        },
                      });
                      setRespOptions((prev) => ({ ...prev, [idx]: [] }));
                    }}
                    allowCustom
                    onCreateCustom={(text) => {
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
                <label className="ins-field">
                  <span>Evidencia de levantamiento (opcional)</span>
                  <input
                    className="ins-input"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => updateFiles(idx, "lev", e.target.files)}
                  />

                  {/* ✅ PREVIEW LEV */}
                  <PreviewGrid
                    urls={row.evidencia_lev_previews || []}
                    onRemove={(imgIndex) => removePreview(idx, "lev", imgIndex)}
                  />
                </label>

                <label className="ins-field">
                  <span>% cumplimiento (opcional)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="ins-input"
                    value={row.porcentaje}
                    disabled={!hasLev} // ✅ regla principal
                    placeholder={!hasLev ? "Sube evidencia para habilitar" : "0-100"}
                    onChange={(e) => updateRow(idx, { porcentaje: e.target.value })}
                  />
                  {!hasLev ? (
                    <div className="help">Para ingresar % cumplimiento debes subir evidencia de levantamiento.</div>
                  ) : null}
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <Button type="button" variant="outline" onClick={addRow} style={{ width: "100%" }}>
        AGREGAR OBSERVACION
      </Button>
    </form>
  );
}