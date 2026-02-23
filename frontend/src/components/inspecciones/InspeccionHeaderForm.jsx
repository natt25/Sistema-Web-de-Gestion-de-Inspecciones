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

const DEBOUNCE_MS = 250;

export default function InspeccionHeaderForm({
  headerDef,
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

  const [loadingCliente, setLoadingCliente] = useState(false);
  const [loadingServicio, setLoadingServicio] = useState(false);
  const [loadingArea, setLoadingArea] = useState(false);
  const [loadingLugar, setLoadingLugar] = useState(false);
  const [loadingColab, setLoadingColab] = useState(false);

  const [tCliente, setTCliente] = useState(false);
  const [tServicio, setTServicio] = useState(false);
  const [tArea, setTArea] = useState(false);
  const [tLugar, setTLugar] = useState(false);
  const [tColab, setTColab] = useState(false);

  const setField = (k, v) => onChange((prev) => ({ ...(prev || {}), [k]: v }));

  const canServicio = Boolean(value?.id_cliente);
  const canArea = Boolean(value?.id_servicio);
  const canLugar = Boolean(value?.id_area);

  useEffect(() => {
    if (!headerDef) return;

    if (headerDef.fecha_inspeccion === "auto_today" && !value?.fecha_inspeccion) {
      setField("fecha_inspeccion", new Date().toISOString().slice(0, 10));
    }

    // Inspector principal autollenado desde usuario logueado (readonly en UI).
    if (user) {
      if (!value?.realizado_por) setField("realizado_por", user.nombreCompleto || user.nombre || user.dni || "");
      if (!value?.cargo) setField("cargo", user.cargo || "");
      if (!value?.firma_ruta) setField("firma_ruta", user.firma_ruta || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerDef, user]);

  useEffect(() => {
    if (!tCliente) return;
    const timer = setTimeout(async () => {
      try {
        setLoadingCliente(true);
        const rows = await buscarClientes(qCliente.trim());
        setOptClientes(Array.isArray(rows) ? rows : []);
      } catch {
        setOptClientes([]);
      } finally {
        setLoadingCliente(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [qCliente, tCliente]);

  useEffect(() => {
    if (!tServicio || !canServicio) return;
    const timer = setTimeout(async () => {
      try {
        setLoadingServicio(true);
        const rows = await buscarServicios(qServicio.trim());
        setOptServicios(Array.isArray(rows) ? rows : []);
      } catch {
        setOptServicios([]);
      } finally {
        setLoadingServicio(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [qServicio, tServicio, canServicio]);

  useEffect(() => {
    if (!tArea || !canArea) return;
    const timer = setTimeout(async () => {
      try {
        setLoadingArea(true);
        const rows = await buscarAreas(qArea.trim());
        setOptAreas(Array.isArray(rows) ? rows : []);
      } catch {
        setOptAreas([]);
      } finally {
        setLoadingArea(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [qArea, tArea, canArea]);

  useEffect(() => {
    if (!tLugar || !canLugar) return;
    const timer = setTimeout(async () => {
      try {
        setLoadingLugar(true);
        const rows = await buscarLugares({ q: qLugar.trim(), id_area: value?.id_area });
        setOptLugares(Array.isArray(rows) ? rows : []);
      } catch {
        setOptLugares([]);
      } finally {
        setLoadingLugar(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [qLugar, tLugar, canLugar, value?.id_area]);

  useEffect(() => {
    if (!tColab) return;
    const timer = setTimeout(async () => {
      try {
        setLoadingColab(true);
        const rows = await buscarEmpleados(qColab.trim());
        setOptColabs(Array.isArray(rows) ? rows : []);
      } catch {
        setOptColabs([]);
      } finally {
        setLoadingColab(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [qColab, tColab]);

  async function loadDefaultsClientes() {
    try {
      setLoadingCliente(true);
      const rows = await buscarClientes("");
      setOptClientes(Array.isArray(rows) ? rows : []);
    } catch {
      setOptClientes([]);
    } finally {
      setLoadingCliente(false);
    }
  }

  async function loadDefaultsServicios() {
    if (!canServicio) return;
    try {
      setLoadingServicio(true);
      const rows = await buscarServicios("");
      setOptServicios(Array.isArray(rows) ? rows : []);
    } catch {
      setOptServicios([]);
    } finally {
      setLoadingServicio(false);
    }
  }

  async function loadDefaultsAreas() {
    if (!canArea) return;
    try {
      setLoadingArea(true);
      const rows = await buscarAreas("");
      setOptAreas(Array.isArray(rows) ? rows : []);
    } catch {
      setOptAreas([]);
    } finally {
      setLoadingArea(false);
    }
  }

  async function loadDefaultsLugares() {
    if (!canLugar) return;
    try {
      setLoadingLugar(true);
      const rows = await buscarLugares({ q: "", id_area: value?.id_area });
      setOptLugares(Array.isArray(rows) ? rows : []);
    } catch {
      setOptLugares([]);
    } finally {
      setLoadingLugar(false);
    }
  }

  async function loadDefaultsColabs() {
    try {
      setLoadingColab(true);
      const rows = await buscarEmpleados("");
      setOptColabs(Array.isArray(rows) ? rows : []);
    } catch {
      setOptColabs([]);
    } finally {
      setLoadingColab(false);
    }
  }

  return (
    <Card title="Datos generales (FOR-013)">
      <div style={{ display: "grid", gap: 14 }}>
        <div className="ins-grid">
          <Field label="Cliente / Unidad Minera">
            <Autocomplete
              placeholder="Escribe para buscar..."
              displayValue={value?.cliente_text ?? ""}
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
              onFocus={() => {
                setTCliente(true);
                if (!qCliente.trim()) loadDefaultsClientes();
              }}
              loading={loadingCliente}
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
                  servicio_text: "",
                  area_text: "",
                  lugar_text: "",
                }));
              }}
              onSelect={(c) => {
                onChange((prev) => ({
                  ...(prev || {}),
                  id_cliente: Number(c.id_cliente),
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
              disabled={!canServicio}
              displayValue={value?.servicio_text ?? ""}
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
              onFocus={() => {
                setTServicio(true);
                if (!qServicio.trim()) loadDefaultsServicios();
              }}
              loading={loadingServicio}
              options={optServicios}
              getOptionLabel={(s) => s.nombre_servicio ?? String(s.id_servicio)}
              allowCustom
              onCreateCustom={(text) => {
                onChange((prev) => ({
                  ...(prev || {}),
                  id_servicio: null,
                  id_area: null,
                  id_lugar: null,
                  servicio_text: text,
                  area_text: "",
                  lugar_text: "",
                }));
              }}
              onSelect={(s) => {
                onChange((prev) => ({
                  ...(prev || {}),
                  id_servicio: Number(s.id_servicio),
                  servicio_text: s.nombre_servicio ?? "",
                  id_area: null,
                  id_lugar: null,
                  area_text: "",
                  lugar_text: "",
                }));
              }}
            />

            <div style={{ marginTop: 8 }}>
              <Input
                placeholder="Detalle de servicio (opcional)"
                value={value?.servicio_detalle ?? ""}
                onChange={(e) => setField("servicio_detalle", e.target.value)}
              />
            </div>
          </Field>
        </div>

        <div className="ins-grid">
          <Field label="Area">
            <Autocomplete
              placeholder={canArea ? "Escribe para buscar..." : "Selecciona servicio primero"}
              disabled={!canArea}
              displayValue={value?.area_text ?? ""}
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
              onFocus={() => {
                setTArea(true);
                if (!qArea.trim()) loadDefaultsAreas();
              }}
              loading={loadingArea}
              options={optAreas}
              getOptionLabel={(a) => a.desc_area ?? String(a.id_area)}
              allowCustom
              onCreateCustom={async (text) => {
                try {
                  const created = await crearArea(text);
                  onChange((prev) => ({
                    ...(prev || {}),
                    id_area: Number(created.id_area),
                    area_text: created.desc_area ?? text,
                    id_lugar: null,
                    lugar_text: "",
                  }));
                } catch {
                  // mantiene texto escrito si falla crear
                }
              }}
              onSelect={(a) => {
                onChange((prev) => ({
                  ...(prev || {}),
                  id_area: Number(a.id_area),
                  area_text: a.desc_area ?? "",
                  id_lugar: null,
                  lugar_text: "",
                }));
              }}
            />
          </Field>

          <Field label="Lugar">
            <Autocomplete
              placeholder={canLugar ? "Escribe para buscar..." : "Selecciona area primero"}
              disabled={!canLugar}
              displayValue={value?.lugar_text ?? ""}
              onInputChange={(txt) => {
                setQLugar(txt);
                onChange((prev) => ({
                  ...(prev || {}),
                  id_lugar: null,
                  lugar_text: txt,
                }));
              }}
              onFocus={() => {
                setTLugar(true);
                if (!qLugar.trim()) loadDefaultsLugares();
              }}
              loading={loadingLugar}
              options={optLugares}
              getOptionLabel={(l) => l.desc_lugar ?? String(l.id_lugar)}
              allowCustom
              onCreateCustom={async (text) => {
                if (!value?.id_area) return;
                try {
                  const created = await crearLugar({ id_area: Number(value.id_area), desc_lugar: text });
                  onChange((prev) => ({
                    ...(prev || {}),
                    id_lugar: Number(created.id_lugar),
                    lugar_text: created.desc_lugar ?? text,
                  }));
                } catch {
                  // mantiene texto escrito si falla crear
                }
              }}
              onSelect={(l) => {
                onChange((prev) => ({
                  ...(prev || {}),
                  id_lugar: Number(l.id_lugar),
                  lugar_text: l.desc_lugar ?? "",
                }));
              }}
            />
          </Field>

          <Field label="Fecha de inspeccion">
            <input
              type="date"
              className="ins-input"
              value={value?.fecha_inspeccion ?? ""}
              onChange={(e) => setField("fecha_inspeccion", e.target.value)}
            />
          </Field>
        </div>

        {/* REALIZADO POR */}
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <b>Realizado por</b>
            <span className="help">Datos del usuario que está creando la inspección.</span>
          </div>

          {/* Datos del creador (solo nombre + cargo) */}
          <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 14 }}>
            <div className="ins-grid">
              <Field label="Nombre">
                <Input value={value?.realizado_por ?? ""} disabled />
              </Field>

              <Field label="Cargo">
                <Input value={value?.cargo ?? ""} disabled />
              </Field>
            </div>
          </div>

          {/* INSPECTORES / COLABORADORES */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
            <b>Inspectores</b>
            <Badge>{(value?.participantes?.length || 0) + 1} total</Badge>
            <span className="help">Incluye al realizado por + inspectores agregados.</span>
          </div>

          {/* Agregar inspector */}
          <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Agregar inspector</div>

            <div className="ins-grid">
              <Field label="Buscar (DNI / Apellido / Nombre)">
                <Autocomplete
                  placeholder="Escribe para buscar..."
                  displayValue={qColab}
                  onInputChange={setQColab}
                  onFocus={() => setTColab(true)}
                  loading={loadingColab}
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
