// frontend/src/components/forms/TablaBotiquinForm.jsx
import { useEffect, useMemo, useState } from "react";
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import Badge from "../ui/Badge.jsx";
import Input from "../ui/Input.jsx";
import Autocomplete from "../ui/Autocomplete.jsx";
import { buscarEmpleados } from "../../api/busquedas.api.js";
import { serializeTablaBotiquin } from "../../utils/plantillaRenderer.js";

const MESES = [
  { key: "ENE", label: "Enero" },
  { key: "FEB", label: "Febrero" },
  { key: "MAR", label: "Marzo" },
  { key: "ABR", label: "Abril" },
  { key: "MAY", label: "Mayo" },
  { key: "JUN", label: "Junio" },
  { key: "JUL", label: "Julio" },
  { key: "AGO", label: "Agosto" },
  { key: "SEP", label: "Septiembre" },
  { key: "OCT", label: "Octubre" },
  { key: "NOV", label: "Noviembre" },
  { key: "DIC", label: "Diciembre" },
];

const ESTADOS = ["", "BUENO", "MALO", "NA"];

const DEFAULT_ITEMS = [
  { descripcion: "Guantes Quirúrgicos / Nitrilo", cant: "1", unidad: "Par" },
  { descripcion: "Yodopovidona (….. ml)", cant: "1", unidad: "Uni" },
  { descripcion: "Agua Oxigenada (….. ml)", cant: "1", unidad: "Uni" },
  { descripcion: "Alcohol (….. ml)", cant: "1", unidad: "Uni" },
  { descripcion: "Apósitos Esterilizados", cant: "1", unidad: "Uni" },
  { descripcion: "Gasas Esterilizadas ….. x ….. cm", cant: "1", unidad: "Uni" },
  { descripcion: "Esparadrapos ….. cm x ….. cm", cant: "1", unidad: "Uni" },
  { descripcion: "Vendas Elásticas ….. pulg x ….. yardas", cant: "1", unidad: "Uni" },
  { descripcion: "Algodón ….. gramos", cant: "1", unidad: "Uni" },
  { descripcion: "Vendas Triangulares", cant: "1", unidad: "Uni" },
  { descripcion: "Paleta Baja Lengua (Entablillado de Dedos)", cant: "1", unidad: "Uni" },
  { descripcion: "Tijera Punta Roma", cant: "1", unidad: "Uni" },
  { descripcion: "Pinza", cant: "1", unidad: "Uni" },
  { descripcion: "Bandas Adhesivas", cant: "1", unidad: "Uni" },
  { descripcion: "Gel Antibacterial (….. ml)", cant: "1", unidad: "Uni" },
  { descripcion: "Gasa Tipo Jalonet", cant: "1", unidad: "Uni" },
  { descripcion: "Colirio (….. ml)", cant: "1", unidad: "Uni" },
  { descripcion: "Guía de Primero Auxilios", cant: "1", unidad: "Uni" },
  { descripcion: "Estuche / Gabinete", cant: "1", unidad: "Uni" },
];

// helper arriba del componente ✅ (AQUÍ va)
const getFirmaUrl = (emp) => {
  if (!emp) return null;
  if (emp.firma_url) return emp.firma_url;
  if (emp.id_usuario)
    return `${import.meta.env.VITE_API_URL}/api/usuarios/${emp.id_usuario}/firma`;
  return null;
};

function emptyAccion() {
  return { que: "", quien: null, cuando: "" };
}

function makeRow(i, base) {
  const idx = String(i + 1).padStart(2, "0");
  return {
    item_ref: `i${idx}`,
    descripcion: base?.descripcion || "",
    cant: base?.cant || "",
    unidad: base?.unidad || "",
    estado: "",
    observacion: "",
    accion: emptyAccion(),
  };
}

/**
 * Props esperadas (compatibles con tu arquitectura):
 * - definicion: definición normalizada (trae tipo/codigo_formato)
 * - participantes: { inspectores: [] } (si lo tienes)
 * - value: estado actual del form (opcional)
 * - onChange: callback(value)
 * - onSubmit: callback({ respuestas })
 */
