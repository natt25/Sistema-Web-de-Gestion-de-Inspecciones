import { useEffect, useMemo, useState } from "react";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import Badge from "../ui/Badge";

export default function InspeccionHeaderForm({
  headerDef,      // definicion.header (del JSON)
  catalogos,      // { clientes, servicios, areas, lugares }
  user,           // { dni, nombres, cargo, firma_ruta } opcional
  value,          // objeto estado actual
  onChange,       // (newValue) => void
  onAddParticipante,
  onRemoveParticipante,
}) {
  const { clientes = [], servicios = [], areas = [], lugares = [] } = catalogos || {};

  const [participante, setParticipante] = useState({ nombre: "", cargo: "" });

  // filtrar lugares por área elegida (si tus lugares vienen con id_area)
  const lugaresFiltrados = useMemo(() => {
    if (!value?.id_area) return lugares;
    return lugares.filter((l) => Number(l.id_area) === Number(value.id_area));
  }, [lugares, value?.id_area]);

  const setField = (k, v) => onChange((prev) => ({ ...(prev || {}), [k]: v }));

  // autollenados del JSON: fecha / user / cargo / firma
  useEffect(() => {
    if (!headerDef) return;

    // fecha
    if (headerDef.fecha_inspeccion === "auto_today" && !value.fecha_inspeccion) {
      const today = new Date().toISOString().slice(0, 10);
      setField("fecha_inspeccion", today);
    }

    // realizado_por
    if (headerDef.realizado_por === "auto_user" && user && !value.realizado_por) {
      setField("realizado_por", user?.nombre || user?.dni || "");
    }

    // cargo
    if (headerDef.cargo === "auto_user_cargo" && user && !value.cargo) {
      setField("cargo", user?.cargo || "");
    }

    // firma: guardamos ruta o flag
    if (headerDef.firma === "auto_user_firma" && user && !value.firma_ruta) {
      setField("firma_ruta", user?.firma_ruta || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerDef, user]);

  return (
    <Card title="Datos generales (FOR-013)">
      <div style={{ display: "grid", gap: 14 }}>
        {/* Fila 1: Cliente / Servicio */}
        <div className="ins-grid">
          <Field label="Cliente / Unidad Minera">
            <select
              className="ins-input"
              value={value.id_cliente ?? ""}
              onChange={(e) => setField("id_cliente", e.target.value || null)}
            >
              <option value="">— Seleccionar —</option>
              {clientes.map((c) => (
                <option key={c.id_cliente} value={c.id_cliente}>
                  {c.raz_social}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Servicio">
            <select
              className="ins-input"
              value={value.id_servicio ?? ""}
              onChange={(e) => setField("id_servicio", e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— Seleccionar —</option>
              {servicios.map((s) => (
                <option key={s.id_servicio} value={s.id_servicio}>
                  {s.nombre_servicio}
                </option>
              ))}
            </select>

            {/* Si necesitas "OTRO" */}
            <div style={{ marginTop: 8 }}>
              <Input
                placeholder="Detalle de servicio (opcional)"
                value={value.servicio_detalle ?? ""}
                onChange={(e) => setField("servicio_detalle", e.target.value)}
              />
            </div>
          </Field>
        </div>

        {/* Fila 2: Área / Lugar / Fecha */}
        <div className="ins-grid">
          <Field label="Área">
            <select
              className="ins-input"
              value={value.id_area ?? ""}
              onChange={(e) => {
                const id_area = e.target.value ? Number(e.target.value) : null;
                onChange((prev) => ({
                    ...(prev || {}),
                    id_area,
                    id_lugar: null,
                }));
                }}            
            >
              <option value="">— Seleccionar —</option>
              {areas.map((a) => (
                <option key={a.id_area} value={a.id_area}>
                  {a.desc_area}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Lugar">
            <select
              className="ins-input"
              value={value.id_lugar ?? ""}
              onChange={(e) => setField("id_lugar", e.target.value ? Number(e.target.value) : null)}
              disabled={!value.id_area}
              title={!value.id_area ? "Selecciona un área primero" : ""}
            >
              <option value="">— Seleccionar —</option>
              {lugaresFiltrados.map((l) => (
                <option key={l.id_lugar} value={l.id_lugar}>
                  {l.desc_lugar}
                </option>
              ))}
            </select>
            {!value.id_area ? (
              <div className="help">Selecciona un área para habilitar lugares.</div>
            ) : null}
          </Field>

          <Field label="Fecha de inspección">
            <input
              type="date"
              className="ins-input"
              value={value.fecha_inspeccion ?? ""}
              onChange={(e) => setField("fecha_inspeccion", e.target.value)}
            />
          </Field>
        </div>

        {/* Inspectores/Participantes */}
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <b>Participantes</b>
            <Badge>{(value.participantes?.length || 0) + 1} total</Badge>
            <span className="help">Incluye al inspector principal + colaboradores.</span>
          </div>

          {/* Inspector principal */}
          <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Inspector principal</div>
            <div className="ins-grid">
              <Field label="Realizado por">
                <Input
                  value={value.realizado_por ?? ""}
                  onChange={(e) => setField("realizado_por", e.target.value)}
                  placeholder="Nombre / DNI"
                />
              </Field>
              <Field label="Cargo">
                <Input
                  value={value.cargo ?? ""}
                  onChange={(e) => setField("cargo", e.target.value)}
                  placeholder="Cargo"
                />
              </Field>
              <Field label="Firma (ruta)">
                <Input
                  value={value.firma_ruta ?? ""}
                  onChange={(e) => setField("firma_ruta", e.target.value)}
                  placeholder="firma_x.png (auto si tienes firma)"
                />
              </Field>
            </div>
          </div>

          {/* Colaboradores */}
          <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Agregar colaborador</div>

            <div className="ins-grid">
              <Field label="Nombre">
                <Input
                  value={participante.nombre}
                  onChange={(e) => setParticipante((p) => ({ ...p, nombre: e.target.value }))}
                  placeholder="Apellido / Nombre o DNI"
                />
              </Field>

              <Field label="Cargo">
                <Input
                  value={participante.cargo}
                  onChange={(e) => setParticipante((p) => ({ ...p, cargo: e.target.value }))}
                  placeholder="Cargo"
                />
              </Field>

              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <Button
                  type="button"
                  onClick={() => {
                    const n = participante.nombre.trim();
                    if (!n) return;
                    onAddParticipante?.({ nombre: n, cargo: (participante.cargo || "").trim() });
                    setParticipante({ nombre: "", cargo: "" });
                  }}
                >
                  + Agregar
                </Button>
              </div>
            </div>

            {(value.participantes || []).length ? (
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {value.participantes.map((p, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <b>{p.nombre}</b> {p.cargo ? <span className="help">• {p.cargo}</span> : null}
                    </div>
                    <button
                      type="button"
                      className="menu-btn"
                      onClick={() => onRemoveParticipante?.(idx)}
                      style={{ width: 120 }}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Field({ label, children }) {
  return (
    <label className="ins-field">
      <span>{label}</span>
      {children}
    </label>
  );
}