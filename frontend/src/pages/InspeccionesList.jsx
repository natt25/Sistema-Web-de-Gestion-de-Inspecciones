import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { listarInspecciones } from "../api/inspecciones.api";
import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Table from "../components/ui/Table";
import Badge from "../components/ui/Badge";
import Autocomplete from "../components/ui/Autocomplete";
import useLoadingWatchdog from "../hooks/useLoadingWatchdog";
import { listarPlantillas } from "../api/plantillas.api";
import {
  buscarAreas,
  buscarClientes,
  buscarLugares,
  buscarServicios,
} from "../api/busquedas.api";

function normalizeArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (payload?.ok === true && Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.recordset)) return payload.recordset;
  return [];
}

function toInputDate(value) {
  return value || "";
}

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getRangeDates(range, customDesde, customHasta) {
  const today = new Date();
  const end = formatDateISO(today);

  if (range === "custom") {
    return { desde: customDesde || "", hasta: customHasta || "" };
  }

  const from = new Date(today);
  if (range === "7d") from.setDate(from.getDate() - 7);
  if (range === "1m") from.setMonth(from.getMonth() - 1);
  if (range === "3m") from.setMonth(from.getMonth() - 3);
  if (range === "6m") from.setMonth(from.getMonth() - 6);
  if (range === "1y") from.setFullYear(from.getFullYear() - 1);
  return { desde: formatDateISO(from), hasta: end };
}