export default function TablaBotiquinForm({ definicion, participantes, value, onChange, onSubmit }) {
  const inspectores = participantes?.inspectores || [];

  const [mes, setMes] = useState(value?.mes || "ENE");
  const [fecha, setFecha] = useState(value?.fecha || "");
  const [realizadoPor, setRealizadoPor] = useState(value?.realizadoPor || null);

  const [codigoBotiquin, setCodigoBotiquin] = useState(value?.codigoBotiquin || "");
  const [rows, setRows] = useState(() => {
    if (Array.isArray(value?.rows) && value.rows.length) return value.rows;
    return DEFAULT_ITEMS.map((it, i) => makeRow(i, it));
  });

  // búsqueda empleados (para "Realizado por" y fallback de "Quién")
  const [qEmp, setQEmp] = useState("");
  const [empOptions, setEmpOptions] = useState([]);
  const handleGuardar = () => {
    const payload = {
        respuestas: serializeTablaBotiquin({
        mes, fecha, realizadoPor, firmaUrl, codigoBotiquin, rows, definicion
        }),
    };

    onSubmit?.(payload);
    };

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!qEmp || qEmp.trim().length < 2) return setEmpOptions([]);
      try {
        const r = await buscarEmpleados(qEmp.trim());
        if (alive) setEmpOptions(Array.isArray(r) ? r : []);
      } catch {
        if (alive) setEmpOptions([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [qEmp]);

  const firmaUrl = useMemo(() => getFirmaUrl(realizadoPor), [realizadoPor]);

  function updateRow(index, patch) {
    setRows((prev) => {
      const next = [...prev];
      const cur = next[index];
      next[index] = { ...cur, ...patch };
      return next;
    });
  }

  function updateAccion(index, patch) {
    setRows((prev) => {
      const next = [...prev];
      const cur = next[index];
      next[index] = { ...cur, accion: { ...(cur.accion || emptyAccion()), ...patch } };
      return next;
    });
  }

  function addRow() {
    setRows((prev) => {
      const i = prev.length;
      return [...prev, makeRow(i, { descripcion: "", cant: "", unidad: "" })];
    });
  }

  // Validación UX simple: si MALO => obs + acción obligatorios
  const errores = useMemo(() => {
    const errs = {};
    rows.forEach((r) => {
      if (String(r.estado).toUpperCase() === "MALO") {
        const k = r.item_ref;
        const faltaObs = !String(r.observacion || "").trim();
        const faltaQue = !String(r.accion?.que || "").trim();
        const faltaQuien = !r.accion?.quien;
        const faltaCuando = !String(r.accion?.cuando || "").trim();
        if (faltaObs || faltaQue || faltaQuien || faltaCuando) {
          errs[k] = {
            observacion: faltaObs,
            que: faltaQue,
            quien: faltaQuien,
            cuando: faltaCuando,
          };
        }
      }
    });
    return errs;
  }, [rows]);

  // Emitir value al padre
  useEffect(() => {
    const v = { mes, fecha, realizadoPor, codigoBotiquin, rows };
    onChange?.(v);
  }, [mes, fecha, realizadoPor, codigoBotiquin, rows, onChange]);

  const quienOptions = inspectores.length ? inspectores : empOptions;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Card title="Inspección de Botiquín (FOR-038)">
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label>
              Mes
              <select
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,.15)" }}
              >
                {MESES.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Fecha
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </label>
          </div>

          <label>
            Código de Botiquín
            <Input value={codigoBotiquin} onChange={(e) => setCodigoBotiquin(e.target.value)} placeholder="Ej: BOT-001" />
          </label>

          <label>
            Realizado por
            <Autocomplete
              value={realizadoPor}
              onChange={setRealizadoPor}
              onSearch={setQEmp}
              options={empOptions}
              placeholder="DNI / Apellido / Nombre"
              getOptionLabel={(o) => o?.nombre || o?.nombres || o?.apellidos || o?.label || ""}
            />
          </label>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontWeight: 600, opacity: 0.8 }}>Firma:</div>
            {firmaUrl ? (
              <img
                src={firmaUrl}
                alt="firma"
                style={{ height: 56, borderRadius: 10, border: "1px solid rgba(0,0,0,.12)", background: "#fff" }}
              />
            ) : (
              <span style={{ opacity: 0.65 }}>Sin firma registrada</span>
            )}
          </div>
        </div>
      </Card>

      <Card title="Items del botiquín">
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((r, idx) => {
            const isMalo = String(r.estado).toUpperCase() === "MALO";
            const err = errores[r.item_ref];

            return (
              <div
                key={r.item_ref}
                style={{
                  border: "1px solid rgba(0,0,0,.10)",
                  borderRadius: 14,
                  padding: 12,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 90px 90px 140px", gap: 10, alignItems: "end" }}>
                  <div style={{ fontWeight: 700, opacity: 0.7 }}>{idx + 1}</div>

                  <label>
                    Descripción
                    <Input value={r.descripcion} onChange={(e) => updateRow(idx, { descripcion: e.target.value })} />
                  </label>

                  <label>
                    Cant.
                    <Input value={r.cant} onChange={(e) => updateRow(idx, { cant: e.target.value })} />
                  </label>

                  <label>
                    Unidad
                    <Input value={r.unidad} onChange={(e) => updateRow(idx, { unidad: e.target.value })} />
                  </label>

                  <label>
                    Estado{" "}
                    {r.estado && (
                      <Badge>
                        {r.estado === "BUENO" ? "✓ BUENO" : r.estado === "MALO" ? "X MALO" : r.estado === "NA" ? "NA" : ""}
                      </Badge>
                    )}
                    <select
                      value={r.estado}
                      onChange={(e) => {
                        const v = e.target.value;
                        // si cambia a no-MALO, limpiar panel
                        if (String(v).toUpperCase() !== "MALO") {
                          updateRow(idx, { estado: v, observacion: "", accion: emptyAccion() });
                        } else {
                          updateRow(idx, { estado: v });
                        }
                      }}
                      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,.15)" }}
                    >
                      {ESTADOS.map((x) => (
                        <option key={x} value={x}>
                          {x === "" ? "— Seleccionar —" : x}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {isMalo && (
                  <div
                    style={{
                      border: "1px solid rgba(255,0,0,.25)",
                      background: "rgba(255,0,0,.03)",
                      borderRadius: 14,
                      padding: 12,
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontWeight: 800, color: "#b00020" }}>Observación (obligatoria)</div>
                    <textarea
                      value={r.observacion}
                      onChange={(e) => updateRow(idx, { observacion: e.target.value })}
                      placeholder="Detalla observaciones y medidas correctivas..."
                      style={{
                        width: "100%",
                        minHeight: 70,
                        padding: 10,
                        borderRadius: 12,
                        border: err?.observacion ? "1px solid rgba(176,0,32,.6)" : "1px solid rgba(0,0,0,.15)",
                      }}
                    />

                    <div style={{ fontWeight: 800 }}>Plan de acción (obligatorio)</div>

                    <label>
                      Qué
                      <Input
                        value={r.accion?.que || ""}
                        onChange={(e) => updateAccion(idx, { que: e.target.value })}
                        style={err?.que ? { border: "1px solid rgba(176,0,32,.6)" } : undefined}
                      />
                    </label>

                    <label>
                      Quién
                      <Autocomplete
                        value={r.accion?.quien || null}
                        onChange={(emp) => updateAccion(idx, { quien: emp })}
                        onSearch={setQEmp}
                        options={quienOptions}
                        placeholder="Inspector / Responsable"
                        getOptionLabel={(o) => o?.nombre || o?.nombres || o?.apellidos || o?.label || ""}
                      />
                      {err?.quien && <div style={{ color: "#b00020", fontSize: 12 }}>Selecciona un responsable.</div>}
                    </label>

                    <label>
                      Cuándo
                      <Input
                        type="date"
                        value={r.accion?.cuando || ""}
                        onChange={(e) => updateAccion(idx, { cuando: e.target.value })}
                        style={err?.cuando ? { border: "1px solid rgba(176,0,32,.6)" } : undefined}
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={addRow}>+ Agregar fila</Button>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={handleGuardar}>Guardar inspeccion</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
