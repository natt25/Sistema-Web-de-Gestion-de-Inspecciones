// frontend/src/components/forms/TablaLavaojosForm.jsx
import { useMemo, useState, useCallback } from "react";
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import Input from "../ui/Input.jsx";
import Badge from "../ui/Badge.jsx";
import Autocomplete from "../ui/Autocomplete.jsx";
import { buscarEmpleados } from "../../api/busquedas.api.js";
import { serializeTablaLavaojosPayload } from "../../utils/plantillaRenderer.js";

const DIAS = [
  { key: "LUNES", label: "Lunes" },
  { key: "MARTES", label: "Martes" },
  { key: "MIERCOLES", label: "Miércoles" },
  { key: "JUEVES", label: "Jueves" },
  { key: "VIERNES", label: "Viernes" },
  { key: "SABADO", label: "Sábado" },
  { key: "DOMINGO", label: "Domingo" },
];

const ESTADOS = ["BUENO", "MALO", "NA"];

function emptyDiaHeader() {
  return { fecha: "", realizado_por: null, firma: "" };
}

function emptyCell() {
  return {
    estado: "",
    observacion: "",
    accion: { que: "", quien: "", cuando: "" },
  };
}

function buildInitialModel(definicion, initial) {
  const items =
    Array.isArray(definicion?.items) && definicion.items.length
      ? definicion.items
      : [];

  // initial puede venir desde deserialize (si estás re-editando); si no, empieza vacío.
  const base = {
    meta: {
      codigo_lavaojos: initial?.meta?.codigo_lavaojos ?? "",
      responsable_proceso: initial?.meta?.responsable_proceso ?? "",
      dias: {},
    },
    items: [],
  };

  DIAS.forEach((d) => {
    base.meta.dias[d.key] = initial?.meta?.dias?.[d.key] ?? emptyDiaHeader();
  });

  base.items = items.map((it, idx) => {
    const saved = initial?.items?.find((x) => String(x.item_id) === String(it.id));
    const row = {
      item_id: it.id ?? String(idx + 1),
      descripcion: it.descripcion ?? it.desc ?? `Item ${idx + 1}`,
      dias: {},
    };
    DIAS.forEach((d) => {
      row.dias[d.key] = saved?.dias?.[d.key] ?? emptyCell();
    });
    return row;
  });

  return base;
}

function EstadoRadio({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {ESTADOS.map((s) => {
        const active = value === s;
        return (
          <label
            key={s}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: active ? "rgba(255,123,0,0.10)" : "transparent",
              cursor: "pointer",
              userSelect: "none",
              fontWeight: 700,
            }}
          >
            <input
              type="radio"
              checked={active}
              onChange={() => onChange(s)}
              style={{ accentColor: "var(--brand)" }}
            />
            {s === "NA" ? "N/A" : s}
          </label>
        );
      })}
    </div>
  );
}

function validateModel(model) {
  const errors = [];

  // valida celdas con MALO
  model.items.forEach((it) => {
    DIAS.forEach((d) => {
      const c = it.dias?.[d.key];
      if (c?.estado === "MALO") {
        if (!String(c.observacion || "").trim()) {
          errors.push(`Falta Observación en "${it.descripcion}" (${d.label}).`);
        }
        const que = String(c.accion?.que || "").trim();
        const quien = String(c.accion?.quien || "").trim();
        const cuando = String(c.accion?.cuando || "").trim();
        if (!que || !quien || !cuando) {
          errors.push(`Falta Plan de Acción (Qué/Quién/Cuándo) en "${it.descripcion}" (${d.label}).`);
        }
      }
    });
  });

  return errors;
}