function formatDateOnly(raw) {
  if (!raw) return "-";
  const str = String(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toISOString().slice(0, 10);
}

function getEstadoVariant(nombreEstado) {
  const e = String(nombreEstado || "").toUpperCase().trim();
  if (!e) return "gray";
  if (e.includes("BORRADOR")) return "gray";
  if (e.includes("PENDIENTE")) return "yellow";
  if (e.includes("PROGRESO")) return "blue";
  if (e.includes("CERRADA") || e.includes("CERRADO") || e.includes("FINALIZ")) return "green";
  return "gray";
}

function getEstadoLabel(it) {
  return it?.estado_inspeccion || it?.nombre_estado_inspeccion || "-";
}

function getClienteLabel(item) {
  return item?.raz_social || item?.nombre || String(item?.id_cliente || "");
}

function getAreaLabel(item) {
  return item?.desc_area || String(item?.id_area || "");
}

function getLugarLabel(item) {
  return item?.desc_lugar || String(item?.id_lugar || "");
}

function getServicioLabel(item) {
  return item?.nombre_servicio || item?.nombre || String(item?.id_servicio || "");
}

const DEFAULT_ESTADOS = ["BORRADOR", "PENDIENTE", "EN PROGRESO", "CERRADA"];

function EstadoCompactDropdown({ value, options, onChange, getVariant }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onDocClick(e) {
      if (!e.target.closest?.(".estado-dd")) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const currentVariant = value === "ALL" ? "outline" : getVariant(value);

  return (
    <div className="estado-dd" style={{ position: "relative" }}>
      <button
        type="button"
        className="estado-dd-trigger"
        aria-label="Filtrar por estado"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`estado-dd-dot ${currentVariant}`} />
        <span className={`estado-dd-tri ${open ? "open" : ""}`} />
      </button>

      {open ? (
        <div className="estado-dd-menu">
          {options.map((op) => {
            const v = op;
            const variant = v === "ALL" ? "outline" : getVariant(v);
            return (
              <button
                key={v}
                type="button"
                className="estado-dd-item"
                onClick={() => {
                  onChange(v);
                  setOpen(false);
                }}
              >
                <Badge variant={variant}>{v}</Badge>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function InspeccionesList() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const plantillaId = params.get("plantilla");
  const plantillaIdNum = plantillaId ? Number(plantillaId) : null;

  const [filters, setFilters] = useState({
    id_cliente: "",
    cliente_text: "",
    id_area: "",
    area_text: "",
    id_lugar: "",
    lugar_text: "",
    id_servicio: "",
    servicio_text: "",
    range: "7d",
    desde: "",
    hasta: "",
  });
  const [estadoTabla, setEstadoTabla] = useState("ALL");
  const [clienteOptions, setClienteOptions] = useState([]);
  const [areaOptions, setAreaOptions] = useState([]);
  const [lugarOptions, setLugarOptions] = useState([]);
  const [servicioOptions, setServicioOptions] = useState([]);
  const [loadingCliente, setLoadingCliente] = useState(false);
  const [loadingArea, setLoadingArea] = useState(false);
  const [loadingLugar, setLoadingLugar] = useState(false);
  const [loadingServicio, setLoadingServicio] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [pageTitle, setPageTitle] = useState("Inspecciones");

  useLoadingWatchdog({
    loading,
    setLoading,
    setMessage: setError,
    label: "InspeccionesList.load",
    timeoutMs: 8000,
  });

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      try {
        setLoadingCliente(true);
        const data = await buscarClientes(filters.cliente_text || "");
        if (!alive) return;
        setClienteOptions(Array.isArray(data) ? data : []);
      } catch {
        if (alive) setClienteOptions([]);
      } finally {
        if (alive) setLoadingCliente(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [filters.cliente_text]);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      try {
        setLoadingArea(true);
        const data = await buscarAreas({ q: filters.area_text || "" });
        if (!alive) return;
        setAreaOptions(Array.isArray(data) ? data : []);
      } catch {
        if (alive) setAreaOptions([]);
      } finally {
        if (alive) setLoadingArea(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [filters.area_text]);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      if (!filters.id_area) {
        if (alive) setLugarOptions([]);
        return;
      }
      try {
        setLoadingLugar(true);
        const data = await buscarLugares({
          q: filters.lugar_text || "",
          id_area: filters.id_area,
        });
        if (!alive) return;
        setLugarOptions(Array.isArray(data) ? data : []);
      } catch {
        if (alive) setLugarOptions([]);
      } finally {
        if (alive) setLoadingLugar(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [filters.id_area, filters.lugar_text]);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      try {
        setLoadingServicio(true);
        const data = await buscarServicios(filters.servicio_text || "");
        if (!alive) return;
        setServicioOptions(Array.isArray(data) ? data : []);
      } catch {
        if (alive) setServicioOptions([]);
      } finally {
        if (alive) setLoadingServicio(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [filters.servicio_text]);

  const estadoOptions = useMemo(() => {
    const discovered = [...new Set(items.map((it) => String(getEstadoLabel(it) || "").trim()).filter(Boolean))];
    const merged = [...DEFAULT_ESTADOS, ...discovered.filter((v) => !DEFAULT_ESTADOS.includes(v.toUpperCase()))];
    return ["ALL", ...merged];
  }, [items]);

  const queryParams = useMemo(() => {
    const p = {};
    if (filters.id_cliente) p.id_cliente = filters.id_cliente;
    if (filters.id_area) p.id_area = Number(filters.id_area);
    if (filters.id_lugar) p.id_lugar = Number(filters.id_lugar);
    if (filters.id_servicio) p.id_servicio = filters.id_servicio;
    if (estadoTabla && estadoTabla !== "ALL") p.estado = estadoTabla;
    if (Number.isFinite(plantillaIdNum)) p.plantilla = plantillaIdNum;
    const { desde, hasta } = getRangeDates(filters.range, filters.desde, filters.hasta);
    if (desde) p.desde = desde;
    if (hasta) p.hasta = hasta;
    return p;
  }, [filters, estadoTabla, plantillaIdNum]);

  async function load() {
    try {
      setLoading(true);

      const payload = await listarInspecciones(queryParams);
      const list = normalizeArray(payload);
      setItems(list);

      if (Number.isFinite(plantillaIdNum) && list.length > 0) {
        const nombre = list[0]?.nombre_formato || "Inspecciones";
        const cod = String(list[0]?.codigo_formato ?? "").trim();
        const codigo = cod ? ` (${cod})` : "";
        setPageTitle(`${nombre}${codigo}`);
        return;
      }

      if (Number.isFinite(plantillaIdNum)) {
        const plantillas = await listarPlantillas();
        const p = plantillas.find((x) => Number(x?.id_plantilla_inspec) === plantillaIdNum);
        if (p) {
          setPageTitle(String(p.nombre_formato ?? "Inspecciones").trim());
        } else {
          setPageTitle(`Inspecciones (Plantilla ${plantillaIdNum})`);
        }
      } else {
        setPageTitle("Inspecciones");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [location.key, queryParams]);

  function onChange(e) {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  const columns = [
    { key: "id", label: "ID", render: (it) => it.id_inspeccion ?? "-" },
    {
      key: "fecha",
      label: "FECHA",
      render: (it) => formatDateOnly(it.fecha_inspeccion || it.created_at),
    },
    {
      key: "cliente",
      label: "CLIENTE",
      render: (it) => it.raz_social || it.otro_cliente_texto || "-",
    },
    { key: "area", label: "AREA", render: (it) => it.desc_area || "-" },
    {
      key: "servicio",
      label: "SERVICIO",
      render: (it) => it.nombre_servicio || it.servicio_detalle || it.otro_servicio_texto || "-",
    },
    {
      key: "estado",
      label: (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span>ESTADO</span>
          <EstadoCompactDropdown
            value={estadoTabla}
            options={estadoOptions}
            onChange={setEstadoTabla}
            getVariant={getEstadoVariant}
          />
        </div>
      ),
      render: (it) => {
        const label = getEstadoLabel(it);
        return <Badge variant={getEstadoVariant(label)}>{label}</Badge>;
      },
    },
    {
      key: "accion",
      label: "ACCIÓN",
      render: (it) => (
        <Link
          to={`/inspecciones/${it.id_inspeccion}`}
          style={{ color: "#f97316", textDecoration: "none", fontWeight: 900 }}
        >
          Ver detalle
        </Link>
      ),
    },
  ];

  return (
    <DashboardLayout title={pageTitle}>
      <Card title="Filtros">
        {Number.isFinite(plantillaIdNum) ? (
          <div style={{ marginBottom: 10 }}>
            <Badge>Filtrando por plantilla: {plantillaIdNum}</Badge>
          </div>
        ) : null}
        <div className="grid-cards filters-grid">
          <label className="ins-field">
            <span>Cliente</span>
            <Autocomplete
              placeholder="Todos"
              displayValue={filters.cliente_text}
              loading={loadingCliente}
              options={clienteOptions}
              getOptionLabel={getClienteLabel}
              onFocus={async () => {
                if (filters.cliente_text.trim()) return;
                setLoadingCliente(true);
                try {
                  const data = await buscarClientes("");
                  setClienteOptions(Array.isArray(data) ? data : []);
                } finally {
                  setLoadingCliente(false);
                }
              }}
              onInputChange={(txt) =>
                setFilters((prev) => ({
                  ...prev,
                  cliente_text: txt,
                  id_cliente: "",
                }))
              }
              onSelect={(c) =>
                setFilters((prev) => ({
                  ...prev,
                  id_cliente: String(c?.id_cliente ?? ""),
                  cliente_text: getClienteLabel(c),
                }))
              }
            />
          </label>

          <label className="ins-field">
            <span>Área</span>
            <Autocomplete
              placeholder="Todas"
              displayValue={filters.area_text}
              loading={loadingArea}
              options={areaOptions}
              getOptionLabel={getAreaLabel}
              onFocus={async () => {
                if (filters.area_text.trim()) return;
                setLoadingArea(true);
                try {
                  const data = await buscarAreas({ q: "" });
                  setAreaOptions(Array.isArray(data) ? data : []);
                } finally {
                  setLoadingArea(false);
                }
              }}
              onInputChange={(txt) =>
                setFilters((prev) => ({
                  ...prev,
                  area_text: txt,
                  id_area: "",
                  id_lugar: "",
                  lugar_text: "",
                }))
              }
              onSelect={(a) =>
                setFilters((prev) => ({
                  ...prev,
                  id_area: String(a?.id_area ?? ""),
                  area_text: getAreaLabel(a),
                  id_lugar: "",
                  lugar_text: "",
                }))
              }
            />
          </label>

          <label className="ins-field">
            <span>Lugar</span>
            <Autocomplete
              placeholder={filters.id_area ? "Todos" : "Selecciona área"}
              displayValue={filters.lugar_text}
              disabled={!filters.id_area}
              loading={loadingLugar}
              options={lugarOptions}
              getOptionLabel={getLugarLabel}
              onFocus={async () => {
                if (!filters.id_area || filters.lugar_text.trim()) return;
                setLoadingLugar(true);
                try {
                  const data = await buscarLugares({ q: "", id_area: filters.id_area });
                  setLugarOptions(Array.isArray(data) ? data : []);
                } finally {
                  setLoadingLugar(false);
                }
              }}
              onInputChange={(txt) =>
                setFilters((prev) => ({
                  ...prev,
                  lugar_text: txt,
                  id_lugar: "",
                }))
              }
              onSelect={(l) =>
                setFilters((prev) => ({
                  ...prev,
                  id_lugar: String(l?.id_lugar ?? ""),
                  lugar_text: getLugarLabel(l),
                }))
              }
            />
          </label>

          <label className="ins-field">
            <span>Servicio</span>
            <Autocomplete
              placeholder="Todos"
              displayValue={filters.servicio_text}
              loading={loadingServicio}
              options={servicioOptions}
              getOptionLabel={getServicioLabel}
              onFocus={async () => {
                if (filters.servicio_text.trim()) return;
                setLoadingServicio(true);
                try {
                  const data = await buscarServicios("");
                  setServicioOptions(Array.isArray(data) ? data : []);
                } finally {
                  setLoadingServicio(false);
                }
              }}
              onInputChange={(txt) =>
                setFilters((prev) => ({
                  ...prev,
                  servicio_text: txt,
                  id_servicio: "",
                }))
              }
              onSelect={(s) =>
                setFilters((prev) => ({
                  ...prev,
                  id_servicio: String(s?.id_servicio ?? ""),
                  servicio_text: getServicioLabel(s),
                }))
              }
            />
          </label>

          <label className="ins-field">
            <span>Rango</span>
            <select className="ins-input" name="range" value={filters.range} onChange={onChange}>
              <option value="7d">7 dias</option>
              <option value="1m">1 mes</option>
              <option value="3m">3 meses</option>
              <option value="6m">6 meses</option>
              <option value="1y">1 año</option>
              <option value="custom">Personalizado</option>
            </select>
          </label>

          {filters.range === "custom" ? (
            <>
              <Input label="desde" type="date" name="desde" value={toInputDate(filters.desde)} onChange={onChange} />
              <Input label="hasta" type="date" name="hasta" value={toInputDate(filters.hasta)} onChange={onChange} />
            </>
          ) : null}
        </div>
      </Card>

      <Card title="Listado">
        <Table columns={columns} data={items} emptyText={loading ? "Cargando..." : "Sin registros."} />
      </Card>
      {error ? (
        <div style={{ marginTop: 10 }}>
          <Badge variant="red">{error}</Badge>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
