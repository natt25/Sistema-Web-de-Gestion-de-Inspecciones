import { useMemo, useState } from "react";
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import Badge from "../ui/Badge.jsx";
import Autocomplete from "../ui/Autocomplete.jsx";

const DAYS = [
  { key: "LUNES", label: "Lunes" },
  { key: "MARTES", label: "Martes" },
  { key: "MIERCOLES", label: "Miercoles" },
  { key: "JUEVES", label: "Jueves" },
  { key: "VIERNES", label: "Viernes" },
  { key: "SABADO", label: "Sabado" },
  { key: "DOMINGO", label: "Domingo" },
];

const ESTADOS = ["", "BUENO", "MALO", "NA"];

const DEFAULT_ITEMS = [
  "Camilla",
  "Botiquin completo",
  "Acceso libre",
  "Senaletica",
];

function getFirmaUrl(emp) {
  if (!emp) return null;
  if (emp.firma_url) return emp.firma_url;
  if (emp.firma_ruta) {
    const base = String(import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/+$/, "");
    return `${base}/${String(emp.firma_ruta).replace(/^\/+/, "")}`;
  }
  if (emp.id_usuario) {
    const base = String(import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/+$/, "");
    return `${base}/api/usuarios/${emp.id_usuario}/firma`;
  }
  return null;
}

function emptyCell() {
  return {
    estado: "",
    observacion: "",
    accion: { que: "", quien: null, cuando: "" },
  };
}

function buildInitial(initial) {
  const items = Array.isArray(initial?.items) && initial.items.length
    ? initial.items
    : DEFAULT_ITEMS.map((desc) => ({ desc }));

  const days = {};
  for (const d of DAYS) {
    const src = initial?.days?.[d.key] || {};
    const srcItems = Array.isArray(src?.items) ? src.items : [];
    const cellItems = items.map((_, i) => srcItems[i] || emptyCell());
    days[d.key] = {
      fecha: src?.fecha || "",
      realizado_por: src?.realizado_por || null,
      items: cellItems,
    };
  }
  return { items, days };
}

function empleadoLabel(opt) {
  if (!opt) return "";
  if (typeof opt === "string") return opt;
  return `${opt?.dni ?? ""} - ${opt?.apellido ?? ""} ${opt?.nombre ?? ""}`.trim();
}

function filterInspectores(inspectores, query) {
  const q = String(query || "").toLowerCase().trim();
  const list = Array.isArray(inspectores) ? inspectores : [];
  if (!q) return list.slice(0, 20);
  return list
    .filter((x) => {
      const dni = String(x?.dni ?? "").toLowerCase();
      const ap = String(x?.apellido ?? x?.apellidos ?? "").toLowerCase();
      const no = String(x?.nombre ?? x?.nombres ?? "").toLowerCase();
      const full = `${ap} ${no}`.trim();
      return dni.includes(q) || ap.includes(q) || no.includes(q) || full.includes(q);
    })
    .slice(0, 20);
}