export default function TablaLavaojosForm({ definicion, initial, onSubmit }) {
  const [uiError, setUiError] = useState("");
  const [saving, setSaving] = useState(false);

  const initialModel = useMemo(
    () => buildInitialModel(definicion, initial),
    [definicion, initial]
  );

  const [model, setModel] = useState(initialModel);

  const buscarEmpleadosForAutocomplete = useCallback(async (text) => {
    try {
      const rows = await buscarEmpleados(String(text || "").trim());
      return Array.isArray(rows) ? rows : [];
    } catch (err) {
      console.error("[TablaLavaojosForm] buscarEmpleados error", err);
      return [];
    }
  }, []);

  const setDiaHeader = (diaKey, patch) => {
    setModel((prev) => ({
      ...prev,
      meta: {
        ...prev.meta,
        dias: { ...prev.meta.dias, [diaKey]: { ...prev.meta.dias[diaKey], ...patch } },
      },
    }));
  };

  const setMeta = (patch) => setModel((prev) => ({ ...prev, meta: { ...prev.meta, ...patch } }));

  const setCell = (itemId, diaKey, patch) => {
    setModel((prev) => ({
      ...prev,
      items: prev.items.map((it) => {
        if (String(it.item_id) !== String(itemId)) return it;
        const current = it.dias?.[diaKey] ?? emptyCell();
        return { ...it, dias: { ...it.dias, [diaKey]: { ...current, ...patch } } };
      }),
    }));
  };

  const handleSubmit = async () => {
    setUiError("");
    const errs = validateModel(model);
    if (errs.length) {
      setUiError(errs[0]); // UX: muestra solo el primero (puedes mejorar luego con lista)
      return;
    }

    const payload = serializeTablaLavaojosPayload(model);

    try {
      setSaving(true);
      await onSubmit(payload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card title="Datos generales (Lavaojos portátil)">
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Código de Lavaojos</div>
            <Input
              value={model.meta.codigo_lavaojos}
              onChange={(e) => setMeta({ codigo_lavaojos: e.target.value })}
              placeholder="Ej: LO-001"
            />
          </div>

          <div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Responsable del proceso / servicio</div>
            <Input
              value={model.meta.responsable_proceso}
              onChange={(e) => setMeta({ responsable_proceso: e.target.value })}
              placeholder="Nombre / Cargo"
            />
          </div>
        </div>
      </Card>

      <Card title="Tarjeta de inspección semanal">
        {uiError ? (
          <div style={{ padding: 12, borderRadius: 12, border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", fontWeight: 800 }}>
            {uiError}
          </div>
        ) : null}

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 1100 }}>
            <thead>
              <tr>
                <th style={thSticky(0, 60)}>ITEM</th>
                <th style={thSticky(60, 320)}>DESCRIPCIÓN</th>
                {DIAS.map((d) => (
                  <th key={d.key} style={thDay()}>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontWeight: 900 }}>{d.label.toUpperCase()}</span>
                        <Badge variant="outline">BUENO / MALO / N/A</Badge>
                      </div>

                      <div style={{ display: "grid", gap: 8 }}>
                        <div>
                          <div style={miniLabel()}>Fecha</div>
                          <Input
                            type="date"
                            value={model.meta.dias[d.key]?.fecha || ""}
                            onChange={(e) => setDiaHeader(d.key, { fecha: e.target.value })}
                          />
                        </div>

                        <div>
                          <div style={miniLabel()}>Realizado por</div>
                          <Autocomplete
                            placeholder="DNI / Apellido / Nombre"
                            fetchOptions={buscarEmpleadosForAutocomplete}
                            getOptionLabel={(o) => `${o?.dni ?? ""} - ${o?.apellido ?? ""} ${o?.nombre ?? ""}`.trim()}
                            onSelect={(opt) => setDiaHeader(d.key, { realizado_por: opt })}
                            value={model.meta.dias[d.key]?.realizado_por}
                          />
                        </div>

                        <div>
                          <div style={miniLabel()}>Firma</div>
                          <Input
                            value={model.meta.dias[d.key]?.firma || ""}
                            onChange={(e) => setDiaHeader(d.key, { firma: e.target.value })}
                            placeholder="(texto) o código firma"
                          />
                        </div>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {model.items.map((it, idx) => (
                <tr key={it.item_id}>
                  <td style={tdSticky(0, 60)}>{idx + 1}</td>
                  <td style={tdSticky(60, 320)}>{it.descripcion}</td>

                  {DIAS.map((d) => {
                    const cell = it.dias?.[d.key] ?? emptyCell();
                    const estado = cell.estado;
                    const isMalo = estado === "MALO";

                    return (
                      <td key={d.key} style={tdDay()}>
                        <div style={{ display: "grid", gap: 10 }}>
                          <EstadoRadio
                            value={estado}
                            onChange={(v) => {
                              // UX: si cambia a BUENO/NA, limpia obs/accion
                              if (v !== "MALO") {
                                setCell(it.item_id, d.key, {
                                  estado: v,
                                  observacion: "",
                                  accion: { que: "", quien: "", cuando: "" },
                                });
                              } else {
                                setCell(it.item_id, d.key, { estado: v });
                              }
                            }}
                          />

                          {isMalo ? (
                            <div
                              style={{
                                border: "1px solid #fecaca",
                                background: "#fff7ed",
                                borderRadius: 14,
                                padding: 12,
                                display: "grid",
                                gap: 10,
                              }}
                            >
                              <div style={{ fontWeight: 900, color: "#b91c1c" }}>
                                Observación (obligatoria)
                              </div>
                              <textarea
                                value={cell.observacion}
                                onChange={(e) => setCell(it.item_id, d.key, { observacion: e.target.value })}
                                placeholder="Detalla observaciones y medidas correctivas..."
                                style={ta()}
                              />

                              <div style={{ fontWeight: 900 }}>Plan de acción (obligatorio)</div>

                              <div style={{ display: "grid", gap: 8 }}>
                                <div>
                                  <div style={miniLabel()}>Qué</div>
                                  <textarea
                                    value={cell.accion?.que || ""}
                                    onChange={(e) =>
                                      setCell(it.item_id, d.key, { accion: { ...cell.accion, que: e.target.value } })
                                    }
                                    placeholder="Describe la acción correctiva inmediata..."
                                    style={ta(70)}
                                  />
                                </div>

                                <div>
                                  <div style={miniLabel()}>Quién</div>
                                  <Input
                                    value={cell.accion?.quien || ""}
                                    onChange={(e) =>
                                      setCell(it.item_id, d.key, { accion: { ...cell.accion, quien: e.target.value } })
                                    }
                                    placeholder="DNI / Apellido / Nombre"
                                  />
                                </div>

                                <div>
                                  <div style={miniLabel()}>Cuándo</div>
                                  <Input
                                    type="date"
                                    value={cell.accion?.cuando || ""}
                                    onChange={(e) =>
                                      setCell(it.item_id, d.key, { accion: { ...cell.accion, cuando: e.target.value } })
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Guardando..." : "Guardar inspección"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// === estilos helpers (sin tocar tu UI global)
function thSticky(left, width) {
  return {
    position: "sticky",
    left,
    zIndex: 3,
    top: 0,
    width,
    minWidth: width,
    background: "var(--card)",
    borderBottom: "1px solid var(--border)",
    padding: 10,
    textAlign: "left",
    fontWeight: 900,
  };
}
function tdSticky(left, width) {
  return {
    position: "sticky",
    left,
    zIndex: 2,
    width,
    minWidth: width,
    background: "var(--card)",
    borderBottom: "1px solid var(--border)",
    padding: 10,
    verticalAlign: "top",
    fontWeight: left === 0 ? 900 : 700,
  };
}
function thDay() {
  return {
    top: 0,
    zIndex: 1,
    background: "var(--card)",
    borderBottom: "1px solid var(--border)",
    padding: 10,
    textAlign: "left",
    verticalAlign: "top",
    minWidth: 220,
  };
}
function tdDay() {
  return {
    borderBottom: "1px solid var(--border)",
    padding: 10,
    verticalAlign: "top",
    minWidth: 220,
  };
}
function miniLabel() {
  return { fontSize: 12, fontWeight: 800, opacity: 0.85, marginBottom: 6 };
}
function ta(height = 90) {
  return {
    width: "100%",
    minHeight: height,
    borderRadius: 12,
    border: "1px solid var(--border)",
    padding: 10,
    resize: "vertical",
    outline: "none",
    fontFamily: "inherit",
  };
}