import { useState, useRef, useEffect, useMemo, useCallback } from "react";
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

function buildNombreCreador(user) {
  const nombres = String(user?.nombres ?? "").trim();
  const apellidoPaterno = String(user?.apellido_paterno ?? "").trim();
  const apellidoMaterno = String(user?.apellido_materno ?? "").trim();
  const apellidos = String(user?.apellidos ?? "").trim();
  const nombre = String(user?.nombre ?? "").trim();
  const dni = String(user?.dni ?? "").trim();

  return (
    [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(" ").trim() ||
    [nombres, apellidos].filter(Boolean).join(" ").trim() ||
    nombre ||
    dni
  );
}

function normalizeClienteId(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeServicioId(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function getClienteLabel(cliente) {
  return cliente?.raz_social ?? cliente?.nombre ?? String(cliente?.id_cliente ?? "");
}

function getServicioLabel(servicio) {
  return (
    servicio?.nombre_servicio ??
    servicio?.nombre ??
    String(servicio?.id_servicio ?? "")
  );
}

function buildNombreCompletoEmpleado(e) {
  const apellidoPaterno = String(e?.apellido_paterno ?? "").trim();
  const apellidoMaterno = String(e?.apellido_materno ?? "").trim();
  const apellidos = String(e?.apellidos ?? "").trim();
  const nombres = String(e?.nombres ?? e?.nombre ?? "").trim();
  const dni = String(e?.dni ?? "").trim();

  return (
    [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(" ").trim() ||
    [nombres, apellidos].filter(Boolean).join(" ").trim() ||
    String(e?.nombre_completo ?? "").trim() ||
    dni ||
    "SIN NOMBRE"
  );
}

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

  const [dupMsg, setDupMsg] = useState("");

  const setField = useCallback(
    (k, v) => {
      onChange((prev) => {
        const base = prev || {};
        if (base[k] === v) return base;
        return { ...base, [k]: v };
      });
    },
    [onChange]
  );

  const applyHeaderUpdate = useCallback(
    (updater) => {
      onChange((prev) => {
        const base = prev || {};
        const next = updater(base);
        return next === base ? base : next;
      });
    },
    [onChange]
  );

  const userDefaults = useMemo(
    () => ({
      realizadoPor: buildNombreCreador(user),
      cargo: user?.cargo || "",
      firmaRuta: user?.firma_ruta || "",
    }),
    [
      user?.nombres,
      user?.apellido_paterno,
      user?.apellido_materno,
      user?.apellidos,
      user?.nombre,
      user?.dni,
      user?.cargo,
      user?.firma_ruta,
    ]
  );

  const canServicio = true;
  const canArea = true;
  const canLugar = Boolean(value?.id_area);

  const didInitRef = useRef(false);

  useEffect(() => {
    if (didInitRef.current) return;

    let touched = false;

    if (!value?.fecha_inspeccion) {
      setField("fecha_inspeccion", new Date().toISOString().slice(0, 10));
      touched = true;
    }

    if (userDefaults.realizadoPor && !value?.realizado_por) {
      setField("realizado_por", userDefaults.realizadoPor);
      touched = true;
    }
    if (userDefaults.cargo && !value?.cargo) {
      setField("cargo", userDefaults.cargo);
      touched = true;
    }
    if (userDefaults.firmaRuta && !value?.firma_ruta) {
      setField("firma_ruta", userDefaults.firmaRuta);
      touched = true;
    }

    if (
      touched ||
      value?.fecha_inspeccion ||
      value?.realizado_por ||
      value?.cargo ||
      value?.firma_ruta
    ) {
      didInitRef.current = true;
    }
  }, [
    setField,
    userDefaults.realizadoPor,
    userDefaults.cargo,
    userDefaults.firmaRuta,
    value?.fecha_inspeccion,
    value?.realizado_por,
    value?.cargo,
    value?.firma_ruta,
  ]);

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
    <Card title="Datos generales (FOR-014 / FOR-013)">
      <div style={{ display: "grid", gap: 14 }}>
        <div className="ins-grid">
          <Field label="Cliente / Unidad Minera">
            <Autocomplete
              placeholder="Escribe para buscar..."
              displayValue={value?.cliente_text ?? ""}
              onInputChange={(txt) => {
                setQCliente(txt);
                applyHeaderUpdate((prev) => ({
                  ...prev,
                  id_cliente: txt.trim() === "" ? null : prev.id_cliente,
                  cliente_text: txt,
                }));
              }}
              onFocus={() => {
                setTCliente(true);
                if (!qCliente.trim()) loadDefaultsClientes();
              }}
              loading={loadingCliente}
              options={optClientes}
              getOptionLabel={getClienteLabel}
              onSelect={(c) => {
                const nextIdCliente = normalizeClienteId(c?.id_cliente);
                const nextClienteText = getClienteLabel(c);
                setQCliente(nextClienteText);
                applyHeaderUpdate((prev) => ({
                  ...prev,
                  id_cliente: nextIdCliente,
                  cliente_text: nextClienteText,
                }));
                console.log("[InspeccionHeaderForm] cliente seleccionado", {
                  raw: c,
                  id_cliente: nextIdCliente,
                  cliente_text: nextClienteText,
                });
              }}
            />
          </Field>

          <Field label="Servicio">
            <Autocomplete
              placeholder="Escribe para buscar..."
              disabled={false}
              displayValue={value?.servicio_text ?? ""}
              onInputChange={(txt) => {
                setQServicio(txt);
                applyHeaderUpdate((prev) => ({
                  ...prev,
                  id_servicio: txt.trim() === "" ? null : prev.id_servicio,
                  servicio_text: txt,
                }));
              }}
              onFocus={() => {
                setTServicio(true);
                if (!qServicio.trim()) loadDefaultsServicios();
              }}
              loading={loadingServicio}
              options={optServicios}
              getOptionLabel={getServicioLabel}
              onSelect={(s) => {
                const nextIdServicio = normalizeServicioId(s?.id_servicio);
                const nextServicioText = getServicioLabel(s);
                setQServicio(nextServicioText);
                applyHeaderUpdate((prev) => ({
                  ...prev,
                  id_servicio: nextIdServicio,
                  servicio_text: nextServicioText,
                }));
                console.log("[InspeccionHeaderForm] servicio seleccionado", {
                  raw: s,
                  id_servicio: nextIdServicio,
                  servicio_text: nextServicioText,
                });
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
              placeholder="Escribe para buscar..."
              disabled={false}
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
                  if (!value?.id_cliente) {
                    alert("Primero debes seleccionar un Cliente / Unidad Minera para crear un área.");
                    return;
                  }
                  const created = await crearArea({
                    desc_area: text,
                    id_empresa: value?.id_cliente,
                  });
                  onChange((prev) => ({
                    ...(prev || {}),
                    id_area: Number(created.id_area),
                    area_text: created.desc_area ?? text,
                    id_lugar: null,
                    lugar_text: "",
                  }));
                } catch {}
              }}
              onSelect={(a) => {
                applyHeaderUpdate((prev) => ({
                  ...prev,
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
              placeholder={canLugar ? "Escribe para buscar..." : "Selecciona área primero"}
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
                  const created = await crearLugar({
                    id_area: Number(value.id_area),
                    desc_lugar: text,
                  });
                  onChange((prev) => ({
                    ...(prev || {}),
                    id_lugar: Number(created.id_lugar),
                    lugar_text: created.desc_lugar ?? text,
                  }));
                } catch {}
              }}
              onSelect={(l) => {
                applyHeaderUpdate((prev) => ({
                  ...prev,
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

        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <b>Realizado por</b>
            <span className="help">Incluye al creador + inspectores agregados.</span>
          </div>

          <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 14 }}>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombres y Apellidos completos</th>
                    <th>Cargo</th>
                    <th>Firma</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div style={{ display: "grid", gap: 6 }}>
                        <span>
                          <Badge className="badge-creator-header">
                            INSPECCION CREADA POR:
                          </Badge>
                        </span>
                        <span style={{ fontWeight: 800 }}>
                          {value?.realizado_por || "SIN NOMBRE"}
                        </span>
                      </div>
                    </td>

                    <td>{value?.cargo || "-"}</td>

                    <td>
                      {value?.firma_ruta ? (
                        <img
                          src={value.firma_ruta}
                          alt="Firma creador"
                          className="firma-img"
                        />
                      ) : (
                        "-"
                      )}
                    </td>

                    <td>-</td>
                  </tr>

                  {(value?.participantes || []).map((p, idx) => (
                    <tr key={`${p.dni || p.nombreCompleto || "p"}-${idx}`}>
                      <td>
                        <span style={{ fontWeight: 800 }}>
                          {p?.nombreCompleto || p?.nombre || p?.dni || "SIN NOMBRE"}
                        </span>
                      </td>

                      <td>{p?.cargo || "-"}</td>

                      <td>{p?.firma_url ? <img src={p.firma_url} alt="Firma inspector" className="firma-img" /> : "-"}</td>

                      <td>
                        <button
                          type="button"
                          className="menu-btn"
                          onClick={() => onRemoveParticipante?.(idx)}
                          style={{ width: 140 }}
                        >
                          Quitar inspector
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
            <Badge>{(value?.participantes?.length || 0) + 1} total</Badge>
            <span className="help">Creador + inspectores agregados.</span>
          </div>

          <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Agregar inspector</div>

            <div className="ins-grid">
              <Field label="Buscar (DNI / Apellido / Nombre)">
                <Autocomplete
                  placeholder="Escribe para buscar..."
                  displayValue={qColab}
                  onInputChange={(txt) => {
                    setDupMsg("");
                    setQColab(txt);
                  }}
                  onFocus={() => {
                    setDupMsg("");
                    setTColab(true);
                    if (!qColab.trim()) loadDefaultsColabs();
                  }}
                  loading={loadingColab}
                  options={optColabs}
                  getOptionLabel={(e) => {
                    const nom = buildNombreCompletoEmpleado(e);
                    const dni = String(e?.dni ?? "").trim();
                    const cargo = String(e?.cargo ?? "").trim();
                    return `${nom}${dni ? ` (${dni})` : ""}${cargo ? ` — ${cargo}` : ""}`.trim();
                  }}
                  onSelect={(e) => {
                    const dni = String(e.dni ?? "").trim();
                    const nombreCompleto = buildNombreCompletoEmpleado(e);
                    const cargo = e.cargo ?? "";
                    const firmaUrl = e.firma_url || e.firma_ruta || null;

                    const ya = (value?.participantes || []).some(
                      (x) => String(x?.dni ?? "").trim() === dni
                    );

                    if (dni && ya) {
                      setDupMsg("Ese inspector ya fue agregado. No se puede repetir.");
                      setQColab("");
                      setOptColabs([]);
                      return;
                    }

                    setDupMsg("");
                    onAddParticipante?.({
                      dni,
                      nombre: nombreCompleto,
                      nombreCompleto,
                      cargo,
                      firma_url: firmaUrl,
                    });
                    setQColab("");
                    setOptColabs([]);
                  }}
                />
              </Field>
            </div>
          </div>

          {dupMsg ? (
            <div style={{ marginTop: 8, color: "#b91c1c", fontWeight: 700 }}>
              {dupMsg}
            </div>
          ) : null}
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