export default function TablaBotiquinForm({
  definicion,
  initial,
  inspectores = [],
  buscarEmpleados,
  onSubmit,
}) {
  const seed = useMemo(() => buildInitial(initial), [initial]);
  const [items, setItems] = useState(seed.items);
  const [days, setDays] = useState(seed.days);
  const [searchMap, setSearchMap] = useState({});
  const [errors, setErrors] = useState({});

  const setItemDesc = (idx, value) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, desc: value } : it)));
  };

  const setDayMeta = (dayKey, patch) => {
    setDays((prev) => ({ ...prev, [dayKey]: { ...prev[dayKey], ...patch } }));
  };

  const setCell = (dayKey, itemIdx, patch) => {
    setDays((prev) => {
      const day = prev[dayKey];
      const nextItems = day.items.map((cell, i) => (i === itemIdx ? { ...cell, ...patch } : cell));
      return { ...prev, [dayKey]: { ...day, items: nextItems } };
    });
  };

  const addRow = () => {
    setItems((prev) => [...prev, { desc: "" }]);
    setDays((prev) => {
      const next = { ...prev };
      for (const d of DAYS) {
        next[d.key] = {
          ...next[d.key],
          items: [...next[d.key].items, emptyCell()],
        };
      }
      return next;
    });
  };

  const validate = () => {
    const nextErrors = {};
    for (const d of DAYS) {
      const row = days[d.key];
      for (let i = 0; i < row.items.length; i += 1) {
        const c = row.items[i];
        if (String(c?.estado || "").toUpperCase() !== "MALO") continue;
        if (!String(c?.observacion || "").trim()) nextErrors[`obs:${d.key}:${i}`] = "Observacion obligatoria";
        if (!String(c?.accion?.que || "").trim()) nextErrors[`que:${d.key}:${i}`] = "Que obligatorio";
        const quienText = typeof c?.accion?.quien === "string"
          ? c.accion.quien
          : `${c?.accion?.quien?.dni || ""} ${c?.accion?.quien?.apellido || ""} ${c?.accion?.quien?.nombre || ""}`.trim();
        if (!String(quienText || "").trim()) nextErrors[`quien:${d.key}:${i}`] = "Quien obligatorio";
        if (!String(c?.accion?.cuando || "").trim()) nextErrors[`cuando:${d.key}:${i}`] = "Cuando obligatorio";
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const getOptions = (fieldKey) => {
    const q = searchMap[fieldKey] || "";
    if (fieldKey.startsWith("quien:")) return filterInspectores(inspectores, q);
    if (typeof buscarEmpleados === "function" && q.trim().length >= 2) return [];
    return filterInspectores(inspectores, q);
  };

  const handleGuardar = async () => {
    if (!validate()) return;
    const data = {
      __tipo: "tabla_botiquin",
      codigo_formato: definicion?.codigo_formato || "AQP-SSOMA-FOR-038",
      items,
      days,
    };
    await onSubmit?.({
      __tipo: "tabla_botiquin",
      data,
    });
  };

  return (
    <Card title="FOR-038 | Inspeccion de Botiquin y Camilla">
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button onClick={addRow}>Agregar fila</Button>
          <Button variant="outline" onClick={handleGuardar}>Guardar inspeccion</Button>
        </div>

        <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
            <thead>
              <tr>
                <th style={thSticky}>ITEM</th>
                <th style={thSticky}>DESCRIPCION</th>
                {DAYS.map((d) => {
                  const firmaUrl = getFirmaUrl(days[d.key]?.realizado_por);
                  return (
                    <th key={d.key} style={thDay}>
                      <div style={{ fontWeight: 800 }}>{d.label.toUpperCase()}</div>
                      <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                        <label style={miniField}>
                          <span style={miniLabel}>Fecha</span>
                          <input
                            type="date"
                            value={days[d.key]?.fecha || ""}
                            onChange={(e) => setDayMeta(d.key, { fecha: e.target.value })}
                            style={miniInput(false)}
                          />
                        </label>
                        <label style={miniField}>
                          <span style={miniLabel}>Realizado por</span>
                          <Autocomplete
                            placeholder="DNI / Apellido / Nombre"
                            displayValue={empleadoLabel(days[d.key]?.realizado_por)}
                            onInputChange={(text) => {
                              setSearchMap((prev) => ({ ...prev, [`realizado:${d.key}`]: text }));
                              setDayMeta(d.key, { realizado_por: text });
                            }}
                            options={getOptions(`realizado:${d.key}`)}
                            getOptionLabel={empleadoLabel}
                            onSelect={(emp) => setDayMeta(d.key, { realizado_por: emp || null })}
                          />
                        </label>
                        <div style={{ display: "grid", gap: 6 }}>
                          <span style={miniLabel}>Firma</span>
                          {firmaUrl ? (
                            <img
                              alt="firma"
                              src={firmaUrl}
                              style={{
                                width: "100%",
                                maxWidth: 180,
                                height: 70,
                                objectFit: "contain",
                                border: "1px solid #eee",
                                borderRadius: 10,
                                background: "#fff",
                              }}
                              onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                          ) : (
                            <div style={{ opacity: 0.6, fontSize: 12 }}>Sin firma</div>
                          )}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={`row-${idx}`}>
                  <td style={tdSticky}>{idx + 1}</td>
                  <td style={tdSticky}>
                    <input
                      value={it.desc || ""}
                      onChange={(e) => setItemDesc(idx, e.target.value)}
                      placeholder="Descripcion..."
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 10 }}
                    />
                  </td>
                  {DAYS.map((d) => {
                    const cell = days[d.key]?.items?.[idx] || emptyCell();
                    const isMalo = String(cell.estado || "").toUpperCase() === "MALO";
                    return (
                      <td key={`${d.key}-${idx}`} style={tdCell}>
                        <div style={{ display: "grid", gap: 8 }}>
                          <select
                            value={cell.estado || ""}
                            onChange={(e) => {
                              const next = e.target.value;
                              if (next !== "MALO") {
                                setCell(d.key, idx, { estado: next, observacion: "", accion: { que: "", quien: null, cuando: "" } });
                              } else {
                                setCell(d.key, idx, { estado: next });
                              }
                            }}
                            style={{
                              padding: "10px 10px",
                              borderRadius: 12,
                              border: isMalo ? "2px solid #ef4444" : "1px solid #ddd",
                              background: isMalo ? "#fff5f5" : "#fff",
                              width: "100%",
                            }}
                          >
                            {ESTADOS.map((x) => (
                              <option key={x} value={x}>
                                {x === "" ? "SIN RESPONDER" : x}
                              </option>
                            ))}
                          </select>

                          {isMalo ? (
                            <div style={maloBox}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <b style={{ color: "#b91c1c" }}>Observacion (obligatoria)</b>
                                <Badge variant="danger">MALO</Badge>
                              </div>
                              <textarea
                                value={cell.observacion || ""}
                                onChange={(e) => setCell(d.key, idx, { observacion: e.target.value })}
                                placeholder="Detalla observaciones y medidas correctivas..."
                                style={txtArea(Boolean(errors[`obs:${d.key}:${idx}`]))}
                              />
                              <div style={{ marginTop: 8 }}>
                                <b>Plan de accion (obligatorio)</b>
                              </div>
                              <label style={miniField}>
                                <span style={miniLabel}>Que</span>
                                <input
                                  value={cell.accion?.que || ""}
                                  onChange={(e) => setCell(d.key, idx, { accion: { ...(cell.accion || {}), que: e.target.value } })}
                                  style={miniInput(Boolean(errors[`que:${d.key}:${idx}`]))}
                                />
                              </label>
                              <label style={miniField}>
                                <span style={miniLabel}>Quien</span>
                                <Autocomplete
                                  placeholder="DNI / Apellido / Nombre"
                                  displayValue={empleadoLabel(cell.accion?.quien)}
                                  onInputChange={(text) => {
                                    setSearchMap((prev) => ({ ...prev, [`quien:${d.key}:${idx}`]: text }));
                                    setCell(d.key, idx, { accion: { ...(cell.accion || {}), quien: text } });
                                  }}
                                  options={getOptions(`quien:${d.key}:${idx}`)}
                                  getOptionLabel={empleadoLabel}
                                  onSelect={(emp) => setCell(d.key, idx, { accion: { ...(cell.accion || {}), quien: emp || null } })}
                                />
                              </label>
                              <label style={miniField}>
                                <span style={miniLabel}>Cuando</span>
                                <input
                                  type="date"
                                  value={cell.accion?.cuando || ""}
                                  onChange={(e) => setCell(d.key, idx, { accion: { ...(cell.accion || {}), cuando: e.target.value } })}
                                  style={miniInput(Boolean(errors[`cuando:${d.key}:${idx}`]))}
                                />
                              </label>
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
      </div>
    </Card>
  );
}

const thSticky = {
  position: "sticky",
  left: 0,
  zIndex: 3,
  background: "#111827",
  color: "white",
  padding: 12,
  borderBottom: "1px solid #111",
  minWidth: 70,
};

const thDay = {
  background: "#f97316",
  color: "white",
  padding: 12,
  borderBottom: "1px solid #f59e0b",
  minWidth: 240,
  verticalAlign: "top",
};

const tdSticky = {
  position: "sticky",
  left: 0,
  zIndex: 2,
  background: "white",
  padding: 10,
  borderBottom: "1px solid #eee",
  borderRight: "1px solid #eee",
  minWidth: 70,
};

const tdCell = {
  padding: 10,
  borderBottom: "1px solid #eee",
  borderRight: "1px solid #eee",
  verticalAlign: "top",
};

const maloBox = {
  border: "2px solid #fecaca",
  background: "#fff5f5",
  borderRadius: 14,
  padding: 10,
  display: "grid",
  gap: 8,
};

const miniField = { display: "grid", gap: 6 };
const miniLabel = { fontSize: 12, opacity: 0.8 };
const miniInput = (hasErr) => ({
  padding: "10px 12px",
  borderRadius: 12,
  border: hasErr ? "2px solid #ef4444" : "1px solid #ddd",
  outline: "none",
});

const txtArea = (hasErr) => ({
  width: "100%",
  minHeight: 70,
  resize: "vertical",
  padding: "10px 12px",
  borderRadius: 12,
  border: hasErr ? "2px solid #ef4444" : "1px solid #ddd",
  outline: "none",
});
