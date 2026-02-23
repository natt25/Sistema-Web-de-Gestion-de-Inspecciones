import { useEffect, useState } from "react";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Badge from "../ui/Badge";
import Autocomplete from "../ui/Autocomplete";
import {
  buscarClientes,
  buscarServicios,
  buscarAreas,
  buscarLugares,
  buscarEmpleados,
  crearArea,
  crearLugar,
} from "../../api/busquedas.api";

export default function InspeccionHeaderForm({
  headerDef,
  catalogos,
  user,
  value,
  onChange,
  onAddParticipante,
  onRemoveParticipante,
}) {
  const [qCliente, setQCliente] = useState("");
  const [qServicio, setQServicio] = useState("");
  const [qArea, setQArea] = useState("");
  const [qLugar, setQLugar] = useState("");
  const [qColab, setQColab] = useState("");

  const [optClientes, setOptClientes] = useState([]);
  const [optServicios, setOptServicios] = useState([]);
  const [optAreas, setOptAreas] = useState([]);
  const [optLugares, setOptLugares] = useState([]);
  const [optColabs, setOptColabs] = useState([]);

  const canServicio = !!value?.id_cliente;
  const canArea = !!value?.id_servicio;
  const canLugar = !!value?.id_area;

  const setField = (k, v) => onChange((prev) => ({ ...(prev || {}), [k]: v }));

  // autollenados del JSON: fecha / user / cargo / firma
  useEffect(() => {
    if (!headerDef) return;

    if (headerDef.fecha_inspeccion === "auto_today" && !value?.fecha_inspeccion) {
      const today = new Date().toISOString().slice(0, 10);
      setField("fecha_inspeccion", today);
    }

    if (headerDef.realizado_por === "auto_user" && user && !value?.realizado_por) {
      setField("realizado_por", user?.nombre || user?.dni || "");
    }

    if (headerDef.cargo === "auto_user_cargo" && user && !value?.cargo) {
      setField("cargo", user?.cargo || "");
    }

    if (headerDef.firma === "auto_user_firma" && user && !value?.firma_ruta) {
      setField("firma_ruta", user?.firma_ruta || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerDef, user]);

  // Búsqueda cliente
  useEffect(() => {
    const t = setTimeout(async () => {
      const s = qCliente.trim();
      if (!s) return setOptClientes([]);
      const data = await buscarClientes(s);
      setOptClientes(Array.isArray(data) ? data : []);
    }, 250);
    return () => clearTimeout(t);
  }, [qCliente]);

  // Búsqueda servicio (depende de cliente)
  useEffect(() => {
    const t = setTimeout(async () => {
      const s = qServicio.trim();
      if (!s || !value?.id_cliente) return setOptServicios([]);
      const data = await buscarServicios(s);
      setOptServicios(Array.isArray(data) ? data : []);
    }, 250);
    return () => clearTimeout(t);
  }, [qServicio, value?.id_cliente]);

  // Búsqueda áreas (depende de servicio)
  useEffect(() => {
    const t = setTimeout(async () => {
      const s = qArea.trim();
      if (!s || !value?.id_servicio) return setOptAreas([]);
      const data = await buscarAreas(s);
      setOptAreas(Array.isArray(data) ? data : []);
    }, 250);
    return () => clearTimeout(t);
  }, [qArea, value?.id_servicio]);

  // Búsqueda lugares (depende de área)
  useEffect(() => {
    const t = setTimeout(async () => {
      const s = qLugar.trim();
      if (!s || !value?.id_area) return setOptLugares([]);
      const data = await buscarLugares({ q: s, id_area: value.id_area });
      setOptLugares(Array.isArray(data) ? data : []);
    }, 250);
    return () => clearTimeout(t);
  }, [qLugar, value?.id_area]);

  // Búsqueda colaboradores
  useEffect(() => {
    const t = setTimeout(async () => {
      const s = qColab.trim();
      if (!s) return setOptColabs([]);
      const data = await buscarEmpleados(s);
      setOptColabs(Array.isArray(data) ? data : []);
    }, 250);
    return () => clearTimeout(t);
  }, [qColab]);

  return (
    <Card title="Datos generales (FOR-013)">
      <div style={{ display: "grid", gap: 14 }}>
        {/* Fila 1: Cliente / Servicio */}
        <div className="ins-grid">
          <Field label="Cliente / Unidad Minera">
            <Autocomplete
              placeholder="Escribe para buscar..."
              displayValue={value?.cliente_text ?? (value?.id_cliente ? String(value.id_cliente) : "")}
              onInputChange={(txt) => {
                setQCliente(txt);
                onChange((prev) => ({
                  ...(prev || {}),
                  id_cliente: null,
                  id_servicio: null,
                  id_area: null,
                  id_lugar: null,
                  cliente_text: txt,
                  servicio_text: "",
                  area_text: "",
                  lugar_text: "",
                }));
              }}
              options={optClientes}
              getOptionLabel={(c) => c.raz_social ?? String(c.id_cliente)}
              allowCustom
              onCreateCustom={(text) => {
                onChange((prev) => ({
                  ...(prev || {}),
                  id_cliente: null,
                  id_servicio: null,
                  id_area: null,
                  id_lugar: null,
                  cliente_text: text,
                }));
              }}
              onSelect={(c) => {
                onChange((prev) => ({
                  ...(prev || {}),
                  id_cliente: c.id_cliente,
                  cliente_text: c.raz_social ?? "",
                  id_servicio: null,
                  id_area: null,
                  id_lugar: null,
                  servicio_text: "",
                  area_text: "",
                  lugar_text: "",
                }));
              }}
            />
          </Field>

          <Field label="Servicio">
            <Autocomplete
              placeholder={canServicio ? "Escribe para buscar..." : "Selecciona cliente primero"}
              displayValue={value?.servicio_text ?? (value?.id_servicio ? String(value.id_servicio) : "")}
              onInputChange={(txt) => {
                setQServicio(txt);
                onChange((prev) => ({
                  ...(prev || {}),
                  id_servicio: null,
                  id_area: null,
                  id_lugar: null,
                  servicio_text: txt,
                  area_text: "",
                  lugar_text: "",
                }));
              }}
              options={optServicios}
              getOptionLabel={(s) => s.nombre_servicio ?? String(s.id_servicio)}
              disabled={!canServicio}
              allowCustom
              onCreateCustom={(text) => {
                onChange((prev) => ({
                  ...(prev || {}),
                  id_servicio: null,
                  id_area: null,
                  id_lugar: null,
                  servicio_text: text,
                }));
              }}
              onSelect={(s) => {
                onChange((prev) => ({
                  ...(prev || {}),
                  id_servicio: s.id_servicio,
                  servicio_text: s.nombre_servicio ?? "",
                  id_area: null,
                  id_lugar: null,
                  area_text: "",
                  lugar_text: "",
                }));
              }}
            />

            {/* Detalle de servicio NO se cambia */}
            <div style={{ marginTop: 8 }}>
              <Input
                placeholder="Detalle de servicio (opcional)"
                value={value?.servicio_detalle ?? ""}
                onChange={(e) => setField("servicio_detalle", e.target.value)}
              />
            </div>
          </Field>
        </div>

        {/* Fila 2: Área / Lugar / Fecha */}
        <div className="ins-grid">
          <Field label="Área">
            <Autocomplete
              placeholder={canArea ? "Escribe para buscar..." : "Selecciona servicio primero"}
              displayValue={value?.area_text ?? (value?.id_area ? String(value.id_area) : "")}
              onInputChange={(txt) => {
                setQArea(txt);
                onChange((prev) => ({
                  ...(prev || {}),
                  id_area: null,
                  id_lugar: null,
                  area_text: txt,
                  lugar_text: "",
                }));
              }}
              options={optAreas}
              getOptionLabel={(a) => a.desc_area ?? String(a.id_area)}
              disabled={!canArea}
              allowCustom
              onCreateCustom={async (text) => {
                const created = await crearArea(text);
                onChange((prev) => ({
                  ...(prev || {}),
                  id_area: created.id_area,
                  area_text: created.desc_area,
                  id_lugar: null,
                  lugar_text: "",
                }));
              }}
              onSelect={(a) => {
                onChange((prev) => ({
                  ...(prev || {}),
                  id_area: a.id_area,
                  area_text: a.desc_area ?? "",
                  id_lugar: null,
                  lugar_text: "",
                }));
              }}
            />
          </Field>

          <Field label="Lugar">
            <Autocomplete
              placeholder={canLugar ? "Escribe para buscar..." : "Selecciona área primero"}
              displayValue={value?.lugar_text ?? (value?.id_lugar ? String(value.id_lugar) : "")}
              onInputChange={(txt) => {
                setQLugar(txt);
                onChange((prev) => ({
                  ...(prev || {}),
                  id_lugar: null,
                  lugar_text: txt,
                }));
              }}
              options={optLugares}
              getOptionLabel={(l) => l.desc_lugar ?? String(l.id_lugar)}
              disabled={!canLugar}
              allowCustom
              onCreateCustom={async (text) => {
                const created = await crearLugar({ id_area: value.id_area, desc_lugar: text });
                onChange((prev) => ({
                  ...(prev || {}),
                  id_lugar: created.id_lugar,
                  lugar_text: created.desc_lugar,
                }));
              }}
              onSelect={(l) => {
                onChange((prev) => ({
                  ...(prev || {}),
                  id_lugar: l.id_lugar,
                  lugar_text: l.desc_lugar ?? "",
                }));
              }}
            />
          </Field>

          <Field label="Fecha de inspección">
            <input
              type="date"
              className="ins-input"
              value={value?.fecha_inspeccion ?? ""}
              onChange={(e) => setField("fecha_inspeccion", e.target.value)}
            />
          </Field>
        </div>

        {/* Participantes */}
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <b>Participantes</b>
            <Badge>{(value?.participantes?.length || 0) + 1} total</Badge>
            <span className="help">Incluye al inspector principal + colaboradores.</span>
          </div>

          {/* Inspector principal */}
          <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Inspector principal</div>
            <div className="ins-grid">
              <Field label="Realizado por">
                <Input
                  value={value?.realizado_por ?? ""}
                  onChange={(e) => setField("realizado_por", e.target.value)}
                  placeholder="Nombre / DNI"
                />
              </Field>
              <Field label="Cargo">
                <Input
                  value={value?.cargo ?? ""}
                  onChange={(e) => setField("cargo", e.target.value)}
                  placeholder="Cargo"
                />
              </Field>
              <Field label="Firma (ruta)">
                <Input
                  value={value?.firma_ruta ?? ""}
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
              <Field label="Buscar colaborador (DNI / Apellido / Nombre)">
                <Autocomplete
                  placeholder="Escribe para buscar..."
                  displayValue={qColab}
                  onInputChange={setQColab}
                  options={optColabs}
                  getOptionLabel={(e) => {
                    const nom = `${e.apellidos ?? ""} ${e.nombres ?? ""}`.trim();
                    const dni = e.dni ? `(${e.dni})` : "";
                    const cargo = e.cargo ? `— ${e.cargo}` : "";
                    return `${nom} ${dni} ${cargo}`.trim();
                  }}
                  onSelect={(e) => {
                    onAddParticipante?.({
                      dni: e.dni,
                      nombre: `${e.apellidos ?? ""} ${e.nombres ?? ""}`.trim(),
                      cargo: e.cargo ?? "",
                    });
                    setQColab("");
                    setOptColabs([]);
                  }}
                />
              </Field>
            </div>

            {(value?.participantes || []).length ? (
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